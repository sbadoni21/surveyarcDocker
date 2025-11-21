# app/routers/tickets.py
"""
Ticket Router

This module exposes the REST API for tickets. Major responsibilities:

- CRUD for tickets (create/list/read/update/delete)
- Assignment to group/team/agent (single team and single agent per ticket)
- Comments, attachments, collaborators
- SLA lifecycle hooks (create status, pause/resume timers, first-response/resolution markers)
- Caching (Redis) for single-ticket, org/team/agent lists, and counts
- Worklogs (list/create)

Additions in this version:
- Per-organization sequential ticket numbering using an atomic counter
  (_next_ticket_number). This fills the "number" column that was null before.
"""

from __future__ import annotations
import json, sqlalchemy as sa
from fastapi import APIRouter, Depends, HTTPException, Query,Header
from sqlalchemy.orm import Session, selectinload, joinedload
from sqlalchemy import func, select, text  # <-- text is used for atomic counter SQL
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime

from ..db import get_db
from ..services.redis_ticket_service import RedisTicketService
from ..services.redis_sla_service import get_ticket_sla_status
from ..models.tickets import (
    Ticket,
    TicketPlatform,
    TicketWorklog,
    TicketWatcher,
    TicketAssignment,
    TicketPriority,
    TicketSeverity,
)
from ..models.ticket_taxonomies import TicketFeature, TicketImpactArea, TicketRootCauseType  # ▶ ADD
from ..schemas.tickets import RootCauseSet,SLAPauseRequest, SLAResumeRequest,TicketSLAStatusOut # ▶ ADD (if you added the schema)
from ..services.sla_notify import (
    compute_business_elapsed,
    crossed_threshold,
    enqueue_outbox,
    lookup_user_email,
    lookup_team_mailbox,
    list_team_member_emails,
    list_client_contact_emails,
)

from ..schemas.tickets import WorklogCreate, WorklogOut
from ..policies.tickets import can_view_ticket, can_edit_ticket
from ..models.ticket_categories import TicketCategory, TicketSubcategory
from ..models.tickets import (
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
    SLAProcessingData,
)
from ..models.sla import SLADimension, SLA
from ..services import sla_service

router = APIRouter(prefix="/tickets", tags=["Tickets"])

# ---------------------------------------------------------------------
# Constants / coercion helpers
# ---------------------------------------------------------------------

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



def _resolve_recipients_basic(session, ticket: Ticket) -> dict[str, set[str]]:
    """
    Lightweight recipient set for "ticket.created".
    (Requester + assignee/agent + team mailbox/members + watchers.)
    """
    emails = {"requester": set(), "assignee": set(), "team": set(), "watchers": set()}

    # requester
    emails["requester"] |= {lookup_user_email(session, ticket.requester_id)}

    # assignee/agent
    if ticket.assignee_id:
        emails["assignee"] |= {lookup_user_email(session, ticket.assignee_id)}
    if ticket.agent_id:
        emails["assignee"] |= {lookup_user_email(session, ticket.agent_id)}

    # team mailbox (prefer) or members
    if ticket.team_id:
        mbox = lookup_team_mailbox(session, ticket.team_id)
        if mbox:
            emails["team"].add(mbox)
        else:
            for m in list_team_member_emails(session, ticket.team_id):
                if m: emails["team"].add(m)

    # watchers
    for w in (ticket.watchers or []):
        emails["watchers"].add(lookup_user_email(session, w.user_id))

    # strip empties
    for k in list(emails.keys()):
        emails[k] = {e for e in emails[k] if e}
    return emails

def on_ticket_created(session, ticket: Ticket):
    """
    Queue a 'ticket.created' notification into Outbox (idempotent via dedupe_key).
    """
    dedupe = f"ticket.created:{ticket.ticket_id}"
    recips = _resolve_recipients_basic(session, ticket)

    enqueue_outbox(session, "ticket.created", dedupe, {
        "ticket_id": ticket.ticket_id,
        "org_id": ticket.org_id,
        "number": ticket.number,
        "subject": ticket.subject,
        "priority": ticket.priority.value if ticket.priority else None,
        "severity": ticket.severity.value if ticket.severity else None,
        "assignee_id": ticket.assignee_id,
        "team_id": ticket.team_id,
        # include SLA due times if already computed
        "first_response_due_at": ticket.sla_status and ticket.sla_status.first_response_due_at and ticket.sla_status.first_response_due_at.isoformat(),
        "resolution_due_at": ticket.sla_status and ticket.sla_status.resolution_due_at and ticket.sla_status.resolution_due_at.isoformat(),
        "recipients": {k: list(v) for k, v in recips.items()},
    })
