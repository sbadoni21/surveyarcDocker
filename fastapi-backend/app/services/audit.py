# app/services/audit.py
import uuid, hashlib, json
from typing import Dict, Any, Iterable
from sqlalchemy.orm import Session
from ..models.audit_event import AuditEvent

# Paths to redact (dot-notation)
REDACT_PATHS = {
  "password", "token", "access_token", "refresh_token",
  "smtp.pass", "smtp.password",
  "user.ssn", "user.dob",
  "credit_card.number", "credit_card.cvv",
}

def _redact(obj: Any, paths: Iterable[str]) -> tuple[Any, bool]:
    """
    Redact sensitive fields in a shallow or nested dict by known paths.
    Returns (sanitized_obj, redacted_bool).
    """
    redacted = False
    def mark(d: Dict[str, Any], keys: list[str]):
        nonlocal redacted
        if not isinstance(d, dict) or not keys:
            return
        k = keys[0]
        if k in d:
            if len(keys) == 1:
                d[k] = "***REDACTED***"; redacted = True
            else:
                mark(d[k], keys[1:])
    if isinstance(obj, dict):
        clone = json.loads(json.dumps(obj))
        for p in paths:
            mark(clone, p.split("."))
        return clone, redacted
    return obj, redacted

def _dedupe_hash(payload: Dict[str, Any]) -> str:
    """
    Stable, collision-resistant hash to make inserts idempotent.
    Include org_id, entity, event_type, occurred_at second, and after/before/meta.
    """
    key = json.dumps({
        "org_id": payload.get("org_id"),
        "entity_type": payload.get("entity_type"),
        "entity_id": payload.get("entity_id"),
        "event_type": payload.get("event_type"),
        "occurred_at": str(payload.get("occurred_at") or ""),
        "before": payload.get("before") or {},
        "after": payload.get("after") or {},
        "meta": payload.get("meta") or {},
    }, sort_keys=True, separators=(",",":"))
    return hashlib.sha256(key.encode("utf-8")).hexdigest()

def audit(session: Session, **kwargs) -> AuditEvent:
    """
    Insert one audit event (append-only).
    Will redact sensitive fields and enforce idempotency on dedupe_hash.
    """
    before = kwargs.get("before")
    after  = kwargs.get("after")
    before_s, b_red = _redact(before, REDACT_PATHS)
    after_s,  a_red = _redact(after,  REDACT_PATHS)
    meta_s,   m_red = _redact(kwargs.get("meta"), REDACT_PATHS)
    redacted = any([b_red, a_red, m_red])

    payload = dict(kwargs)
    payload["before"]   = before_s
    payload["after"]    = after_s
    payload["meta"]     = meta_s
    payload["redacted"] = redacted
    payload["received_at"] = None  # server default NOW()
    payload["log_id"]   = f"aevt_{uuid.uuid4().hex[:12]}"
    payload["dedupe_hash"] = _dedupe_hash(payload)

    row = AuditEvent(**payload)
    session.add(row)
    try:
        session.commit()
    except Exception:
        # on unique violation of dedupe_hash, fetch and return existing
        session.rollback()
        existing = session.query(AuditEvent).filter_by(dedupe_hash=payload["dedupe_hash"]).first()
        if existing:
            return existing
        raise
    session.refresh(row)
    return row

