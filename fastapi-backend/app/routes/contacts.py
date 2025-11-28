from fastapi import APIRouter, Depends, HTTPException, Body, UploadFile, File
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import select, or_, and_
from uuid import uuid4
from typing import List, Optional
import csv
import io

from ..db import get_db
from ..models.contact import Contact, ContactEmail, ContactPhone, ContactSocial, ContactList, list_members, ContactType
from ..schemas.contact import ContactCreate, ContactOut, ContactUpdate

router = APIRouter(
    prefix="/contacts",
    tags=["contacts"]
)


def find_existing_contact(db: Session, org_id: str, contact_data: ContactCreate):
    """
    Find existing contact by matching email, phone, or social media
    Returns contact_id if found, None otherwise
    """
    conditions = []
    
    # Check if any email exists in ContactEmail table
    if contact_data.emails:
        for email_data in contact_data.emails:
            email_subquery = db.query(ContactEmail.contact_id).filter(
                ContactEmail.email_lower == email_data.email.lower()
            ).subquery()
            conditions.append(Contact.contact_id.in_(email_subquery))
    
    # Check if any phone exists in ContactPhone table
    if contact_data.phones:
        for phone_data in contact_data.phones:
            phone_subquery = db.query(ContactPhone.contact_id).filter(
                ContactPhone.phone_number == phone_data.phone_number,
                ContactPhone.country_code == (phone_data.country_code or "")
            ).subquery()
            conditions.append(Contact.contact_id.in_(phone_subquery))
    
    # Check if any social media handle exists in ContactSocial table
    if contact_data.socials:
        for social_data in contact_data.socials:
            if social_data.platform and social_data.handle:
                social_subquery = db.query(ContactSocial.contact_id).filter(
                    ContactSocial.platform == social_data.platform,
                    ContactSocial.handle == social_data.handle
                ).subquery()
                conditions.append(Contact.contact_id.in_(social_subquery))
    
    # If no conditions, can't find duplicate
    if not conditions:
        return None
    
    # Find contact that matches ANY of these conditions
    query = db.query(Contact).filter(
        Contact.org_id == org_id,
        or_(*conditions)
    )
    
    existing = query.first()
    
    return existing.contact_id if existing else None


def create_or_get_contact(db: Session, contact_data: ContactCreate, list_id: Optional[str] = None):
    """
    Create a new contact or return existing contact_id if duplicate found
    Optionally associate with a list
    """
    # Check for existing contact using comprehensive matching
    existing_id = find_existing_contact(db, contact_data.org_id, contact_data)
    
    if existing_id:
        print(f"✅ Found existing contact: {existing_id}")
        
        # Add to list if list_id provided
        if list_id:
            stmt = select(list_members).where(
                (list_members.c.list_id == list_id) & 
                (list_members.c.contact_id == existing_id)
            )
            existing_member = db.execute(stmt).first()
            
            if not existing_member:
                db.execute(list_members.insert().values(
                    list_id=list_id,
                    contact_id=existing_id
                ))
                db.flush()
                print(f"✅ Added existing contact {existing_id} to list {list_id}")
            else:
                print(f"ℹ️ Contact {existing_id} already in list {list_id}")
        
        return existing_id, False  # False = not newly created
    
    # Create new contact (rest of the function remains the same)
    contact_id = contact_data.contact_id or str(uuid4())
    
    new_contact = Contact(
        contact_id=contact_id,
        org_id=contact_data.org_id,
        user_id=contact_data.user_id,
        name=contact_data.name or "",
        contact_type=contact_data.contact_type,
        primary_identifier=contact_data.primary_identifier,
        status=contact_data.status or "active",
        meta=contact_data.meta or {}
    )
    
    db.add(new_contact)
    db.flush()
    
    # Add emails (deduplicate first)
    unique_emails = {}
    for email_data in (contact_data.emails or []):
        email_lower = email_data.email.lower()
        if email_lower not in unique_emails:
            unique_emails[email_lower] = email_data
    
    for email_data in unique_emails.values():
        email_obj = ContactEmail(
            id=str(uuid4()),
            contact_id=contact_id,
            email=email_data.email,
            email_lower=email_data.email.lower(),
            is_primary=email_data.is_primary,
            is_verified=email_data.is_verified,
            status=email_data.status or "active"
        )
        db.add(email_obj)
    
    # Add phones (deduplicate first)
    unique_phones = {}
    for phone_data in (contact_data.phones or []):
        phone_key = f"{phone_data.country_code or ''}_{phone_data.phone_number}"
        if phone_key not in unique_phones:
            unique_phones[phone_key] = phone_data
    
    for phone_data in unique_phones.values():
        phone_obj = ContactPhone(
            id=str(uuid4()),
            contact_id=contact_id,
            country_code=phone_data.country_code or "",
            phone_number=phone_data.phone_number,
            is_primary=phone_data.is_primary,
            is_whatsapp=phone_data.is_whatsapp,
            is_verified=phone_data.is_verified
        )
        db.add(phone_obj)
    
    # Add socials (deduplicate first)
    unique_socials = {}
    for social_data in (contact_data.socials or []):
        if social_data.platform and social_data.handle:
            social_key = f"{social_data.platform}_{social_data.handle}"
            if social_key not in unique_socials:
                unique_socials[social_key] = social_data
    
    for social_data in unique_socials.values():
        social_obj = ContactSocial(
            id=str(uuid4()),
            contact_id=contact_id,
            platform=social_data.platform,
            handle=social_data.handle,
            link=social_data.link
        )
        db.add(social_obj)
    
    # Add to list if provided
    if list_id:
        db.execute(list_members.insert().values(
            list_id=list_id,
            contact_id=contact_id
        ))
        db.flush()
        print(f"✅ Added new contact {contact_id} to list {list_id}")
    
    db.flush()
    print(f"✅ Created new contact: {contact_id}")
    
    return contact_id, True  # True = newly created


@router.post("/", response_model=ContactOut)
def create_contact(data: ContactCreate, db: Session = Depends(get_db)):
    """Create a new contact with emails, phones, and socials"""
    
    # Create the main contact
    new_contact = Contact(
        contact_id=data.contact_id or str(uuid4()),
        org_id=data.org_id,
        user_id=data.user_id,
        name=data.name,
        contact_type=data.contact_type,
        primary_identifier=data.primary_identifier,
        status=data.status,
        meta=data.meta or {}
    )
    
    db.add(new_contact)
    db.flush()  # Get the contact_id assigned
    
    # Create related emails
    if data.emails:
        for email_data in data.emails:
            email = ContactEmail(
                id=email_data.id or str(uuid4()),
                contact_id=new_contact.contact_id,
                email=email_data.email,
                email_lower=email_data.email.lower(),
                is_primary=email_data.is_primary,
                is_verified=email_data.is_verified,
                status=email_data.status
            )
            db.add(email)
    
    # Create related phones
    if data.phones:
        for phone_data in data.phones:
            phone = ContactPhone(
                id=phone_data.id or str(uuid4()),
                contact_id=new_contact.contact_id,
                country_code=phone_data.country_code,
                phone_number=phone_data.phone_number,
                is_primary=phone_data.is_primary,
                is_whatsapp=phone_data.is_whatsapp,
                is_verified=phone_data.is_verified
            )
            db.add(phone)
    
    # Create related socials
    if data.socials:
        for social_data in data.socials:
            social = ContactSocial(
                id=social_data.id or str(uuid4()),
                contact_id=new_contact.contact_id,
                platform=social_data.platform,
                handle=social_data.handle,
                link=social_data.link
            )
            db.add(social)
    
    db.commit()
    
    # Reload with all relationships
    contact = (
        db.query(Contact)
        .options(
            joinedload(Contact.emails),
            joinedload(Contact.phones),
            joinedload(Contact.socials),
            joinedload(Contact.lists)
        )
        .filter(Contact.contact_id == new_contact.contact_id)
        .first()
    )
    
    return contact