def _resolve_comment_recipients(session: Session, ticket: Ticket, *, author_id: str, is_internal: bool) -> dict[str, list[str]]:
    """
    Build recipients for a new comment.
    - Everyone involved (requester, assignee/agent, team mailbox/members, watchers, collaborators)
    - EXCEPT the author themselves.
    - If is_internal=True, do NOT notify requester/client contacts.
    """
    from ..models.tickets import TicketCollaborator

    # base sets
    emails = {
        "requester": set(),
        "assignee": set(),
        "team": set(),
        "watchers": set(),
        "collaborators": set(),
    }

    author_email = lookup_user_email(session, author_id)

    # requester (skip if internal)
    if not is_internal:
        req = lookup_user_email(session, ticket.requester_id)
        if req and req != author_email:
            emails["requester"].add(req)

    # assignee/agent
    for uid in [ticket.assignee_id, ticket.agent_id]:
        if uid:
            e = lookup_user_email(session, uid)
            if e and e != author_email:
                emails["assignee"].add(e)

    # watchers
    for w in (ticket.watchers or []):
        e = lookup_user_email(session, w.user_id)
        if e and e != author_email:
            emails["watchers"].add(e)

    # team mailbox preferred, else members
    if ticket.team_id:
        mbox = lookup_team_mailbox(session, ticket.team_id)
        if mbox and mbox != author_email:
            emails["team"].add(mbox)
        else:
            for e in list_team_member_emails(session, ticket.team_id):
                if e and e != author_email:
                    emails["team"].add(e)

    # collaborators (if you use the collaborators table)
    try:
        rows = session.query(TicketCollaborator).filter(TicketCollaborator.ticket_id == ticket.ticket_id).all()
        for r in rows:
            e = lookup_user_email(session, r.user_id)
            if e and e != author_email:
                emails["collaborators"].add(e)
    except Exception:
        pass

    # finalize to lists and remove empties
    return {k: [*v] for k, v in emails.items() if v}

    
def coerce_priority(v: str | None) -> TicketPriority | None:
    """Map free-text to TicketPriority enum if possible."""
    if not v:
        return None
    s = str(v).strip().lower()
    s = WORD_TO_PRIORITY.get(s, s)
    try:
        return TicketPriority(s)
    except Exception:
        return None


def coerce_severity(v: str | None) -> TicketSeverity | None:
    """Map free-text to TicketSeverity enum if possible."""
    if not v:
        return None
    s = str(v).strip().lower()
    s = WORD_TO_SEVERITY.get(s, s)
    try:
        return TicketSeverity(s)
    except Exception:
        return None


# ---------------------------------------------------------------------
# SLA utilities
# ---------------------------------------------------------------------

# Snippet from app/routers/tickets.py - Replace the relevant functions

def _ensure_sla_status_if_needed(db: Session, t: Ticket) -> None:
    """
    ✅ FIXED: Ensure a TicketSLAStatus exists and has proper due dates calculated.
    Safe to call on create/update.
    """
    if not t.sla_id:
        return
    if t.sla_status:
        # Status exists, just ensure due dates are set
        sla_obj = db.get(SLA, t.sla_id)
        if sla_obj and (not t.sla_status.first_response_due_at or not t.sla_status.resolution_due_at):
            sla_service.initialize_due_dates(db, t.sla_status, sla_obj)
        return
    
    # Create new status
    st = TicketSLAStatus(
        ticket_id=t.ticket_id, 
        sla_id=t.sla_id, 
        paused=False, 
        meta={}
    )
    db.add(st)
    db.flush()
    
    # Initialize timers and calculate due dates
    sla_service.ensure_started(st)
    sla_obj = db.get(SLA, t.sla_id)
    if sla_obj:
        sla_service.initialize_due_dates(db, st, sla_obj)



