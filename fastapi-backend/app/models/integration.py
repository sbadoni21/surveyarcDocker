from sqlalchemy import Column, String, Boolean, DateTime, JSON
from sqlalchemy.sql import func
from ..db import Base

class Integration(Base):
    __tablename__ = "integrations"

    int_id = Column(String, primary_key=True, index=True)
    org_id = Column(String, nullable=False)
    type = Column(String, nullable=False)
    config = Column(JSON, default={})
    enabled = Column(Boolean, default=True)
    installed_by = Column(String, nullable=True)
    installed_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
