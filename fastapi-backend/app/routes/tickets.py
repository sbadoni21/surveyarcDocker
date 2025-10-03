# app/routers/tickets.py
from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, selectinload, joinedload
from sqlalchemy import func, select
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime
from ..db import get_db
from ..services.redis_ticket_service import RedisTicketService
from ..services.redis_sla_service import get_ticket_sla_status
from ..models.tickets import Ticket, TicketWorklog, TicketWatcher, TicketAssignment, TicketPriority, TicketSeverity
from ..schemas.tickets import WorklogCreate, WorklogOut
from ..policies.tickets import can_view_ticket, can_edit_ticket
from ..models.ticket_categories import TicketCategory, TicketSubcategory
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
    AssignGroupBody,
    AssignTeamBody,
    AssignAgentBody,
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
    AssignmentMeta,
    SLAProcessingData
)
from ..models.sla import SLADimension, SLA
from ..services import sla_service

router = APIRouter(prefix="/tickets", tags=["Tickets"])

WORD_TO_PRIORITY = {
    "low": "low",
    "normal": "normal",
    "medium": "normal",
    "high": "high",
    "urgent": "urgent",
    "blocker": "blocker",
}

WORD_TO_SEVERITY = {
    "critical": "sev1",
    "sev1": "sev1",
    "high": "sev2",
    "sev2": "sev2",
    "medium": "sev3",
    "sev3": "sev3",
    "low": "sev4",
    "sev4": "sev4",
}

def coerce_priority(v: str | None) -> TicketPriority | None:
    if not v:
        return None
    s = str(v).strip().lower()
    s = WORD_TO_PRIORITY.get(s, s)
    try:
        return TicketPriority(s)
    except Exception:
        return None

def coerce_severity(v: str | None) -> TicketSeverity | None:
    if not v:
        return None
    s = str(v).strip().lower()
    s = WORD_TO_SEVERITY.get(s, s)
    try:
        return TicketSeverity(s)
    except Exception:
        return None

def _ensure_sla_status_if_needed(db: Session, t: Ticket) -> None:
    if not t.sla_id:
        return
    if t.sla_status:
        return
    st = TicketSLAStatus(ticket_id=t.ticket_id, sla_id=t.sla_id, paused=False, meta={})
    db.add(st)
    sla_service.ensure_started(st)
    sla_obj = db.get(SLA, t.sla_id)
    if sla_obj:
        sla_service._recompute_due(db, st, sla_obj)

def _apply_category_defaults_on_create(db: Session, t: Ticket):
    """Apply category/subcategory defaults without overwriting explicit choices"""
    from ..models.ticket_categories import TicketSubcategory
    if not t.subcategory_id:
        return
    sub = db.get(TicketSubcategory, t.subcategory_id)
    if not sub or not sub.active:
        return
    
    if sub.default_priority and not t.priority:
        cp = coerce_priority(sub.default_priority)
        if cp:
            t.priority = cp
    
    if sub.default_severity and not t.severity:
        cs = coerce_severity(sub.default_severity)
        if cs:
            t.severity = cs
    
    if sub.default_sla_id and not t.sla_id:
        t.sla_id = sub.default_sla_id

def _invalidate_all(db: Session, t: Ticket):
    """Invalidate all relevant caches for a ticket"""
    RedisTicketService.invalidate_ticket(t.ticket_id)
    RedisTicketService.invalidate_org_lists_and_counts(t.org_id)
    
    # Invalidate assignment-specific caches
    if t.team_id:
        RedisTicketService.invalidate_team_caches(t.org_id, t.team_id)
    if t.agent_id:
        RedisTicketService.invalidate_agent_caches(t.org_id, t.agent_id)
    if t.assignee_id:
        RedisTicketService.invalidate_all_assignment_caches(
            t.org_id, 
            assignee_id=t.assignee_id
        )

def _import_user_model():
    """Lazy import to avoid circulars"""
    try:
        from ..models.user import User
        return User
    except Exception:
        return None

