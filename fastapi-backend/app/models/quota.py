# app/models/quota.py
from sqlalchemy import Column, Text, Boolean, Integer, JSON, TIMESTAMP, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
import uuid

from ..db import Base


class SurveyQuota(Base):
    __tablename__ = "survey_quotas"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    org_id = Column(Text, nullable=False)
    survey_id = Column(Text, nullable=False)

    # Optional – which question this quota is tied to
    question_id = Column(Text, nullable=True)

    name = Column(Text, nullable=False)
    description = Column(Text)

    is_enabled = Column(Boolean, default=True, nullable=False)

    # hard / soft / etc.
    quota_type = Column(Text, default="hard", nullable=False)

    stop_condition = Column(Text, default="greater", nullable=False)
    when_met = Column(Text, default="close_survey", nullable=False)

    # JSON payload telling what to do when quota is met
    action_payload = Column(JSON)

    # Extra config; stored in DB as column "metadata"
    quota_metadata = Column("metadata", JSON)

    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), onupdate=func.now())

    # Relationship to cells
    cells = relationship(
        "SurveyQuotaCell",
        back_populates="quota",
        cascade="all, delete-orphan",
        lazy="selectin",
    )


class SurveyQuotaCell(Base):
    __tablename__ = "survey_quota_cells"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    quota_id = Column(
        UUID(as_uuid=True),
        ForeignKey("survey_quotas.id", ondelete="CASCADE"),
        nullable=False,
    )

    label = Column(Text, nullable=False)
    cap = Column(Integer, nullable=False)
    count = Column(Integer, default=0, nullable=False)

    # JSON condition – "facts" you will match on later
    condition = Column(JSON, nullable=False)

    is_enabled = Column(Boolean, default=True, nullable=False)

    # Optionally tie to a specific answer choice
    target_option_id = Column(Text, nullable=True)

    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), onupdate=func.now())

    quota = relationship("SurveyQuota", back_populates="cells")


class SurveyQuotaEvent(Base):
    __tablename__ = "survey_quota_events"

    id = Column(Integer, primary_key=True, autoincrement=True)
    cell_id = Column(UUID(as_uuid=True), nullable=False)
    quota_id = Column(UUID(as_uuid=True), nullable=False)
    survey_id = Column(Text, nullable=False)
    respondent_id = Column(UUID(as_uuid=True), nullable=True)
    delta = Column(Integer, nullable=False)
    reason = Column(Text, nullable=False)
    event_metadata = Column("metadata", JSON)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), onupdate=func.now())
