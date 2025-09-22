from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import uuid
from sqlalchemy.sql import func

from ..db import get_db
from ..models.ticket import Ticket
from ..schemas.ticket import TicketCreate, TicketUpdate, TicketOut, TicketComment

router = APIRouter(prefix="/tickets", tags=["Tickets"])

@router.post("/", response_model=TicketOut)
def create_ticket(data: TicketCreate, db: Session = Depends(get_db)):
    ticket_id = data.ticket_id or f"tkt_{uuid.uuid4().hex[:10]}"
    print(ticket_id)
    ticket = Ticket(   
        ticket_id=ticket_id,
        org_id=data.org_id,
        survey_id=data.survey_id,
        question_id=data.question_id,
        subject=data.subject,
        description=data.description,
        created_by=data.created_by,
        status=data.status,
        priority=data.priority,
        assigned_to=data.assigned_to,
        comments=[c.dict() for c in (data.comments or [])],
    )
    db.add(ticket)
    db.commit()
    db.refresh(ticket)
    return ticket

@router.get("/{ticket_id}", response_model=TicketOut)
def get_ticket(ticket_id: str, db: Session = Depends(get_db)):
    ticket = db.query(Ticket).filter(Ticket.ticket_id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    return ticket

@router.patch("/{ticket_id}", response_model=TicketOut)
def update_ticket(ticket_id: str, data: TicketUpdate, db: Session = Depends(get_db)):
    ticket = db.query(Ticket).filter(Ticket.ticket_id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    payload = data.model_dump(exclude_unset=True)
    if "comments" in payload and payload["comments"] is not None:
        payload["comments"] = [c.dict() for c in payload["comments"]]

    for k, v in payload.items():
        setattr(ticket, k, v)

    db.commit()
    db.refresh(ticket)
    return ticket

@router.delete("/{ticket_id}")
def delete_ticket(ticket_id: str, db: Session = Depends(get_db)):
    ticket = db.query(Ticket).filter(Ticket.ticket_id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    db.delete(ticket)
    db.commit()
    return {"detail": "Ticket deleted"}

# Handy list endpoints
@router.get("/org/{org_id}", response_model=List[TicketOut])
def list_by_org(org_id: str, db: Session = Depends(get_db)):
    return db.query(Ticket).filter(Ticket.org_id == org_id).order_by(Ticket.created_at.desc()).all()

@router.get("/survey/{survey_id}", response_model=List[TicketOut])
def list_by_survey(survey_id: str, db: Session = Depends(get_db)):
    return db.query(Ticket).filter(Ticket.survey_id == survey_id).order_by(Ticket.created_at.desc()).all()

@router.get("/question/{question_id}", response_model=List[TicketOut])
def list_by_question(question_id: str, db: Session = Depends(get_db)):
    return db.query(Ticket).filter(Ticket.question_id == question_id).order_by(Ticket.created_at.desc()).all()

# Add a single comment
@router.post("/{ticket_id}/comments", response_model=TicketOut)
def add_comment(ticket_id: str, comment: TicketComment, db: Session = Depends(get_db)):
    ticket = db.query(Ticket).filter(Ticket.ticket_id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    comments = list(ticket.comments or [])
    comments.append({
        "uid": comment.uid,
        "comment": comment.comment,
        "created_at": func.now(),  # let DB set timestamp
    })
    ticket.comments = comments
    db.commit()
    db.refresh(ticket)
    return ticket
