# ============================================
# SALESFORCE SYNC ROUTES
# app/routes/salesforce_sync_routes.py
# ============================================

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select
from typing import List
from datetime import datetime, timezone

from ..db import get_db
from ..services.salesforce_service import SalesforceService
from ..services.salesforce_contact_sync_service import sync_salesforce_contact_to_internal
from ..models.contact import ContactList, Contact, list_members
from ..schemas.salesforce_campaign import (
    SalesforceSyncRequest,
    SalesforceSyncResult,
    SalesforceAccountToListRequest,
    SalesforceAccountsToListsRequest
)
from ..policies.auth import get_current_user
from ..utils.id_generator import generate_id

router = APIRouter(prefix="/salesforce-campaigns", tags=["Salesforce Sync"])


# ============================================
# SYNC CONTACTS
# ============================================

@router.post("/sync", response_model=SalesforceSyncResult)
def sync_salesforce_contacts(
    sync_request: SalesforceSyncRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Sync Salesforce contacts to internal database
    
    - Creates new contacts if they don't exist
    - Updates existing contacts with latest Salesforce data
    - Links existing contacts (by email) to Salesforce IDs
    """
    
    org_id = current_user.get("org_id")
    
    # Fetch Salesforce contacts
    sf_contacts = []
    
    if sync_request.account_id:
        try:
            account_data = SalesforceService.get_account_with_contacts(
                sync_request.account_id
            )
            sf_contacts = account_data.get("contacts", [])
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to fetch Salesforce account contacts: {str(e)}"
            )
    
    elif sync_request.contact_ids:
        try:
            for contact_id in sync_request.contact_ids:
                contact = SalesforceService.get_contact_by_id(contact_id)
                if contact:
                    sf_contacts.append(contact)
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to fetch Salesforce contacts: {str(e)}"
            )
    
    elif sync_request.sync_all:
        try:
            sf_contacts = SalesforceService.get_contacts_from_apex(limit=500)
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to fetch all Salesforce contacts: {str(e)}"
            )
    
    else:
        raise HTTPException(
            status_code=400,
            detail="Must specify account_id, contact_ids, or sync_all=true"
        )
    
    if not sf_contacts:
        return SalesforceSyncResult(
            total_synced=0,
            created=0,
            updated=0,
            linked=0,
            failed=0,
            details=[]
        )
    
    # Sync each contact
    created_count = 0
    updated_count = 0
    linked_count = 0
    failed_count = 0
    details = []
    
    for sf_contact in sf_contacts:
        try:
            sf_id = sf_contact.get("id") or sf_contact.get("Id")
            email = sf_contact.get("email") or sf_contact.get("Email")
            name = f"{sf_contact.get('firstName', '')} {sf_contact.get('lastName', '')}".strip()
            
            if not email:
                failed_count += 1
                details.append({
                    "salesforce_id": sf_id,
                    "name": name,
                    "status": "failed",
                    "reason": "No email address"
                })
                continue
            
            # Check if contact existed before
            existing_by_sf_id = db.query(Contact).filter(
                Contact.salesforce_id == sf_id,
                Contact.org_id == org_id
            ).first()
            
            existed_before = existing_by_sf_id is not None
            
            # Sync contact
            contact = sync_salesforce_contact_to_internal(sf_contact, org_id, db)
            
            # Determine what happened
            if not existed_before:
                if contact.meta_data and contact.meta_data.get("salesforce_linked_at"):
                    linked_count += 1
                    status = "linked"
                else:
                    created_count += 1
                    status = "created"
            else:
                updated_count += 1
                status = "updated"
            
            details.append({
                "salesforce_id": sf_id,
                "contact_id": contact.contact_id,
                "name": name,
                "email": email,
                "status": status
            })
            
        except Exception as e:
            failed_count += 1
            details.append({
                "salesforce_id": sf_contact.get("id"),
                "status": "failed",
                "reason": str(e)
            })
    
    db.commit()
    
    return SalesforceSyncResult(
        total_synced=created_count + updated_count + linked_count,
        created=created_count,
        updated=updated_count,
        linked=linked_count,
        failed=failed_count,
        details=details[:100]
    )


@router.get("/sync-status")
def get_salesforce_sync_status(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get status of Salesforce sync"""
    
    org_id = current_user.get("org_id")
    
    total_contacts = db.query(Contact).filter(
        Contact.org_id == org_id,
        Contact.deleted_at.is_(None)
    ).count()
    
    synced_contacts = db.query(Contact).filter(
        Contact.org_id == org_id,
        Contact.salesforce_id.isnot(None),
        Contact.deleted_at.is_(None)
    ).count()
    
    return {
        "total_contacts": total_contacts,
        "salesforce_synced": synced_contacts,
        "not_synced": total_contacts - synced_contacts,
        "sync_percentage": round((synced_contacts / total_contacts * 100), 2) if total_contacts > 0 else 0
    }


# ============================================
# ADD TO EXISTING LIST
# ============================================

@router.post("/add-to-list")
def add_salesforce_contacts_to_list(
    list_id: str,
    salesforce_account_id: str = None,
    salesforce_contact_ids: List[str] = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Sync Salesforce contacts and add them to an existing contact list"""
    
    org_id = current_user.get("org_id")
    
    # Validate list exists
    contact_list = db.query(ContactList).filter(
        ContactList.list_id == list_id,
        ContactList.org_id == org_id
    ).first()
    
    if not contact_list:
        raise HTTPException(status_code=404, detail="Contact list not found")
    
    # Fetch Salesforce contacts
    sf_contacts = []
    
    if salesforce_account_id:
        try:
            account_data = SalesforceService.get_account_with_contacts(salesforce_account_id)
            sf_contacts = account_data.get("contacts", [])
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to fetch Salesforce account contacts: {str(e)}"
            )
    
    elif salesforce_contact_ids:
        try:
            for contact_id in salesforce_contact_ids:
                contact = SalesforceService.get_contact_by_id(contact_id)
                if contact:
                    sf_contacts.append(contact)
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to fetch Salesforce contacts: {str(e)}"
            )
    
    else:
        raise HTTPException(
            status_code=400,
            detail="Either salesforce_account_id or salesforce_contact_ids required"
        )
    
    if not sf_contacts:
        return {
            "success": True,
            "message": "No contacts found in Salesforce",
            "added": 0,
            "skipped": 0
        }
    
    # Sync contacts and add to list
    added_count = 0
    skipped_count = 0
    
    for sf_contact in sf_contacts:
        email = sf_contact.get("email") or sf_contact.get("Email")
        
        if not email:
            skipped_count += 1
            continue
        
        try:
            contact = sync_salesforce_contact_to_internal(sf_contact, org_id, db)
            
            # Check if already in list
            existing = db.execute(
                select(list_members).where(
                    (list_members.c.list_id == list_id) &
                    (list_members.c.contact_id == contact.contact_id)
                )
            ).first()
            
            if not existing:
                db.execute(
                    list_members.insert().values(
                        list_id=list_id,
                        contact_id=contact.contact_id
                    )
                )
                added_count += 1
            else:
                skipped_count += 1
                
        except Exception as e:
            print(f"Warning: Failed to sync contact {sf_contact.get('id')}: {e}")
            skipped_count += 1
            continue
    
    db.commit()
    
    total_in_list = db.execute(
        select(list_members).where(list_members.c.list_id == list_id)
    ).rowcount
    
    return {
        "success": True,
        "message": f"Added {added_count} contacts to list",
        "list_id": list_id,
        "list_name": contact_list.list_name,
        "salesforce_contacts_found": len(sf_contacts),
        "added": added_count,
        "skipped": skipped_count,
        "total_in_list": total_in_list
    }


# ============================================
# SYNC ACCOUNTS AS LISTS
# ============================================

@router.post("/sync-account-as-list")
def sync_salesforce_account_as_list(
    request: SalesforceAccountToListRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Sync a Salesforce Account as a Contact List
    - List name = Salesforce Account name
    - Syncs all contacts under that account
    """
    
    org_id = current_user.get("org_id")
    
    # Fetch Salesforce account and contacts
    try:
        account_data = SalesforceService.get_account_with_contacts(request.account_id)
        account = account_data.get("account", {})
        sf_contacts = account_data.get("contacts", [])
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch Salesforce account: {str(e)}"
        )
    
    account_name = account.get("name", "Unknown Account")
    
    # Check if list already exists
    existing_lists = db.query(ContactList).filter(
        ContactList.org_id == org_id,
        ContactList.list_name == account_name
    ).all()
    
    contact_list = None
    for lst in existing_lists:
        if lst.meta_data and lst.meta_data.get("salesforce_account_id") == request.account_id:
            contact_list = lst
            break
    
    list_metadata = {
        "salesforce_account_id": request.account_id,
        "salesforce_account_type": account.get("type"),
        "salesforce_website": account.get("website"),
        "salesforce_phone": account.get("phone"),
        "source": "salesforce",
        "last_synced_at": datetime.now(timezone.utc).isoformat()
    }
    
    if not contact_list:
        contact_list = ContactList(
            list_id=generate_id(),
            org_id=org_id,
            list_name=account_name,
            status="active",
            meta_data=list_metadata
        )
        db.add(contact_list)
        db.flush()
        print(f"✅ Created list '{account_name}'")
        was_created = True
    else:
        contact_list.meta_data = list_metadata
        db.flush()
        print(f"✅ Updating list '{account_name}'")
        was_created = False
    
    # Sync contacts
    synced_contact_ids = []
    failed_count = 0
    
    for sf_contact in sf_contacts:
        email = sf_contact.get("email") or sf_contact.get("Email")
        
        if not email:
            failed_count += 1
            continue
        
        try:
            contact = sync_salesforce_contact_to_internal(sf_contact, org_id, db)
            synced_contact_ids.append(contact.contact_id)
        except Exception as e:
            print(f"Warning: Failed to sync contact {sf_contact.get('id')}: {e}")
            failed_count += 1
    
    # Add contacts to list
    added_count = 0
    existing_count = 0
    
    for contact_id in synced_contact_ids:
        existing = db.execute(
            select(list_members).where(
                (list_members.c.list_id == contact_list.list_id) &
                (list_members.c.contact_id == contact_id)
            )
        ).first()
        
        if not existing:
            db.execute(
                list_members.insert().values(
                    list_id=contact_list.list_id,
                    contact_id=contact_id
                )
            )
            added_count += 1
        else:
            existing_count += 1
    
    db.commit()
    
    total_in_list = db.execute(
        select(list_members).where(list_members.c.list_id == contact_list.list_id)
    ).rowcount
    
    return {
        "success": True,
        "list_id": contact_list.list_id,
        "list_name": account_name,
        "salesforce_account_id": request.account_id,
        "list_created": was_created,
        "account_details": {
            "name": account_name,
            "type": account.get("type"),
            "website": account.get("website"),
            "phone": account.get("phone")
        },
        "sync_summary": {
            "salesforce_contacts_found": len(sf_contacts),
            "contacts_synced": len(synced_contact_ids),
            "added_to_list": added_count,
            "already_in_list": existing_count,
            "failed": failed_count,
            "total_in_list": total_in_list
        }
    }


@router.post("/sync-accounts-as-lists")
def sync_salesforce_accounts_as_lists(
    request: SalesforceAccountsToListsRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Sync multiple Salesforce Accounts as Contact Lists"""
    
    results = []
    
    for account_id in request.account_ids:
        try:
            result = sync_salesforce_account_as_list(
                SalesforceAccountToListRequest(account_id=account_id),
                db,
                current_user
            )
            results.append({
                "account_id": account_id,
                "success": True,
                **result
            })
        except Exception as e:
            results.append({
                "account_id": account_id,
                "success": False,
                "error": str(e)
            })
    
    return {
        "total_accounts": len(request.account_ids),
        "successful": sum(1 for r in results if r["success"]),
        "failed": sum(1 for r in results if not r["success"]),
        "results": results
    }


@router.get("/salesforce-accounts")
def list_salesforce_accounts(
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """Get list of all Salesforce accounts"""
    
    try:
        accounts = SalesforceService.get_accounts_from_apex(limit=limit)
        
        return {
            "total": len(accounts),
            "accounts": [
                {
                    "id": acc.get("id"),
                    "name": acc.get("name"),
                    "type": acc.get("type"),
                    "website": acc.get("website"),
                    "phone": acc.get("phone")
                }
                for acc in accounts
            ]
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch Salesforce accounts: {str(e)}"
        )