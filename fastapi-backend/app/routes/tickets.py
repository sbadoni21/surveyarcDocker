# app/routers/tickets.py
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session,selectinload,joinedload
from sqlalchemy import func, select
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime

from ..db import get_db
from ..services.redis_ticket_service import RedisTicketService
from ..services.redis_sla_service import get_ticket_sla_status  # optional use
from ..models.tickets import Ticket, TicketWorklog,TicketWatcher,TicketAssignment,TicketPriority,TicketSeverity
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
    PatchAgentsBody,
    PatchTeamsBody,
    AssignGroupBody
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

from ..models.sla import SLADimension,SLA

from ..services import sla_service

router = APIRouter(prefix="/tickets", tags=["Tickets"])
_WORD_TO_PRIORITY = {
    "low": "low",
    "normal": "normal",
    "medium": "normal",   # <- tolerate 'medium'
    "high": "high",
    "urgent": "urgent",
    "blocker": "blocker",
}

_WORD_TO_SEVERITY = {
    # tolerate words and map to your enum scale (sev1=critical ... sev4=low)
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
    s = _WORD_TO_PRIORITY.get(s, s)  # pass through if already valid
    try:
        return TicketPriority(s)  # validates against enum
    except Exception:
        return None

def coerce_severity(v: str | None) -> TicketSeverity | None:
    if not v:
        return None
    s = str(v).strip().lower()
    s = _WORD_TO_SEVERITY.get(s, s)
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
    # start and compute dues
    sla_service.ensure_started(st)
    sla_obj = db.get(SLA, t.sla_id)
    if sla_obj:
        sla_service._recompute_due(db, st, sla_obj)


def _apply_category_defaults_on_create(db: Session, t: Ticket):
    """
    If category/subcategory carries defaults, apply them without overwriting
    explicit client choices; always coerce to valid enums.
    """
    from ..models.ticket_categories import TicketSubcategory

    if not t.subcategory_id:
        return

    sub = db.get(TicketSubcategory, t.subcategory_id)
    if not sub or not sub.active:
        return

    # Priority
    if sub.default_priority and not t.priority:
        cp = coerce_priority(sub.default_priority)
        if cp:
            t.priority = cp

    # Severity
    if sub.default_severity and not t.severity:
        cs = coerce_severity(sub.default_severity)
        if cs:
            t.severity = cs

    # SLA
    if sub.default_sla_id and not t.sla_id:
        t.sla_id = sub.default_sla_id
      
def _invalidate_all(db: Session, t: Ticket):
    RedisTicketService.invalidate_ticket(t.ticket_id)
    RedisTicketService.invalidate_org_lists_and_counts(t.org_id)
    
def _dedupe_sorted_strs(items: List[str]) -> List[str]:
    return sorted({str(x).strip() for x in items if str(x).strip()})

def _merge_array(current: List[str], incoming: List[str], mode: str) -> List[str]:
    cur = set(current or [])
    inc = {x for x in incoming or []}
    if mode == "replace":
        return _dedupe_sorted_strs(list(inc))
    if mode == "remove":
        return _dedupe_sorted_strs(list(cur - inc))
    # default "add"
    return _dedupe_sorted_strs(list(cur | inc))

def _import_user_model():
    """
    Lazy import to avoid circulars. Returns User model or None.
    """
    try:
        from ..models.user import User  # type: ignore
        return User
    except Exception:
        return None

# ------------------------------- CRUD --------------------------------

# app/routers/tickets.py

def _create_sla_status_with_processing(
    db: Session,
    ticket: Ticket,
    sla_processing: Optional[SLAProcessingData]
):
    if not ticket.sla_id:
        return

    # Base payload
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
        # NEW: persist meta so we know how the timers were derived
        "meta": {
            "sla_mode": None,              # "priority" | "severity"
            "basis_priority": None,        # e.g. "high"
            "basis_severity": None,        # e.g. "sev2"
            "source": "frontend_or_server" # we’ll set below
        }
    }

    # Apply client-provided precomputed due dates (if any)
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

    # Persist the SLA row
    sla_status = TicketSLAStatus(**sla_status_data)
    db.add(sla_status)
    ticket.sla_status = sla_status
    db.flush()

    # If any due is missing, compute using current service signature
    if not sla_status.first_response_due_at or not sla_status.resolution_due_at:
        # stash hints in meta for downstream logic (no kwargs)
        mode = sla_status.meta.get("sla_mode") or ("priority" if ticket.priority else "severity")
        sla_status.meta["sla_mode"] = mode
        sla_status.meta["basis_priority"] = ticket.priority.value if ticket.priority else None
        sla_status.meta["basis_severity"] = ticket.severity.value if ticket.severity else None
        sla_status.meta["source"] = "server"

        sla_service.ensure_started(sla_status)
        sla_obj = db.get(SLA, ticket.sla_id)
        if sla_obj:
            # NOTE: no extra kwargs here
            sla_service._recompute_due(db, sla_status, sla_obj)

    # keep ticket.due_at in sync with resolution due
    if not ticket.due_at and sla_status.resolution_due_at:
        ticket.due_at = sla_status.resolution_due_at


