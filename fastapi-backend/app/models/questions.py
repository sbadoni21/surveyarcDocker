from sqlalchemy import Column, String, Boolean, DateTime, JSON
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

    config = Column(JSON, default=dict)
    logic = Column(JSON, default=list)
    translations = Column(JSON, default=dict)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )

    # ✅ CRITICAL FIX
    def to_dict(self):
        return {
            "question_id": self.question_id,
            "org_id": self.org_id,
            "survey_id": self.survey_id,
            "project_id": self.project_id,
            "type": self.type,
            "label": self.label,
            "description": self.description,
            "required": self.required,
            "config": self.config or {},
            "logic": self.logic or [],
            "translations": self.translations or {},
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }
