# app/routers/contacts.py

import uuid
from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import select

from ..db import get_db
from ..models.contact import Contact, ContactList, ContactEmail, ContactPhone, ContactSocial
from ..schemas.contact import (
    ContactCreate, ContactUpdate, ContactOut,
    ListCreate, ListUpdate, ListOut
)
from ..services.redis_contacts_service import RedisContactsService
from ..services.audit import audit


router = APIRouter(prefix="/contacts", tags=["Contacts & Lists"])


# -----------------------------------------------------------
# Helpers
# -----------------------------------------------------------
def record_audit(
    db: Session,
    event_type: str,
    entity_id: str,
    org_id: str,
    meta: dict = None,
    entity_type: str = "contact"
):
    audit(
        db=db,
        event_type=event_type,
        entity_type=entity_type,
        entity_id=entity_id,
        org_id=org_id,
        meta=meta or {},
    )


def list_to_out(l: ContactList) -> ListOut:
    return ListOut(
        list_id=l.list_id,
        org_id=l.org_id,
        list_name=l.list_name,
        status=l.status,
        created_at=l.created_at,
        updated_at=l.updated_at,
        deleted_at=l.deleted_at,
        contacts=[ContactOut.from_orm(c) for c in l.contacts],  # ✅ Include full contact objects
        contact_ids=[c.contact_id for c in l.contacts],
    )


# ===========================================================
# CONTACTS
# ===========================================================


# ===========================================================
# FIXED LIST CONTACTS ENDPOINT
# ===========================================================

@router.get("/", response_model=List[ContactOut])
def list_contacts(org_id: str = Query(...), db: Session = Depends(get_db)):
    # Temporarily disable cache to debug
    # cached = RedisContactsService.get_contacts_for_org(org_id)
    # if cached is not None:
    #     import json
    #     parsed = []
    #     for item in cached:
    #         if isinstance(item, str):
    #             item = json.loads(item)
    #         parsed.append(item)
    #     return parsed
    
    # ✅ Eagerly load ALL related data
    rows = (
        db.query(Contact)
        .options(
            joinedload(Contact.emails),
            joinedload(Contact.phones),
            joinedload(Contact.socials),
            joinedload(Contact.lists)  # ✅ ADD THIS LINE

        )
        .filter(Contact.org_id == org_id)
        .order_by(Contact.created_at.desc())
        .all()
    )

    # Debug: Print what we got
    for row in rows:
        print(f"Contact {row.contact_id}: {len(row.emails)} emails, {len(row.phones)} phones, {len(row.socials)} socials")

    # Convert to Pydantic models
    out = [ContactOut.from_orm(r) for r in rows]
    
    # Debug: Check Pydantic models
    for o in out:
        print(f"Pydantic {o.contact_id}: {len(o.emails)} emails, {len(o.phones)} phones, {len(o.socials)} socials")
    
    # Cache the model_dump version
    out_dicts = [o.model_dump() for o in out]
    RedisContactsService.cache_contacts_for_org(org_id, out_dicts)

    return out



@router.post("/", response_model=ContactOut, status_code=201)
def create_contact(data: ContactCreate, db: Session = Depends(get_db)):
    cid = data.contact_id or ("ct_" + uuid.uuid4().hex[:12])

    # Create contact
    row = Contact(
        contact_id=cid,
        org_id=data.org_id,
        user_id=data.user_id,
        name=data.name or "",
        primary_identifier=data.primary_identifier,
        contact_type=data.contact_type,
        status=data.status or "active",
        meta=data.meta or {},
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )

    db.add(row)
    
    # ✅ IMPORTANT: Flush to get the contact_id registered BEFORE adding children
    db.flush()

    # ✅ Create email records
    if data.emails:
        for em in data.emails:
            email_record = ContactEmail(
                id=em.id or ("em_" + uuid.uuid4().hex[:12]),
                contact_id=cid,
                email=em.email,
                email_lower=em.email.lower(),
                is_primary=em.is_primary,
                is_verified=em.is_verified,
                status=em.status
            )
            db.add(email_record)
            print(f"Adding email: {email_record.email} to contact {cid}")

    # ✅ Create phone records
    if data.phones:
        for ph in data.phones:
            phone_record = ContactPhone(
                id=ph.id or ("ph_" + uuid.uuid4().hex[:12]),
                contact_id=cid,
                country_code=ph.country_code,
                phone_number=ph.phone_number,
                is_primary=ph.is_primary,
                is_whatsapp=ph.is_whatsapp,
                is_verified=ph.is_verified,
            )
            db.add(phone_record)
            print(f"Adding phone: {phone_record.phone_number} to contact {cid}")

    # ✅ Create social records
    if data.socials:
        for sc in data.socials:
            social_record = ContactSocial(
                id=sc.id or ("sc_" + uuid.uuid4().hex[:12]),
                contact_id=cid,
                platform=sc.platform,
                handle=sc.handle,
                link=sc.link,
            )
            db.add(social_record)
            print(f"Adding social: {social_record.platform} to contact {cid}")

    # Commit everything
    db.commit()
    
    # ✅ Reload with relationships - CRITICAL
    row = (
        db.query(Contact)
        .options(
            joinedload(Contact.emails),
            joinedload(Contact.phones),
            joinedload(Contact.socials)
        )
        .filter(Contact.contact_id == cid)
        .first()
    )

    print(f"After reload: {len(row.emails)} emails, {len(row.phones)} phones, {len(row.socials)} socials")

    RedisContactsService.invalidate_contacts(data.org_id)

    return row

