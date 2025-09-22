from sqlalchemy import Column, String, ForeignKey, DateTime, JSON
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from ..db import Base


class Answer(Base):
    __tablename__ = "answers"

    id = Column(String, primary_key=True)  # use UUID or similar
    question_id = Column(String, nullable=False)
    project_id = Column(String, nullable=False)
    survey_id = Column(String, ForeignKey("surveys.survey_id")) 
    org_id = Column(String, nullable=False)
    answer_config = Column(JSON, default={})
    answered_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # ✅ fixed: match Response PK name
    response_id = Column(String, ForeignKey("responses.response_id"), nullable=False)

    # 🔗 many-to-one relationship (Answer → Response)
    response = relationship("Response", back_populates="answers")