def _create_sla_status_with_processing(
    db: Session,
    ticket: Ticket,
    sla_processing: Optional[SLAProcessingData]
):
    if not ticket.sla_id:
        return
    
    sla_status_data = {
        "ticket_id": ticket.ticket_id,
        "sla_id": ticket.sla_id,
        "first_response_started_at": datetime.utcnow(),
        "resolution_started_at": datetime.utcnow(),
        "last_resume_first_response": datetime.utcnow(),
        "last_resume_resolution": datetime.utcnow(),
        "paused": False,
        "breached_first_response": False,
        "breached_resolution": False,
        "elapsed_first_response_minutes": 0,
        "elapsed_resolution_minutes": 0,
        "meta": {
            "sla_mode": None,
            "basis_priority": None,
            "basis_severity": None,
            "source": "frontend_or_server"
        }
    }
    
    if sla_processing:
        sla_status_data["meta"]["sla_mode"] = sla_processing.sla_mode
        if sla_processing.first_response_due_at:
            s = sla_processing.first_response_due_at
            if s.endswith("Z"): s = s[:-1] + "+00:00"
            try: sla_status_data["first_response_due_at"] = datetime.fromisoformat(s)
            except Exception: pass
        if sla_processing.resolution_due_at:
            s = sla_processing.resolution_due_at
            if s.endswith("Z"): s = s[:-1] + "+00:00"
            try: sla_status_data["resolution_due_at"] = datetime.fromisoformat(s)
            except Exception: pass
        if sla_processing.calendar_id:
            sla_status_data["calendar_id"] = sla_processing.calendar_id
    
    sla_status = TicketSLAStatus(**sla_status_data)
    db.add(sla_status)
    ticket.sla_status = sla_status
    db.flush()
    
    if not sla_status.first_response_due_at or not sla_status.resolution_due_at:
        mode = sla_status.meta.get("sla_mode") or ("priority" if ticket.priority else "severity")
        sla_status.meta["sla_mode"] = mode
        sla_status.meta["basis_priority"] = ticket.priority.value if ticket.priority else None
        sla_status.meta["basis_severity"] = ticket.severity.value if ticket.severity else None
        sla_status.meta["source"] = "server"
        sla_service.ensure_started(sla_status)
        sla_obj = db.get(SLA, ticket.sla_id)
        if sla_obj:
            sla_service._recompute_due(db, sla_status, sla_obj)
    
    if not ticket.due_at and sla_status.resolution_due_at:
        ticket.due_at = sla_status.resolution_due_at

def _handle_assignment_on_create(db: Session, ticket: Ticket, assignment: AssignmentMeta):
    """Handle assignment metadata during ticket creation"""
    
    if assignment.is_group_selected and assignment.group_id:
        from ..models.support import SupportGroup
        group = db.get(SupportGroup, assignment.group_id)
        if group and group.org_id == ticket.org_id:
            ticket.group_id = assignment.group_id
    
    if assignment.is_team_selected and assignment.team_id:
        from ..models.support import SupportTeam
        team = db.get(SupportTeam, assignment.team_id)
        if team and team.org_id == ticket.org_id:
            ticket.team_id = assignment.team_id
    
    if assignment.is_agent_selected and assignment.agent_id:
        User = _import_user_model()
        if User:
            user = db.get(User, assignment.agent_id)
            if user:
                ticket.agent_id = assignment.agent_id
        else:
            ticket.agent_id = assignment.agent_id

def _create_ticket_creation_event(db: Session, ticket: Ticket, payload: TicketCreate):
    """Create audit event for ticket creation"""
    from ..models.tickets import TicketEvent
    
    event_meta = {
        "creation_method": "web_form",
        "has_sla": bool(ticket.sla_id),
        "has_sla_processing": bool(payload.sla_processing),
        "has_team": bool(ticket.team_id),
        "has_agent": bool(ticket.agent_id),
        "tag_count": len(payload.tags) if payload.tags else 0,
    }
    
    if payload.sla_processing:
        event_meta.update({
            "sla_mode": payload.sla_processing.sla_mode,
            "has_calendar": bool(payload.sla_processing.calendar_id),
            "has_calculated_due_dates": bool(
                payload.sla_processing.first_response_due_at or 
                payload.sla_processing.resolution_due_at
            )
        })
    
    if payload.assignment:
        event_meta.update({
            "assignment_group_selected": payload.assignment.is_group_selected,
            "assignment_team_selected": payload.assignment.is_team_selected,
            "assignment_agent_selected": payload.assignment.is_agent_selected,
            "initiated_by": payload.assignment.initiated_by,
        })
    
    event = TicketEvent(
        event_id=f"evt_{uuid.uuid4().hex[:10]}",
        ticket_id=ticket.ticket_id,
        actor_id=ticket.requester_id,
        event_type="ticket_created",
        from_value={},
        to_value={
            "status": ticket.status.value,
            "priority": ticket.priority.value,
            "severity": ticket.severity.value,
            "assignee_id": ticket.assignee_id,
            "group_id": ticket.group_id,
            "team_id": ticket.team_id,
            "agent_id": ticket.agent_id,
            "sla_id": ticket.sla_id,
        },
        meta=event_meta
    )
    db.add(event)

# ------------------------------- CRUD --------------------------------

@router.get("/{ticket_id}", response_model=TicketOut)
def get_ticket(ticket_id: str, db: Session = Depends(get_db)):
    """Get ticket with SLA status"""
    cached = RedisTicketService.get_ticket(ticket_id)
    if cached:
        return cached
    
    t = db.query(Ticket).options(
        joinedload(Ticket.sla_status),
        joinedload(Ticket.tags)
    ).filter(Ticket.ticket_id == ticket_id).first()
    
    if not t:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    dto = TicketOut.model_validate(t, from_attributes=True)
    RedisTicketService.cache_ticket(dto)
    return dto

@router.get("/", response_model=List[TicketOut])
def list_tickets(
    org_id: str = Query(...),
    status: Optional[TicketStatus] = Query(None),
    assignee_id: Optional[str] = Query(None),
    team_id: Optional[str] = Query(None),
    agent_id: Optional[str] = Query(None),
    q: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    group_id: Optional[str] = Query(None),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    """List tickets with SLA status"""
    # Check cache for simple org list
    if all(v is None for v in [status, assignee_id, team_id, agent_id, q, group_id]) and offset == 0:
        cached = RedisTicketService.get_org_list(org_id)
        if cached:
            return cached
    
    # Check team-specific cache
    if team_id and all(v is None for v in [status, assignee_id, agent_id, q, group_id]) and offset == 0:
        cached = RedisTicketService.get_team_list(org_id, team_id)
        if cached:
            return cached
    
    # Check agent-specific cache
    if agent_id and all(v is None for v in [status, assignee_id, team_id, q, group_id]) and offset == 0:
        cached = RedisTicketService.get_agent_list(org_id, agent_id)
        if cached:
            return cached
    
    stmt = select(Ticket).options(
        joinedload(Ticket.sla_status),
        selectinload(Ticket.tags),
        selectinload(Ticket.comments),
        joinedload(Ticket.group),
    ).where(Ticket.org_id == org_id)
    
    if status is not None:
        stmt = stmt.where(Ticket.status == status)
    if assignee_id:
        stmt = stmt.where(Ticket.assignee_id == assignee_id)
    if team_id:
        stmt = stmt.where(Ticket.team_id == team_id)
    if agent_id:
        stmt = stmt.where(Ticket.agent_id == agent_id)
    if group_id:
        stmt = stmt.where(Ticket.group_id == group_id)
    if q:
        like = f"%{q.lower()}%"
        stmt = stmt.where(func.lower(Ticket.subject).like(like))
    
    stmt = stmt.limit(limit).offset(offset)
    records = db.execute(stmt).scalars().all()
    
    ticket_outs = [TicketOut.model_validate(r, from_attributes=True) for r in records]
    
    # Cache results
    if all(v is None for v in [status, assignee_id, team_id, agent_id, q, group_id]) and offset == 0:
        RedisTicketService.cache_org_list(org_id, ticket_outs)
    elif team_id and all(v is None for v in [status, assignee_id, agent_id, q, group_id]) and offset == 0:
        RedisTicketService.cache_team_list(org_id, team_id, ticket_outs)
    elif agent_id and all(v is None for v in [status, assignee_id, team_id, q, group_id]) and offset == 0:
        RedisTicketService.cache_agent_list(org_id, agent_id, ticket_outs)
    
    return ticket_outs

# app/routers/tickets.py (just the create_ticket function fix)

@router.post("/", response_model=TicketOut, status_code=201)
def create_ticket(payload: TicketCreate, db: Session = Depends(get_db)):
    ticket_id = getattr(payload, "ticket_id", None) or f"tkt_{uuid.uuid4().hex[:10]}"
    
    # CRITICAL FIX: Exclude deprecated fields before passing to SQLAlchemy
    ticket_data = payload.model_dump(
        exclude={"tags", "ticket_id", "assignment", "sla_processing", "team_ids", "agent_ids"}
    )
    
    if "priority" in ticket_data:
        ticket_data["priority"] = coerce_priority(ticket_data["priority"]) or TicketPriority.normal
    if "severity" in ticket_data:
        ticket_data["severity"] = coerce_severity(ticket_data["severity"]) or TicketSeverity.sev4
    
    t = Ticket(ticket_id=ticket_id, **ticket_data)
    db.add(t)
    
    # Tags
    if payload.tags:
        existing_tags = db.query(Tag).filter(Tag.tag_id.in_(payload.tags), Tag.org_id == t.org_id).all()
        if existing_tags:
            t.tags = existing_tags
            for tag in existing_tags:
                tag.usage_count += 1
    
    db.flush()
    
    # Category defaults
    _apply_category_defaults_on_create(db, t)
    
    # SLA status
    if t.sla_id:
        _create_sla_status_with_processing(db, t, payload.sla_processing)
    else:
        _ensure_sla_status_if_needed(db, t)
    
    # Requester auto-watcher
    try:
        wl = TicketWatcher(
            watcher_id=f"twa_{uuid.uuid4().hex[:10]}",
            ticket_id=t.ticket_id,
            user_id=t.requester_id
        )
        db.add(wl)
    except Exception:
        pass
    
    # Assignment audit
    if t.assignee_id:
        db.add(TicketAssignment(
            assignment_id=f"tas_{uuid.uuid4().hex[:10]}",
            ticket_id=t.ticket_id,
            actor_id=t.requester_id,
            from_assignee=None,
            to_assignee=t.assignee_id
        ))
    
    # Handle assignment metadata
    if payload.assignment:
        _handle_assignment_on_create(db, t, payload.assignment)
    
    # Event + activity
    _create_ticket_creation_event(db, t, payload)
    t.last_activity_at = datetime.utcnow()
    
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
    
    # Track old values for cache invalidation
    old_team_id = t.team_id
    old_agent_id = t.agent_id
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
    
    # Invalidate old and new assignment caches
    RedisTicketService.invalidate_all_assignment_caches(
        t.org_id,
        team_id=old_team_id or t.team_id,
        agent_id=old_agent_id or t.agent_id,
        assignee_id=t.assignee_id
    )
    RedisTicketService.invalidate_org_lists_and_counts(t.org_id)
    
    return dto

@router.delete("/{ticket_id}", status_code=204)
def delete_ticket(ticket_id: str, db: Session = Depends(get_db)):
    t: Ticket | None = db.get(Ticket, ticket_id)
    if not t:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    org_id = t.org_id
    team_id = t.team_id
    agent_id = t.agent_id
    
    db.delete(t)
    db.commit()
    
    RedisTicketService.invalidate_ticket(ticket_id)
    RedisTicketService.invalidate_all_assignment_caches(org_id, team_id=team_id, agent_id=agent_id)
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
        db.commit()
        db.refresh(exists)
        _invalidate_all(db, t)
        return CollaboratorOut.model_validate(exists, from_attributes=True)
    
    row = TicketCollaborator(
        collab_id=f"tcol_{uuid.uuid4().hex[:10]}",
        ticket_id=ticket_id,
        user_id=payload.user_id,
        role=TicketCollaboratorRole(payload.role),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
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
    db.delete(row)
    db.commit()
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
    
    # First response completion hook
    if t.sla_id and t.sla_status and not payload.is_internal:
        if payload.author_id != t.requester_id and t.first_response_at is None:
            sla_service.mark_first_response_done(db, t)
        
        if payload.author_id == t.requester_id:
            sla_service.resume_sla(db, t, SLADimension.resolution)
        else:
            if payload.body and ("needs info" in payload.body.lower() or payload.body.strip().endswith("?")):
                sla_service.pause_sla(db, t, SLADimension.resolution, reason="awaiting_customer_info")
    
    t.last_activity_at = datetime.utcnow()
    db.commit()
    db.refresh(row)
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
    db.delete(row)
    db.commit()
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
    db.commit()
    db.refresh(row)
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
    db.delete(row)
    db.commit()
    _invalidate_all(db, t)
    return None

# ------------------------- assignment: group --------------------------

@router.post("/{ticket_id}/group", response_model=TicketOut)
def assign_group(ticket_id: str, body: AssignGroupBody, db: Session = Depends(get_db)):
    t: Ticket | None = db.get(Ticket, ticket_id)
    if not t:
        raise HTTPException(404, "Ticket not found")
    
    if body.group_id:
        from ..models.support import SupportGroup
        g = db.get(SupportGroup, body.group_id)
        if not g:
            raise HTTPException(404, "Support group not found")
        if g.org_id != t.org_id:
            raise HTTPException(400, "Group belongs to a different organization")
        t.group_id = body.group_id
    else:
        t.group_id = None
    
    t.last_activity_at = datetime.utcnow()
    db.commit()
    db.refresh(t)
    
    dto = TicketOut.model_validate(t, from_attributes=True)
    RedisTicketService.cache_ticket(dto)
    RedisTicketService.invalidate_org_lists_and_counts(t.org_id)
    return dto

# ------------------------- assignment: team ---------------------------

@router.post("/{ticket_id}/team", response_model=TicketOut)
def assign_team(ticket_id: str, body: AssignTeamBody, db: Session = Depends(get_db)):
    t: Ticket | None = db.get(Ticket, ticket_id)
    if not t:
        raise HTTPException(404, "Ticket not found")
    
    old_team_id = t.team_id
    
    if body.team_id:
        from ..models.support import SupportTeam
        team = db.get(SupportTeam, body.team_id)
        if not team:
            raise HTTPException(404, "Team not found")
        if team.org_id != t.org_id:
            raise HTTPException(400, "Team belongs to a different organization")
        t.team_id = body.team_id
    else:
        t.team_id = None
    
    t.last_activity_at = datetime.utcnow()
    db.commit()
    db.refresh(t)
    
    dto = TicketOut.model_validate(t, from_attributes=True)
    RedisTicketService.cache_ticket(dto)
    
    # Invalidate old and new team caches
    if old_team_id:
        RedisTicketService.invalidate_team_caches(t.org_id, old_team_id)
    if t.team_id:
        RedisTicketService.invalidate_team_caches(t.org_id, t.team_id)
    RedisTicketService.invalidate_org_lists_and_counts(t.org_id)
    
    return dto

# ------------------------- assignment: agent --------------------------

@router.post("/{ticket_id}/agent", response_model=TicketOut)
def assign_agent(ticket_id: str, body: AssignAgentBody, db: Session = Depends(get_db)):
    t: Ticket | None = db.get(Ticket, ticket_id)
    if not t:
        raise HTTPException(404, "Ticket not found")
    
    old_agent_id = t.agent_id
    
    if body.agent_id:
        User = _import_user_model()
        if User:
            user = db.get(User, body.agent_id)
            if not user:
                raise HTTPException(404, "Agent not found")
        t.agent_id = body.agent_id
    else:
        t.agent_id = None
    
    t.last_activity_at = datetime.utcnow()
    db.commit()
    db.refresh(t)
    
    dto = TicketOut.model_validate(t, from_attributes=True)
    RedisTicketService.cache_ticket(dto)
    
    # Invalidate old and new agent caches
    if old_agent_id:
        RedisTicketService.invalidate_agent_caches(t.org_id, old_agent_id)
    if t.agent_id:
        RedisTicketService.invalidate_agent_caches(t.org_id, t.agent_id)
    RedisTicketService.invalidate_org_lists_and_counts(t.org_id)
    
    return dto

# ----------------------- quick participants view ----------------------

@router.get("/{ticket_id}/participants", response_model=Dict[str, Any])
def get_participants(ticket_id: str, db: Session = Depends(get_db)):
    t: Ticket | None = db.get(Ticket, ticket_id)
    if not t:
        raise HTTPException(404, "Ticket not found")
    return {
        "ticket_id": t.ticket_id,
        "org_id": t.org_id,
        "group_id": t.group_id,
        "team_id": t.team_id,
        "agent_id": t.agent_id,
        "assignee_id": t.assignee_id,
        "updated_at": t.updated_at,
    }

# ------------------------------- worklogs -----------------------------

@router.get("/{ticket_id}/worklogs", response_model=list[WorklogOut])
def list_worklogs(
    ticket_id: str,
    _t = Depends(can_view_ticket),
    db: Session = Depends(get_db),
):
    return (
        db.query(TicketWorklog)
        .filter(TicketWorklog.ticket_id == ticket_id)
        .order_by(TicketWorklog.created_at.desc())
        .all()
    )

@router.post("/{ticket_id}/worklogs", response_model=WorklogOut, status_code=201)
def create_worklog(
    ticket_id: str,
    payload: WorklogCreate,
    _t = Depends(can_edit_ticket),
    db: Session = Depends(get_db),
):
    if payload.user_id is None:
        raise HTTPException(400, "user_id required")
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