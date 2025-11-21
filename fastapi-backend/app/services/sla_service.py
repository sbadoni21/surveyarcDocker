# app/services/sla_service.py
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Optional
import uuid

from sqlalchemy.orm import Session
from sqlalchemy import select

from ..models.tickets import Ticket, TicketSLAStatus, TicketSLAPauseHistory, TicketEvent, SLAPauseReason
from ..models.sla import SLAPauseWindow, SLADimension, SLA
from ..services.redis_sla_service import cache_ticket_sla_status

UTC = timezone.utc

def now_utc() -> datetime:
    return datetime.now(tz=UTC)

# ---- Recipients + outbox helpers ----
from ..services.sla_notify import (
    enqueue_outbox,
    lookup_user_email,
    lookup_team_mailbox,
    list_team_member_emails,
    list_client_contact_emails,
)

def _resolve_recipients(session: Session, ticket: Ticket, sla: SLA) -> dict[str, set[str]]:
    emails = {"assignee": set(), "team": set(), "watchers": set(), "client_contacts": set(), "requester": set()}
    
    emails["requester"] |= {lookup_user_email(session, ticket.requester_id)}
    
    if ticket.assignee_id:
        emails["assignee"] |= {lookup_user_email(session, ticket.assignee_id)}
    if ticket.agent_id:
        emails["assignee"] |= {lookup_user_email(session, ticket.agent_id)}
    
    for w in (ticket.watchers or []):
        emails["watchers"].add(lookup_user_email(session, w.user_id))
    
    if ticket.team_id:
        mbox = lookup_team_mailbox(session, ticket.team_id)
        if mbox:
            emails["team"].add(mbox)
        else:
            for m in list_team_member_emails(session, ticket.team_id):
                if m:
                    emails["team"].add(m)
    
    if sla and sla.scope in ("custom", "product") and "client_contact_list_id" in (sla.scope_ids or {}):
        emails["client_contacts"] |= set(
            list_client_contact_emails(session, sla.scope_ids["client_contact_list_id"])
        )
    
    for k in list(emails.keys()):
        emails[k] = {e for e in emails[k] if e}
    return emails

def _enqueue_breach(session: Session, ticket: Ticket, sla: SLA, status: TicketSLAStatus, dim: str) -> None:
    key = f"sla.breach:{dim}:{ticket.ticket_id}"
    recips = _resolve_recipients(session, ticket, sla)
    enqueue_outbox(session, "sla.breach", key, {
        "ticket_id": ticket.ticket_id,
        "org_id": ticket.org_id,
        "sla_id": sla.sla_id if sla else None,
        "dimension": dim,
        "due_at": getattr(status, f"{dim}_due_at") and getattr(status, f"{dim}_due_at").isoformat(),
        "recipients": {k: list(v) for k, v in recips.items()},
    })

def _minutes_to_due(base: datetime, mins: Optional[int]) -> Optional[datetime]:
    """Calculate due date from base time + minutes. Returns None if mins is invalid."""
    if mins is None:
        return None
    try:
        mins = int(mins)
    except Exception:
        return None
    if mins <= 0:
        return None  # ✅ FIXED: Return None instead of base time
    return base + timedelta(minutes=mins)

def _serialize_status(status: TicketSLAStatus) -> dict:
    return {
        "ticket_id": status.ticket_id,
        "sla_id": status.sla_id,
        "first_response_due_at": status.first_response_due_at.isoformat() if status.first_response_due_at else None,
        "resolution_due_at": status.resolution_due_at.isoformat() if status.resolution_due_at else None,
        "breached_first_response": status.breached_first_response,
        "breached_resolution": status.breached_resolution,
        "paused": status.paused,
        "pause_reason": status.pause_reason,
        "updated_at": status.updated_at.isoformat() if status.updated_at else None,
    }