@router.get("/{contact_id}", response_model=ContactOut)
def get_contact(contact_id: str, db: Session = Depends(get_db)):
    """Get a single contact with all related data"""
    contact = (
        db.query(Contact)
        .options(
            joinedload(Contact.emails),
            joinedload(Contact.phones),
            joinedload(Contact.socials),
            joinedload(Contact.lists)
        )
        .filter(Contact.contact_id == contact_id)
        .first()
    )
    
    if not contact:
        raise HTTPException(404, "Contact not found")
    
    return contact


@router.patch("/{contact_id}", response_model=ContactOut)
def update_contact(contact_id: str, data: ContactUpdate, db: Session = Depends(get_db)):
    """Update a contact and optionally replace child records"""
    
    contact = db.query(Contact).filter(Contact.contact_id == contact_id).first()
    if not contact:
        raise HTTPException(404, "Contact not found")
    
    # Update basic fields
    if data.name is not None:
        contact.name = data.name
    if data.primary_identifier is not None:
        contact.primary_identifier = data.primary_identifier
    if data.contact_type is not None:
        contact.contact_type = data.contact_type
    if data.status is not None:
        contact.status = data.status
    if data.meta is not None:
        contact.meta = data.meta
    if data.user_id is not None:
        contact.user_id = data.user_id
    
    # Replace emails if provided
    if data.emails is not None:
        # Delete existing
        db.query(ContactEmail).filter(ContactEmail.contact_id == contact_id).delete()
        # Add new
        for email_data in data.emails:
            email = ContactEmail(
                id=email_data.id or str(uuid4()),
                contact_id=contact_id,
                email=email_data.email,
                email_lower=email_data.email.lower(),
                is_primary=email_data.is_primary,
                is_verified=email_data.is_verified,
                status=email_data.status
            )
            db.add(email)
    
    # Replace phones if provided
    if data.phones is not None:
        db.query(ContactPhone).filter(ContactPhone.contact_id == contact_id).delete()
        for phone_data in data.phones:
            phone = ContactPhone(
                id=phone_data.id or str(uuid4()),
                contact_id=contact_id,
                country_code=phone_data.country_code,
                phone_number=phone_data.phone_number,
                is_primary=phone_data.is_primary,
                is_whatsapp=phone_data.is_whatsapp,
                is_verified=phone_data.is_verified
            )
            db.add(phone)
    
    # Replace socials if provided
    if data.socials is not None:
        db.query(ContactSocial).filter(ContactSocial.contact_id == contact_id).delete()
        for social_data in data.socials:
            social = ContactSocial(
                id=social_data.id or str(uuid4()),
                contact_id=contact_id,
                platform=social_data.platform,
                handle=social_data.handle,
                link=social_data.link
            )
            db.add(social)
    
    db.commit()
    
    # Reload with relationships
    contact = (
        db.query(Contact)
        .options(
            joinedload(Contact.emails),
            joinedload(Contact.phones),
            joinedload(Contact.socials),
            joinedload(Contact.lists)
        )
        .filter(Contact.contact_id == contact_id)
        .first()
    )
    
    return contact

@router.post("/bulk", response_model=dict)
def bulk_create_contacts(
    contacts: List[ContactCreate],
    list_id: Optional[str] = None,  # Can come from query param
    db: Session = Depends(get_db)
):
    """
    Bulk create contacts and optionally add them to a list
    Returns summary of created vs existing contacts
    
    Usage:
    - POST /contacts/bulk (creates contacts only)
    - POST /contacts/bulk?list_id=xyz (creates contacts AND adds to list)
    """
    # Validate list exists if provided
    if list_id:
        contact_list = db.query(ContactList).filter(ContactList.list_id == list_id).first()
        if not contact_list:
            raise HTTPException(404, f"List {list_id} not found")
    
    created_ids = []
    existing_ids = []
    errors = []
    
    for idx, contact_data in enumerate(contacts, start=1):
        try:
            contact_id, is_new = create_or_get_contact(db, contact_data, list_id)
            
            if is_new:
                created_ids.append(contact_id)
            else:
                existing_ids.append(contact_id)
                
        except Exception as e:
            error_msg = f"Contact {idx} ({contact_data.name or 'unnamed'}): {str(e)}"
            print(f"❌ {error_msg}")
            errors.append(error_msg)
            # Don't rollback - continue processing other contacts
            continue
    
    db.commit()
    
    return {
        "success": True,
        "total": len(contacts),
        "created": len(created_ids),
        "existing": len(existing_ids),
        "errors": errors,
        "created_ids": created_ids,
        "existing_ids": existing_ids,
        "list_id": list_id
    }

