# ============================================
# SALESFORCE CONTACT SYNC SERVICE
# app/services/salesforce_contact_sync_service.py
# ============================================

from sqlalchemy.orm import Session
from datetime import datetime, timezone
from typing import Dict

from ..models.contact import Contact, ContactEmail, ContactType
from ..utils.id_generator import generate_id


def sync_salesforce_contact_to_internal(sf_contact: Dict, org_id: str, session: Session) -> Contact:
    """
    Sync Salesforce contact with internal database
    
    Logic:
    1. Check if contact exists by Salesforce ID
    2. If not, check if contact exists by email
    3. If found, update with Salesforce data
    4. If not found, create new contact
    5. Always update email to latest from Salesforce
    
    Returns: Internal Contact object
    """
    
    sf_id = sf_contact.get("id") or sf_contact.get("Id")
    first_name = sf_contact.get("firstName") or sf_contact.get("FirstName") or ""
    last_name = sf_contact.get("lastName") or sf_contact.get("LastName") or ""
    email = sf_contact.get("email") or sf_contact.get("Email")
    account_name = sf_contact.get("accountName")
    
    name = f"{first_name} {last_name}".strip() or "Unknown"
    
    if not email:
        raise ValueError(f"Contact {sf_id} has no email address")
    
    # ============================================
    # STEP 1: Try to find existing contact by Salesforce ID
    # ============================================
    existing_contact = session.query(Contact).filter(
        Contact.salesforce_id == sf_id,
        Contact.org_id == org_id,
        Contact.deleted_at.is_(None)
    ).first()
    
    if existing_contact:
        print(f"✅ Found existing contact by SF ID: {existing_contact.contact_id}")
        
        # Update contact details from Salesforce
        existing_contact.name = name
        existing_contact.updated_at = datetime.now(timezone.utc)
        
        # Update metadata
        if not existing_contact.meta_data:
            existing_contact.meta_data = {}
        
        existing_contact.meta_data["salesforce_synced_at"] = datetime.now(timezone.utc).isoformat()
        existing_contact.meta_data["salesforce_account_name"] = account_name
        
        # Update/add email
        _sync_contact_email(existing_contact, email, org_id, session)
        
        session.flush()
        return existing_contact
    
    # ============================================
    # STEP 2: Try to find existing contact by email
    # ============================================
    email_record = session.query(ContactEmail).filter(
        ContactEmail.email == email,
        ContactEmail.org_id == org_id,
        ContactEmail.status == "active"
    ).first()
    
    if email_record:
        existing_contact = session.query(Contact).filter(
            Contact.contact_id == email_record.contact_id,
            Contact.org_id == org_id,
            Contact.deleted_at.is_(None)
        ).first()
        
        if existing_contact:
            print(f"✅ Found existing contact by email: {existing_contact.contact_id}")
            
            # Link Salesforce ID to existing contact
            existing_contact.salesforce_id = sf_id
            existing_contact.name = name  # Update name from Salesforce
            existing_contact.updated_at = datetime.now(timezone.utc)
            
            # Update metadata
            if not existing_contact.meta_data:
                existing_contact.meta_data = {}
            
            existing_contact.meta_data["salesforce_synced_at"] = datetime.now(timezone.utc).isoformat()
            existing_contact.meta_data["salesforce_account_name"] = account_name
            existing_contact.meta_data["salesforce_linked_at"] = datetime.now(timezone.utc).isoformat()
            
            session.flush()
            return existing_contact
    
    # ============================================
    # STEP 3: Create new contact
    # ============================================
    print(f"🆕 Creating new contact from Salesforce: {name}")
    
    new_contact = Contact(
        contact_id=generate_id(),
        org_id=org_id,
        name=name,
        contact_type=ContactType.person,
        salesforce_id=sf_id,
        primary_identifier=email,
        status="active",
        created_at=datetime.now(timezone.utc),
        meta_data={
            "source": "salesforce",
            "salesforce_synced_at": datetime.now(timezone.utc).isoformat(),
            "salesforce_account_name": account_name
        }
    )
    
    session.add(new_contact)
    session.flush()
    
    # Add email
    contact_email = ContactEmail(
        email_id=generate_id(),
        contact_id=new_contact.contact_id,
        org_id=org_id,
        email=email,
        email_type="work",
        is_primary=True,
        status="active"
    )
    session.add(contact_email)
    
    session.flush()
    return new_contact


def _sync_contact_email(contact: Contact, email: str, org_id: str, session: Session):
    """
    Sync email address for existing contact
    Updates if different, or adds if not present
    """
    
    # Check if email already exists for this contact
    existing_email = session.query(ContactEmail).filter(
        ContactEmail.contact_id == contact.contact_id,
        ContactEmail.email == email,
        ContactEmail.status == "active"
    ).first()
    
    if existing_email:
        # Email already exists and is active
        if not existing_email.is_primary:
            # Make it primary if it's not
            existing_email.is_primary = True
        return
    
    # Check if contact has a different primary email
    current_primary = session.query(ContactEmail).filter(
        ContactEmail.contact_id == contact.contact_id,
        ContactEmail.is_primary == True,
        ContactEmail.status == "active"
    ).first()
    
    if current_primary:
        if current_primary.email != email:
            # Salesforce email is different - demote old primary, add new one
            print(f"   📧 Updating email: {current_primary.email} → {email}")
            current_primary.is_primary = False
            
            # Add new email as primary
            new_email = ContactEmail(
                email_id=generate_id(),
                contact_id=contact.contact_id,
                org_id=org_id,
                email=email,
                email_type="work",
                is_primary=True,
                status="active"
            )
            session.add(new_email)
    else:
        # No primary email exists, add this one
        new_email = ContactEmail(
            email_id=generate_id(),
            contact_id=contact.contact_id,
            org_id=org_id,
            email=email,
            email_type="work",
            is_primary=True,
            status="active"
        )
        session.add(new_email)