def _create_sla_status_with_processing(
    db: Session,
    ticket: Ticket,
    sla_processing: Optional[SLAProcessingData],
):
    """
    ✅ FIXED: Create SLA status, honoring pre-computed due dates from frontend.
    Only calculate server-side if frontend didn't provide them.
    """
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
            "source": "frontend_or_server",
        },
    }

    # Parse frontend-provided due dates
    has_frontend_dates = False
    if sla_processing:
        sla_status_data["meta"]["sla_mode"] = sla_processing.sla_mode
        
        if sla_processing.first_response_due_at:
            s = sla_processing.first_response_due_at
            if s.endswith("Z"):
                s = s[:-1] + "+00:00"
            try:
                sla_status_data["first_response_due_at"] = datetime.fromisoformat(s)
                has_frontend_dates = True
            except Exception:
                pass
        
        if sla_processing.resolution_due_at:
            s = sla_processing.resolution_due_at
            if s.endswith("Z"):
                s = s[:-1] + "+00:00"
            try:
                sla_status_data["resolution_due_at"] = datetime.fromisoformat(s)
                has_frontend_dates = True
            except Exception:
                pass
        
        if sla_processing.calendar_id:
            sla_status_data["calendar_id"] = sla_processing.calendar_id

    sla_status = TicketSLAStatus(**sla_status_data)
    db.add(sla_status)
    ticket.sla_status = sla_status
    db.flush()

    # ✅ FIXED: Only calculate server-side if frontend didn't provide dates
    if not has_frontend_dates or not sla_status.first_response_due_at or not sla_status.resolution_due_at:
        mode = sla_status.meta.get("sla_mode") or ("priority" if ticket.priority else "severity")
        sla_status.meta["sla_mode"] = mode
        sla_status.meta["basis_priority"] = ticket.priority.value if ticket.priority else None
        sla_status.meta["basis_severity"] = ticket.severity.value if ticket.severity else None
        sla_status.meta["source"] = "server"
        
        sla_obj = db.get(SLA, ticket.sla_id)
        if sla_obj:
            # This will only set dates that are still None
            sla_service.initialize_due_dates(db, sla_status, sla_obj)

    # Set ticket.due_at from SLA resolution due date if not explicitly provided
    if not ticket.due_at and sla_status.resolution_due_at:
        ticket.due_at = sla_status.resolution_due_at
# ---------------------------------------------------------------------
# Assignment / caching helpers
# ---------------------------------------------------------------------

def _apply_category_defaults_on_create(db: Session, t: Ticket):
    """
    On create: apply defaults from the selected subcategory (priority, severity, SLA),
    without overwriting explicit user choices.
    """
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
    """
    Invalidate all relevant caches for a ticket (single ticket, org lists/counts,
    team/agent/assignee lists).
    """
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
            assignee_id=t.assignee_id,
        )


def _import_user_model():
    """Lazy import for User to avoid circular imports in some environments."""
    try:
        from ..models.user import User
        return User
    except Exception:
        return None


def _handle_assignment_on_create(db: Session, ticket: Ticket, assignment: AssignmentMeta):
    """
    Apply assignment meta (group/team/agent) on create, validating org boundaries.
    """
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
    """
    Audit event for ticket creation (immutable history).
    """
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
        event_meta.update(
            {
                "sla_mode": payload.sla_processing.sla_mode,
                "has_calendar": bool(payload.sla_processing.calendar_id),
                "has_calculated_due_dates": bool(
                    payload.sla_processing.first_response_due_at
                    or payload.sla_processing.resolution_due_at
                ),
            }
        )

    if payload.assignment:
        event_meta.update(
            {
                "assignment_group_selected": payload.assignment.is_group_selected,
                "assignment_team_selected": payload.assignment.is_team_selected,
                "assignment_agent_selected": payload.assignment.is_agent_selected,
                "initiated_by": payload.assignment.initiated_by,
            }
        )

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
        meta=event_meta,
    )
    db.add(event)


# ---------------------------------------------------------------------
# Atomic per-org ticket numbering
# ---------------------------------------------------------------------

def _next_ticket_number(db: Session, org_id: str) -> int:
    """
    Atomically increments and returns the next ticket number for the given org.

    Requires a table:

        CREATE TABLE IF NOT EXISTS ticket_counters (
          org_id text PRIMARY KEY,
          next_number bigint NOT NULL
        );

    This single INSERT ... ON CONFLICT ... DO UPDATE ... RETURNING round-trip
    prevents race conditions even under concurrency.
    """
    row = db.execute(
        text(
            """
            INSERT INTO ticket_counters (org_id, next_number)
            VALUES (:org_id, 1)
            ON CONFLICT (org_id)
            DO UPDATE SET next_number = ticket_counters.next_number + 1
            RETURNING next_number
            """
        ),
        {"org_id": org_id},
    ).mappings().first()
    return int(row["next_number"])


# ---------------------------------------------------------------------
# CRUD
# ---------------------------------------------------------------------

@router.get("/{ticket_id}", response_model=TicketOut)
def get_ticket(ticket_id: str, db: Session = Depends(get_db)):
    """
    Fetch a single ticket with complete SLA tracking data.
    Includes: SLA status, pause history, pause windows, and events.
    """
    cached = RedisTicketService.get_ticket(ticket_id)
    if cached is not None:
        return cached

    t = (
        db.query(Ticket)
        .options(
            joinedload(Ticket.sla_status).joinedload(TicketSLAStatus.pause_history),
            joinedload(Ticket.sla_status).joinedload(TicketSLAStatus.sla),
            joinedload(Ticket.tags),
            selectinload(Ticket.events).options(
                # Only load SLA-related events
                # You might want to filter these in the schema instead
            ),
        )
        .filter(Ticket.ticket_id == ticket_id)
        .first()
    )

    if not t:
        raise HTTPException(status_code=404, detail="Ticket not found")

    dto = TicketOut.model_validate(t, from_attributes=True)
    RedisTicketService.cache_ticket(dto)
    return dto