@router.post("/upload-csv")
async def upload_contacts_csv(
    file: UploadFile = File(...),
    org_id: str = Body(...),
    list_id: Optional[str] = Body(None),
    list_name: Optional[str] = Body(None),  # Add this parameter
    db: Session = Depends(get_db)
):
    """
    Upload contacts from CSV and optionally add to a list
    If list_id is provided but doesn't exist, returns error
    If list_name is provided without list_id, creates new list
    CSV columns: name, email, phone, country_code, platform, handle
    """
    if not file.filename.endswith('.csv'):
        raise HTTPException(400, "File must be a CSV")
    
    # Handle list creation/validation
    contact_list = None
    if list_id:
        # Validate existing list
        contact_list = db.query(ContactList).filter(ContactList.list_id == list_id).first()
        if not contact_list:
            raise HTTPException(404, f"List {list_id} not found")
        if contact_list.org_id != org_id:
            raise HTTPException(403, "List doesn't belong to this organization")
    elif list_name:
        # Create new list with provided name
        list_id = str(uuid4())
        contact_list = ContactList(
            list_id=list_id,
            org_id=org_id,
            list_name=list_name,
            status="active"
        )
        db.add(contact_list)
        db.flush()
        print(f"✅ Created new list: {list_id} - {list_name}")
    
    contents = await file.read()
    csv_data = io.StringIO(contents.decode('utf-8'))
    reader = csv.DictReader(csv_data)
    
    created_ids = []
    existing_ids = []
    errors = []
    
    for idx, row in enumerate(reader, start=1):
        try:
            # Determine primary identifier and contact type
            email = row.get('email', '').strip()
            phone = row.get('phone', '').strip()
            
            if email:
                primary_identifier = email
                contact_type = ContactType.email
            elif phone:
                primary_identifier = phone
                contact_type = ContactType.phone
            else:
                errors.append(f"Row {idx}: No email or phone provided")
                continue
            
            # Build contact data
            contact_data = ContactCreate(
                org_id=org_id,
                name=row.get('name', '').strip(),
                primary_identifier=primary_identifier,
                contact_type=contact_type,
                emails=[ContactEmail(email=email, is_primary=True)] if email else [],
                phones=[ContactPhone(
                    country_code=row.get('country_code', '').strip(),
                    phone_number=phone,
                    is_primary=True
                )] if phone else [],
                socials=[ContactSocial(
                    platform=row.get('platform', '').strip(),
                    handle=row.get('handle', '').strip()
                )] if row.get('platform') else []
            )
            
            contact_id, is_new = create_or_get_contact(db, contact_data, list_id)
            
            if is_new:
                created_ids.append(contact_id)
            else:
                existing_ids.append(contact_id)
                
        except Exception as e:
            errors.append(f"Row {idx}: {str(e)}")
            continue
    
    db.commit()
    
    return {
        "success": True,
        "total_rows": idx if 'idx' in locals() else 0,
        "created": len(created_ids),
        "existing": len(existing_ids),
        "errors": errors,
        "list_id": list_id,
        "list_name": contact_list.list_name if contact_list else None,
        "list_created": bool(list_name and not contact_list)  # Was list created?
    }

