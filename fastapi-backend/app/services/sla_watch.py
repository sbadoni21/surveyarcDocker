from __future__ import annotations
from sqlalchemy import select, and_
from sqlalchemy.orm import joinedload
from datetime import datetime, timezone
from ..db import SessionLocal
from ..models.tickets import Ticket, TicketSLAStatus, TicketStatus
from ..models.sla import SLA
from ..routes.tickets import maybe_warn  # reuse your function

DEFAULT_FRACTIONS = [0.5, 0.9]  # fallback if SLA.reminder_policy not set

def _fractions_for(sla: SLA, dim: str):
    rp = (sla.reminder_policy or {}).get(dim) or {}
    fr = rp.get("warn_at")
    if isinstance(fr, list) and fr:
        return [float(x) for x in fr]
    return DEFAULT_FRACTIONS

def run_once(limit=500):
    now = datetime.utcnow().replace(tzinfo=timezone.utc)
    with SessionLocal() as session:
        rows = (
            session.query(Ticket)
            .join(TicketSLAStatus, Ticket.ticket_id == TicketSLAStatus.ticket_id)
            .options(joinedload(Ticket.sla_status))
            .filter(
                Ticket.status.in_([TicketStatus.new, TicketStatus.open, TicketStatus.pending, TicketStatus.on_hold]),
                Ticket.sla_id.isnot(None)
            )
            .limit(limit)
            .all()
        )
        for t in rows:
            sla = session.get(SLA, t.sla_id)
            if not (sla and t.sla_status):
                continue
            # first_response warnings until completed
            if t.sla_status.first_response_completed_at is None and t.sla_status.first_response_due_at:
                maybe_warn(session, t, sla, t.sla_status, "first_response",
                           target_min=_target_minutes(sla, "first_response", t),  # see note below
                           fractions=_fractions_for(sla, "first_response"))
            # resolution warnings until resolved
            if t.sla_status.resolution_completed_at is None and t.sla_status.resolution_due_at:
                maybe_warn(session, t, sla, t.sla_status, "resolution",
                           target_min=_target_minutes(sla, "resolution", t),
                           fractions=_fractions_for(sla, "resolution"))
        session.commit()

def _target_minutes(sla: SLA, dim: str, ticket: Ticket) -> int:
    """
    Use objective matrix if present; else fall back to SLA.first_response_minutes / resolution_minutes.
    Keep simple here; you can mirror your _recompute_due logic if you want perfect parity.
    """
    if dim == "first_response":
        return int(sla.first_response_minutes or 0) or 1
    if dim == "resolution":
        return int(sla.resolution_minutes or 0) or 1
    return 1

if __name__ == "__main__":
    run_once()