def on_sla_assigned(session, ticket: Ticket, sla: SLA, status: TicketSLAStatus):
    # build recipients
    recips = resolve_recipients(session, ticket, sla)  # {assignee,set...}
    dedupe = f"sla.assigned:{ticket.ticket_id}:{sla.sla_id}"
    session.execute(
      sa.text("""
        INSERT INTO outbox(kind, dedupe_key, payload)
        VALUES (:k, :d, :p)
        ON CONFLICT (dedupe_key) DO NOTHING
      """),
      dict(
        k="sla.assigned",
        d=dedupe,
        p=json.dumps({
          "ticket_id": ticket.ticket_id,
          "org_id": ticket.org_id,
          "sla_id": sla.sla_id,
          "subject": ticket.subject,
          "first_response_due_at": status.first_response_due_at and status.first_response_due_at.isoformat(),
          "resolution_due_at": status.resolution_due_at and status.resolution_due_at.isoformat(),
          "calendar_id": status.calendar_id,
          "recipients": { k:list(v) for k,v in recips.items() },   # <<< ADD
        })
      )
    )

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
        # ▶ ADD these:
    product_id: Optional[str] = Query(None),
    feature_id: Optional[str] = Query(None),
    impact_id: Optional[str] = Query(None),
    rca_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """
    List tickets with optional filters. Opportunistically uses Redis caches for:
    - org list (no filters)
    - team list
    - agent list
    """
    # Org-wide simple list cache
    if all(v is None for v in [status, assignee_id, team_id, agent_id, q, group_id]) and offset == 0:
        cached = RedisTicketService.get_org_list(org_id)
        if cached is not None:
            return cached

    # Team-specific cache
    if team_id and all(v is None for v in [status, assignee_id, agent_id, q, group_id]) and offset == 0:
        cached = RedisTicketService.get_team_list(org_id, team_id)
        if cached is not None:
            return cached

    # Agent-specific cache
    if agent_id and all(v is None for v in [status, assignee_id, team_id, q, group_id]) and offset == 0:
        cached = RedisTicketService.get_agent_list(org_id, agent_id)
        if cached is not None:
            return cached

    stmt = (
        select(Ticket)
        .options(
            joinedload(Ticket.sla_status),
            selectinload(Ticket.tags),
            selectinload(Ticket.comments),
            joinedload(Ticket.group),
        )
        .where(Ticket.org_id == org_id)
    )

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
    if product_id:
        stmt = stmt.where(Ticket.product_id == product_id)
    if feature_id:
        stmt = stmt.where(Ticket.feature_id == feature_id)
    if impact_id:
        stmt = stmt.where(Ticket.impact_id == impact_id)
    if rca_id:
        stmt = stmt.where(Ticket.rca_id == rca_id)

    if q:
        like = f"%{q.lower()}%"
        stmt = stmt.where(func.lower(Ticket.subject).like(like))

    stmt = stmt.limit(limit).offset(offset)
    records = db.execute(stmt).scalars().all()

    ticket_outs = [TicketOut.model_validate(r, from_attributes=True) for r in records]

    # Populate caches
    if all(v is None for v in [status, assignee_id, team_id, agent_id, q, group_id]) and offset == 0:
        RedisTicketService.cache_org_list(org_id, ticket_outs)
    elif team_id and all(v is None for v in [status, assignee_id, agent_id, q, group_id]) and offset == 0:
        RedisTicketService.cache_team_list(org_id, team_id, ticket_outs)
    elif agent_id and all(v is None for v in [status, assignee_id, team_id, q, group_id]) and offset == 0:
        RedisTicketService.cache_agent_list(org_id, agent_id, ticket_outs)

    return ticket_outs


# ---------------------------- CREATE ----------------------------
def maybe_warn(session, ticket, sla, status, dim: str, target_min: int, fractions: list[float]):
    now = datetime.utcnow()
    elapsed = compute_business_elapsed(status, dim, now)
    frac = elapsed / max(1, target_min)

    for f in fractions:
        if crossed_threshold(session, dim, ticket.ticket_id, f, frac):
            key = f"sla.warn:{dim}:{ticket.ticket_id}:{f:.2f}"
            enqueue_outbox(session, "sla.warn", key, {
                "ticket_id": ticket.ticket_id,
                "dimension": dim,
                "fraction": f,
                "target_minutes": target_min,
                "due_at": getattr(status, f"{dim}_due_at") and getattr(status, f"{dim}_due_at").isoformat(),
            })

