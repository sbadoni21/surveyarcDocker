from sqlalchemy import Column, String, Integer, JSON, DateTime, ForeignKey
from sqlalchemy.sql import func
from ..db import Base


class Survey(Base):
    __tablename__ = "surveys"

    survey_id = Column(String, primary_key=True, index=True)
    org_id = Column(String, ForeignKey("organisations.org_id"), nullable=False, index=True)
    project_id = Column(String, nullable=False, index=True)
    name = Column(String, nullable=False)
    slug = Column(String, nullable=False, unique=True)
    version = Column(Integer, default=1)
    status = Column(String, default="draft")  # draft, published, archived
    created_by = Column(String, nullable=False)
    updated_by = Column(String, nullable=False)
    time = Column(String, nullable=True)  # change to DateTime/Interval if needed
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    settings = Column(JSON, default=lambda: {"anonymous": False})
    question_order = Column(JSON, default=list)  # list of question IDs
    meta_data = Column(JSON, default=dict)
    theme_id = Column(String, nullable=True)

    # 🔹 NEW: blocks & block_order
    blocks = Column(JSON, default=list)        # [{blockId, name, questionOrder:[]}, ...]
    block_order = Column(JSON, default=list)   # ["B1234", "B5678", ...]