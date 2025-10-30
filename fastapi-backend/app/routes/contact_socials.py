from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from uuid import uuid4
from ..db import get_db
from ..models.contact import ContactSocial as DBSocial
from ..schemas.contact import ContactSocial as SocialSchema

router = APIRouter(
    prefix="/contact-socials",
    tags=["contact-socials"]
)

@router.post("/", response_model=SocialSchema)
def create_social(data: SocialSchema, db: Session = Depends(get_db)):
    social = DBSocial(
        id=str(uuid4()),
        contact_id=data.id or data.contact_id,
        platform=data.platform,
        handle=data.handle,
        link=data.link
    )

    db.add(social)
    db.commit()
    db.refresh(social)
    return social


@router.get("/", response_model=list[SocialSchema])
def get_socials(contact_id: str | None = None, db: Session = Depends(get_db)):
    q = db.query(DBSocial)

    if contact_id:
        q = q.filter(DBSocial.contact_id == contact_id)

    return q.all()


@router.delete("/{social_id}")
def delete_social(social_id: str, db: Session = Depends(get_db)):
    record = db.query(DBSocial).filter(DBSocial.id == social_id).first()

    if not record:
        raise HTTPException(404, "Social record not found")

    db.delete(record)
    db.commit()
    return {"success": True}
