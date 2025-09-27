# app/services/sla_service.py
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy.orm import Session
from sqlalchemy import select

from ..models.tickets import Ticket, TicketSLAStatus
from ..models.sla import SLAPauseWindow, SLADimension, SLA
from ..services.redis_sla_service import (
    cache_ticket_sla_status,
    invalidate_ticket_sla_status,  # kept for completeness (not used below but handy)
)

UTC = timezone.utc


def now_utc() -> datetime:
    return datetime.now(tz=UTC)


# --------------------------------------------------------------------
# Helpers (wall-clock, no business-calendar)
# --------------------------------------------------------------------

def _minutes_to_due(base: datetime, mins: Optional[int]) -> Optional[datetime]:
    if mins is None:
        return None
    try:
        mins = int(mins)
    except Exception:
        return None
    if mins <= 0:
        return base
    return base + timedelta(minutes=mins)


def _freeze_clock(status: TicketSLAStatus, when: datetime) -> None:
    """
    Capture remaining minutes at 'when' for both dimensions so we can recreate due times on resume.
    """
    if status.paused:
        return

    status.meta = status.meta or {}

    rem_fr = None
    if status.first_response_due_at:
        delta = (status.first_response_due_at - when).total_seconds() // 60
        rem_fr = max(0, int(delta))

    rem_res = None
    if status.resolution_due_at:
        delta = (status.resolution_due_at - when).total_seconds() // 60
        rem_res = max(0, int(delta))

    status.meta["remaining_first_response_minutes"] = rem_fr
    status.meta["remaining_resolution_minutes"] = rem_res


def _unfreeze_clock(status: TicketSLAStatus, when: datetime) -> None:
    """
    Rebuild due times from remaining minutes snapshot taken at pause time.
    """
    status.meta = status.meta or {}
    fr = status.meta.pop("remaining_first_response_minutes", None)
    rr = status.meta.pop("remaining_resolution_minutes", None)

    status.first_response_due_at = _minutes_to_due(when, fr) if fr is not None else status.first_response_due_at
    status.resolution_due_at     = _minutes_to_due(when, rr) if rr is not None else status.resolution_due_at


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


# --------------------------------------------------------------------
# (Re)compute due dates – simple wall-clock version
# --------------------------------------------------------------------

def _recompute_due(db: Session, status: TicketSLAStatus, sla: SLA) -> None:
    """
    Compute/refresh due times from 'now', respecting paused state.

    Rules (simple):
      - If paused: do nothing (freeze state).
      - If running:
          * first_response_due_at: set once if SLA target exists and not already satisfied.
          * resolution_due_at: set/refresh every time based on SLA target.
    """
    if not status or not sla:
        return

    n = now_utc()

    if status.paused:
        # When paused, do not touch due times—freeze preserved via _freeze_clock.
        return

    # First Response target
    if sla.first_response_minutes and not status.first_response_due_at and not status.breached_first_response:
        status.first_response_due_at = _minutes_to_due(n, sla.first_response_minutes)

    # Resolution target
    if sla.resolution_minutes and not status.breached_resolution:
        # Allow recomputation to keep it simple (e.g., if SLA minutes change)
        status.resolution_due_at = _minutes_to_due(n, sla.resolution_minutes)
    elif not sla.resolution_minutes:
        status.resolution_due_at = None


# --------------------------------------------------------------------
# Public API
# --------------------------------------------------------------------

def pause_sla(db: Session, ticket: Ticket, dimension: SLADimension, reason: str | None = None) -> TicketSLAStatus:
    """
    Pause SLA timers (single paused flag for simplicity).
    Creates/extends an open SLAPauseWindow for audit (dimension is stored).
    """
    if not ticket or not ticket.sla_status:
        return ticket.sla_status  # type: ignore

    st = ticket.sla_status
    if st.paused:
        return st

    when = now_utc()
    _freeze_clock(st, when)
    st.paused = True
    st.pause_reason = reason or "manual"

    # open pause window
    win = SLAPauseWindow(
        ticket_id=ticket.ticket_id,
        dimension=dimension,
        reason=st.pause_reason,
        started_at=when,
        ended_at=None,
        meta={},
    )
    db.add(win)
    db.add(st)
    db.flush()

    cache_ticket_sla_status(ticket.ticket_id, _serialize_status(st))
    return st


def resume_sla(db: Session, ticket: Ticket, dimension: SLADimension) -> TicketSLAStatus:
    """
    Resume SLA timers from the snapshot of remaining minutes.
    Closes the most recent open SLAPauseWindow for the given dimension.
    """
    if not ticket or not ticket.sla_status:
        return ticket.sla_status  # type: ignore

    st = ticket.sla_status
    if not st.paused:
        return st

    when = now_utc()
    _unfreeze_clock(st, when)
    st.paused = False
    st.pause_reason = None

    # close the latest open window for this dim (if any)
    win = (
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
    if win:
        win.ended_at = when
        db.add(win)

    db.add(st)
    db.flush()

    cache_ticket_sla_status(ticket.ticket_id, _serialize_status(st))
    return st


def mark_first_response_done(db: Session, ticket: Ticket) -> None:
    """
    On first PUBLIC agent reply: stamp 'first_response_at' and stop the first-response timer.
    """
    if not ticket or not ticket.sla_status:
        return

    st = ticket.sla_status
    if ticket.first_response_at:
        return

    ticket.first_response_at = now_utc()

    if st.first_response_due_at and ticket.first_response_at > st.first_response_due_at:
        st.breached_first_response = True

    # stop first-response timer
    st.first_response_due_at = None

    db.add(ticket)
    db.add(st)
    db.flush()

    cache_ticket_sla_status(ticket.ticket_id, _serialize_status(st))


def mark_resolved(db: Session, ticket: Ticket) -> None:
    """
    When ticket is resolved: stamp 'resolved_at', mark breach if late, stop resolution timer.
    """
    if not ticket or not ticket.sla_status:
        return

    st = ticket.sla_status
    if ticket.resolved_at:
        return

    ticket.resolved_at = now_utc()

    if st.resolution_due_at and ticket.resolved_at > st.resolution_due_at:
        st.breached_resolution = True

    st.resolution_due_at = None

    db.add(ticket)
    db.add(st)
    db.flush()

    cache_ticket_sla_status(ticket.ticket_id, _serialize_status(st))


def ensure_started(st: TicketSLAStatus) -> None:
    """
    Initialize SLA clocks when a ticket is created/binds to an SLA.
    (We keep fields for compatibility with more advanced engines, but
     here they’re used as simple "started at" markers.)
    """
    n = now_utc()
    if not st.first_response_started_at:
        st.first_response_started_at = n
        st.last_resume_first_response = n
    if not st.resolution_started_at:
        st.resolution_started_at = n
        st.last_resume_resolution = n


def get_timers(db: Session, ticket_id: str) -> dict:
    """
    Returns a compact snapshot of a ticket's SLA timers + pause windows.
    All wall-clock; no business-hours math.
    """
    t = db.get(Ticket, ticket_id)
    if not t or not t.sla_status:
        return {}

    st = t.sla_status
    sla = db.get(SLA, t.sla_id) if t.sla_id else None
    if sla:
        _recompute_due(db, st, sla)

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
            "breached": st.breached_first_response,
        },
        "resolution": {
            "started_at": st.resolution_started_at,
            "due_at": st.resolution_due_at,
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