def resolve_recipients(session, ticket: Ticket, sla: SLA) -> dict[str, set[str]]:
    emails = {"assignee": set(), "team": set(), "watchers": set(), "client_contacts": set(), "requester": set()}

    # requester
    emails["requester"] |= {lookup_user_email(session, ticket.requester_id)}

    # assignee/agent
    if ticket.assignee_id:
        emails["assignee"] |= {lookup_user_email(session, ticket.assignee_id)}
    if ticket.agent_id:
        emails["assignee"] |= {lookup_user_email(session, ticket.agent_id)}

    # watchers
    for w in ticket.watchers:
        emails["watchers"].add(lookup_user_email(session, w.user_id))

    # team
    if ticket.team_id:
        mbox = lookup_team_mailbox(session, ticket.team_id)  # prefer mailbox
        if mbox: emails["team"].add(mbox)
        else:
            for m in list_team_member_emails(session, ticket.team_id):
                emails["team"].add(m)

    # client contacts (if SLA is client scoped)
    if sla.scope in ("custom","product") and "client_contact_list_id" in (sla.scope_ids or {}):
        emails["client_contacts"] |= set(list_client_contact_emails(session, sla.scope_ids["client_contact_list_id"]))

    # strip empties
    for k in list(emails.keys()):
        emails[k] = {e for e in emails[k] if e}
    return emails

@router.post("/", response_model=TicketOut, status_code=201)
def create_ticket(payload: TicketCreate, db: Session = Depends(get_db)):
    """
    Create a ticket. Steps:
      1) Normalize & coerce enums
      2) Assign per-org sequential 'number'
      3) Attach tags (+increment usage)
      4) Apply category defaults (priority/severity/SLA)
      5) Ensure/init SLA status (+auto due dates if needed)
      6) Auto-add requester as watcher
      7) Record initial assignment audit (if assignee provided)
      8) Apply structured assignment meta (group/team/agent)
      9) Create 'ticket_created' audit event
     10) Cache + invalidate related lists/counts
    """
    ticket_id = getattr(payload, "ticket_id", None) or f"tkt_{uuid.uuid4().hex[:10]}"

    # Exclude deprecated list fields before instantiating SQLAlchemy model
    ticket_data = payload.model_dump(
        exclude={"tags", "ticket_id", "assignment", "sla_processing", "team_ids", "agent_ids","ticket", }
    )

    if "priority" in ticket_data:
        ticket_data["priority"] = coerce_priority(ticket_data["priority"]) or TicketPriority.normal
    if "severity" in ticket_data:
        ticket_data["severity"] = coerce_severity(ticket_data["severity"]) or TicketSeverity.sev4
    print(ticket_data)
    ticket_data["platform"] = getattr(payload, "platform", TicketPlatform.in_app)

    t = Ticket(ticket_id=ticket_id, **ticket_data)

    # -------- NEW: assign sequential number per org (atomic) --------
    # Do this BEFORE flush/commit so the number is stored with the ticket row.
    t.number = _next_ticket_number(db, t.org_id)

    db.add(t)

    # Tags
    if payload.tags:
        existing_tags = (
            db.query(Tag).filter(Tag.tag_id.in_(payload.tags), Tag.org_id == t.org_id).all()
        )
        if existing_tags:
            t.tags = existing_tags
            for tag in existing_tags:
                tag.usage_count += 1

    db.flush()

    # Category defaults
    _apply_category_defaults_on_create(db, t)

    # SLA status
    # SLA status
    if t.sla_id:
        _create_sla_status_with_processing(db, t, payload.sla_processing)
    else:
        _ensure_sla_status_if_needed(db, t)

    # >>> ADD: queue “SLA assigned” email
    if t.sla_id and t.sla_status:
        sla_obj = db.get(SLA, t.sla_id)
        if sla_obj:
            on_sla_assigned(db, t, sla_obj, t.sla_status)


    # Requester auto-watcher
    try:
        wl = TicketWatcher(
            watcher_id=f"twa_{uuid.uuid4().hex[:10]}",
            ticket_id=t.ticket_id,
            user_id=t.requester_id,
        )
        db.add(wl)
    except Exception:
        # Watcher creation is non-critical
        pass

    # Assignment audit (primary assignee)
    if t.assignee_id:
        db.add(
            TicketAssignment(
                assignment_id=f"tas_{uuid.uuid4().hex[:10]}",
                ticket_id=t.ticket_id,
                actor_id=t.requester_id,
                from_assignee=None,
                to_assignee=t.assignee_id,
            )
        )

    # Handle structured assignment metadata (group/team/agent)
    if payload.assignment:
        _handle_assignment_on_create(db, t, payload.assignment)

    # Event + activity
    _create_ticket_creation_event(db, t, payload)
    t.last_activity_at = datetime.utcnow()
    on_ticket_created(db, t)

    db.commit()
    db.refresh(t)

    dto = TicketOut.model_validate(t, from_attributes=True)
    RedisTicketService.cache_ticket(dto)
    RedisTicketService.invalidate_org_lists_and_counts(t.org_id)

    return dto