def _handle_assignment_on_create(
    db: Session, 
    ticket: Ticket, 
    assignment: AssignmentMeta
):
    """Handle assignment metadata during ticket creation"""
    
    if assignment.is_group_selected and assignment.group_id:
        # Validate group exists and belongs to same org
        from ..models.support import SupportGroup
        group = db.get(SupportGroup, assignment.group_id)
        if group and group.org_id == ticket.org_id:
            ticket.group_id = assignment.group_id
    
    if assignment.is_team_selected and assignment.team_ids:
        # Validate teams exist and belong to same org
        from ..models.support import SupportTeam
        teams = db.query(SupportTeam).filter(
            SupportTeam.team_id.in_(assignment.team_ids),
            SupportTeam.org_id == ticket.org_id
        ).all()
        valid_team_ids = [team.team_id for team in teams]
        ticket.team_ids = valid_team_ids
    
    if assignment.is_agents_selected and assignment.agent_ids:
        # Validate agents if User model is available
        User = _import_user_model()
        if User:
            users = db.query(User).filter(User.uid.in_(assignment.agent_ids)).all()
            valid_agent_ids = [user.uid for user in users]
            ticket.agent_ids = valid_agent_ids
        else:
            # If no User model validation, trust the frontend
            ticket.agent_ids = assignment.agent_ids


def _create_ticket_creation_event(
    db: Session, 
    ticket: Ticket, 
    payload: TicketCreate
):
    """Create audit event for ticket creation"""
    
    from ..models.tickets import TicketEvent
    
    # Build event metadata
    event_meta = {
        "creation_method": "web_form",
        "has_sla": bool(ticket.sla_id),
        "has_sla_processing": bool(payload.sla_processing),
        "team_count": len(ticket.team_ids) if ticket.team_ids else 0,
        "agent_count": len(ticket.agent_ids) if ticket.agent_ids else 0,
        "tag_count": len(payload.tags) if payload.tags else 0,
    }
    
    # Add SLA processing metadata
    if payload.sla_processing:
        event_meta.update({
            "sla_mode": payload.sla_processing.sla_mode,
            "has_calendar": bool(payload.sla_processing.calendar_id),
            "has_calculated_due_dates": bool(
                payload.sla_processing.first_response_due_at or 
                payload.sla_processing.resolution_due_at
            )
        })
    
    # Add assignment metadata
    if payload.assignment:
        event_meta.update({
            "assignment_group_selected": payload.assignment.is_group_selected,
            "assignment_team_selected": payload.assignment.is_team_selected,
            "assignment_agents_selected": payload.assignment.is_agents_selected,
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
            "sla_id": ticket.sla_id,
            "team_ids": ticket.team_ids,
            "agent_ids": ticket.agent_ids,
        },
        meta=event_meta
    )
    db.add(event)