def _recompute_due(db: Session, status: TicketSLAStatus, sla: SLA, force: bool = False) -> None:
    """
    Recompute due dates and check for breaches.
    
    Args:
        db: Database session
        status: Ticket SLA status
        sla: SLA policy
        force: If True, recalculate even if due dates already exist (use for updates)
    """
    if not status or not sla:
        return
    
    n = now_utc()
    
    # ✅ FIXED: Don't skip if paused - we still need to check/set initial due dates
    # Only skip breach checks if paused
    is_paused = status.paused
    
    # First Response - only set if not already set (unless force=True)
    if sla.first_response_minutes and (force or not status.first_response_due_at) and not status.breached_first_response:
        # Use started_at as base if available, otherwise current time
        base_time = status.first_response_started_at or n
        status.first_response_due_at = _minutes_to_due(base_time, sla.first_response_minutes)
    
    # Check first response breach (only if not paused and not completed)
    if (
        not is_paused
        and status.first_response_due_at
        and not status.breached_first_response
        and status.first_response_completed_at is None
        and n > status.first_response_due_at
    ):
        status.breached_first_response = True
        t = db.get(Ticket, status.ticket_id)
        if t and t.sla_id:
            _enqueue_breach(db, t, sla, status, "first_response")
    
    # Resolution - only set if not already set (unless force=True)
    if sla.resolution_minutes and (force or not status.resolution_due_at) and not status.breached_resolution:
        # Use started_at as base if available, otherwise current time
        base_time = status.resolution_started_at or n
        status.resolution_due_at = _minutes_to_due(base_time, sla.resolution_minutes)
    elif not sla.resolution_minutes and force:
        # Clear if SLA no longer has resolution target
        status.resolution_due_at = None
    
    # Check resolution breach (only if not paused and not completed)
    if (
        not is_paused
        and status.resolution_due_at
        and not status.breached_resolution
        and status.resolution_completed_at is None
        and n > status.resolution_due_at
    ):
        status.breached_resolution = True
        t = db.get(Ticket, status.ticket_id)
        if t and t.sla_id:
            _enqueue_breach(db, t, sla, status, "resolution")


# ============================================================================
# PAUSE SLA - Complete Implementation
# ============================================================================

