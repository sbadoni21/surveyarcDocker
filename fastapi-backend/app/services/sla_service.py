# app/services/sla_service.py
from __future__ import annotations
from datetime import datetime, timedelta, date, time,timezone
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session
from sqlalchemy import select, and_

from ..models.tickets import Ticket, TicketSLAStatus, SLA
from ..models.sla import SLAPauseWindow, SLADimension, BusinessCalendar, BusinessCalendarHour, BusinessCalendarHoliday
# app/services/sla_service.py

from typing import Optional


from sqlalchemy.orm import Session

from ..models.tickets import Ticket, TicketSLAStatus, SLA
from ..services.redis_sla_service import (
    cache_ticket_sla_status,
    invalidate_ticket_sla_status,
)
from ..models.sla import SLADimension

UTC = timezone.utc

def now_utc() -> datetime:
    return datetime.now(tz=UTC)

# ------------------- helpers -------------------



def _minutes_to_due(base: datetime, mins: Optional[int]) -> Optional[datetime]:
    if not mins:
        return None
    return base + timedelta(minutes=int(mins))

def _freeze_clock(status: TicketSLAStatus, when: datetime) -> None:
    """
    Freeze 'remaining' for any due dates when we go paused.
    We store remaining intervals in meta-like mechanism by subtracting 'when' from dues.
    """
    if status.paused:
        return
    # compute remaining deltas
    status.meta = status.meta or {}
    fr, rr = None, None
    if status.first_response_due_at:
        fr = max(0, int((status.first_response_due_at - when).total_seconds() // 60))
    if status.resolution_due_at:
        rr = max(0, int((status.resolution_due_at - when).total_seconds() // 60))
    status.meta["remaining_first_response_minutes"] = fr
    status.meta["remaining_resolution_minutes"] = rr

def _unfreeze_clock(status: TicketSLAStatus, when: datetime) -> None:
    """
    Resume by restoring due_at = when + remaining_minutes.
    """
    status.meta = status.meta or {}
    fr = status.meta.get("remaining_first_response_minutes")
    rr = status.meta.get("remaining_resolution_minutes")
    if fr is not None:
        status.first_response_due_at = _minutes_to_due(when, fr)
    if rr is not None:
        status.resolution_due_at = _minutes_to_due(when, rr)
    # clear remaining once restored
    status.meta.pop("remaining_first_response_minutes", None)
    status.meta.pop("remaining_resolution_minutes", None)

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

# ------------------- recompute -------------------

def _recompute_due(db: Session, status: TicketSLAStatus, sla: SLA) -> None:
    """
    Recompute due times naïvely from 'now' respecting paused state and any remaining values.
    This is intentionally simple; if you have business calendars, plug them here.
    """
    if status is None or sla is None:
        return
    n = now_utc()
    # if paused and we have remaining, do not change; otherwise set from SLA mins
    if not status.paused:
        if sla.first_response_minutes:
            # don't override if already set (first response might have been set on first agent reply)
            if not status.first_response_due_at:
                status.first_response_due_at = _minutes_to_due(n, sla.first_response_minutes)
        if sla.resolution_minutes:
            status.resolution_due_at = _minutes_to_due(n, sla.resolution_minutes)

# ------------------- public API -------------------

def pause_sla(db: Session, ticket: Ticket, dimension: SLADimension, reason: str | None = None) -> TicketSLAStatus:
    """
    Pause SLA timing (we freeze remaining minutes at the pause moment).
    For per-dimension pause we still store a single paused flag (simple model).
    """
    if not ticket or not ticket.sla_status:
        return ticket.sla_status  # type: ignore
    st = ticket.sla_status
    if st.paused:
        return st

    _freeze_clock(st, now_utc())
    st.paused = True
    st.pause_reason = reason or "manual"
    db.add(st); db.flush()
    cache_ticket_sla_status(ticket.ticket_id, _serialize_status(st))
    return st

def resume_sla(db: Session, ticket: Ticket, dimension: SLADimension) -> TicketSLAStatus:
    """
    Resume SLA timing (we rebuild dues from remaining minutes captured at pause).
    """
    if not ticket or not ticket.sla_status:
        return ticket.sla_status  # type: ignore
    st = ticket.sla_status
    if not st.paused:
        return st

    _unfreeze_clock(st, now_utc())
    st.paused = False
    st.pause_reason = None
    db.add(st); db.flush()
    cache_ticket_sla_status(ticket.ticket_id, _serialize_status(st))
    return st

def mark_first_response_done(db: Session, ticket: Ticket) -> None:
    """
    Called when the first agent PUBLIC reply is posted; we set first_response_at and
    stop the first-response clock (by nulling due or marking breached if late).
    """
    if not ticket or not ticket.sla_status:
        return
    st = ticket.sla_status
    if ticket.first_response_at:
        return
    ticket.first_response_at = now_utc()

    if st.first_response_due_at and ticket.first_response_at > st.first_response_due_at:
        st.breached_first_response = True
    # stop first response timer
    st.first_response_due_at = None
    db.add(ticket); db.add(st); db.flush()
    cache_ticket_sla_status(ticket.ticket_id, _serialize_status(st))

def mark_resolved(db: Session, ticket: Ticket) -> None:
    """
    Called when ticket is resolved; we stop resolution clock and mark breach if late.
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
    db.add(ticket); db.add(st); db.flush()
    cache_ticket_sla_status(ticket.ticket_id, _serialize_status(st))

# --------- business-hours helpers (compact but correct enough) ----------

def _get_calendar(db: Session, calendar_id: str | None, fallback_tz="UTC") -> tuple[str, list[tuple[int,int,int]], set[str]]:
    """
    Returns (tz, hours, holidays) for calendar_id.
    hours: list of (weekday, start_min, end_min)
    holidays: set of 'YYYY-MM-DD'
    """
    if not calendar_id:
        return fallback_tz, [(i, 0, 24*60) for i in range(7)], set()  # 24x7 default

    cal = db.get(BusinessCalendar, calendar_id)
    if not cal or not cal.active:
        return fallback_tz, [(i, 0, 24*60) for i in range(7)], set()

    hrs = db.execute(select(BusinessCalendarHour).where(BusinessCalendarHour.calendar_id == calendar_id)).scalars().all()
    hols = db.execute(select(BusinessCalendarHoliday).where(BusinessCalendarHoliday.calendar_id == calendar_id)).scalars().all()
    hours = [(h.weekday, h.start_min, h.end_min) for h in hrs]
    holidays = {h.date_iso for h in hols}
    return cal.timezone or fallback_tz, hours, holidays

def _clip_to_business_minutes(tz: str, hours: list[tuple[int,int,int]], holidays: set[str], start_dt: datetime, end_dt: datetime) -> int:
    """
    Returns business minutes between start_dt and end_dt.
    Simplified: iterate day by day, intersect with working windows.
    """
    if end_dt <= start_dt:
        return 0
    z = ZoneInfo(tz)
    s = start_dt.astimezone(z)
    e = end_dt.astimezone(z)

    total = 0
    cur = s
    while cur < e:
        day_end = datetime(cur.year, cur.month, cur.day, 23, 59, 59, tzinfo=z)
        stop = min(e, day_end)
        key = f"{cur.date().isoformat()}"
        if key not in holidays:
            wd = cur.weekday()
            for (hwd, start_min, end_min) in hours:
                if hwd != wd: 
                    continue
                win_start = datetime(cur.year, cur.month, cur.day, 0, 0, tzinfo=z) + timedelta(minutes=start_min)
                win_end   = datetime(cur.year, cur.month, cur.day, 0, 0, tzinfo=z) + timedelta(minutes=end_min)
                # overlap between [cur, stop] and [win_start, win_end]
                a = max(cur, win_start)
                b = min(stop, win_end)
                if b > a:
                    total += int((b - a).total_seconds() // 60)
        cur = datetime(cur.year, cur.month, cur.day, 0, 0, tzinfo=z) + timedelta(days=1)
    return max(total, 0)

def _add_business_minutes(tz: str, hours: list[tuple[int,int,int]], holidays: set[str], start_dt: datetime, minutes: int) -> datetime:
    """Move forward by business minutes; simplified but robust."""
    if minutes <= 0: 
        return start_dt
    z = ZoneInfo(tz)
    cur = start_dt.astimezone(z)
    remaining = minutes

    # iterate days forward
    while remaining > 0:
        key = cur.date().isoformat()
        if key not in holidays:
            wd = cur.weekday()
            segments = [(s,e) for (hwd,s,e) in hours if hwd==wd]
            segments.sort()
            moved = False

            for s_min, e_min in segments:
                seg_start = datetime(cur.year, cur.month, cur.day, 0, 0, tzinfo=z) + timedelta(minutes=s_min)
                seg_end   = datetime(cur.year, cur.month, cur.day, 0, 0, tzinfo=z) + timedelta(minutes=e_min)

                if cur <= seg_end:
                    cur2 = max(cur, seg_start)
                    if cur2 < seg_end:
                        cap = int((seg_end - cur2).total_seconds() // 60)
                        used = min(cap, remaining)
                        cur  = cur2 + timedelta(minutes=used)
                        remaining -= used
                        moved = True
                        if remaining == 0:
                            return cur
            if not moved:
                # jump to next day's first window
                cur = datetime(cur.year, cur.month, cur.day, 0, 0, tzinfo=z) + timedelta(days=1)
                continue
        else:
            cur = datetime(cur.year, cur.month, cur.day, 0, 0, tzinfo=z) + timedelta(days=1)
    return cur

# ------------- SLA state machine (pause/resume/recompute) -------------

def _accumulate_elapsed(db: Session, t: Ticket, st: TicketSLAStatus, dim: SLADimension) -> None:
    tz, hours, holidays = _get_calendar(db, st.calendar_id)
    now = datetime.utcnow()
    if dim == SLADimension.first_response and st.last_resume_first_response:
        st.elapsed_first_response_minutes += _clip_to_business_minutes(
            tz, hours, holidays, st.last_resume_first_response, now
        )
        st.last_resume_first_response = None
    elif dim == SLADimension.resolution and st.last_resume_resolution:
        st.elapsed_resolution_minutes += _clip_to_business_minutes(
            tz, hours, holidays, st.last_resume_resolution, now
        )
        st.last_resume_resolution = None

def _recompute_due(db: Session, st: TicketSLAStatus, sla: SLA) -> None:
    tz, hours, holidays = _get_calendar(db, st.calendar_id)
    now = datetime.utcnow()

    # FIRST RESPONSE
    if sla.first_response_minutes:
        elapsed = st.elapsed_first_response_minutes
        # if running, include partial to now
        if st.last_resume_first_response:
            elapsed += _clip_to_business_minutes(tz, hours, holidays, st.last_resume_first_response, now)
        remaining = max(sla.first_response_minutes - elapsed, 0)
        st.first_response_due_at = _add_business_minutes(tz, hours, holidays, now, remaining)
        st.breached_first_response = elapsed >= sla.first_response_minutes
    else:
        st.first_response_due_at = None
        st.breached_first_response = False

    # RESOLUTION
    if sla.resolution_minutes:
        elapsed = st.elapsed_resolution_minutes
        if st.last_resume_resolution:
            elapsed += _clip_to_business_minutes(tz, hours, holidays, st.last_resume_resolution, now)
        remaining = max(sla.resolution_minutes - elapsed, 0)
        st.resolution_due_at = _add_business_minutes(tz, hours, holidays, now, remaining)
        st.breached_resolution = elapsed >= sla.resolution_minutes
    else:
        st.resolution_due_at = None
        st.breached_resolution = False

def ensure_started(st: TicketSLAStatus) -> None:
    now = datetime.utcnow()
    if not st.first_response_started_at:
        st.first_response_started_at = now
        st.last_resume_first_response = now
    if not st.resolution_started_at:
        st.resolution_started_at = now
        st.last_resume_resolution = now



def get_timers(db: Session, ticket_id: str) -> dict:
    t = db.get(Ticket, ticket_id)
    if not t or not t.sla_status:
        return {}
    st = t.sla_status
    sla = db.get(SLA, t.sla_id) if t.sla_id else None
    if sla:
        _recompute_due(db, st, sla)
    windows = db.execute(
        select(SLAPauseWindow).where(SLAPauseWindow.ticket_id == ticket_id).order_by(SLAPauseWindow.started_at.asc())
    ).scalars().all()

    return {
        "ticket_id": t.ticket_id,
        "sla_id": t.sla_id,
        "paused": st.paused,
        "pause_reason": st.pause_reason,
        "first_response": {
            "started_at": st.first_response_started_at,
            "elapsed_minutes": st.elapsed_first_response_minutes
                + (0 if not st.last_resume_first_response else 0),  # already accounted in due calc
            "due_at": st.first_response_due_at,
            "breached": st.breached_first_response,
        },
        "resolution": {
            "started_at": st.resolution_started_at,
            "elapsed_minutes": st.elapsed_resolution_minutes
                + (0 if not st.last_resume_resolution else 0),
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