# Updated get_ticket to include SLA status
@router.get("/{ticket_id}", response_model=TicketOut)
def get_ticket(ticket_id: str, db: Session = Depends(get_db)):
    """Get ticket with SLA status"""
    cached = RedisTicketService.get_ticket(ticket_id)
    if cached:
        return cached

    # Load ticket with SLA status relationship
    from sqlalchemy.orm import joinedload
    t = db.query(Ticket).options(
        joinedload(Ticket.sla_status),
        joinedload(Ticket.tags)
    ).filter(Ticket.ticket_id == ticket_id).first()
    
    if not t:
        raise HTTPException(status_code=404, detail="Ticket not found")

    dto = TicketOut.model_validate(t, from_attributes=True)
    RedisTicketService.cache_ticket(dto)
    return dto


# Updated list_tickets to include SLA status
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
    """List tickets with SLA status"""
    if status is None and assignee_id is None and q is None and group_id is None and offset == 0:
        cached = RedisTicketService.get_org_list(org_id)
        if cached:
            return cached

    from sqlalchemy.orm import joinedload
    stmt = select(Ticket).options(
        joinedload(Ticket.sla_status),
        joinedload(Ticket.tags)
    ).where(Ticket.org_id == org_id)
    
    if status is not None:
        stmt = stmt.where(Ticket.status == status)
    if assignee_id:
        stmt = stmt.where(Ticket.assignee_id == assignee_id)
    if group_id:
        stmt = stmt.where(Ticket.group_id == group_id)
    if q:
        like = f"%{q.lower()}%"
        stmt = stmt.where(func.lower(Ticket.subject).like(like))

    stmt = (
        select(Ticket)
        .where(Ticket.org_id == org_id)
        .options(
            selectinload(Ticket.tags),         # was joinedload(...)
            selectinload(Ticket.comments),     # was joinedload(...)
            joinedload(Ticket.group),          # many-to-one is fine with joinedload
        )
    # .order_by(Ticket.created_at.desc())  # keep ordering on parent only
        )  
    records = db.execute(stmt).scalars().all()

    if status is None and assignee_id is None and q is None and group_id is None and offset == 0:
        ticket_outs = [TicketOut.model_validate(r, from_attributes=True) for r in records]
        RedisTicketService.cache_org_list(org_id, ticket_outs)
        return ticket_outs

    return [TicketOut.model_validate(r, from_attributes=True) for r in records]


# app/routers/tickets.py  (inside create_ticket)

@router.post("/", response_model=TicketOut, status_code=201)
def create_ticket(payload: TicketCreate, db: Session = Depends(get_db)):
    ticket_id = getattr(payload, "ticket_id", None) or f"tkt_{uuid.uuid4().hex[:10]}"

    ticket_data = payload.model_dump(exclude={"tags","ticket_id","assignment","sla_processing"})
    t = Ticket(ticket_id=ticket_id, **ticket_data)
    db.add(t)

    # Tags (existing)
    if payload.tags:
        existing_tags = db.query(Tag).filter(Tag.tag_id.in_(payload.tags), Tag.org_id == t.org_id).all()
        if existing_tags:
            t.tags = existing_tags
            for tag in existing_tags:
                tag.usage_count += 1
    if "priority" in ticket_data:
        ticket_data["priority"] = coerce_priority(ticket_data["priority"]) or TicketPriority.normal
    if "severity" in ticket_data:
        ticket_data["severity"] = coerce_severity(ticket_data["severity"]) or TicketSeverity.sev4


    db.flush()

    # NEW: defaults from category/subcategory
    _apply_category_defaults_on_create(db, t)

    # SLA status (persist mode + compute if missing)
    if t.sla_id:
        _create_sla_status_with_processing(db, t, payload.sla_processing)
    else:
        _ensure_sla_status_if_needed(db, t)  # keeps your existing behavior

    # NEW (optional): requester auto-watcher (so they receive updates)
    try:
        wl = TicketWatcher(
            watcher_id=f"twa_{uuid.uuid4().hex[:10]}",
            ticket_id=t.ticket_id,
            user_id=t.requester_id
        )
        db.add(wl)
    except Exception:
        pass

    # NEW (optional): assignment audit row if we start with an assignee
    if t.assignee_id:
        db.add(TicketAssignment(
            assignment_id=f"tas_{uuid.uuid4().hex[:10]}",
            ticket_id=t.ticket_id,
            actor_id=t.requester_id,
            from_assignee=None,
            to_assignee=t.assignee_id
        ))

    # Existing: handle group/team/agent arrays via assignment meta
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
# ------------------------- assignment: group --------------------------

