from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from sqlalchemy.sql import func
from ..db import get_db
from ..models.invite import Invite
from ..schemas.invite import InviteCreate, InviteResponse

router = APIRouter(prefix="/invites", tags=["Invites"])

@router.post("/", response_model=InviteResponse)
def create_invite(data: InviteCreate, db: Session = Depends(get_db)):
    db_invite = Invite(**data.dict())
    db.add(db_invite)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Invite already exists")
    db.refresh(db_invite)
    return db_invite

@router.get("/{invite_id}", response_model=InviteResponse)
def get_invite(invite_id: str, db: Session = Depends(get_db)):
    db_invite = db.query(Invite).filter(Invite.invite_id == invite_id).first()
    if not db_invite:
        raise HTTPException(status_code=404, detail="Invite not found")
    return db_invite

@router.put("/{invite_id}", response_model=InviteResponse)
def update_invite(invite_id: str, update_data: InviteCreate, db: Session = Depends(get_db)):
    db_invite = db.query(Invite).filter(Invite.invite_id == invite_id).first()
    if not db_invite:
        raise HTTPException(status_code=404, detail="Invite not found")
    for key, value in update_data.dict().items():
        setattr(db_invite, key, value)
    db_invite.updated_at = func.now()
    db.commit()
    db.refresh(db_invite)
    return db_invite

@router.delete("/{invite_id}", response_model=dict)
def delete_invite(invite_id: str, db: Session = Depends(get_db)):
    db_invite = db.query(Invite).filter(Invite.invite_id == invite_id).first()
    if not db_invite:
        raise HTTPException(status_code=404, detail="Invite not found")
    db.delete(db_invite)
    db.commit()
    return {"detail": "Invite deleted"}
