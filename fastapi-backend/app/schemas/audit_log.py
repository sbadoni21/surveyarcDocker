from pydantic import BaseModel
from typing import Optional, Dict
from datetime import datetime

class AuditLogBase(BaseModel):
    org_id: str
    action: str
    performed_by: str
    target: Optional[str] = None
    details: Optional[Dict] = {}
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None

class AuditLogCreate(AuditLogBase):
    log_id: str

class AuditLogResponse(AuditLogBase):
    log_id: str
    timestamp: datetime

    class Config:
        from_attributes = True