@router.post("/{ticket_id}/group", response_model=TicketOut)
def assign_group(ticket_id: str, body: AssignGroupBody, db: Session = Depends(get_db)):
    t: Ticket | None = db.get(Ticket, ticket_id)
    if not t:
        raise HTTPException(404, "Ticket not found")

    # Validate group when provided
    if body.group_id:
        from ..models.support import SupportGroup
        g = db.get(SupportGroup, body.group_id)
        if not g:
            raise HTTPException(404, "Support group not found")
        if g.org_id != t.org_id:
            raise HTTPException(400, "Group belongs to a different organization")

        t.group_id = body.group_id
    else:
        # clear
        t.group_id = None

    # activity bump
    t.last_activity_at = datetime.utcnow()

    db.commit(); db.refresh(t)
    dto = TicketOut.model_validate(t, from_attributes=True)
    RedisTicketService.cache_ticket(dto)
    RedisTicketService.invalidate_org_lists_and_counts(t.org_id)
    return dto


# ------------------------- assignment: teams --------------------------

@router.post("/{ticket_id}/teams", response_model=TicketOut)
def patch_teams(ticket_id: str, body: PatchTeamsBody, db: Session = Depends(get_db)):
    t: Ticket | None = db.get(Ticket, ticket_id)
    if not t:
        raise HTTPException(404, "Ticket not found")

    # Validate teams against org
    from ..models.support import SupportTeam
    if body.team_ids:
        teams = db.query(SupportTeam).filter(SupportTeam.team_id.in_(body.team_ids)).all()
        found_ids = {x.team_id for x in teams}
        missing = set(body.team_ids) - found_ids
        if missing:
            raise HTTPException(404, f"Teams not found: {sorted(missing)}")
        # org guard
        cross = [x.team_id for x in teams if x.org_id != t.org_id]
        if cross:
            raise HTTPException(400, f"Teams in different org: {sorted(cross)}")

    new_team_ids = _merge_array(t.team_ids or [], body.team_ids, body.mode)
    t.team_ids = new_team_ids

    # activity bump
    t.last_activity_at = datetime.utcnow()

    db.commit(); db.refresh(t)
    dto = TicketOut.model_validate(t, from_attributes=True)
    RedisTicketService.cache_ticket(dto)
    RedisTicketService.invalidate_org_lists_and_counts(t.org_id)
    return dto


# ------------------------- assignment: agents -------------------------

@router.post("/{ticket_id}/agents", response_model=TicketOut)
def patch_agents(ticket_id: str, body: PatchAgentsBody, db: Session = Depends(get_db)):
    t: Ticket | None = db.get(Ticket, ticket_id)
    if not t:
        raise HTTPException(404, "Ticket not found")

    # Validate users if the real User model is available
    User = _import_user_model()
    if User and body.agent_ids:
        users = db.query(User).filter(User.uid.in_(body.agent_ids)).all()
        found = {u.uid for u in users}
        missing = set(body.agent_ids) - found
        if missing:
            # Soft warning route: you can choose 400 instead if you require hard validation
            raise HTTPException(404, f"Agents not found: {sorted(missing)}")

    new_agent_ids = _merge_array(t.agent_ids or [], body.agent_ids, body.mode)
    t.agent_ids = new_agent_ids

    # activity bump
    t.last_activity_at = datetime.utcnow()

    db.commit(); db.refresh(t)
    dto = TicketOut.model_validate(t, from_attributes=True)
    RedisTicketService.cache_ticket(dto)
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
        "team_ids": t.team_ids or [],
        "agent_ids": t.agent_ids or [],
        "assignee_id": t.assignee_id,
        "updated_at": t.updated_at,
    }
    
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