# ---------------------------- UPDATE / DELETE ----------------------------

@router.patch("/{ticket_id}", response_model=TicketOut)
def update_ticket(ticket_id: str, payload: TicketUpdate, db: Session = Depends(get_db)):
    """
    Update mutable fields. Applies SLA pause/resume hooks when status changes.
    """
    t: Ticket | None = db.get(Ticket, ticket_id)
    if not t:
        raise HTTPException(status_code=404, detail="Ticket not found")

    # Track old values for cache invalidation
    old_team_id = t.team_id
    old_agent_id = t.agent_id
    old_status = t.status
    old_sla_id = t.sla_id  # <<< ADD


    data = payload.model_dump(exclude_unset=True, exclude={"tags"})
    for k, v in data.items():
        setattr(t, k, v)
    if t.sla_id and t.sla_id != old_sla_id and t.sla_status:
        sla_obj = db.get(SLA, t.sla_id)
        if sla_obj:
            on_sla_assigned(db, t, sla_obj, t.sla_status)
    if payload.tags is not None:
        if not payload.tags:
            t.tags = []
        else:
            tags = db.query(Tag).filter(Tag.tag_id.in_(payload.tags)).all()
            t.tags = tags

    _ensure_sla_status_if_needed(db, t)

    # SLA behavior on status changes
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
        assignee_id=t.assignee_id,
    )
    RedisTicketService.invalidate_org_lists_and_counts(t.org_id)

    return dto


@router.delete("/{ticket_id}", status_code=204)
def delete_ticket(ticket_id: str, db: Session = Depends(get_db)):
    """
    Delete a ticket and invalidate all related caches.
    """
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

@router.post("/{ticket_id}/root-cause", response_model=TicketOut, status_code=200)
def set_root_cause(ticket_id: str, payload: RootCauseSet, db: Session = Depends(get_db)):
    """
    Set/override Root Cause Type for a resolved/closed ticket.
    Also stores who confirmed it and when.
    """
    t = db.get(Ticket, ticket_id)
    if not t:
        raise HTTPException(404, "Ticket not found")

    # Validate RCA belongs to same org
    rca = db.get(TicketRootCauseType, payload.rca_id)
    if not rca or rca.org_id != t.org_id or not rca.active:
        raise HTTPException(400, "Invalid or inactive root cause for this org")

    t.rca_id = payload.rca_id
    t.rca_note = payload.rca_note
    t.rca_set_by = payload.confirmed_by
    t.rca_set_at = payload.confirmed_at or datetime.utcnow()

    # It’s common to require the ticket be resolved/closed; uncomment if you want to enforce:
    # if t.status not in (TicketStatus.resolved, TicketStatus.closed):
    #     raise HTTPException(409, "Root cause can only be set when ticket is resolved/closed")

    db.commit()
    db.refresh(t)

    dto = TicketOut.model_validate(t, from_attributes=True)
    RedisTicketService.cache_ticket(dto)
    RedisTicketService.invalidate_org_lists_and_counts(t.org_id)
    return dto

# ---------------------------------------------------------------------
# Counts
# ---------------------------------------------------------------------

@router.get("/counts/org", response_model=dict)
def counts_for_org(
    org_id: str = Query(...),
    status: Optional[TicketStatus] = Query(None),
    db: Session = Depends(get_db),
):
    """
    Return total count for org, or count by status if provided.
    Uses Redis cache per org and per-status.
    """
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
    """Alias for /counts/org for compatibility."""
    return counts_for_org(org_id=org_id, status=status, db=db)


@router.get("/counts", response_model=dict)
def counts_alias(
    org_id: str = Query(...),
    status: Optional[TicketStatus] = Query(None),
    db: Session = Depends(get_db),
):
    """Alias for /counts/org for compatibility."""
    return counts_for_org(org_id=org_id, status=status, db=db)


# ---------------------------------------------------------------------
# Collaborators
# ---------------------------------------------------------------------

@router.get("/{ticket_id}/collaborators", response_model=List[CollaboratorOut])
def list_collaborators(ticket_id: str, db: Session = Depends(get_db)):
    """
    List collaborators on a ticket.
    """
    t = db.get(Ticket, ticket_id)
    if not t:
        raise HTTPException(404, "Ticket not found")
    rows = db.query(TicketCollaborator).filter(TicketCollaborator.ticket_id == ticket_id).all()
    return [CollaboratorOut.model_validate(r, from_attributes=True) for r in rows]


