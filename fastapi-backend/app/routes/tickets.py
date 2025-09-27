# app/routers/tickets.py
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, select
from typing import List, Optional
import uuid
from datetime import datetime

from ..db import get_db
from ..services.redis_ticket_service import RedisTicketService
from ..services.redis_sla_service import get_ticket_sla_status  # optional use

from ..models.tickets import (
    Ticket,
    Tag,
    ticket_tags,
    TicketStatus,
    TicketComment,
    TicketAttachment,
    TicketCollaborator,
    TicketCollaboratorRole,
    TicketSLAStatus,
    SLA,
)
from ..schemas.tickets import (
    TicketCreate,
    TicketUpdate,
    TicketOut,
    CommentCreate,
    CommentOut,
    AttachmentCreate,
    AttachmentOut,
    CollaboratorCreate,
    CollaboratorOut,
)

from ..models.sla import SLADimension
from ..services import sla_service

router = APIRouter(prefix="/tickets", tags=["Tickets"])


def _ensure_sla_status_if_needed(db: Session, t: Ticket) -> None:
    if not t.sla_id:
        return
    if t.sla_status:
        return
    st = TicketSLAStatus(ticket_id=t.ticket_id, sla_id=t.sla_id, paused=False, meta={})
    db.add(st)
    # start and compute dues
    sla_service.ensure_started(st)
    sla_obj = db.get(SLA, t.sla_id)
    if sla_obj:
        sla_service._recompute_due(db, st, sla_obj)


def _invalidate_all(db: Session, t: Ticket):
    RedisTicketService.invalidate_ticket(t.ticket_id)
    RedisTicketService.invalidate_org_lists_and_counts(t.org_id)


# ------------------------------- CRUD --------------------------------

