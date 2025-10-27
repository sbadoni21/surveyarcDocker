from __future__ import annotations
import json, sqlalchemy as sa
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from typing import Iterable, Optional
from ..models.tickets import Ticket, TicketSLAStatus
from ..models.sla import SLA
from ..models.outbox import Outbox
from ..models.contact import Contact, ContactList

# --- import helpers ---
def _import_user_model():
    try:
        from ..models.user import User  # keep using models.user
        return User
    except Exception:
        return None
# add near your other lookups
def lookup_org_owner_email(session: Session, org_id: str) -> str | None:
    try:
        from ..models.organisation import Organisation  # adjust module/name if different
    except Exception:
        # fallback if model import path differs in your project
        return None

    org = session.get(Organisation, org_id)
    if not org:
        return None
    # field name per your note: owner_email
    return getattr(org, "owner_email", None) or getattr(org, "owner_emial", None)  # if typo exists

def _import_support_models():
    try:
        from ..models.support import SupportTeam, SupportTeamMember
        return SupportTeam, SupportTeamMember
    except Exception:
        return None, None

# --- schema introspection helpers ---
def _user_pk_col(User):
    # prefer common names; fall back to mapped PK
    for name in ("user_id", "id", "uid"):
        if hasattr(User, name):
            return getattr(User, name)
    try:
        return sa.inspect(User).primary_key[0]
    except Exception:
        return None

def _user_email_attr(u):
    for name in ("email", "primary_email", "work_email"):
        if hasattr(u, name):
            return getattr(u, name)
    meta = getattr(u, "meta", None) or getattr(u, "meta_data", None) or {}
    return meta.get("email")

# --- lookups ---
def lookup_user_email(session: Session, user_id: str | int) -> Optional[str]:
    User = _import_user_model()
    if not (User and user_id):
        return None
    pk = _user_pk_col(User)
    if pk is None:
        return None

    # try both str/int equality to avoid type mismatches
    def _first():
        try:
            return session.query(User).filter(pk == user_id).first()
        except Exception:
            return None
    u = _first()
    if not u:
        try:
            u = session.query(User).filter(pk == int(user_id)).first()
        except Exception:
            u = None
    return _user_email_attr(u) if u else None

def lookup_team_mailbox(session: Session, team_id: str) -> Optional[str]:
    SupportTeam, _ = _import_support_models()
    if not (SupportTeam and team_id):
        return None
    t = session.get(SupportTeam, team_id)
    if not t:
        return None
    for field in ("mailbox", "email", "inbox"):
        val = getattr(t, field, None)
        if val:
            return val
    meta = getattr(t, "meta", {}) or {}
    return meta.get("mailbox") or meta.get("email")

def list_team_member_emails(session: Session, team_id: str) -> Iterable[str]:
    SupportTeam, SupportTeamMember = _import_support_models()
    User = _import_user_model()
    if not (SupportTeam and SupportTeamMember and User and team_id):
        return []

    # 1) collect member IDs
    rows = session.query(SupportTeamMember.user_id).filter_by(team_id=team_id).all()
    ids = [r[0] for r in rows if r and r[0] is not None]
    if not ids:
        return []

    # 2) query users by their actual PK column
    pk = _user_pk_col(User)
    if pk is None:
        return []

    def _maybe_int(x):
        try: return int(x)
        except Exception: return x

    try:
        users = session.query(User).filter(pk.in_([_maybe_int(x) for x in ids])).all()
    except Exception:
        # last-resort: load & filter in Python
        all_users = session.query(User).all()
        # get the attribute name of pk column (e.g., 'uid')
        pk_name = getattr(pk, "key", None) or getattr(pk, "name", None)
        idx = {str(getattr(u, pk_name)): u for u in all_users if pk_name and hasattr(u, pk_name)}
        users = [idx.get(str(i)) for i in ids if idx.get(str(i))]

    emails = []
    for u in users or []:
        e = _user_email_attr(u)
        if e:
            emails.append(e)
    return emails

# --------- Time math: straight elapsed minutes with pause support ----------
def _minutes_between(a: datetime, b: datetime) -> int:
    if not a or not b:
        return 0
    if a.tzinfo is None:  # guard against naive
        a = a.replace(tzinfo=timezone.utc)
    if b.tzinfo is None:
        b = b.replace(tzinfo=timezone.utc)
    return max(0, int((b - a).total_seconds() // 60))

def compute_business_elapsed(status: TicketSLAStatus, dim: str, now: Optional[datetime] = None) -> int:
    """
    Minimal, safe elapsed calculator using your persisted counters + last resume pointers.
    - Uses elapsed_*_minutes fields + (now - last_resume_*) if running.
    - If you later add true business-hours math, swap this function’s internals.
    """
    now = now or datetime.utcnow().replace(tzinfo=timezone.utc)

    if dim == "first_response":
        base = status.elapsed_first_response_minutes or 0
        running = (not status.first_response_paused) and (status.first_response_completed_at is None)
        if running and status.last_resume_first_response:
            base += _minutes_between(status.last_resume_first_response, now)
        return max(0, base)

    if dim == "resolution":
        base = status.elapsed_resolution_minutes or 0
        running = (not status.resolution_paused) and (status.resolution_completed_at is None)
        if running and status.last_resume_resolution:
            base += _minutes_between(status.last_resume_resolution, now)
        return max(0, base)

    # Unknown dimension → 0
    return 0

# --------- Threshold tracking / idempotency via Outbox.dedupe_key ----------
def crossed_threshold(
    session: Session,
    dim: str,
    ticket_id: str,
    threshold: float,
    current_fraction: float
) -> bool:
    """
    Returns True the first time current_fraction >= threshold.
    We rely on outbox.dedupe_key uniqueness to guarantee idempotency.
    """
    if current_fraction < threshold:
        return False
    key = f"sla.warn:{dim}:{ticket_id}:{threshold:.2f}"

    # If an outbox row (sent or pending) already exists, we’ve already “crossed”
    exists = session.execute(
        sa.select(Outbox.id).where(Outbox.dedupe_key == key)
    ).first()
    return exists is None

def enqueue_outbox(session: Session, kind: str, dedupe_key: str, payload: dict) -> None:
    """
    Insert-or-ignore into outbox using the ORM. No exception on duplicates.
    """
    try:
        ob = Outbox(kind=kind, dedupe_key=dedupe_key, payload=payload)
        session.add(ob)
        session.flush()  # ensure INSERT happens now; will error if violates unique
    except Exception:
        # Swallow duplicate-key errors (idempotent behavior).
        session.rollback()
        # Re-open a transaction boundary for the caller after a rollback from flush()
        # Insert again only if it's a different error — we just ignore silently here.

# --------- Basic recipient resolvers (best-effort, no hard deps) ----------
def _import_user_model():
    try:
        from ..models.user import User
        return User
    except Exception:
        return None

def _import_support_models():
    try:
        from ..models.support import SupportTeam, SupportTeamMember
        return SupportTeam, SupportTeamMember
    except Exception:
        return None, None




def list_client_contact_emails(session: Session, contact_list_id: str) -> Iterable[str]:
    """
    Look up all contact emails for a given list_id using your models.
    """
    if not contact_list_id:
        return []

    cl = session.get(ContactList, contact_list_id)
    if not cl:
        return []

    # Thanks to relationships, this is simple:
    return [c.email for c in (cl.contacts or []) if getattr(c, "email", None)]
