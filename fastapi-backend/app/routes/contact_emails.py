from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from uuid import uuid4
from ..db import get_db
from ..models.contact import ContactEmail

router = APIRouter(
    prefix="/contact-emails",
    tags=["contact-emails"]
)

@router.post("/")
def create_contact_email(data: dict, db: Session = Depends(get_db)):
    email = ContactEmail(
        id=str(uuid4()),
        contact_id=data["contact_id"],
        email=data["email"],
        email_lower=data["email"].lower(),
        is_primary=data.get("is_primary", False),
        is_verified=data.get("is_verified", False),
    )
    db.add(email)
    db.commit()
    db.refresh(email)
    return email


@router.get("/")
def get_contact_emails(contact_id: str | None = None, db: Session = Depends(get_db)):
    q = db.query(ContactEmail)

    if contact_id:
        q = q.filter(ContactEmail.contact_id == contact_id)

    return q.all()
