from sqlalchemy import Column, String, Boolean, DateTime
from sqlalchemy.sql import func
from ..db import Base

class Domain(Base):
    __tablename__ = "domains"

    domain_id = Column(String, primary_key=True, index=True)
    org_id = Column(String, nullable=False)
    domain = Column(String, nullable=False)
    ssl_status = Column(String, default="pending")
    verification_token = Column(String, nullable=True)
    is_primary = Column(Boolean, default=False)
    added_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
