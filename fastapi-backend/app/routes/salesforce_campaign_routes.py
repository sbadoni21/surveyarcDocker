# ============================================
# SALESFORCE CAMPAIGN ROUTES
# app/routes/salesforce_campaign_routes.py
# ============================================

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Query
from sqlalchemy.orm import Session
from sqlalchemy import select
from typing import List, Optional
from datetime import datetime, timezone

from ..db import get_db
from ..services.salesforce_service import SalesforceService
from ..services.salesforce_contact_sync_service import sync_salesforce_contact_to_internal
from ..models.campaigns import Campaign, CampaignChannel, CampaignStatus
from ..models.contact import ContactList, Contact, list_members
from ..schemas.campaign import CampaignSendRequest
from ..schemas.salesforce_campaign import (
    SalesforceCampaignCreate,
    SalesforceContactSummary,
    SalesforceCampaignPreview,
    SalesforceAccountToListRequest,
    SalesforceAccountsToListsRequest
)
from ..services.campaign_sender_service import process_campaign_batch
from ..policies.auth import get_current_user
from ..utils.id_generator import generate_id

router = APIRouter(prefix="/salesforce-campaigns", tags=["Salesforce Campaigns"])


# ============================================
# PREVIEW CAMPAIGN RECIPIENTS
# ============================================

@router.post("/preview", response_model=SalesforceCampaignPreview)
def preview_salesforce_campaign(
    data: SalesforceCampaignCreate,
    current_user: dict = Depends(get_current_user)
):
    """Preview who will receive the campaign without actually creating it"""
    
    user_org_id = current_user.get("org_id")
    if data.org_id != user_org_id:
        raise HTTPException(
            status_code=403,
            detail="Cannot preview campaign for different organization"
        )
    
    # Fetch Salesforce contacts
    sf_contacts = []
    
    if data.salesforce_account_id:
        try:
            account_data = SalesforceService.get_account_with_contacts(
                data.salesforce_account_id
            )
            sf_contacts = account_data.get("contacts", [])
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to fetch Salesforce account contacts: {str(e)}"
            )
    
    elif data.salesforce_contact_ids:
        try:
            for contact_id in data.salesforce_contact_ids:
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
    
    # Separate valid and invalid contacts
    valid_contacts = []
    invalid_contacts = []
    
    for sf_contact in sf_contacts:
        email = sf_contact.get("email") or sf_contact.get("Email")
        
        if not email:
            invalid_contacts.append({
                "id": sf_contact.get("id") or sf_contact.get("Id"),
                "name": f"{sf_contact.get('firstName', '')} {sf_contact.get('lastName', '')}".strip(),
                "reason": "No email address"
            })
            continue
        
        valid_contacts.append(
            SalesforceContactSummary(
                id=sf_contact.get("id") or sf_contact.get("Id"),
                name=f"{sf_contact.get('firstName', '')} {sf_contact.get('lastName', '')}".strip(),
                email=email,
                account_name=sf_contact.get("accountName")
            )
        )
    
    return SalesforceCampaignPreview(
        total_recipients=len(valid_contacts),
        contacts=valid_contacts[:50],
        invalid_contacts=invalid_contacts
    )


# ============================================
# CREATE AND SEND CAMPAIGN
# ============================================

