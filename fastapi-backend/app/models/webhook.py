from sqlalchemy import Column, String, Boolean, DateTime, ARRAY, func

from ..db import Base

class Webhook(Base):
    __tablename__ = "webhooks"

    hook_id = Column(String, primary_key=True, index=True)
    org_id = Column(String, nullable=False, index=True)
    name = Column(String, nullable=False)
    url = Column(String, nullable=False)
    secret = Column(String, nullable=True)
    events = Column(ARRAY(String), default=[])
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
