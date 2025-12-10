# app/models/responses.py
from sqlalchemy import Column, String, DateTime, JSON, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from ..db import Base

class Response(Base):
    __tablename__ = "responses"

    response_id = Column(String, primary_key=True, index=True)
    org_id = Column(String, index=True, nullable=False)
    survey_id = Column(String, ForeignKey("surveys.survey_id"), index=True, nullable=False)

    # 🔹 NEW: which participant source / panel this came from
    source_id = Column(String, ForeignKey("participant_sources.id"), index=True, nullable=True)

    respondent_id = Column(String, nullable=False)
    status = Column(String, default="started")  # started, completed

    started_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)

    # store anything extra (panel info, device, IP hash, etc.)
    meta_data = Column(JSON, default=dict)

    updated_at = Column(DateTime(timezone=True),
                        server_default=func.now(),
                        onupdate=func.now())

    # inline answers snapshot
    answers_blob = Column(JSON, default=list)

    # relational answers
    answers = relationship(
        "Answer",
        back_populates="response",
        cascade="all, delete-orphan"
    )
