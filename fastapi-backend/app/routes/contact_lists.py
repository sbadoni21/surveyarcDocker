from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import select
from uuid import uuid4
from typing import List

from ..db import get_db
from ..models.contact import ContactList, list_members, Contact
from ..schemas.contact import ListCreate, ListOut, ListUpdate
from ..services.redis_contact_service import RedisContactService as RCon
from ..schemas.contact import ListOut, ContactOut


router = APIRouter(
    prefix="/contact-lists",
    tags=["contact-lists"]
)


def load_list_with_contacts(db: Session, list_id: str):
    """Helper to consistently load a list with all related data"""
    return (
        db.query(ContactList)
        .options(
            joinedload(ContactList.contacts)
                .joinedload(Contact.emails),
            joinedload(ContactList.contacts)
                .joinedload(Contact.phones),
            joinedload(ContactList.contacts)
                .joinedload(Contact.socials)
        )
        .filter(ContactList.list_id == list_id)
        .first()
    )


@router.post("/", response_model=ListOut)
def create_list(data: ListCreate, db: Session = Depends(get_db)):
    """Create a new contact list"""
    new_list = ContactList(
        list_id=data.list_id or str(uuid4()),
        org_id=data.org_id,
        list_name=data.list_name,
        status=data.status
    )
    db.add(new_list)
    db.commit()
    db.flush()

    # Attach contacts if given
    if data.contact_ids:
        # Validate contacts exist and belong to org
        existing_contacts = db.query(Contact.contact_id).filter(
            Contact.contact_id.in_(data.contact_ids),
            Contact.org_id == data.org_id
        ).all()
        existing_ids = {c.contact_id for c in existing_contacts}
        
        missing = set(data.contact_ids) - existing_ids
        if missing:
            db.rollback()
            raise HTTPException(400, f"Contacts not found: {', '.join(missing)}")
        
        # Add to list
        for cid in data.contact_ids:
            db.execute(list_members.insert().values(
                list_id=new_list.list_id,
                contact_id=cid
            ))
        db.commit()
        
        # Reload with contacts
        new_list = load_list_with_contacts(db, new_list.list_id)
    else:
        db.refresh(new_list)

    # Reload with contacts if needed already done above
    out = ListOut.model_validate(new_list, from_attributes=True).model_dump()
    org_id = out["org_id"]

    # ---- Redis: invalidate & cache ----
    RCon.invalidate_list(out["list_id"], org_id)
    RCon.invalidate_org_lists(org_id)  # org list collection
    RCon.cache_list_full(out["list_id"], out)

    return new_list


@router.get("/", response_model=List[ListOut])
def get_lists(org_id: str, db: Session = Depends(get_db)):
    """Get all lists for an organization (with Redis caching)."""

    cached = RCon.get_lists_by_org(org_id)
    if cached is not None:
        return [ListOut(**row) for row in cached]

    lists = (
        db.query(ContactList)
        .options(
            joinedload(ContactList.contacts).joinedload(Contact.emails),
            joinedload(ContactList.contacts).joinedload(Contact.phones),
            joinedload(ContactList.contacts).joinedload(Contact.socials),
        )
        .filter(ContactList.org_id == org_id)
        .all()
    )

    out = [
        ListOut.model_validate(lst, from_attributes=True).model_dump()
        for lst in lists
    ]

    RCon.cache_lists_by_org(org_id, out)
    for r in out:
        RCon.cache_list_full(r["list_id"], r)

    return [ListOut(**r) for r in out]



@router.get("/{list_id}", response_model=ListOut)
def get_list(list_id: str, db: Session = Depends(get_db)):
    """Get a single list with all contacts (cached)."""

    cached = RCon.get_list_full(list_id)
    if cached is not None:
        return ListOut(**cached)

    contact_list = load_list_with_contacts(db, list_id)
    
    if not contact_list:
        raise HTTPException(404, "List not found")

    out = ListOut.model_validate(contact_list, from_attributes=True).model_dump()
    RCon.cache_list_full(list_id, out)

    # Also prime contacts-by-list cache
    contacts_out = [
        ContactOut.model_validate(c, from_attributes=True).model_dump()
        for c in contact_list.contacts
    ]
    RCon.cache_contacts_by_list(list_id, contacts_out)

    return ListOut(**out)