@router.get("/", response_model=List[TicketOut])
def list_tickets(
    org_id: str = Query(...),
    status: Optional[TicketStatus] = Query(None),
    assignee_id: Optional[str] = Query(None),
    q: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    group_id: Optional[str] = Query(None),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    if status is None and assignee_id is None and q is None and group_id is None and offset == 0:
        cached = RedisTicketService.get_org_list(org_id)
        if cached:
            return cached

    stmt = select(Ticket).where(Ticket.org_id == org_id)
    if status is not None:
        stmt = stmt.where(Ticket.status == status)
    if assignee_id:
        stmt = stmt.where(Ticket.assignee_id == assignee_id)
    if group_id:
        stmt = stmt.where(Ticket.group_id == group_id)
    if q:
        like = f"%{q.lower()}%"
        stmt = stmt.where(func.lower(Ticket.subject).like(like))

    stmt = stmt.order_by(Ticket.created_at.desc()).limit(limit).offset(offset)
    records = db.execute(stmt).scalars().all()

    if status is None and assignee_id is None and q is None and group_id is None and offset == 0:
        RedisTicketService.cache_org_list(org_id, records)

    return [TicketOut.model_validate(r, from_attributes=True) for r in records]


@router.get("/{ticket_id}", response_model=TicketOut)
def get_ticket(ticket_id: str, db: Session = Depends(get_db)):
    cached = RedisTicketService.get_ticket(ticket_id)
    if cached:
        return cached

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

    if payload.tags:
        tags = db.query(Tag).filter(Tag.tag_id.in_(payload.tags)).all()
        t.tags = tags

    db.flush()
    _ensure_sla_status_if_needed(db, t)

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

    old_status = t.status

    data = payload.model_dump(exclude_unset=True, exclude={"tags"})
    for k, v in data.items():
        setattr(t, k, v)

    if payload.tags is not None:
        if not payload.tags:
            t.tags = []
        else:
            tags = db.query(Tag).filter(Tag.tag_id.in_(payload.tags)).all()
            t.tags = tags

    _ensure_sla_status_if_needed(db, t)

    if t.sla_id and t.sla_status and payload.status is not None and payload.status != old_status:
        if payload.status in (TicketStatus.pending, TicketStatus.on_hold):
            sla_service.pause_sla(db, t, SLADimension.resolution, reason="status_changed")
        elif payload.status in (TicketStatus.open, TicketStatus.new):
            sla_service.resume_sla(db, t, SLADimension.resolution)
        elif payload.status == TicketStatus.resolved:
            sla_service.mark_resolved(db, t)

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
    if status is None:
        cached = RedisTicketService.get_count_org(org_id)
        if cached is not None:
            return {"count": cached}

        cnt = db.query(func.count(Ticket.ticket_id)).filter(Ticket.org_id == org_id).scalar() or 0
        RedisTicketService.cache_count_org(org_id, cnt)
        return {"count": cnt}

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


@router.get("/count", response_model=dict)
def count_alias(
    org_id: str = Query(...),
    status: Optional[TicketStatus] = Query(None),
    db: Session = Depends(get_db),
):
    return counts_for_org(org_id=org_id, status=status, db=db)


@router.get("/counts", response_model=dict)
def counts_alias(
    org_id: str = Query(...),
    status: Optional[TicketStatus] = Query(None),
    db: Session = Depends(get_db),
):
    return counts_for_org(org_id=org_id, status=status, db=db)


# ---------------------------- collaborators ---------------------------

@router.get("/{ticket_id}/collaborators", response_model=List[CollaboratorOut])
def list_collaborators(ticket_id: str, db: Session = Depends(get_db)):
    t = db.get(Ticket, ticket_id)
    if not t:
        raise HTTPException(404, "Ticket not found")
    rows = db.query(TicketCollaborator).filter(TicketCollaborator.ticket_id == ticket_id).all()
    return [CollaboratorOut.model_validate(r, from_attributes=True) for r in rows]


@router.post("/{ticket_id}/collaborators", response_model=CollaboratorOut, status_code=201)
def add_collaborator(ticket_id: str, payload: CollaboratorCreate, db: Session = Depends(get_db)):
    if ticket_id != payload.ticket_id:
        raise HTTPException(400, "ticket_id mismatch")
    t = db.get(Ticket, ticket_id)
    if not t:
        raise HTTPException(404, "Ticket not found")

    exists = db.query(TicketCollaborator).filter_by(ticket_id=ticket_id, user_id=payload.user_id).first()
    if exists:
        exists.role = TicketCollaboratorRole(payload.role)
        db.commit(); db.refresh(exists)
        _invalidate_all(db, t)
        return CollaboratorOut.model_validate(exists, from_attributes=True)

    row = TicketCollaborator(
        collab_id=f"tcol_{uuid.uuid4().hex[:10]}",
        ticket_id=ticket_id,
        user_id=payload.user_id,
        role=TicketCollaboratorRole(payload.role),
    )
    db.add(row); db.commit(); db.refresh(row)
    _invalidate_all(db, t)
    return CollaboratorOut.model_validate(row, from_attributes=True)


@router.delete("/{ticket_id}/collaborators/{user_id}", status_code=204)
def remove_collaborator(ticket_id: str, user_id: str, db: Session = Depends(get_db)):
    t = db.get(Ticket, ticket_id)
    if not t:
        raise HTTPException(404, "Ticket not found")
    row = db.query(TicketCollaborator).filter_by(ticket_id=ticket_id, user_id=user_id).first()
    if not row:
        raise HTTPException(404, "Not found")
    db.delete(row); db.commit()
    _invalidate_all(db, t)
    return None


# ------------------------------- comments -----------------------------

@router.get("/{ticket_id}/comments", response_model=List[CommentOut])
def list_comments(ticket_id: str, db: Session = Depends(get_db)):
    t = db.get(Ticket, ticket_id)
    if not t:
        raise HTTPException(404, "Ticket not found")
    rows = (
        db.query(TicketComment)
        .filter(TicketComment.ticket_id == ticket_id)
        .order_by(TicketComment.created_at.asc())
        .all()
    )
    return [CommentOut.model_validate(r, from_attributes=True) for r in rows]


@router.post("/{ticket_id}/comments", response_model=CommentOut, status_code=201)
def create_comment(ticket_id: str, payload: CommentCreate, db: Session = Depends(get_db)):
    if ticket_id != payload.ticket_id:
        raise HTTPException(400, "ticket_id mismatch")

    t = db.get(Ticket, ticket_id)
    if not t:
        raise HTTPException(404, "Ticket not found")

    comment_id = getattr(payload, "comment_id", None) or f"tcm_{uuid.uuid4().hex[:10]}"
    row = TicketComment(
        comment_id=comment_id,
        ticket_id=payload.ticket_id,
        author_id=payload.author_id,
        body=payload.body,
        is_internal=payload.is_internal,
    )
    db.add(row)

    # First response completion hook: first public agent reply
    if t.sla_id and t.sla_status and not payload.is_internal:
        if payload.author_id != t.requester_id and t.first_response_at is None:
            sla_service.mark_first_response_done(db, t)

        # pause/resume heuristic for resolution clock
        if payload.author_id == t.requester_id:
            sla_service.resume_sla(db, t, SLADimension.resolution)
        else:
            if payload.body and ("needs info" in payload.body.lower() or payload.body.strip().endswith("?")):
                sla_service.pause_sla(db, t, SLADimension.resolution, reason="awaiting_customer_info")

    # activity bump
    t.last_activity_at = datetime.utcnow()

    db.commit(); db.refresh(row)
    _invalidate_all(db, t)
    return CommentOut.model_validate(row, from_attributes=True)


@router.delete("/{ticket_id}/comments/{comment_id}", status_code=204)
def delete_comment(ticket_id: str, comment_id: str, db: Session = Depends(get_db)):
    t = db.get(Ticket, ticket_id)
    if not t:
        raise HTTPException(404, "Ticket not found")
    row = db.get(TicketComment, comment_id)
    if not row or row.ticket_id != ticket_id:
        raise HTTPException(404, "Comment not found")
    db.delete(row); db.commit()
    _invalidate_all(db, t)
    return None


# ------------------------------ attachments ---------------------------

@router.get("/{ticket_id}/attachments", response_model=List[AttachmentOut])
def list_attachments(ticket_id: str, db: Session = Depends(get_db)):
    t = db.get(Ticket, ticket_id)
    if not t:
        raise HTTPException(404, "Ticket not found")
    rows = (
        db.query(TicketAttachment)
        .filter(TicketAttachment.ticket_id == ticket_id)
        .order_by(TicketAttachment.created_at.asc())
        .all()
    )
    return [AttachmentOut.model_validate(r, from_attributes=True) for r in rows]


@router.post("/{ticket_id}/attachments", response_model=AttachmentOut, status_code=201)
def create_attachment(ticket_id: str, payload: AttachmentCreate, db: Session = Depends(get_db)):
    if ticket_id != payload.ticket_id:
        raise HTTPException(400, "ticket_id mismatch")

    t = db.get(Ticket, ticket_id)
    if not t:
        raise HTTPException(404, "Ticket not found")

    attachment_id = getattr(payload, "attachment_id", None) or f"tat_{uuid.uuid4().hex[:10]}"
    row = TicketAttachment(
        attachment_id=attachment_id,
        ticket_id=payload.ticket_id,
        comment_id=payload.comment_id,
        filename=payload.filename,
        content_type=payload.content_type,
        size_bytes=payload.size_bytes,
        storage_key=payload.storage_key,
        url=payload.url,
        checksum=payload.checksum,
        uploaded_by=payload.uploaded_by,
    )
    db.add(row)
    db.commit(); db.refresh(row)
    _invalidate_all(db, t)
    return AttachmentOut.model_validate(row, from_attributes=True)


@router.delete("/{ticket_id}/attachments/{attachment_id}", status_code=204)
def delete_attachment(ticket_id: str, attachment_id: str, db: Session = Depends(get_db)):
    t = db.get(Ticket, ticket_id)
    if not t:
        raise HTTPException(404, "Ticket not found")
    row = db.get(TicketAttachment, attachment_id)
    if not row or row.ticket_id != ticket_id:
        raise HTTPException(404, "Attachment not found")
    db.delete(row); db.commit()
    _invalidate_all(db, t)
    return None
