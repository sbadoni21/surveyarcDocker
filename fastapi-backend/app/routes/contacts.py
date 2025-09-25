import uuid
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..db import get_db
from ..models.contact import Contact, ContactList, list_members
from ..schemas.contact import (
    ContactCreate, ContactUpdate, ContactOut,
    ListCreate, ListUpdate, ListOut
)
from ..services.redis_contacts_service import RedisContactsService

router = APIRouter(prefix="/contacts", tags=["Contacts & Lists"])

# ---------- Contacts ----------

@router.get("", response_model=List[ContactOut])
def list_contacts(org_id: str = Query(...), db: Session = Depends(get_db)):
    cached = RedisContactsService.get_contacts_for_org(org_id)
    if cached is not None: return cached
    rows = db.query(Contact).filter(Contact.org_id == org_id).order_by(Contact.created_at.desc()).all()
    RedisContactsService.cache_contacts_for_org(org_id, rows)
    return rows

@router.post("/", response_model=ContactOut)
def create_contact(data: ContactCreate, db: Session = Depends(get_db)):
    cid = data.contact_id or ("ct_" + uuid.uuid4().hex[:12])
    email_lower = (data.email_lower or data.email).lower()
    existing = db.query(Contact).filter(Contact.org_id==data.org_id, Contact.email_lower==email_lower).first()
    if existing:
        raise HTTPException(status_code=409, detail="Contact with this email already exists")

    row = Contact(
        contact_id=cid,
        org_id=data.org_id,
        user_id=data.user_id,
        name=data.name or "",
        email=data.email,
        email_lower=email_lower,
        status=data.status or "active",
        meta=data.meta or {},
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    RedisContactsService.invalidate_contacts(data.org_id)
    return row

@router.get("/{contact_id}", response_model=ContactOut)
def get_contact(contact_id: str, db: Session = Depends(get_db)):
    row = db.query(Contact).filter(Contact.contact_id == contact_id).first()
    if not row: raise HTTPException(status_code=404, detail="Contact not found")
    return row

@router.patch("/{contact_id}", response_model=ContactOut)
def update_contact(contact_id: str, data: ContactUpdate, db: Session = Depends(get_db)):
    row = db.query(Contact).filter(Contact.contact_id == contact_id).first()
    if not row: raise HTTPException(status_code=404, detail="Contact not found")
    updates = data.dict(exclude_unset=True)
    for k, v in updates.items():
        setattr(row, k, v)
    if "email" in updates:
        row.email_lower = updates["email"].lower()
    row.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(row)
    RedisContactsService.invalidate_contacts(row.org_id)
    return row

@router.delete("/{contact_id}")
def delete_contact(contact_id: str, db: Session = Depends(get_db)):
    row = db.query(Contact).filter(Contact.contact_id == contact_id).first()
    if not row: raise HTTPException(status_code=404, detail="Contact not found")
    org = row.org_id
    # removing from association table via relationship cascade is automatic on delete
    db.delete(row)
    db.commit()
    RedisContactsService.invalidate_contacts(org)
    return {"detail": "Contact deleted"}


# ---------- Lists ----------

def _list_to_out(l: ContactList) -> ListOut:
    return ListOut(
        list_id=l.list_id,
        org_id=l.org_id,
        list_name=l.list_name,
        status=l.status,
        created_at=l.created_at,
        updated_at=l.updated_at,
        deleted_at=l.deleted_at,
        contact_ids=[c.contact_id for c in l.contacts],
    )

@router.get("/lists", response_model=List[ListOut])
def list_lists(org_id: str = Query(...), db: Session = Depends(get_db)):
    cached = RedisContactsService.get_lists(org_id)
    if cached is not None: return cached
    rows = db.query(ContactList).filter(ContactList.org_id==org_id, ContactList.deleted_at==None).all()
    out = [_list_to_out(l) for l in rows]
    RedisContactsService.cache_lists(org_id, out)
    return out

@router.post("/lists", response_model=ListOut)
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
    # attach initial contacts (ignore missing ids silently)
    if data.contact_ids:
        contacts = db.query(Contact).filter(Contact.contact_id.in_(data.contact_ids)).all()
        row.contacts = contacts
    db.commit()
    db.refresh(row)
    RedisContactsService.invalidate_lists(data.org_id)
    return _list_to_out(row)

@router.get("/lists/{list_id}", response_model=ListOut)
def get_list(list_id: str, db: Session = Depends(get_db)):
    l = db.query(ContactList).filter(ContactList.list_id==list_id).first()
    if not l: raise HTTPException(status_code=404, detail="List not found")
    return _list_to_out(l)

@router.patch("/lists/{list_id}", response_model=ListOut)
def update_list(list_id: str, data: ListUpdate, db: Session = Depends(get_db)):
    l = db.query(ContactList).filter(ContactList.list_id==list_id).first()
    if not l: raise HTTPException(status_code=404, detail="List not found")

    if data.list_name is not None: l.list_name = data.list_name
    if data.status is not None: l.status = data.status
    if data.contact_ids is not None:
        contacts = db.query(Contact).filter(Contact.contact_id.in_(data.contact_ids)).all()
        l.contacts = contacts  # replace
    l.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(l)
    RedisContactsService.invalidate_lists(l.org_id)
    return _list_to_out(l)

@router.post("/lists/{list_id}/add")
def add_contacts_to_list(list_id: str, contact_ids: List[str], db: Session = Depends(get_db)):
    l = db.query(ContactList).filter(ContactList.list_id==list_id).first()
    if not l: raise HTTPException(status_code=404, detail="List not found")
    existing = {c.contact_id for c in l.contacts}
    new_contacts = db.query(Contact).filter(Contact.contact_id.in_(contact_ids)).all()
    for c in new_contacts:
        if c.contact_id not in existing: l.contacts.append(c)
    db.commit()
    RedisContactsService.invalidate_lists(l.org_id)
    return {"detail": "added", "count": len(new_contacts)}

@router.post("/lists/{list_id}/remove")
def remove_contacts_from_list(list_id: str, contact_ids: List[str], db: Session = Depends(get_db)):
    l = db.query(ContactList).filter(ContactList.list_id==list_id).first()
    if not l: raise HTTPException(status_code=404, detail="List not found")
    l.contacts = [c for c in l.contacts if c.contact_id not in set(contact_ids)]
    db.commit()
    RedisContactsService.invalidate_lists(l.org_id)
    return {"detail": "removed"}

@router.delete("/lists/{list_id}")
def delete_list(list_id: str, db: Session = Depends(get_db)):
    l = db.query(ContactList).filter(ContactList.list_id==list_id).first()
    if not l: raise HTTPException(status_code=404, detail="List not found")
    l.deleted_at = datetime.utcnow()
    db.commit()
    RedisContactsService.invalidate_lists(l.org_id)
    return {"detail": "List deleted (soft)"}
