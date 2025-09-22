from sqlalchemy import Column, String, DateTime
from sqlalchemy.sql import func
from ..db import Base
from typing import Optional


class Invite(Base):
    __tablename__ = "invites"

    invite_id = Column(String, primary_key=True, index=True)
    org_id = Column(String, nullable=False)
    email = Column(String, nullable=False)
    role = Column(String, nullable=False)
    invited_by = Column(String, nullable=False)
    status = Column(String, default="pending")
    sent_at = Column(DateTime(timezone=True), server_default=func.now())
    accepted_at = Column(DateTime(timezone=True), nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=True)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
