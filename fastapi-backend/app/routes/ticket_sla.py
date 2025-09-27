# app/routers/ticket_sla.py
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..db import get_db
from ..models.sla import SLADimension
from ..models.tickets import Ticket, TicketSLAStatus, SLA
from ..services import sla_service

router = APIRouter(prefix="/tickets", tags=["Tickets.SLA"])

class PauseReq(BaseModel):
    dimension: SLADimension
    reason: str

class ResumeReq(BaseModel):
    dimension: SLADimension

@router.post("/{ticket_id}/sla/pause")
def pause_ticket_sla(ticket_id: str, payload: PauseReq, db: Session = Depends(get_db)):
    t = db.get(Ticket, ticket_id)
    if not t:
        raise HTTPException(404, "Ticket not found")
    if not t.sla_id or not t.sla_status:
        raise HTTPException(400, "No SLA attached to this ticket")

    st = sla_service.pause_sla(db, t, payload.dimension, payload.reason)
    db.commit(); db.refresh(st)
    return sla_service.get_timers(db, ticket_id)

@router.post("/{ticket_id}/sla/resume")
def resume_ticket_sla(ticket_id: str, payload: ResumeReq, db: Session = Depends(get_db)):
    t = db.get(Ticket, ticket_id)
    if not t:
        raise HTTPException(404, "Ticket not found")
    if not t.sla_id or not t.sla_status:
        raise HTTPException(400, "No SLA attached to this ticket")

    st = sla_service.resume_sla(db, t, payload.dimension)
    db.commit(); db.refresh(st)
    return sla_service.get_timers(db, ticket_id)

@router.get("/{ticket_id}/sla/timers")
def read_ticket_sla_timers(ticket_id: str, db: Session = Depends(get_db)):
    t = db.get(Ticket, ticket_id)
    if not t:
        raise HTTPException(404, "Ticket not found")
    return sla_service.get_timers(db, ticket_id)