@router.post("/{ticket_id}/collaborators", response_model=CollaboratorOut, status_code=201)
def add_collaborator(ticket_id: str, payload: CollaboratorCreate, db: Session = Depends(get_db)):
    """
    Add or update a collaborator role. Idempotent per (ticket_id, user_id).
    """
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
    """
    Remove a collaborator from a ticket.
    """
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


# ---------------------------------------------------------------------
# Comments
# ---------------------------------------------------------------------
@router.get("/{ticket_id}/comments", response_model=List[CommentOut])
def list_comments(ticket_id: str, db: Session = Depends(get_db)):
    # try cache first
    cached = RedisTicketService.get_comments(ticket_id)
    if cached is not None:
        # already serialized dicts, return as pydantic models
        return [CommentOut.model_validate(c) for c in cached]

    t = db.get(Ticket, ticket_id)
    if not t:
        raise HTTPException(404, "Ticket not found")
    rows = (
        db.query(TicketComment)
        .filter(TicketComment.ticket_id == ticket_id)
        .order_by(TicketComment.created_at.asc())
        .all()
    )
    out = [CommentOut.model_validate(r, from_attributes=True) for r in rows]
    # cache plain dicts
    RedisTicketService.cache_comments(ticket_id, [o.model_dump() for o in out])
    return out

@router.post("/{ticket_id}/comments", response_model=CommentOut, status_code=201)
def create_comment(ticket_id: str, payload: CommentCreate, db: Session = Depends(get_db)):
    """
    Create a comment. Side-effects:
      - On first PUBLIC agent reply → mark first_response_done
      - Pause/resume resolution SLA when asking for info / requester replies
    """
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

    # SLA first-response + info-needed semantics (public only)
    if t.sla_id and t.sla_status and not payload.is_internal:
        if payload.author_id != t.requester_id and t.first_response_at is None:
            sla_service.mark_first_response_done(db, t)

        if payload.author_id == t.requester_id:
            sla_service.resume_sla(db, t, SLADimension.resolution)
        else:
            if payload.body and ("needs info" in payload.body.lower() or payload.body.strip().endswith("?")):
                sla_service.pause_sla(db, t, SLADimension.resolution, reason="awaiting_customer_info")
                
    if t.sla_id and t.sla_status:
        sla_obj = db.get(SLA, t.sla_id)
        if sla_obj:
            # quick warn checks (don’t replace the periodic job)
            maybe_warn(db, t, sla_obj, t.sla_status, "first_response",
                       target_min=sla_obj.first_response_minutes or 1,
                       fractions=[0.5, 0.9])
            maybe_warn(db, t, sla_obj, t.sla_status, "resolution",
                       target_min=sla_obj.resolution_minutes or 1,
                       fractions=[0.5, 0.9])

    t.last_activity_at = datetime.utcnow()
    db.commit()
    db.refresh(row)
    _invalidate_all(db, t)
    
    try:
     dto = CommentOut.model_validate(row, from_attributes=True).model_dump()
     RedisTicketService.append_comment(t.ticket_id, dto)
    except Exception:
     pass

    try:
        recips = _resolve_comment_recipients(
            db, t,
            author_id=row.author_id,
            is_internal=row.is_internal
        )
        # If nothing to notify, skip
        if any(recips.values()):
            dedupe = f"ticket.comment:{row.comment_id}"
            enqueue_outbox(db, "ticket.comment", dedupe, {
                "ticket_id": t.ticket_id,
                "org_id": t.org_id,
                "number": t.number,
                "subject": t.subject,
                "author_id": row.author_id,
                "is_internal": bool(row.is_internal),
                "body": row.body,
                "recipients": recips,
            })
            db.commit()
    except Exception:
        # never break the API just because email enqueue failed
        pass
  
    return CommentOut.model_validate(row, from_attributes=True)


@router.delete("/{ticket_id}/comments/{comment_id}", status_code=204)
def delete_comment(ticket_id: str, comment_id: str, db: Session = Depends(get_db)):
    """
    Delete a comment from a ticket.
    """
    t = db.get(Ticket, ticket_id)
    if not t:
        raise HTTPException(404, "Ticket not found")
    row = db.get(TicketComment, comment_id)
    if not row or row.ticket_id != ticket_id:
        raise HTTPException(404, "Comment not found")
    db.delete(row)
    db.commit()
    _invalidate_all(db, t)
    try:
     RedisTicketService.remove_comment(ticket_id, comment_id)
    except Exception:
     pass
    return None


# ---------------------------------------------------------------------
# Attachments
# ---------------------------------------------------------------------

