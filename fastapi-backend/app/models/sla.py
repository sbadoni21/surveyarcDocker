from __future__ import annotations
from sqlalchemy import (
    String, Boolean, DateTime, Text, Integer, ForeignKey, Enum, Index, UniqueConstraint
)
from sqlalchemy.orm import relationship, Mapped, mapped_column
from sqlalchemy.sql import func
from sqlalchemy.dialects.postgresql import JSONB
import enum

from ..db import Base

# ----------------------------- Enums -----------------------------

class SLADimension(str, enum.Enum):
    first_response = "first_response"
    resolution = "resolution"
    update_cadence = "update_cadence"  # e.g., customer-visible update frequency
    custom = "custom"

class SLAAggregation(str, enum.Enum):
    per_ticket = "per_ticket"
    monthly_percent = "monthly_percent"
    rolling_30d_percent = "rolling_30d_percent"

class SLACreditUnit(str, enum.Enum):
    percent_fee = "percent_fee"  # % of fee/invoice
    fixed_usd = "fixed_usd"      # fixed currency value (name for clarity; currency handling is your billing layer)
    service_days = "service_days"

class SLABreachGrade(str, enum.Enum):
    minor = "minor"
    major = "major"
    critical = "critical"

class SLAScope(str, enum.Enum):
    org = "org"
    group = "group"
    team = "team"
    product = "product"
    custom = "custom"


# -------------------------- Pause Windows -------------------------

class SLAPauseWindow(Base):
    __tablename__ = "sla_pause_windows"

    id:         Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    ticket_id:  Mapped[str] = mapped_column(String, ForeignKey("tickets.ticket_id", ondelete="CASCADE"), index=True, nullable=False)
    dimension:  Mapped[SLADimension] = mapped_column(Enum(SLADimension), nullable=False)
    reason:     Mapped[str] = mapped_column(String, nullable=False)
    started_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    ended_at:   Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    meta:       Mapped[dict] = mapped_column(JSONB, default=dict)

    __table_args__ = (
        Index("ix_sla_pause_active", "ticket_id", "dimension", "ended_at"),
    )


# ------------------------------ SLA -------------------------------

class SLA(Base):
    """
    Contract-level SLA policy (no calendars here; working hours resolved per ticket/team at runtime).
    JSON fields are used to keep policy authoring flexible.
    """
    __tablename__ = "slas"

    # Identity / scope
    sla_id:  Mapped[str] = mapped_column(String, primary_key=True, index=True)
    org_id:  Mapped[str] = mapped_column(String, index=True, nullable=False)

    name:        Mapped[str] = mapped_column(String, nullable=False)
    slug:        Mapped[str | None] = mapped_column(String, nullable=True)       # unique within org for easy reference
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    active:      Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Global fallbacks if no objective / matrix match (optional)
    first_response_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    resolution_minutes:     Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Policy / matching / behavior (authorable JSON)
    # - rules.applies_to: { requester_tier_in, priority_in, severity_in, tag_any, group_id_in, team_id_in, product_id_in, ... }
    rules:              Mapped[dict] = mapped_column(JSONB, default=dict)
    # - target_matrix: e.g., by_priority/by_severity/by_channel → per-dimension targets
    target_matrix:      Mapped[dict] = mapped_column(JSONB, default=dict)
    # - pause_rules: { pause_on_status:[], pause_when_waiting_on:[], resume_on_events:[] }
    pause_rules:        Mapped[dict] = mapped_column(JSONB, default=dict)
    # - reminder_policy: { first_response:{warn_at:[0.5,0.9],repeat_every_min:10}, resolution:{...}, update_cadence:{...} }
    reminder_policy:    Mapped[dict] = mapped_column(JSONB, default=dict)
    # - escalation_policy: { levels:[{at:"warn_90"/"breach", notify:[roles], reassign_to_team:"..." }], channels:["email","slack"] }
    escalation_policy:  Mapped[dict] = mapped_column(JSONB, default=dict)
    # - kpi_targets: e.g. {"monthly_percent>=95": ["first_response","resolution"]}
    kpi_targets:        Mapped[dict] = mapped_column(JSONB, default=dict)
    # - exclusions: { labels_any:[], maintenance_ids:[], etc. } (actual windows evaluated at runtime)
    exclusions:         Mapped[dict] = mapped_column(JSONB, default=dict)
    # - penalties: may simply point to "use_credit_rules_table" or encode basic policy flags
    penalties:          Mapped[dict] = mapped_column(JSONB, default=dict)

    # Reporting/aggregation behavior
    aggregation:        Mapped[SLAAggregation] = mapped_column(Enum(SLAAggregation), default=SLAAggregation.monthly_percent, nullable=False)

    # Hierarchical scoping and precedence (policy selection resolution)
    scope:              Mapped[SLAScope] = mapped_column(Enum(SLAScope), default=SLAScope.org, nullable=False)
    scope_ids:          Mapped[dict] = mapped_column(JSONB, default=dict)  # e.g., {"group_id": "..."} or {"team_id":"..."}
    precedence:         Mapped[int] = mapped_column(Integer, default=100, nullable=False)  # lower = higher priority

    # Lifecycle & governance
    version:            Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    effective_from:     Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    effective_to:       Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    published_at:       Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    requires_contract_accept: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    audit_tags:         Mapped[dict] = mapped_column(JSONB, default=dict)  # e.g., {"iso27001":true,"soc2":true}
    data_retention_days: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Operational niceties
    grace_minutes:          Mapped[int] = mapped_column(Integer, default=0, nullable=False)   # grace around timers
    auto_close_after_days:  Mapped[int | None] = mapped_column(Integer, nullable=True)        # policy hint; actual job elsewhere

    # Audit
    created_by: Mapped[str | None] = mapped_column(String, nullable=True)
    updated_by: Mapped[str | None] = mapped_column(String, nullable=True)

    meta:       Mapped[dict] = mapped_column(JSONB, default=dict)

    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    updated_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), index=True)

    # Relations
    objectives = relationship("SLAObjective", back_populates="sla", cascade="all, delete-orphan")
    credit_rules = relationship("SLACreditRule", back_populates="sla", cascade="all, delete-orphan")
    statuses = relationship("TicketSLAStatus", back_populates="sla", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("org_id", "slug", name="uq_sla_org_slug"),
        Index("ix_sla_org_active", "org_id", "active"),
        Index("ix_sla_org_precedence", "org_id", "precedence"),
        Index("ix_sla_effective", "effective_from", "effective_to"),
        Index("ix_sla_scope", "org_id", "scope"),
    )