@router.post("/create-and-send")
def create_and_send_salesforce_campaign(
    data: SalesforceCampaignCreate,
    send_request: CampaignSendRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Create campaign and send to Salesforce contacts
    
    Flow:
    1. Fetch contacts from Salesforce
    2. Sync to internal Contact records
    3. Create/update ContactList (using Account name)
    4. Add contacts to list
    5. Create Campaign (using contact_list_id)
    6. Create CampaignResults
    7. Queue for sending
    """
    
    user_org_id = current_user.get("org_id")
    if data.org_id != user_org_id:
        raise HTTPException(
            status_code=403,
            detail="Cannot create campaign for different organization"
        )
    
    # Step 1: Fetch Salesforce contacts
    sf_contacts = []
    
    if data.salesforce_account_id:
        try:
            account_data = SalesforceService.get_account_with_contacts(
                data.salesforce_account_id
            )
            sf_contacts = account_data.get("contacts", [])
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to fetch Salesforce account contacts: {str(e)}"
            )
    
    elif data.salesforce_contact_ids:
        try:
            for contact_id in data.salesforce_contact_ids:
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
        raise HTTPException(
            status_code=400,
            detail="No contacts found in Salesforce"
        )
    
    # Step 2: Sync to internal contacts
    internal_contact_ids = []
    
    for sf_contact in sf_contacts:
        email = sf_contact.get("email") or sf_contact.get("Email")
        
        if not email:
            continue
        
        try:
            contact = sync_salesforce_contact_to_internal(sf_contact, data.org_id, db)
            internal_contact_ids.append(contact.contact_id)
        except Exception as e:
            print(f"Warning: Failed to sync contact {sf_contact.get('id')}: {e}")
            continue
    
    if not internal_contact_ids:
        raise HTTPException(
            status_code=400,
            detail="No valid contacts with email addresses found"
        )
    
    # Step 3: Create or get ContactList (using Salesforce Account name)
    if data.salesforce_account_id:
        try:
            account_data = SalesforceService.get_account_with_contacts(data.salesforce_account_id)
            account = account_data.get("account", {})
            account_name = account.get("name", "Unknown Account")
            
            list_name = account_name
            
            list_metadata = {
                "salesforce_account_id": data.salesforce_account_id,
                "salesforce_account_type": account.get("type"),
                "salesforce_website": account.get("website"),
                "salesforce_phone": account.get("phone"),
                "source": "salesforce"
            }
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to fetch Salesforce account details: {str(e)}"
            )
    else:
        list_name = f"Salesforce Contacts - {data.campaign_name}"
        list_metadata = {
            "source": "salesforce",
            "contact_ids": data.salesforce_contact_ids
        }
    
    # Check if list exists
    contact_list = None
    
    if data.salesforce_account_id:
        existing_lists = db.query(ContactList).filter(
            ContactList.org_id == data.org_id,
            ContactList.list_name == list_name
        ).all()
        
        for lst in existing_lists:
            if lst.meta_data and lst.meta_data.get("salesforce_account_id") == data.salesforce_account_id:
                contact_list = lst
                break
    
    if not contact_list:
        contact_list = ContactList(
            list_id=generate_id(),
            org_id=data.org_id,
            list_name=list_name,
            status="active",
            meta_data=list_metadata
        )
        db.add(contact_list)
        db.flush()
        print(f"✅ Created new contact list: '{list_name}' ({contact_list.list_id})")
    else:
        print(f"✅ Using existing contact list: '{list_name}' ({contact_list.list_id})")
    
    # Step 4: Add contacts to list
    added_count = 0
    for contact_id in internal_contact_ids:
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
    
    db.flush()
    print(f"✅ Added {added_count} contacts to list (total: {len(internal_contact_ids)})")
    
    # Step 5: Create Campaign
    campaign = Campaign(
        campaign_id=generate_id(),
        org_id=data.org_id,
        user_id=data.user_id,
        survey_id=data.survey_id,
        campaign_name=data.campaign_name,
        channel=CampaignChannel(data.channel),
        contact_list_id=contact_list.list_id,
        email_subject=data.email_subject,
        email_body_html=data.email_body_html,
        email_from_name=data.email_from_name,
        email_reply_to=data.email_reply_to,
        contact_filters=data.contact_filters,
        status="draft",
        meta_data={
            "source": "salesforce",
            "salesforce_account_id": data.salesforce_account_id,
            "salesforce_contact_count": len(sf_contacts),
            "list_name": list_name
        }
    )
    
    db.add(campaign)
    db.commit()
    db.refresh(campaign)
    
    # Step 6: Get contacts and create campaign results
    contacts = db.query(Contact).join(
        list_members,
        list_members.c.contact_id == Contact.contact_id
    ).filter(
        list_members.c.list_id == contact_list.list_id,
        Contact.status == "active"
    ).all()
    
    from ..services.campaign_sender_service import create_campaign_results
    
    results_created = create_campaign_results(db, campaign, contacts)
    
    if results_created == 0:
        raise HTTPException(
            status_code=400,
            detail="No valid recipients found"
        )
    
    # Step 7: Update campaign and queue
    campaign.total_recipients = results_created
    
    if send_request.send_immediately:
        campaign.status = CampaignStatus.sending
        campaign.started_at = datetime.now(timezone.utc)
        
        db.commit()
        
        background_tasks.add_task(process_campaign_batch, campaign.campaign_id, batch_size=100)
        
        return {
            "success": True,
            "message": "Campaign queued for sending",
            "campaign_id": campaign.campaign_id,
            "contact_list_id": contact_list.list_id,
            "list_name": list_name,
            "total_recipients": results_created,
            "salesforce_contacts": len(sf_contacts),
            "synced_contacts": len(internal_contact_ids),
            "new_contacts_in_list": added_count
        }
    else:
        campaign.status = CampaignStatus.scheduled
        campaign.scheduled_at = send_request.scheduled_at
        
        db.commit()
        
        return {
            "success": True,
            "message": "Campaign scheduled",
            "campaign_id": campaign.campaign_id,
            "contact_list_id": contact_list.list_id,
            "list_name": list_name,
            "scheduled_at": send_request.scheduled_at.isoformat(),
            "total_recipients": results_created,
            "salesforce_contacts": len(sf_contacts),
            "synced_contacts": len(internal_contact_ids),
            "new_contacts_in_list": added_count
        }


# ============================================
# BULK SEND TO ACCOUNTS
# ============================================

@router.post("/bulk-send-to-accounts")
def bulk_send_to_salesforce_accounts(
    account_ids: List[str],
    campaign_template: SalesforceCampaignCreate,
    send_immediately: bool = True,
    background_tasks: BackgroundTasks = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Create and send campaigns to multiple Salesforce accounts"""
    
    user_org_id = current_user.get("org_id")
    if campaign_template.org_id != user_org_id:
        raise HTTPException(
            status_code=403,
            detail="Cannot create campaign for different organization"
        )
    
    results = []
    
    for account_id in account_ids:
        try:
            account_data = SalesforceService.get_account_with_contacts(account_id)
            account = account_data.get("account", {})
            contacts = account_data.get("contacts", [])
            
            if not contacts:
                results.append({
                    "account_id": account_id,
                    "account_name": account.get("name", "Unknown"),
                    "success": False,
                    "error": "No contacts found"
                })
                continue
            
            campaign_data = campaign_template.copy()
            campaign_data.campaign_name = f"{campaign_template.campaign_name} - {account.get('name', account_id)}"
            campaign_data.salesforce_account_id = account_id
            
            send_request = CampaignSendRequest(
                send_immediately=send_immediately
            )
            
            result = create_and_send_salesforce_campaign(
                data=campaign_data,
                send_request=send_request,
                background_tasks=background_tasks,
                db=db,
                current_user=current_user
            )
            
            results.append({
                "account_id": account_id,
                "account_name": account.get("name", "Unknown"),
                "success": True,
                "campaign_id": result["campaign_id"],
                "recipients": result["total_recipients"]
            })
            
        except Exception as e:
            results.append({
                "account_id": account_id,
                "success": False,
                "error": str(e)
            })
    
    return {
        "total_accounts": len(account_ids),
        "successful": sum(1 for r in results if r["success"]),
        "failed": sum(1 for r in results if not r["success"]),
        "results": results
    }