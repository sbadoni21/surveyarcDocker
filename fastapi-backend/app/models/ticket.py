from sqlalchemy import Column, String, DateTime, JSON, ForeignKey
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func
from ..db import Base

class Ticket(Base):
    __tablename__ = "tickets"

    ticket_id   = Column(String, primary_key=True, index=True)
    org_id      = Column(String, ForeignKey("organisations.org_id"), nullable=False, index=True)
    survey_id   = Column(String, ForeignKey("surveys.survey_id"), nullable=False, index=True)
    question_id = Column(String, ForeignKey("questions.question_id"), nullable=False, index=True)

    subject     = Column(String, nullable=False)
    description = Column(String, nullable=True)
    created_by  = Column(String, nullable=False)
    status      = Column(String, default="open")       # open | in_progress | resolved | closed
    priority    = Column(String, default="medium")     # low | medium | high
    assigned_to = Column(String, nullable=True)

    created_at  = Column(DateTime(timezone=True), server_default=func.now())
    updated_at  = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    comments    = Column(JSONB, default=list)
