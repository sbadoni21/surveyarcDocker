from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import uuid

from ..db import get_db
from ..models.tickets import Ticket, TicketWorklog
from ..schemas.tickets import WorklogCreate, WorklogOut
from ..policies.tickets import can_view_ticket, can_edit_ticket

router = APIRouter(prefix="/tickets", tags=["Tickets - Worklogs"])

@router.get("/{ticket_id}/worklogs", response_model=list[WorklogOut])
def list_worklogs(ticket_id: str, _t = Depends(can_view_ticket), db: Session = Depends(get_db)):
    rows = (
        db.query(TicketWorklog)
        .filter(TicketWorklog.ticket_id == ticket_id)
        .order_by(TicketWorklog.created_at.desc())
        .all()
    )
    return rows

@router.post("/{ticket_id}/worklogs", response_model=WorklogOut, status_code=201)
def create_worklog(
    ticket_id: str,
    payload: WorklogCreate,
    _t = Depends(can_edit_ticket),
    db: Session = Depends(get_db),
):
    if payload.user_id is None:
        raise HTTPException(400, "user_id required")

    # ensure ticket exists (can_edit_ticket already loaded it, but validate anyway)
    t = db.get(Ticket, ticket_id)
    if not t:
        raise HTTPException(404, "Ticket not found")

    wl = TicketWorklog(
        worklog_id=f"twl_{uuid.uuid4().hex[:10]}",
        ticket_id=ticket_id,
        user_id=payload.user_id,
        minutes=payload.minutes,
        kind=payload.kind,
        note=payload.note,
    )
    db.add(wl)
    db.commit()
    db.refresh(wl)
    return wl