def pause_sla(
    db: Session, 
    ticket: Ticket, 
    dimension: SLADimension, 
    reason: str | None = None,
    actor_id: str | None = None,
    reason_note: str | None = None
) -> TicketSLAStatus:
    """
    Pause SLA timer for a specific dimension (first_response or resolution).
    
    Updates:
    1. TicketSLAStatus - dimension-specific pause flags
    2. TicketSLAPauseHistory - audit trail
    3. SLAPauseWindow - legacy compatibility
    4. TicketEvent - ticket event log
    """
    if not ticket or not ticket.sla_status:
        return ticket.sla_status  # type: ignore
    
    st = ticket.sla_status
    when = now_utc()
    
    # Determine which dimension fields to update
    if dimension == SLADimension.first_response:
        if st.first_response_paused:
            return st  # Already paused
        
        # Calculate remaining time before pausing
        remaining_minutes = None
        if st.first_response_due_at:
            delta = (st.first_response_due_at - when).total_seconds() / 60
            remaining_minutes = max(0, int(delta))
        
        # Update status fields
        st.first_response_paused = True
        st.first_response_paused_at = when
        
        # Store remaining time in meta for resume
        st.meta = st.meta or {}
        st.meta["paused_first_response_remaining_minutes"] = remaining_minutes
        
    elif dimension == SLADimension.resolution:
        if st.resolution_paused:
            return st  # Already paused
        
        # Calculate remaining time before pausing
        remaining_minutes = None
        if st.resolution_due_at:
            delta = (st.resolution_due_at - when).total_seconds() / 60
            remaining_minutes = max(0, int(delta))
        
        # Update status fields
        st.resolution_paused = True
        st.resolution_paused_at = when
        
        # Store remaining time in meta for resume
        st.meta = st.meta or {}
        st.meta["paused_resolution_remaining_minutes"] = remaining_minutes
    
    # Update legacy paused flag (for backward compatibility)
    st.paused = st.first_response_paused or st.resolution_paused
    st.pause_reason = reason or "manual"
    
    # 1. Create pause history entry
    pause_reason_enum = None
    if reason:
        try:
            # Try to match to enum
            if "customer" in reason.lower() or "awaiting" in reason.lower():
                pause_reason_enum = SLAPauseReason.awaiting_customer
            elif "agent" in reason.lower():
                pause_reason_enum = SLAPauseReason.agent_paused
            elif "maintenance" in reason.lower():
                pause_reason_enum = SLAPauseReason.scheduled_maintenance
            elif "third" in reason.lower():
                pause_reason_enum = SLAPauseReason.awaiting_third_party
            else:
                pause_reason_enum = SLAPauseReason.other
        except:
            pause_reason_enum = SLAPauseReason.other
    
    pause_history = TicketSLAPauseHistory(
        pause_id=str(uuid.uuid4()),
        ticket_id=ticket.ticket_id,
        dimension=dimension.value,
        action="pause",
        action_at=when,
        actor_id=actor_id or ticket.requester_id,
        reason=pause_reason_enum,
        reason_note=reason_note or reason,
        meta={
            "remaining_minutes": remaining_minutes,
            "due_at_before_pause": (
                st.first_response_due_at.isoformat() if dimension == SLADimension.first_response and st.first_response_due_at
                else st.resolution_due_at.isoformat() if st.resolution_due_at
                else None
            )
        }
    )
    db.add(pause_history)
    
    # 2. Create legacy SLAPauseWindow (for compatibility)
    pause_window = SLAPauseWindow(
        ticket_id=ticket.ticket_id,
        dimension=dimension,
        reason=st.pause_reason,
        started_at=when,
        ended_at=None,
        meta={"actor_id": actor_id}
    )
    db.add(pause_window)
    
    # 3. Create ticket event
    event = TicketEvent(
        event_id=f"evt_{uuid.uuid4().hex[:10]}",
        ticket_id=ticket.ticket_id,
        actor_id=actor_id or ticket.requester_id,
        event_type="sla_paused",
        from_value={
            "dimension": dimension.value,
            "paused": False,
        },
        to_value={
            "dimension": dimension.value,
            "paused": True,
            "reason": reason,
        },
        meta={
            "remaining_minutes": remaining_minutes,
            "pause_reason_note": reason_note,
        }
    )
    db.add(event)
    
    # Update ticket activity
    ticket.last_activity_at = when
    
    db.add(st)
    db.flush()
    
    cache_ticket_sla_status(ticket.ticket_id, _serialize_status(st))
    return st


# ============================================================================
# RESUME SLA - Complete Implementation
# ============================================================================