@router.patch("/{list_id}/contacts", response_model=ListOut)
def add_contacts_to_list(
    list_id: str,
    contact_ids: List[str] = Body(..., embed=True),
    db: Session = Depends(get_db)
):
    """Add contacts to an existing list without removing existing ones"""
    
    # Check if list exists
    record = db.query(ContactList).filter(ContactList.list_id == list_id).first()
    
    if not record:
        raise HTTPException(404, "List not found")
    
    # Validate that all contacts exist and belong to the same org
    existing_contacts = db.query(Contact.contact_id).filter(
        Contact.contact_id.in_(contact_ids),
        Contact.org_id == record.org_id
    ).all()
    existing_contact_ids = {c.contact_id for c in existing_contacts}
    
    # Check for missing contacts
    missing_contacts = set(contact_ids) - existing_contact_ids
    if missing_contacts:
        raise HTTPException(
            400, 
            f"Contacts not found or don't belong to this org: {', '.join(missing_contacts)}"
        )
    
    # Add new contacts (skip duplicates)
    added_count = 0
    for cid in contact_ids:
        # Check if already exists
        stmt = select(list_members).where(
            (list_members.c.list_id == list_id) & 
            (list_members.c.contact_id == cid)
        )
        existing = db.execute(stmt).first()
        
        if not existing:
            db.execute(
                list_members.insert().values(
                    list_id=list_id, 
                    contact_id=cid
                )
            )
            added_count += 1
    
    db.commit()
    
    print(f"✅ Added {added_count} new contacts to list {list_id}")
    
    # Load fresh data with all relationships
    record = load_list_with_contacts(db, list_id)

    # ---- Redis: invalidate & cache ----
    out = ListOut.model_validate(record, from_attributes=True).model_dump()
    org_id = record.org_id

    RCon.invalidate_list(list_id, org_id)
    RCon.cache_list_full(list_id, out)

    # Also refresh contacts-by-list snapshot
    contacts_out = [
        ContactOut.model_validate(c, from_attributes=True).model_dump()
        for c in record.contacts
    ]
    RCon.cache_contacts_by_list(list_id, contacts_out)

    return record



@router.delete("/{list_id}/contacts")
def remove_contacts_from_list(
    list_id: str,
    contact_ids: List[str] = Body(..., embed=True),
    db: Session = Depends(get_db)
):
    """Remove specific contacts from a list"""
    record = db.query(ContactList).filter(ContactList.list_id == list_id).first()

    if not record:
        raise HTTPException(404, "List not found")

    # Remove only selected contacts
    result = db.execute(
        list_members.delete().where(
            list_members.c.list_id == list_id,
            list_members.c.contact_id.in_(contact_ids)
        )
    )

    db.commit()
    
    # ---- Redis: invalidate caches for this list ----
    # We don't need org_id here strictly; list membership changed, so list + contacts:list are stale
    RCon.invalidate_list(list_id)

    return {"success": True, "removed": contact_ids, "count": result.rowcount}



@router.patch("/{list_id}", response_model=ListOut)
def update_list(list_id: str, data: ListUpdate, db: Session = Depends(get_db)):
    """Update list metadata and optionally replace ALL contacts"""
    record = db.query(ContactList).filter(ContactList.list_id == list_id).first()

    if not record:
        raise HTTPException(404, "List not found")

    if data.list_name is not None:
        record.list_name = data.list_name

    if data.status is not None:
        record.status = data.status

    # Replace ALL contact ids if provided
    if data.contact_ids is not None:
        # Validate contacts exist
        existing_contacts = db.query(Contact.contact_id).filter(
            Contact.contact_id.in_(data.contact_ids),
            Contact.org_id == record.org_id
        ).all()
        existing_ids = {c.contact_id for c in existing_contacts}
        
        missing = set(data.contact_ids) - existing_ids
        if missing:
            raise HTTPException(400, f"Contacts not found: {', '.join(missing)}")
        
        # Clear and replace
        db.execute(list_members.delete().where(list_members.c.list_id == list_id))
        for cid in data.contact_ids:
            db.execute(list_members.insert().values(list_id=list_id, contact_id=cid))
    
    db.commit()

    # Reload with contacts
    record = load_list_with_contacts(db, list_id)

    out = ListOut.model_validate(record, from_attributes=True).model_dump()
    org_id = record.org_id

    # ---- Redis: invalidate & cache ----
    RCon.invalidate_list(list_id, org_id)
    RCon.cache_list_full(list_id, out)

    # Refresh contacts-by-list cache if contacts changed
    contacts_out = [
        ContactOut.model_validate(c, from_attributes=True).model_dump()
        for c in record.contacts
    ]
    RCon.cache_contacts_by_list(list_id, contacts_out)

    return record


@router.delete("/{list_id}")
def delete_list(list_id: str, db: Session = Depends(get_db)):
    """Delete an entire contact list"""
    record = db.query(ContactList).filter(ContactList.list_id == list_id).first()

    if not record:
        raise HTTPException(404, "List not found")

    org_id = record.org_id

    db.delete(record)
    db.commit()

    # ---- Redis: invalidate ----
    RCon.invalidate_list(list_id, org_id)

    return {"success": True}
