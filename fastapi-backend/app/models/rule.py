from sqlalchemy import Column, String, Boolean, Integer, JSON, DateTime, ForeignKey
from sqlalchemy.sql import func
from ..db import Base

class Rule(Base):
    __tablename__ = "rules"

    rule_id = Column(String, primary_key=True, index=True)
    org_id = Column(String, index=True, nullable=False)
    project_id = Column(String, index=True, nullable=True)
    survey_id = Column(String, ForeignKey("surveys.survey_id"), index=True, nullable=False)

    name = Column(String, default="")
    block_id = Column(String, index=True, nullable=False)   # the block this rule applies to
    enabled = Column(Boolean, default=True)
    priority = Column(Integer, default=1)

    conditions = Column(JSON, default=list)  # [{questionId, operator, value, conditionLogic}]
    actions = Column(JSON, default=list)     # see your action shapes

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