# --------------------------- SLA Objectives ---------------------------

class SLAObjective(Base):
    """
    Typed/targeted objectives: FR, Resolution, Update Cadence, or Custom.
    'match' allows further filter (priority/severity/channel/product, etc.).
    """
    __tablename__ = "sla_objectives"

    objective_id:   Mapped[str] = mapped_column(String, primary_key=True, index=True)
    sla_id:         Mapped[str] = mapped_column(String, ForeignKey("slas.sla_id", ondelete="CASCADE"), index=True, nullable=False)

    objective:      Mapped[SLADimension] = mapped_column(Enum(SLADimension), nullable=False)
    target_minutes: Mapped[int] = mapped_column(Integer, nullable=False)

    # Optional matching refinement beyond SLA.rules (e.g., per-priority/severity/channel/product)
    match:          Mapped[dict] = mapped_column(JSONB, default=dict)

    # Optional breach grading thresholds (minutes beyond target): {"minor": 15, "major": 60, "critical": 180}
    breach_grades:  Mapped[dict] = mapped_column(JSONB, default=dict)

    active:         Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    meta:           Mapped[dict] = mapped_column(JSONB, default=dict)

    created_at:     Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at:     Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    sla = relationship("SLA", back_populates="objectives")

    __table_args__ = (
        Index("ix_sla_objectives_sla", "sla_id"),
        Index("ix_sla_objectives_type", "objective"),
    )


# --------------------------- SLA Credit Rules -------------------------

class SLACreditRule(Base):
    """
    Breach → Credit mapping. Evaluated by billing/compliance layer after SLA analytics.
    """
    __tablename__ = "sla_credit_rules"

    rule_id:    Mapped[str] = mapped_column(String, primary_key=True, index=True)
    sla_id:     Mapped[str] = mapped_column(String, ForeignKey("slas.sla_id", ondelete="CASCADE"), index=True, nullable=False)

    objective:  Mapped[SLADimension] = mapped_column(Enum(SLADimension), nullable=False)
    grade:      Mapped[SLABreachGrade] = mapped_column(Enum(SLABreachGrade), nullable=False)

    credit_unit:  Mapped[SLACreditUnit] = mapped_column(Enum(SLACreditUnit), nullable=False)
    credit_value: Mapped[int] = mapped_column(Integer, nullable=False)  # meaning depends on credit_unit

    # Caps & period governance
    cap_per_period: Mapped[int | None] = mapped_column(Integer, nullable=True)  # e.g., max 20% / $2000 / 10 days
    period_days:    Mapped[int | None] = mapped_column(Integer, nullable=True)  # settlement period for capping

    active:     Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    meta:       Mapped[dict] = mapped_column(JSONB, default=dict)

    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    sla = relationship("SLA", back_populates="credit_rules")

    __table_args__ = (
        Index("ix_sla_credit_rules_sla", "sla_id"),
        Index("ix_sla_credit_rules_key", "sla_id", "objective", "grade"),
    )
