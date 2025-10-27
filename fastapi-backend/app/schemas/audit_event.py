# app/schemas/audit_event.py
from pydantic import BaseModel, Field
from typing import Optional, Any, Dict, List
from datetime import datetime

class AuditEventCreate(BaseModel):
    org_id: str
    entity_type: str
    entity_id: str
    event_type: str
    actor_id: Optional[str] = None
    actor_email: Optional[str] = None
    actor_role: Optional[str] = None
    entity_human: Optional[str] = None
    severity: str = "info"
    channel: str = "write"
    status: str = "success"
    source: Optional[str] = None
    request_id: Optional[str] = None
    session_id: Optional[str] = None
    trace_id: Optional[str] = None
    correlation_id: Optional[str] = None
    parent_log_id: Optional[str] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    occurred_at: Optional[datetime] = None
    before: Optional[Dict[str, Any]] = None
    after: Optional[Dict[str, Any]] = None
    meta: Optional[Dict[str, Any]] = None
    tags: Optional[List[str]] = None

class AuditEventOut(AuditEventCreate):
    log_id: str
    received_at: datetime
    redacted: bool = False
    version: int = 1

    class Config:
        from_attributes = True