@router.get("/{contact_id}", response_model=ContactOut)
def get_contact(contact_id: str, db: Session = Depends(get_db)):
    # ✅ FIX: Eagerly load related data
    row = (
        db.query(Contact)
        .options(
            joinedload(Contact.emails),
            joinedload(Contact.phones),
            joinedload(Contact.socials),
            joinedload(Contact.lists)  # ✅ ADD THIS LINE

        )
        .filter(Contact.contact_id == contact_id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Contact not found")
    return row


@router.patch("/{contact_id}", response_model=ContactOut)
def update_contact(contact_id: str, data: ContactUpdate, db: Session = Depends(get_db)):
    row = db.query(Contact).filter(Contact.contact_id == contact_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Contact not found")

    updates = data.dict(exclude_unset=True)

    # ✅ update base fields
    for k, v in updates.items():
        if k not in ["emails", "phones", "socials"]:
            setattr(row, k, v)

    # ✅ replace emails
    if data.emails is not None:
        db.query(ContactEmail).filter(ContactEmail.contact_id == contact_id).delete()
        for em in data.emails:
            db.add(
                ContactEmail(
                    id="em_" + uuid.uuid4().hex[:12],
                    contact_id=contact_id,
                    email=em.email,
                    email_lower=em.email.lower(),
                    is_primary=em.is_primary,
                    is_verified=em.is_verified,
                    status=em.status
                )
            )

    # ✅ replace phones
    if data.phones is not None:
        db.query(ContactPhone).filter(ContactPhone.contact_id == contact_id).delete()
        for ph in data.phones:
            db.add(
                ContactPhone(
                    id="ph_" + uuid.uuid4().hex[:12],
                    contact_id=contact_id,
                    country_code=ph.country_code,
                    phone_number=ph.phone_number,
                    is_primary=ph.is_primary,
                    is_whatsapp=ph.is_whatsapp,
                    is_verified=ph.is_verified,
                )
            )

    # ✅ replace socials
    if data.socials is not None:
        db.query(ContactSocial).filter(ContactSocial.contact_id == contact_id).delete()
        for sc in data.socials:
            db.add(
                ContactSocial(
                    id="sc_" + uuid.uuid4().hex[:12],
                    contact_id=contact_id,
                    platform=sc.platform,
                    handle=sc.handle,
                    link=sc.link,
                )
            )

    row.updated_at = datetime.utcnow()
    db.commit()
    
    # ✅ Reload with relationships
    row = (
        db.query(Contact)
        .options(
            joinedload(Contact.emails),
            joinedload(Contact.phones),
            joinedload(Contact.socials),
            joinedload(Contact.lists)  # ✅ ADD THIS LINE

        )
        .filter(Contact.contact_id == contact_id)
        .first()
    )

    RedisContactsService.invalidate_contacts(row.org_id)

    return row


@router.delete("/{contact_id}")
def delete_contact(contact_id: str, db: Session = Depends(get_db)):
    row = db.query(Contact).filter(Contact.contact_id == contact_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Contact not found")

    org = row.org_id
    meta = row.meta or {}

    db.delete(row)
    db.commit()

    RedisContactsService.invalidate_contacts(org)

    record_audit(
        db=db,
        event_type="contact.deleted",
        entity_id=contact_id,
        org_id=org,
        meta=meta
    )

    return {"detail": "Contact deleted"}


# ===========================================================
# LISTS
# ===========================================================

@router.get("/lists", response_model=List[ListOut])
def list_lists(org_id: str = Query(...), db: Session = Depends(get_db)):
    cached = RedisContactsService.get_lists(org_id)
    if cached is not None:
        return cached

    # ✅ FIX: Eagerly load contacts with their nested relationships
    rows = (
        db.query(ContactList)
        .options(
            joinedload(ContactList.contacts).joinedload(Contact.emails),
            joinedload(ContactList.contacts).joinedload(Contact.phones),
            joinedload(ContactList.contacts).joinedload(Contact.socials)
        )
        .filter(ContactList.org_id == org_id, ContactList.deleted_at == None)
        .all()
    )

    out = [list_to_out(l) for l in rows]
    RedisContactsService.cache_lists(org_id, out)
    return out


@router.post("/lists", response_model=ListOut, status_code=201)
def create_list(data: ListCreate, db: Session = Depends(get_db)):
    lid = data.list_id or ("lst_" + uuid.uuid4().hex[:10])

    row = ContactList(
        list_id=lid,
        org_id=data.org_id,
        list_name=data.list_name,
        status=data.status or "live",
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )

    db.add(row)

    if data.contact_ids:
        contacts = (
            db.query(Contact)
            .options(
                joinedload(Contact.emails),
                joinedload(Contact.phones),
                joinedload(Contact.socials)
            )
            .filter(Contact.contact_id.in_(data.contact_ids))
            .all()
        )
        row.contacts = contacts

    db.commit()
    
    # ✅ Reload with relationships
    row = (
        db.query(ContactList)
        .options(
            joinedload(ContactList.contacts).joinedload(Contact.emails),
            joinedload(ContactList.contacts).joinedload(Contact.phones),
            joinedload(ContactList.contacts).joinedload(Contact.socials)
        )
        .filter(ContactList.list_id == lid)
        .first()
    )

    RedisContactsService.invalidate_lists(data.org_id)

    record_audit(
        db=db,
        event_type="list.created",
        entity_id=row.list_id,
        org_id=row.org_id,
        entity_type="contact_list",
        meta={"contact_ids": data.contact_ids},
    )

    return list_to_out(row)


@router.get("/lists/{list_id}", response_model=ListOut)
def get_list(list_id: str, db: Session = Depends(get_db)):
    # ✅ FIX: Eagerly load contacts with nested data
    l = (
        db.query(ContactList)
        .options(
            joinedload(ContactList.contacts).joinedload(Contact.emails),
            joinedload(ContactList.contacts).joinedload(Contact.phones),
            joinedload(ContactList.contacts).joinedload(Contact.socials)
        )
        .filter(ContactList.list_id == list_id)
        .first()
    )
    if not l:
        raise HTTPException(status_code=404, detail="List not found")
    return list_to_out(l)


@router.patch("/lists/{list_id}", response_model=ListOut)
def update_list(list_id: str, data: ListUpdate, db: Session = Depends(get_db)):
    l = db.query(ContactList).filter(ContactList.list_id == list_id).first()
    if not l:
        raise HTTPException(status_code=404, detail="List not found")

    meta = {}
    if data.list_name is not None:
        l.list_name = data.list_name
        meta["list_name"] = data.list_name
    if data.status is not None:
        l.status = data.status
        meta["status"] = data.status

    if data.contact_ids is not None:
        contacts = (
            db.query(Contact)
            .options(
                joinedload(Contact.emails),
                joinedload(Contact.phones),
                joinedload(Contact.socials)
            )
            .filter(Contact.contact_id.in_(data.contact_ids))
            .all()
        )
        l.contacts = contacts
        meta["contact_ids"] = data.contact_ids

    l.updated_at = datetime.utcnow()

    db.commit()
    
    # ✅ Reload with relationships
    l = (
        db.query(ContactList)
        .options(
            joinedload(ContactList.contacts).joinedload(Contact.emails),
            joinedload(ContactList.contacts).joinedload(Contact.phones),
            joinedload(ContactList.contacts).joinedload(Contact.socials)
        )
        .filter(ContactList.list_id == list_id)
        .first()
    )

    RedisContactsService.invalidate_lists(l.org_id)

    record_audit(
        db=db,
        event_type="list.updated",
        entity_id=l.list_id,
        org_id=l.org_id,
        entity_type="contact_list",
        meta=meta,
    )

    return list_to_out(l)


@router.post("/lists/{list_id}/add")
def add_contacts_to_list(list_id: str, contact_ids: List[str], db: Session = Depends(get_db)):
    l = db.query(ContactList).filter(ContactList.list_id == list_id).first()
    if not l:
        raise HTTPException(status_code=404, detail="List not found")

    existing = {c.contact_id for c in l.contacts}

    new_contacts = (
        db.query(Contact)
        .filter(Contact.contact_id.in_(contact_ids))
        .all()
    )

    added = 0
    for c in new_contacts:
        if c.contact_id not in existing:
            l.contacts.append(c)
            added += 1

    db.commit()

    RedisContactsService.invalidate_lists(l.org_id)

    record_audit(
        db=db,
        event_type="list.contacts_added",
        entity_id=list_id,
        org_id=l.org_id,
        entity_type="contact_list",
        meta={"contact_ids": contact_ids},
    )

    return {"detail": "added", "count": added}


@router.post("/lists/{list_id}/remove")
def remove_contacts_from_list(list_id: str, contact_ids: List[str], db: Session = Depends(get_db)):
    l = db.query(ContactList).filter(ContactList.list_id == list_id).first()
    if not l:
        raise HTTPException(status_code=404, detail="List not found")

    l.contacts = [c for c in l.contacts if c.contact_id not in set(contact_ids)]

    db.commit()

    RedisContactsService.invalidate_lists(l.org_id)

    record_audit(
        db=db,
        event_type="list.contacts_removed",
        entity_id=list_id,
        org_id=l.org_id,
        entity_type="contact_list",
        meta={"contact_ids": contact_ids},
    )

    return {"detail": "removed"}


@router.delete("/lists/{list_id}")
def delete_list(list_id: str, db: Session = Depends(get_db)):
    l = db.query(ContactList).filter(ContactList.list_id == list_id).first()
    if not l:
        raise HTTPException(status_code=404, detail="List not found")

    l.deleted_at = datetime.utcnow()
    db.commit()

    RedisContactsService.invalidate_lists(l.org_id)

    record_audit(
        db=db,
        event_type="list.deleted",
        entity_id=list_id,
        org_id=l.org_id,
        entity_type="contact_list",
        meta={},
    )

    return {"detail": "List deleted (soft)"}
# Replace the existing /lists/{list_id}/add and /lists/{list_id}/remove endpoints with:

@router.patch("/lists/{list_id}/contacts")
def add_contacts_to_list_patch(
    list_id: str, 
    contact_ids: List[str],
    db: Session = Depends(get_db)
):
    """PATCH endpoint to add contacts to a list"""
    l = (
        db.query(ContactList)
        .options(
            joinedload(ContactList.contacts).joinedload(Contact.emails),
            joinedload(ContactList.contacts).joinedload(Contact.phones),
            joinedload(ContactList.contacts).joinedload(Contact.socials)
        )
        .filter(ContactList.list_id == list_id)
        .first()
    )
    
    if not l:
        raise HTTPException(status_code=404, detail="List not found")

    existing = {c.contact_id for c in l.contacts}

    new_contacts = (
        db.query(Contact)
        .options(
            joinedload(Contact.emails),
            joinedload(Contact.phones),
            joinedload(Contact.socials)
        )
        .filter(Contact.contact_id.in_(contact_ids))
        .all()
    )

    added = 0
    for c in new_contacts:
        if c.contact_id not in existing:
            l.contacts.append(c)
            added += 1

    db.commit()
    
    # Reload with all relationships
    l = (
        db.query(ContactList)
        .options(
            joinedload(ContactList.contacts).joinedload(Contact.emails),
            joinedload(ContactList.contacts).joinedload(Contact.phones),
            joinedload(ContactList.contacts).joinedload(Contact.socials)
        )
        .filter(ContactList.list_id == list_id)
        .first()
    )

    RedisContactsService.invalidate_lists(l.org_id)

    record_audit(
        db=db,
        event_type="list.contacts_added",
        entity_id=list_id,
        org_id=l.org_id,
        entity_type="contact_list",
        meta={"contact_ids": contact_ids, "added_count": added},
    )

    return list_to_out(l)


@router.delete("/lists/{list_id}/contacts")
def remove_contacts_from_list_delete(
    list_id: str,
    contact_ids: List[str],
    db: Session = Depends(get_db)
):
    """DELETE endpoint to remove contacts from a list"""
    l = (
        db.query(ContactList)
        .options(
            joinedload(ContactList.contacts).joinedload(Contact.emails),
            joinedload(ContactList.contacts).joinedload(Contact.phones),
            joinedload(ContactList.contacts).joinedload(Contact.socials)
        )
        .filter(ContactList.list_id == list_id)
        .first()
    )
    
    if not l:
        raise HTTPException(status_code=404, detail="List not found")

    contact_ids_set = set(contact_ids)
    l.contacts = [c for c in l.contacts if c.contact_id not in contact_ids_set]

    db.commit()
    
    # Reload with all relationships
    l = (
        db.query(ContactList)
        .options(
            joinedload(ContactList.contacts).joinedload(Contact.emails),
            joinedload(ContactList.contacts).joinedload(Contact.phones),
            joinedload(ContactList.contacts).joinedload(Contact.socials)
        )
        .filter(ContactList.list_id == list_id)
        .first()
    )

    RedisContactsService.invalidate_lists(l.org_id)

    record_audit(
        db=db,
        event_type="list.contacts_removed",
        entity_id=list_id,
        org_id=l.org_id,
        entity_type="contact_list",
        meta={"contact_ids": contact_ids, "removed_count": len(contact_ids)},
    )

    return list_to_out(l)