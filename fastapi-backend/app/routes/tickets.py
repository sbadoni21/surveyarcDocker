# app/routers/tickets.py
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, select
from typing import List, Optional
import uuid

from ..db import get_db
from ..models.tickets import Ticket, Tag, ticket_tags, TicketStatus
from ..schemas.tickets import (
    TicketCreate, TicketUpdate, TicketOut,
    CommentCreate, CommentOut, AttachmentCreate, AttachmentOut,
)
from ..services.redis_ticket_service import RedisTicketService
from ..models.tickets import Ticket, Tag, TicketCollaborator, TicketCollaboratorRole
from ..schemas.tickets import TicketOut, TicketCreate, TicketUpdate, CollaboratorCreate, CollaboratorOut
router = APIRouter(prefix="/tickets", tags=["Tickets"])




# ------------------------------- CRUD --------------------------------

@router.get("/", response_model=List[TicketOut])
def list_tickets(
    org_id: str = Query(...),
    status: Optional[TicketStatus] = Query(None),
    assignee_id: Optional[str] = Query(None),
    q: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    group_id: Optional[str] = Query(None),         # <-- NEW

    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    """
    List tickets for an org with optional filters.
    For the simplest case (org only, first page), we attempt Redis list.
    """
    # Try cache only when no filters and page is first window
    if status is None and assignee_id is None and q is None and offset == 0:
        cached = RedisTicketService.get_org_list(org_id)
        if cached:
            return cached

    stmt = select(Ticket).where(Ticket.org_id == org_id)
    if status is not None:
        stmt = stmt.where(Ticket.status == status)
    if assignee_id:
        stmt = stmt.where(Ticket.assignee_id == assignee_id)
    if group_id:
        stmt = stmt.where(Ticket.group_id == group_id)   # <-- NEW
    if q:
        like = f"%{q.lower()}%"
        stmt = stmt.where(func.lower(Ticket.subject).like(like))

    stmt = stmt.order_by(Ticket.created_at.desc()).limit(limit).offset(offset)
    records = db.execute(stmt).scalars().all()

    # Cache simple org list (first page, no filters)
    if status is None and assignee_id is None and q is None and offset == 0:
        RedisTicketService.cache_org_list(org_id, records)

    return [TicketOut.model_validate(r, from_attributes=True) for r in records]


@router.get("/{ticket_id}", response_model=TicketOut)
def get_ticket(ticket_id: str, db: Session = Depends(get_db)):
    cached = RedisTicketService.get_ticket(ticket_id)
    if cached:
        return cached  # already JSON serializable

    t = db.get(Ticket, ticket_id)
    if not t:
        raise HTTPException(status_code=404, detail="Ticket not found")

    dto = TicketOut.model_validate(t, from_attributes=True)
    RedisTicketService.cache_ticket(dto)
    return dto


@router.post("/", response_model=TicketOut, status_code=201)
def create_ticket(payload: TicketCreate, db: Session = Depends(get_db)):
    ticket_id = getattr(payload, "ticket_id", None) or f"tkt_{uuid.uuid4().hex[:10]}"
    t = Ticket(ticket_id=ticket_id, **payload.model_dump(exclude={"tags", "ticket_id"}))
    db.add(t)

    # Handle tags if provided
    if payload.tags:
        tags = db.query(Tag).filter(Tag.tag_id.in_(payload.tags)).all()
        t.tags = tags

    db.commit()
    db.refresh(t)

    dto = TicketOut.model_validate(t, from_attributes=True)
    RedisTicketService.cache_ticket(dto)
    RedisTicketService.invalidate_org_lists_and_counts(t.org_id)
    return dto


@router.patch("/{ticket_id}", response_model=TicketOut)
def update_ticket(ticket_id: str, payload: TicketUpdate, db: Session = Depends(get_db)):
    t: Ticket | None = db.get(Ticket, ticket_id)
    if not t:
        raise HTTPException(status_code=404, detail="Ticket not found")

    # Full replace tags if provided
    data = payload.model_dump(exclude_unset=True, exclude={"tags"})
    for k, v in data.items():
        setattr(t, k, v)

    if payload.tags is not None:
        if not payload.tags:
            t.tags = []
        else:
            tags = db.query(Tag).filter(Tag.tag_id.in_(payload.tags)).all()
            t.tags = tags

    db.commit()
    db.refresh(t)

    dto = TicketOut.model_validate(t, from_attributes=True)
    RedisTicketService.cache_ticket(dto)
    RedisTicketService.invalidate_org_lists_and_counts(t.org_id)
    return dto


@router.delete("/{ticket_id}", status_code=204)
def delete_ticket(ticket_id: str, db: Session = Depends(get_db)):
    t: Ticket | None = db.get(Ticket, ticket_id)
    if not t:
        raise HTTPException(status_code=404, detail="Ticket not found")
    org_id = t.org_id
    db.delete(t)
    db.commit()

    RedisTicketService.invalidate_ticket(ticket_id)
    RedisTicketService.invalidate_org_lists_and_counts(org_id)
    return None


# ------------------------------- counts -------------------------------

@router.get("/counts/org", response_model=dict)
def counts_for_org(
    org_id: str = Query(...),
    status: Optional[TicketStatus] = Query(None),
    db: Session = Depends(get_db),
):
    """
    Returns {"count": n}.
    If status is given, count for that status; else total for org.
    Uses Redis with a brief TTL.
    """
    if status is None:
        cached = RedisTicketService.get_count_org(org_id)
        if cached is not None:
            return {"count": cached}

        cnt = db.query(func.count(Ticket.ticket_id)).filter(Ticket.org_id == org_id).scalar() or 0
        RedisTicketService.cache_count_org(org_id, cnt)
        return {"count": cnt}

    # per-status
    cached = RedisTicketService.get_count_org_status(org_id, status.value)
    if cached is not None:
        return {"count": cached}

    cnt = (
        db.query(func.count(Ticket.ticket_id))
        .filter(Ticket.org_id == org_id, Ticket.status == status)
        .scalar()
        or 0
    )
    RedisTicketService.cache_count_org_status(org_id, status.value, cnt)
    return {"count": cnt}
# ---- friendly aliases so /tickets/count (and /tickets/counts) work ----
@router.get("/count", response_model=dict)
def count_alias(
    org_id: str = Query(...),
    status: Optional[TicketStatus] = Query(None),
    db: Session = Depends(get_db),
):
    # delegate to the existing implementation
    return counts_for_org(org_id=org_id, status=status, db=db)

@router.get("/counts", response_model=dict)
def counts_alias(
    org_id: str = Query(...),
    status: Optional[TicketStatus] = Query(None),
    db: Session = Depends(get_db),
):
    return counts_for_org(org_id=org_id, status=status, db=db)

@router.get("/{ticket_id}/collaborators", response_model=list[CollaboratorOut])
def list_collaborators(ticket_id: str, db: Session = Depends(get_db)):
    t = db.get(Ticket, ticket_id)
    if not t:
        raise HTTPException(404, "Ticket not found")
    rows = db.query(TicketCollaborator).filter(TicketCollaborator.ticket_id == ticket_id).all()
    return rows

@router.post("/{ticket_id}/collaborators", response_model=CollaboratorOut, status_code=201)
def add_collaborator(ticket_id: str, payload: CollaboratorCreate, db: Session = Depends(get_db)):
    if ticket_id != payload.ticket_id:
        raise HTTPException(400, "ticket_id mismatch")
    t = db.get(Ticket, ticket_id)
    if not t:
        raise HTTPException(404, "Ticket not found")
    # upsert-lite
    exists = db.query(TicketCollaborator).filter_by(ticket_id=ticket_id, user_id=payload.user_id).first()
    if exists:
        exists.role = TicketCollaboratorRole(payload.role)
        db.commit(); db.refresh(exists)
        return exists
    row = TicketCollaborator(
        collab_id=f"tcol_{uuid.uuid4().hex[:10]}",
        ticket_id=ticket_id,
        user_id=payload.user_id,
        role=TicketCollaboratorRole(payload.role),
    )
    db.add(row); db.commit(); db.refresh(row)
    return row

@router.delete("/{ticket_id}/collaborators/{user_id}", status_code=204)
def remove_collaborator(ticket_id: str, user_id: str, db: Session = Depends(get_db)):
    row = db.query(TicketCollaborator).filter_by(ticket_id=ticket_id, user_id=user_id).first()
    if not row:
        raise HTTPException(404, "Not found")
    db.delete(row); db.commit()


@router.get("/collaborating", response_model=List[TicketOut])
def list_tickets_i_collaborate(
    org_id: str = Query(...),
    user_id: str = Query(...),
    status: Optional[TicketStatus] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    """
    Tickets in org where the user is a collaborator.
    """
    # requires TicketCollaborator model/table; if not present, switch to watchers
    subq = select(TicketCollaborator.ticket_id).where(TicketCollaborator.user_id == user_id).subquery()

    stmt = select(Ticket).where(
        Ticket.org_id == org_id,
        Ticket.ticket_id.in_(select(subq.c.ticket_id))
    )
    if status is not None:
        stmt = stmt.where(Ticket.status == status)

    stmt = stmt.order_by(Ticket.created_at.desc()).limit(limit).offset(offset)
    records = db.execute(stmt).scalars().all()
    return [TicketOut.model_validate(r, from_attributes=True) for r in records]