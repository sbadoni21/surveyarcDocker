# app/services/audit_helpers.py
from typing import Optional, Dict, Any
from fastapi import Request
from sqlalchemy.orm import Session
from .audit import audit  # your existing audit(session, **kwargs)

def audit_with_request(
    session: Session,
    request: Request,
    *,
    current_user: Optional[dict] = None,
    org_id: Optional[str] = None,
    entity_type: str,
    entity_id: str,
    entity_human: Optional[str] = None,
    event_type: str,
    severity: str = "info",
    channel: str = "write",
    status: str = "success",
    source: str = "api",
    before: Optional[Dict[str, Any]] = None,
    after: Optional[Dict[str, Any]] = None,
    meta: Optional[Dict[str, Any]] = None,
    tags: Optional[list[str]] = None,
):
    st = request.state

    # Actor fields from your auth dependency
    actor_id    = current_user.get("uid")     if current_user else None
    actor_email = current_user.get("email")   if current_user else None
    actor_role  = current_user.get("role")    if current_user else None

    # Choose org_id: explicit arg wins, else try from user
    _org_id = org_id
    if not _org_id and current_user:
        # If user belongs to a single org, use it
        org_ids = current_user.get("org_ids") or []
        if len(org_ids) == 1:
            _org_id = org_ids[0]

    return audit(
        session,
        org_id=_org_id,
        tenant_id=getattr(st, "tenant_id", None),
        actor_id=actor_id,
        actor_email=actor_email,
        actor_role=actor_role,
        entity_type=entity_type,
        entity_id=entity_id,
        entity_human=entity_human,
        event_type=event_type,
        severity=severity,
        channel=channel,
        status=status,
        source=source,
        request_id=getattr(st, "request_id", None),
        session_id=getattr(st, "session_id", None),
        trace_id=getattr(st, "trace_id", None),
        correlation_id=getattr(st, "correlation_id", None),
        parent_log_id=getattr(st, "parent_log_id", None),
        ip_address=getattr(st, "ip", None),
        user_agent=getattr(st, "ua", None),
        before=before,
        after=after,
        meta=meta,
        tags=tags or [],
    )