def resume_sla(
    db: Session, 
    ticket: Ticket, 
    dimension: SLADimension,
    actor_id: str | None = None
) -> TicketSLAStatus:
    """
    Resume SLA timer for a specific dimension (first_response or resolution).
    
    Updates:
    1. TicketSLAStatus - recalculate due dates from remaining time
    2. TicketSLAPauseHistory - complete the audit trail with duration
    3. SLAPauseWindow - close the legacy window
    4. TicketEvent - ticket event log
    """
    if not ticket or not ticket.sla_status:
        return ticket.sla_status  # type: ignore
    
    st = ticket.sla_status
    when = now_utc()
    
    pause_duration_minutes = None
    
    # Determine which dimension to resume
    if dimension == SLADimension.first_response:
        if not st.first_response_paused:
            return st  # Not paused
        
        # Calculate pause duration
        if st.first_response_paused_at:
            pause_duration_minutes = int((when - st.first_response_paused_at).total_seconds() / 60)
            st.total_paused_first_response_minutes += pause_duration_minutes
        
        # Get remaining minutes from meta
        st.meta = st.meta or {}
        remaining_minutes = st.meta.pop("paused_first_response_remaining_minutes", None)
        
        # Recalculate due date from remaining time
        if remaining_minutes is not None:
            st.first_response_due_at = when + timedelta(minutes=remaining_minutes)
        
        # Clear pause state
        st.first_response_paused = False
        st.first_response_paused_at = None
        st.last_resume_first_response = when
        
    elif dimension == SLADimension.resolution:
        if not st.resolution_paused:
            return st  # Not paused
        
        # Calculate pause duration
        if st.resolution_paused_at:
            pause_duration_minutes = int((when - st.resolution_paused_at).total_seconds() / 60)
            st.total_paused_resolution_minutes += pause_duration_minutes
        
        # Get remaining minutes from meta
        st.meta = st.meta or {}
        remaining_minutes = st.meta.pop("paused_resolution_remaining_minutes", None)
        
        # Recalculate due date from remaining time
        if remaining_minutes is not None:
            st.resolution_due_at = when + timedelta(minutes=remaining_minutes)
        
        # Clear pause state
        st.resolution_paused = False
        st.resolution_paused_at = None
        st.last_resume_resolution = when
    
    # Update legacy paused flag
    st.paused = st.first_response_paused or st.resolution_paused
    if not st.paused:
        st.pause_reason = None
    
    # 1. Create resume history entry
    resume_history = TicketSLAPauseHistory(
        pause_id=str(uuid.uuid4()),
        ticket_id=ticket.ticket_id,
        dimension=dimension.value,
        action="resume",
        action_at=when,
        actor_id=actor_id or ticket.requester_id,
        pause_duration_minutes=pause_duration_minutes,
        due_date_extension_minutes=remaining_minutes if remaining_minutes else None,
        meta={
            "new_due_at": (
                st.first_response_due_at.isoformat() if dimension == SLADimension.first_response and st.first_response_due_at
                else st.resolution_due_at.isoformat() if st.resolution_due_at
                else None
            )
        }
    )
    db.add(resume_history)
    
    # 2. Close legacy SLAPauseWindow
    pause_window = (
        db.execute(
            select(SLAPauseWindow)
            .where(
                SLAPauseWindow.ticket_id == ticket.ticket_id,
                SLAPauseWindow.dimension == dimension,
                SLAPauseWindow.ended_at.is_(None),
            )
            .order_by(SLAPauseWindow.started_at.desc())
        )
        .scalars()
        .first()
    )
    if pause_window:
        pause_window.ended_at = when
        db.add(pause_window)
    
    # 3. Create ticket event
    event = TicketEvent(
        event_id=f"evt_{uuid.uuid4().hex[:10]}",
        ticket_id=ticket.ticket_id,
        actor_id=actor_id or ticket.requester_id,
        event_type="sla_resumed",
        from_value={
            "dimension": dimension.value,
            "paused": True,
        },
        to_value={
            "dimension": dimension.value,
            "paused": False,
            "new_due_at": st.resolution_due_at.isoformat() if st.resolution_due_at else None,
        },
        meta={
            "pause_duration_minutes": pause_duration_minutes,
            "total_paused_minutes": (
                st.total_paused_first_response_minutes if dimension == SLADimension.first_response
                else st.total_paused_resolution_minutes
            )
        }
    )
    db.add(event)
    
    # Update ticket activity
    ticket.last_activity_at = when
    
    db.add(st)
    db.flush()
    
    cache_ticket_sla_status(ticket.ticket_id, _serialize_status(st))
    return st


# ============================================================================
# Other Functions
# ============================================================================

def mark_first_response_done(db: Session, ticket: Ticket) -> None:
    if not ticket or not ticket.sla_status:
        return
    
    st = ticket.sla_status
    if ticket.first_response_at:
        return
    
    ticket.first_response_at = now_utc()
    
    if st.first_response_due_at and ticket.first_response_at > st.first_response_due_at:
        st.breached_first_response = True
        sla = db.get(SLA, ticket.sla_id) if ticket.sla_id else None
        if sla:
           _enqueue_breach(db, ticket, sla, st, "first_response")
    
    st.first_response_completed_at = ticket.first_response_at
    
    db.add(ticket)
    db.add(st)
    db.flush()
    
    cache_ticket_sla_status(ticket.ticket_id, _serialize_status(st))


