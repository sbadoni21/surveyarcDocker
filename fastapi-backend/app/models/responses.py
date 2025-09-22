from sqlalchemy import Column, String, DateTime, JSON
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from ..db import Base   # ✅ use shared Base, not a new declarative_base()


class Response(Base):
    __tablename__ = "responses"

    response_id = Column(String, primary_key=True, index=True)
    org_id = Column(String, index=True, nullable=False)
    survey_id = Column(String, index=True, nullable=False)
    respondent_id = Column(String, nullable=False)
    status = Column(String, default="started")  # started, completed, etc.
    started_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)
    meta_data = Column(JSON, default={})
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # 🔗 one-to-many relationship (Response → Answers)
    answers = relationship("Answer", back_populates="response", cascade="all, delete-orphan")
