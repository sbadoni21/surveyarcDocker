from sqlalchemy import Column, String, Boolean, DateTime, JSON, ForeignKey
from sqlalchemy.sql import func

from ..db import Base

class Question(Base):
    __tablename__ = "questions"

    question_id = Column(String, primary_key=True, index=True)
    org_id = Column(String, index=True, nullable=False)
    survey_id = Column(String, index=True, nullable=False)
    project_id = Column(String, nullable=True)
    type = Column(String, nullable=False)
    label = Column(String, nullable=False)
    description = Column(String, default="")
    required = Column(Boolean, default=True)
    config = Column(JSON, default={})
    logic = Column(JSON, default=[])
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
