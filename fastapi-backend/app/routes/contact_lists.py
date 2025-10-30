from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from uuid import uuid4
from ..db import get_db
from ..models.contact import ContactList, list_members, Contact
from ..schemas.contact import ListCreate, ListOut, ListUpdate
from sqlalchemy.orm import joinedload
from fastapi import Body
from typing import List

router = APIRouter(
    prefix="/contact-lists",
    tags=["contact-lists"]
)

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

@router.delete("/{list_id}/contacts")
def remove_contacts_from_list(
    list_id: str,
    contact_ids: List[str] = Body(..., embed=True),
    db: Session = Depends(get_db)
):
    record = (
        db.query(ContactList)
        .options(joinedload(ContactList.contacts))
        .filter(ContactList.list_id == list_id)
        .first()
    )

    if not record:
        raise HTTPException(404, "List not found")

    # Remove only selected contacts
    db.execute(
        list_members.delete().where(
            list_members.c.list_id == list_id,
            list_members.c.contact_id.in_(contact_ids)
        )
    )

    db.commit()
    return {"success": True, "removed": contact_ids}

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

@router.patch("/{list_id}/remove", response_model=ListOut)
def remove_contacts_patch(
    list_id: str,
    data: ListUpdate,
    db: Session = Depends(get_db)
):
    if not data.contact_ids:
        raise HTTPException(400, "contact_ids is required")

    db.execute(
        list_members.delete().where(
            list_members.c.list_id == list_id,
            list_members.c.contact_id.in_(data.contact_ids)
        )
    )
    db.commit()

    record = (
        db.query(ContactList)
        .options(joinedload(ContactList.contacts))
        .filter(ContactList.list_id == list_id)
        .first()
    )

    return record


@router.delete("/{list_id}")
def delete_list(list_id: str, db: Session = Depends(get_db)):
    record = db.query(ContactList).filter(ContactList.list_id == list_id).first()

    if not record:
        raise HTTPException(404, "List not found")

    db.delete(record)
    db.commit()
    return {"success": True}
