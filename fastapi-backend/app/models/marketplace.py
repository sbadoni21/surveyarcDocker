from sqlalchemy import Column, String, Boolean, DateTime, JSON
from sqlalchemy.sql import func
from typing import Optional

from ..db import Base

class Marketplace(Base):
    __tablename__ = "marketplace"

    app_id = Column(String, primary_key=True, index=True)
    org_id = Column(String, nullable=False)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    installed_at = Column(DateTime(timezone=True), server_default=func.now())
    enabled = Column(Boolean, default=True)
    config = Column(JSON, default={})
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
