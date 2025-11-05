# app/models/quota.py
from sqlalchemy import Column, Text, Boolean, Integer, JSON, TIMESTAMP, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid
from ..db import Base

class SurveyQuota(Base):
    __tablename__ = "survey_quotas"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), nullable=False)
    survey_id = Column(UUID(as_uuid=True), nullable=False)
    name = Column(Text, nullable=False)
    description = Column(Text)
    is_enabled = Column(Boolean, default=True, nullable=False)
    stop_condition = Column(Text, default="greater", nullable=False)
    when_met = Column(Text, default="close_survey", nullable=False)
    action_payload = Column(JSON)
    quota_metadata = Column("metadata", JSON)  # DB column stays 'metadata', Python attr is quota_metadata
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), onupdate=func.now())

class SurveyQuotaCell(Base):
    __tablename__ = "survey_quota_cells"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    quota_id = Column(UUID(as_uuid=True), ForeignKey("survey_quotas.id", ondelete="CASCADE"), nullable=False)
    label = Column(Text, nullable=False)
    cap = Column(Integer, nullable=False)
    count = Column(Integer, default=0, nullable=False)
    condition = Column(JSON, nullable=False)
    is_enabled = Column(Boolean, default=True, nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), onupdate=func.now())

class SurveyQuotaEvent(Base):
    __tablename__ = "survey_quota_events"
    id = Column(Integer, primary_key=True, autoincrement=True)
    cell_id = Column(UUID(as_uuid=True), nullable=False)
    quota_id = Column(UUID(as_uuid=True), nullable=False)
    survey_id = Column(UUID(as_uuid=True), nullable=False)
    respondent_id = Column(UUID(as_uuid=True), nullable=True)
    delta = Column(Integer, nullable=False)
    reason = Column(Text, nullable=False)
    # Python attr = event_metadata, DB column name stays "metadata"
    event_metadata = Column("metadata", JSON)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), onupdate=func.now())
