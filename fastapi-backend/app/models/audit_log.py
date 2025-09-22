from sqlalchemy import Column, String, DateTime, JSON
from sqlalchemy.sql import func
from ..db import Base

class AuditLog(Base):
    __tablename__ = "audit_logs"

    log_id = Column(String, primary_key=True, index=True)
    org_id = Column(String, nullable=False)
    action = Column(String, nullable=False)
    performed_by = Column(String, nullable=False)
    target = Column(String, nullable=True)
    details = Column(JSON, default={})
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    ip_address = Column(String, nullable=True)
    user_agent = Column(String, nullable=True)