@router.get("/", response_model=List[ContactOut])
def get_contacts(
    org_id: str,
    list_id: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Get all contacts for an org, optionally filtered by list"""
    query = db.query(Contact).options(
        joinedload(Contact.emails),
        joinedload(Contact.phones),
        joinedload(Contact.socials),
        joinedload(Contact.lists)
    ).filter(Contact.org_id == org_id)
    
    if list_id:
        # Filter by list membership
        query = query.join(Contact.lists).filter(ContactList.list_id == list_id)
    
    return query.all()


@router.get("/{contact_id}", response_model=ContactOut)
def get_contact(contact_id: str, db: Session = Depends(get_db)):
    """Get a single contact with all details"""
    contact = (
        db.query(Contact)
        .options(
            joinedload(Contact.emails),
            joinedload(Contact.phones),
            joinedload(Contact.socials),
            joinedload(Contact.lists)
        )
        .filter(Contact.contact_id == contact_id)
        .first()
    )
    
    if not contact:
        raise HTTPException(404, "Contact not found")
    
    return contact


@router.patch("/{contact_id}", response_model=ContactOut)
def update_contact(
    contact_id: str,
    data: ContactUpdate,
    db: Session = Depends(get_db)
):
    """Update contact details"""
    contact = db.query(Contact).filter(Contact.contact_id == contact_id).first()
    
    if not contact:
        raise HTTPException(404, "Contact not found")
    
    # Update basic fields
    if data.name is not None:
        contact.name = data.name
    if data.primary_identifier is not None:
        contact.primary_identifier = data.primary_identifier
    if data.contact_type is not None:
        contact.contact_type = data.contact_type
    if data.status is not None:
        contact.status = data.status
    if data.meta is not None:
        contact.meta = data.meta
    if data.user_id is not None:
        contact.user_id = data.user_id
    
    # Update emails if provided
    if data.emails is not None:
        # Delete existing emails
        db.query(ContactEmail).filter(ContactEmail.contact_id == contact_id).delete()
        
        # Add new emails
        for email_data in data.emails:
            email_obj = ContactEmail(
                id=str(uuid4()),
                contact_id=contact_id,
                email=email_data.email,
                email_lower=email_data.email.lower(),
                is_primary=email_data.is_primary,
                is_verified=email_data.is_verified,
                status=email_data.status or "active"
            )
            db.add(email_obj)
    
    # Update phones if provided
    if data.phones is not None:
        db.query(ContactPhone).filter(ContactPhone.contact_id == contact_id).delete()
        
        for phone_data in data.phones:
            phone_obj = ContactPhone(
                id=str(uuid4()),
                contact_id=contact_id,
                country_code=phone_data.country_code or "",
                phone_number=phone_data.phone_number,
                is_primary=phone_data.is_primary,
                is_whatsapp=phone_data.is_whatsapp,
                is_verified=phone_data.is_verified
            )
            db.add(phone_obj)
    
    # Update socials if provided
    if data.socials is not None:
        db.query(ContactSocial).filter(ContactSocial.contact_id == contact_id).delete()
        
        for social_data in data.socials:
            social_obj = ContactSocial(
                id=str(uuid4()),
                contact_id=contact_id,
                platform=social_data.platform,
                handle=social_data.handle,
                link=social_data.link
            )
            db.add(social_obj)
    
    db.commit()
    
    # Reload with relationships
    contact = (
        db.query(Contact)
        .options(
            joinedload(Contact.emails),
            joinedload(Contact.phones),
            joinedload(Contact.socials),
            joinedload(Contact.lists)
        )
        .filter(Contact.contact_id == contact_id)
        .first()
    )
    
    return contact


@router.delete("/{contact_id}")
def delete_contact(contact_id: str, db: Session = Depends(get_db)):
    """Delete a contact (cascades to emails, phones, socials)"""
    contact = db.query(Contact).filter(Contact.contact_id == contact_id).first()
    
    if not contact:
        raise HTTPException(404, "Contact not found")
    
    db.delete(contact)
    db.commit()
    
    return {"success": True, "contact_id": contact_id}