@router.get("/{ticket_id}/attachments", response_model=List[AttachmentOut])
def list_attachments(ticket_id: str, db: Session = Depends(get_db)):
    """
    List attachments for a ticket.
    """
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
    """
    Upload metadata for a new attachment associated with a ticket (binary lives in storage).
    """
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
    """
    Delete an attachment record.
    """
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


# ---------------------------------------------------------------------
# Assignment: group / team / agent
# ---------------------------------------------------------------------

@router.post("/{ticket_id}/group", response_model=TicketOut)
def assign_group(ticket_id: str, body: AssignGroupBody, db: Session = Depends(get_db)):
    """
    Assign or clear a support group on a ticket, validating org boundary.
    """
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


@router.post("/{ticket_id}/team", response_model=TicketOut)
def assign_team(ticket_id: str, body: AssignTeamBody, db: Session = Depends(get_db)):
    """
    Assign or clear a team on a ticket, validating org boundary and invalidating caches.
    """
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


@router.post("/{ticket_id}/agent", response_model=TicketOut)
def assign_agent(ticket_id: str, body: AssignAgentBody, db: Session = Depends(get_db)):
    """
    Assign or clear an additional agent on a ticket. Validates existence if User model is available.
    """
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


# ---------------------------------------------------------------------
# Participants (quick view)
# ---------------------------------------------------------------------

@router.get("/{ticket_id}/participants", response_model=Dict[str, Any])
def get_participants(ticket_id: str, db: Session = Depends(get_db)):
    """
    Lightweight participants view: group/team/agent/assignee.
    """
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


# ---------------------------------------------------------------------
# Worklogs
# ---------------------------------------------------------------------

@router.get("/{ticket_id}/worklogs", response_model=list[WorklogOut])
def list_worklogs(
    ticket_id: str,
    _t=Depends(can_view_ticket),
    db: Session = Depends(get_db),
):
    """
    List worklogs for a given ticket, newest first.
    """
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
    _t=Depends(can_edit_ticket),
    db: Session = Depends(get_db),
):
    """
    Create a worklog row for a ticket.
    """
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

# In app/routers/tickets.py - update the pause/resume endpoints

@router.post("/{ticket_id}/sla/pause", response_model=TicketSLAStatusOut, status_code=200)
def pause_sla_endpoint(
    ticket_id: str,
    payload: SLAPauseRequest,
    db: Session = Depends(get_db),
    current_user_id: str = Header(None, alias="X-User-Id"),  # Get from header
):
    """Pause an SLA timer with full audit trail"""
    t = db.get(Ticket, ticket_id)
    if not t:
        raise HTTPException(404, "Ticket not found")
    
    if not t.sla_id or not t.sla_status:
        raise HTTPException(400, "Ticket has no active SLA")
    
    try:
        dimension = SLADimension(payload.dimension)
    except ValueError:
        raise HTTPException(400, f"Invalid dimension: {payload.dimension}")
    
    # Call enhanced pause with actor tracking
    sla_service.pause_sla(
        db, t, dimension,
        reason=payload.reason.value if payload.reason else None,
        actor_id=current_user_id or t.requester_id,
        reason_note=payload.reason_note
    )
    
    t.last_activity_at = datetime.utcnow()
    db.commit()
    db.refresh(t)
    
    _invalidate_all(db, t)
    
    return TicketSLAStatusOut.model_validate(t.sla_status, from_attributes=True)


@router.post("/{ticket_id}/sla/resume", response_model=TicketSLAStatusOut, status_code=200)
def resume_sla_endpoint(
    ticket_id: str,
    payload: SLAResumeRequest,
    db: Session = Depends(get_db),
    current_user_id: str = Header(None, alias="X-User-Id"),
):
    """Resume an SLA timer with full audit trail"""
    t = db.get(Ticket, ticket_id)
    if not t:
        raise HTTPException(404, "Ticket not found")
    
    if not t.sla_id or not t.sla_status:
        raise HTTPException(400, "Ticket has no active SLA")
    
    try:
        dimension = SLADimension(payload.dimension)
    except ValueError:
        raise HTTPException(400, f"Invalid dimension: {payload.dimension}")
    
    # Call enhanced resume with actor tracking
    sla_service.resume_sla(
        db, t, dimension,
        actor_id=current_user_id or t.requester_id
    )
    
    t.last_activity_at = datetime.utcnow()
    db.commit()
    db.refresh(t)
    
    _invalidate_all(db, t)
    
    return TicketSLAStatusOut.model_validate(t.sla_status, from_attributes=True)


@router.get("/{ticket_id}/sla/timers", response_model=dict)
def get_sla_timers(
    ticket_id: str,
    db: Session = Depends(get_db),
):
    """
    Get detailed SLA timer status including pause windows.
    """
    timers = sla_service.get_timers(db, ticket_id)
    if not timers:
        raise HTTPException(404, "Ticket not found or has no SLA")
    return timers