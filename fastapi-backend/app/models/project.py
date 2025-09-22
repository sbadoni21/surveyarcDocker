# models/project.py
from datetime import datetime, date
from uuid import UUID
from decimal import Decimal
import json

from sqlalchemy import Column, String, Boolean, DateTime, Float
from sqlalchemy.sql import func
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.types import TypeDecorator
from sqlalchemy.ext.mutable import MutableList, MutableDict

from ..db import Base

class JSONBSerializable(TypeDecorator):
    impl = JSONB
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is None:
            return None

        def to_jsonable(o):
            if isinstance(o, (datetime, date)):
                return o.isoformat()
            if isinstance(o, UUID):
                return str(o)
            if isinstance(o, Decimal):
                return float(o)
            if isinstance(o, dict):
                return {k: to_jsonable(v) for k, v in o.items()}
            if isinstance(o, (list, tuple, set)):
                return [to_jsonable(v) for v in o]
            return o  # str, int, float, bool, None

        j = to_jsonable(value)
        # Optional: keep the early validation (nice error messages)
        json.dumps(j)
        return j



class Project(Base):
    __tablename__ = "projects"

    project_id = Column(String, primary_key=True, index=True)
    org_id = Column(String, index=True, nullable=False)
    name = Column(String, nullable=False)
    description = Column(String, default="")
    owner_uid = Column(String, nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    is_active = Column(Boolean, default=True)

    # Use MutableList/MutableDict + JSONBSerializable and callables for defaults
    members = Column(MutableList.as_mutable(JSONBSerializable), default=list)       # [{uid, role, status, joined_at: ISO string}]
    start_date = Column(DateTime(timezone=True), server_default=func.now())
    due_date = Column(DateTime(timezone=True), nullable=True)

    milestones = Column(MutableList.as_mutable(JSONBSerializable), default=list)    # e.g., [{title, due: ISO string, done}]
    status = Column(String, default="planning")
    progress_percent = Column(Float, default=0.0)
    priority = Column(String, default="medium")
    category = Column(String, default="")

    tags = Column(ARRAY(String), default=list)                                      # use callable default
    attachments = Column(MutableList.as_mutable(JSONBSerializable), default=list)   # e.g., [{name,url,size}]
    is_public = Column(Boolean, default=False)
    notifications_enabled = Column(Boolean, default=True)
    last_activity = Column(DateTime(timezone=True), server_default=func.now())
    survey_ids = Column(ARRAY(String), default=list)