def mark_resolved(db: Session, ticket: Ticket) -> None:
    if not ticket or not ticket.sla_status:
        return
    
    st = ticket.sla_status
    if ticket.resolved_at:
        return
    
    ticket.resolved_at = now_utc()
    
    if st.resolution_due_at and ticket.resolved_at > st.resolution_due_at:
        st.breached_resolution = True
        sla = db.get(SLA, ticket.sla_id) if ticket.sla_id else None
        if sla:
            _enqueue_breach(db, ticket, sla, st, "resolution")
    
    st.resolution_completed_at = ticket.resolved_at
    
    db.add(ticket)
    db.add(st)
    db.flush()
    
    cache_ticket_sla_status(ticket.ticket_id, _serialize_status(st))


def ensure_started(st: TicketSLAStatus) -> None:
    """Initialize start times if not already set"""
    n = now_utc()
    if not st.first_response_started_at:
        st.first_response_started_at = n
        st.last_resume_first_response = n
    if not st.resolution_started_at:
        st.resolution_started_at = n
        st.last_resume_resolution = n


def initialize_due_dates(db: Session, status: TicketSLAStatus, sla: SLA) -> None:
    """
    ✅ NEW: Initialize due dates for a newly created SLA status.
    This should be called right after creating the status record.
    """
    if not status or not sla:
        return
    
    # Ensure timers are started
    ensure_started(status)
    
    # Calculate initial due dates (don't overwrite existing ones)
    _recompute_due(db, status, sla, force=False)


def get_timers(db: Session, ticket_id: str) -> dict:
    t = db.get(Ticket, ticket_id)
    if not t or not t.sla_status:
        return {}
    
    st = t.sla_status
    sla = db.get(SLA, t.sla_id) if t.sla_id else None
    
    # Only check for breaches, don't recalculate due dates
    if sla and st.first_response_due_at and st.resolution_due_at:
        n = now_utc()
        
        # Check breaches (only if not paused)
        if not st.first_response_paused and not st.breached_first_response and st.first_response_completed_at is None:
            if n > st.first_response_due_at:
                st.breached_first_response = True
                _enqueue_breach(db, t, sla, st, "first_response")
        
        if not st.resolution_paused and not st.breached_resolution and st.resolution_completed_at is None:
            if n > st.resolution_due_at:
                st.breached_resolution = True
                _enqueue_breach(db, t, sla, st, "resolution")
    
    windows = (
        db.execute(
            select(SLAPauseWindow)
            .where(SLAPauseWindow.ticket_id == ticket_id)
            .order_by(SLAPauseWindow.started_at.asc())
        )
        .scalars()
        .all()
    )
    
    return {
        "ticket_id": t.ticket_id,
        "sla_id": t.sla_id,
        "paused": st.paused,
        "pause_reason": st.pause_reason,
        "first_response": {
            "started_at": st.first_response_started_at,
            "due_at": st.first_response_due_at,
            "paused": st.first_response_paused,
            "paused_at": st.first_response_paused_at,
            "total_paused_minutes": st.total_paused_first_response_minutes,
            "breached": st.breached_first_response,
        },
        "resolution": {
            "started_at": st.resolution_started_at,
            "due_at": st.resolution_due_at,
            "paused": st.resolution_paused,
            "paused_at": st.resolution_paused_at,
            "total_paused_minutes": st.total_paused_resolution_minutes,
            "breached": st.breached_resolution,
        },
        "pause_windows": [
            {
                "dimension": w.dimension.value,
                "reason": w.reason,
                "started_at": w.started_at,
                "ended_at": w.ended_at,
            }
            for w in windows
        ],
    }