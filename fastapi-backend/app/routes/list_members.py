from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from uuid import uuid4
from ..db import get_db
from ..models.contact import ContactList, list_members, Contact
from ..schemas.contact import ListCreate, ListOut, ListUpdate
from sqlalchemy.orm import joinedload
from pydantic import BaseModel

router = APIRouter(
    prefix="/contact-lists",
    tags=["contact-lists"]
)

# ============================================================
# SCHEMAS FOR LIST MEMBERSHIP
# ============================================================
class AddContactsToList(BaseModel):
    contact_ids: list[str]

class RemoveContactsFromList(BaseModel):
    contact_ids: list[str]


# ============================================================
# EXISTING ENDPOINTS
# ============================================================
@router.post("/", response_model=ListOut)
def create_list(data: ListCreate, db: Session = Depends(get_db)):
    new_list = ContactList(
        list_id=data.list_id or str(uuid4()),
        org_id=data.org_id,
        list_name=data.list_name,
        status=data.status
    )
    db.add(new_list)
    db.commit()
    db.refresh(new_list)

    # attach contacts if given
    if data.contact_ids:
        for cid in data.contact_ids:
            db.execute(list_members.insert().values(list_id=new_list.list_id, contact_id=cid))
        db.commit()

    return new_list


@router.get("/", response_model=list[ListOut])
def get_lists(org_id: str, db: Session = Depends(get_db)):
    return db.query(ContactList)\
        .options(
            joinedload(ContactList.contacts)
                .joinedload(Contact.emails),
            joinedload(ContactList.contacts)
                .joinedload(Contact.phones),
            joinedload(ContactList.contacts)
                .joinedload(Contact.socials)
        )\
        .filter(ContactList.org_id == org_id)\
        .all()


@router.patch("/{list_id}", response_model=ListOut)
def update_list(list_id: str, data: ListUpdate, db: Session = Depends(get_db)):
    record = db.query(ContactList).filter(ContactList.list_id == list_id).first()

    if not record:
        raise HTTPException(404, "List not found")

    if data.list_name:
        record.list_name = data.list_name

    if data.status:
        record.status = data.status

    db.commit()

    # Replace contact ids
    if data.contact_ids is not None:
        db.execute(list_members.delete().where(list_members.c.list_id == list_id))
        for cid in data.contact_ids:
            db.execute(list_members.insert().values(list_id=list_id, contact_id=cid))
        db.commit()

    db.refresh(record)
    return record


@router.delete("/{list_id}")
def delete_list(list_id: str, db: Session = Depends(get_db)):
    record = db.query(ContactList).filter(ContactList.list_id == list_id).first()

    if not record:
        raise HTTPException(404, "List not found")

    db.delete(record)
    db.commit()
    return {"success": True}


# ============================================================
# NEW: ADD CONTACTS TO LIST
# ============================================================
@router.post("/{list_id}/contacts", response_model=ListOut)
def add_contacts_to_list(
    list_id: str, 
    data: AddContactsToList, 
    db: Session = Depends(get_db)
):
    """Add one or more contacts to a list (without removing existing ones)"""
    record = db.query(ContactList).filter(ContactList.list_id == list_id).first()
    
    if not record:
        raise HTTPException(404, "List not found")
    
    # Verify all contacts exist
    for contact_id in data.contact_ids:
        contact = db.query(Contact).filter(Contact.contact_id == contact_id).first()
        if not contact:
            raise HTTPException(404, f"Contact {contact_id} not found")
    
    # Get existing contact IDs in the list
    existing = db.execute(
        list_members.select().where(list_members.c.list_id == list_id)
    ).fetchall()
    existing_ids = {row.contact_id for row in existing}
    
    # Only add contacts that aren't already in the list
    added_count = 0
    for contact_id in data.contact_ids:
        if contact_id not in existing_ids:
            db.execute(
                list_members.insert().values(
                    list_id=list_id, 
                    contact_id=contact_id
                )
            )
            added_count += 1
    
    db.commit()
    db.refresh(record)
    
    return record


# ============================================================
# NEW: REMOVE CONTACTS FROM LIST
# ============================================================
@router.delete("/{list_id}/contacts")
def remove_contacts_from_list(
    list_id: str,
    data: RemoveContactsFromList,
    db: Session = Depends(get_db)
):
    """Remove one or more contacts from a list"""
    record = db.query(ContactList).filter(ContactList.list_id == list_id).first()
    
    if not record:
        raise HTTPException(404, "List not found")
    
    # Remove the specified contacts
    for contact_id in data.contact_ids:
        db.execute(
            list_members.delete().where(
                (list_members.c.list_id == list_id) & 
                (list_members.c.contact_id == contact_id)
            )
        )
    
    db.commit()
    
    return {
        "success": True,
        "removed_count": len(data.contact_ids),
        "list_id": list_id
    }


# ============================================================
# NEW: GET AVAILABLE CONTACTS (not in list)
# ============================================================
@router.get("/{list_id}/available-contacts")
def get_available_contacts(
    list_id: str,
    org_id: str,
    db: Session = Depends(get_db)
):
    """Get all contacts in the org that are NOT in this list"""
    
    # Get contact IDs already in the list
    in_list = db.execute(
        list_members.select().where(list_members.c.list_id == list_id)
    ).fetchall()
    in_list_ids = {row.contact_id for row in in_list}
    
    # Get all org contacts
    all_contacts = db.query(Contact)\
        .options(
            joinedload(Contact.emails),
            joinedload(Contact.phones),
            joinedload(Contact.socials)
        )\
        .filter(Contact.org_id == org_id)\
        .all()
    
    # Filter out contacts already in list
    available = [c for c in all_contacts if c.contact_id not in in_list_ids]
    
    return available