from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from uuid import uuid4
from ..db import get_db
from ..models.contact import ContactPhone as DBContactPhone
from ..schemas.contact import ContactPhone as PhoneSchema

router = APIRouter(
    prefix="/contact-phones",
    tags=["contact-phones"]
)

@router.post("/", response_model=PhoneSchema)
def create_phone(data: PhoneSchema, db: Session = Depends(get_db)):
    phone = DBContactPhone(
        id=str(uuid4()),
        contact_id=data.id or data.contact_id,
        country_code=data.country_code,
        phone_number=data.phone_number,
        is_primary=data.is_primary,
        is_whatsapp=data.is_whatsapp,
        is_verified=data.is_verified,
    )
    db.add(phone)
    db.commit()
    db.refresh(phone)
    return phone


@router.get("/", response_model=list[PhoneSchema])
def get_phones(contact_id: str | None = None, db: Session = Depends(get_db)):
    q = db.query(DBContactPhone)

    if contact_id:
        q = q.filter(DBContactPhone.contact_id == contact_id)

    return q.all()


@router.delete("/{phone_id}")
def delete_phone(phone_id: str, db: Session = Depends(get_db)):
    record = db.query(DBContactPhone).filter(DBContactPhone.id == phone_id).first()

    if not record:
        raise HTTPException(404, "Phone not found")

    db.delete(record)
    db.commit()
    return {"success": True}
