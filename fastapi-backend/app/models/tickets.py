# app/models/tickets.py
from sqlalchemy import (
    Column, String, Integer, Boolean, DateTime, Text, ForeignKey, Index,
    UniqueConstraint, BigInteger
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy import Table
from sqlalchemy.orm import relationship, Mapped, mapped_column
from sqlalchemy.sql import func

from pydantic import BaseModel, Field
from typing import Dict, Any, List, Optional
from datetime import datetime
import enum

from sqlalchemy import Enum as SAEnum  # <-- important: alias Enum
from .sla import SLADimension
from ..db import Base


# ------------------------------- Pydantic payloads -------------------------------

class AssignGroupBody(BaseModel):
    group_id: Optional[str] = Field(None, description="Support group to assign; null to clear")

class AssignTeamBody(BaseModel):
    team_id: Optional[str] = Field(None, description="Team to assign; null to clear")

class AssignAgentBody(BaseModel):
    agent_id: Optional[str] = Field(None, description="Agent to assign; null to clear")


# ------------------------------- Python Enums -------------------------------

class TicketStatus(str, enum.Enum):
    new = "new"
    open = "open"
    pending = "pending"
    on_hold = "on_hold"
    resolved = "resolved"
    closed = "closed"
    canceled = "canceled"
    
class TicketPlatform(str, enum.Enum):
    in_app = "in_app"
    external_api = "external_api"
    mobile_app = "mobile_app"


class TicketPriority(str, enum.Enum):
    low = "low"
    normal = "normal"
    high = "high"
    urgent = "urgent"
    blocker = "blocker"

class TicketSeverity(str, enum.Enum):
    sev4 = "sev4"   # low
    sev3 = "sev3"   # medium
    sev2 = "sev2"   # high
    sev1 = "sev1"   # critical

class TicketLinkType(str, enum.Enum):
    relates_to = "relates_to"
    duplicate_of = "duplicate_of"
    blocks = "blocks"
    blocked_by = "blocked_by"
    parent_of = "parent_of"
    child_of = "child_of"

class TicketCollaboratorRole(str, enum.Enum):
    contributor = "contributor"   # can work/comment internally
    reviewer    = "reviewer"      # approves or reviews
    observer    = "observer"      # just watching (like watcher)

class WorklogType(str, enum.Enum):
    analysis      = "analysis"
    investigation = "investigation"
    comms         = "comms"
    fix           = "fix"
    review        = "review"
    other         = "other"

class SLAPauseReason(str, enum.Enum):
    """Reasons for pausing SLA timers"""
    awaiting_customer = "awaiting_customer"
    awaiting_third_party = "awaiting_third_party"
    agent_paused = "agent_paused"
    scheduled_maintenance = "scheduled_maintenance"
    outside_business_hours = "outside_business_hours"
    other = "other"


# Named enum type for PostgreSQL
sla_pause_reason_enum = SAEnum(SLAPauseReason, name="sla_pause_reason", metadata=Base.metadata)


# ------------------------------- Named PG Enum types (reuse these) -------------------------------
# These create named PostgreSQL enum types once and allow reuse across models/tables.
ticket_status_enum          = SAEnum(TicketStatus,             name="ticket_status",              metadata=Base.metadata)
ticket_platform_enum          = SAEnum(TicketPlatform,             name="ticket_platform",              metadata=Base.metadata)

ticket_priority_enum        = SAEnum(TicketPriority,           name="ticket_priority",            metadata=Base.metadata)
ticket_severity_enum        = SAEnum(TicketSeverity,           name="ticket_severity",            metadata=Base.metadata)
ticket_link_type_enum       = SAEnum(TicketLinkType,           name="ticket_link_type",           metadata=Base.metadata)
ticket_collaborator_enum    = SAEnum(TicketCollaboratorRole,   name="ticket_collaborator_role",   metadata=Base.metadata)
ticket_worklog_type_enum    = SAEnum(WorklogType,              name="ticket_worklog_type",        metadata=Base.metadata)


# ------------------------------- Association Tables -------------------------------

ticket_tags = Table(
    "ticket_tags",
    Base.metadata,
    Column("ticket_id", String, ForeignKey("tickets.ticket_id", ondelete="CASCADE"), primary_key=True),
    Column("tag_id", String, ForeignKey("tags.tag_id", ondelete="CASCADE"), primary_key=True),
    Index("ix_ticket_tags_ticket_id", "ticket_id"),
    Index("ix_ticket_tags_tag_id", "tag_id"),
)


# ------------------------------- ORM Models -------------------------------

class Ticket(Base):
    __tablename__ = "tickets"

    ticket_id: Mapped[str] = mapped_column(String, primary_key=True, index=True)
    org_id:    Mapped[str] = mapped_column(String, index=True, nullable=False)
    project_id: Mapped[Optional[str]] = mapped_column(String, index=True, nullable=True)
    number:    Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)

    subject:     Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # IMPORTANT: use named PG enum types + actual Enum classes for defaults
    status:   Mapped[TicketStatus]   = mapped_column(ticket_status_enum,   default=TicketStatus.new,     index=True, nullable=False)
    platform:   Mapped[TicketPlatform]   = mapped_column(ticket_platform_enum,   default=TicketStatus.new,     index=True, nullable=True)
    priority: Mapped[TicketPriority] = mapped_column(ticket_priority_enum, default=TicketPriority.normal, index=True, nullable=False)
    severity: Mapped[TicketSeverity] = mapped_column(ticket_severity_enum, default=TicketSeverity.sev4,  index=True, nullable=False)

    requester_id: Mapped[str] = mapped_column(String, index=True, nullable=False)
        # ▶ ADD: fine-grained classification
    feature_id:  Mapped[Optional[str]] = mapped_column(
        String, ForeignKey("ticket_features.feature_id", ondelete="SET NULL"),
        index=True, nullable=True
    )
    impact_id:   Mapped[Optional[str]] = mapped_column(
        String, ForeignKey("ticket_impact_areas.impact_id", ondelete="SET NULL"),
        index=True, nullable=True
    )

    # ▶ ADD: post-resolution root cause (Problem Management)
    rca_id:      Mapped[Optional[str]] = mapped_column(
        String, ForeignKey("ticket_root_cause_types.rca_id", ondelete="SET NULL"),
        index=True, nullable=True
    )
    rca_note:    Mapped[Optional[str]] = mapped_column(Text, nullable=True)             # free text summary
    rca_set_by:  Mapped[Optional[str]] = mapped_column(String, index=True, nullable=True)
    rca_set_at:  Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # SINGLE assignee per ticket
    assignee_id:  Mapped[Optional[str]] = mapped_column(String, index=True, nullable=True)

    # SINGLE team per ticket
    team_id:      Mapped[Optional[str]] = mapped_column(String, ForeignKey("support_teams.team_id", ondelete="SET NULL"), index=True, nullable=True)

    # SINGLE agent per ticket (additional agent besides assignee)
    agent_id:     Mapped[Optional[str]] = mapped_column(String, index=True, nullable=True)

    # Support group (optional)
    group_id:     Mapped[Optional[str]] = mapped_column(String, ForeignKey("support_groups.group_id"), index=True, nullable=True)

    category:     Mapped[Optional[str]] = mapped_column(String, nullable=True)
    subcategory:  Mapped[Optional[str]] = mapped_column(String, nullable=True)
    product_id:   Mapped[Optional[str]] = mapped_column(String, nullable=True)
    sla_id:       Mapped[Optional[str]] = mapped_column(String, ForeignKey("slas.sla_id"), nullable=True)

    due_at:                 Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    first_response_at:      Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    resolved_at:            Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    closed_at:              Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    last_activity_at:       Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), index=True, nullable=True)
    last_public_comment_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    reply_count:     Mapped[int] = mapped_column(Integer, default=0, nullable=True)
    follower_count:  Mapped[int] = mapped_column(Integer, default=0, nullable=True)

    custom_fields: Mapped[dict] = mapped_column(JSONB, default=dict)
    meta:          Mapped[dict] = mapped_column(JSONB, default=dict)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # relationships
    group = relationship("SupportGroup", back_populates="tickets")
    tags  = relationship("Tag", secondary=ticket_tags, back_populates="tickets")
    comments = relationship("TicketComment", back_populates="ticket", cascade="all, delete-orphan")
    attachments = relationship("TicketAttachment", back_populates="ticket", cascade="all, delete-orphan")
    watchers = relationship("TicketWatcher", back_populates="ticket", cascade="all, delete-orphan")
    events   = relationship("TicketEvent", back_populates="ticket", cascade="all, delete-orphan")
    sla_status = relationship("TicketSLAStatus", uselist=False, back_populates="ticket", cascade="all, delete-orphan")
    # ▶ ADD: ORM relationships (read-only; no cascade)
    feature      = relationship("TicketFeature", viewonly=True)
    impact_area  = relationship("TicketImpactArea", viewonly=True)
    root_cause   = relationship("TicketRootCauseType", viewonly=True)

    category_id:    Mapped[Optional[str]] = mapped_column(String, index=True, nullable=True)
    subcategory_id: Mapped[Optional[str]] = mapped_column(String, index=True, nullable=True)

    __table_args__ = (
        Index("ix_ticket_org_status", "org_id", "status"),
        Index("ix_ticket_org_assignee", "org_id", "assignee_id"),
        Index("ix_ticket_org_team", "org_id", "team_id"),
        Index("ix_ticket_org_agent", "org_id", "agent_id"),
        Index("ix_ticket_org_feature", "org_id", "feature_id"),
        Index("ix_ticket_org_impact", "org_id", "impact_id"),
        Index("ix_ticket_org_rca", "org_id", "rca_id"),

        UniqueConstraint("org_id", "number", name="uq_ticket_org_number"),
    )


class TicketComment(Base):
    __tablename__ = "ticket_comments"

    comment_id: Mapped[str] = mapped_column(String, primary_key=True, index=True)
    ticket_id:  Mapped[str] = mapped_column(String, ForeignKey("tickets.ticket_id", ondelete="CASCADE"), index=True, nullable=False)
    author_id:  Mapped[str] = mapped_column(String, index=True, nullable=False)

    body:       Mapped[str] = mapped_column(Text, nullable=False)
    is_internal:Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    ticket = relationship("Ticket", back_populates="comments")
    attachments = relationship("TicketAttachment", back_populates="comment", cascade="all, delete-orphan")


class Tag(Base):
    __tablename__ = "tags"

    tag_id: Mapped[str] = mapped_column(String, primary_key=True, index=True)
    org_id:  Mapped[str] = mapped_column(String, index=True, nullable=False)

    # keep attribute names for ORM, physical names for DB
    name:  Mapped[str] = mapped_column("tag_name", String, nullable=False)
    color: Mapped[str] = mapped_column("tag_colour", String, nullable=False, server_default="#808080")

    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    category:    Mapped[Optional[str]] = mapped_column(String, nullable=True)
    usage_count: Mapped[int]        = mapped_column(Integer, default=0, nullable=False)
    meta:        Mapped[dict]       = mapped_column(JSONB, default=dict)
    created_at:  Mapped[datetime]   = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at:  Mapped[datetime]   = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    tickets = relationship("Ticket", secondary=ticket_tags, back_populates="tags")

    __table_args__ = (
        # USE PHYSICAL COLUMN NAMES HERE (table keys)
        UniqueConstraint("org_id", "tag_name", name="uq_tag_org_name"),
        Index("ix_tag_org_name", "org_id", "tag_name"),
        Index("ix_tag_category", "org_id", "category"),
    )


class TicketAttachment(Base):
    __tablename__ = "ticket_attachments"

    attachment_id: Mapped[str] = mapped_column(String, primary_key=True, index=True)
    ticket_id:     Mapped[str] = mapped_column(String, ForeignKey("tickets.ticket_id", ondelete="CASCADE"), index=True, nullable=False)
    comment_id:    Mapped[Optional[str]] = mapped_column(String, ForeignKey("ticket_comments.comment_id", ondelete="SET NULL"), nullable=True)

    filename:      Mapped[str] = mapped_column(String, nullable=False)
    content_type:  Mapped[Optional[str]] = mapped_column(String, nullable=True)
    size_bytes:    Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    storage_key:   Mapped[str] = mapped_column(String, nullable=False)  # e.g., S3 key / GCS path
    url:           Mapped[Optional[str]] = mapped_column(String, nullable=True)
    checksum:      Mapped[Optional[str]] = mapped_column(String, nullable=True)

    uploaded_by:   Mapped[str] = mapped_column(String, nullable=False)
    created_at:    Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    ticket  = relationship("Ticket", back_populates="attachments")
    comment = relationship("TicketComment", back_populates="attachments")


class TicketWatcher(Base):
    __tablename__ = "ticket_watchers"

    watcher_id: Mapped[str] = mapped_column(String, primary_key=True, index=True)
    ticket_id:  Mapped[str] = mapped_column(String, ForeignKey("tickets.ticket_id", ondelete="CASCADE"), index=True, nullable=False)
    user_id:    Mapped[str] = mapped_column(String, index=True, nullable=False)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    ticket = relationship("Ticket", back_populates="watchers")

    __table_args__ = (
        UniqueConstraint("ticket_id", "user_id", name="uq_ticket_watcher"),
    )


class TicketEvent(Base):
    """
    Immutable audit log for a ticket (status/assignee/priority changes, merges, etc.)
    """
    __tablename__ = "ticket_events"

    event_id:  Mapped[str] = mapped_column(String, primary_key=True, index=True)
    ticket_id: Mapped[str] = mapped_column(String, ForeignKey("tickets.ticket_id", ondelete="CASCADE"), index=True, nullable=False)
    actor_id:  Mapped[str] = mapped_column(String, index=True, nullable=False)

    event_type: Mapped[str] = mapped_column(String, index=True, nullable=False)  # e.g., "status_changed"
    from_value: Mapped[Optional[dict]] = mapped_column(JSONB, default=dict)
    to_value:   Mapped[Optional[dict]] = mapped_column(JSONB, default=dict)
    meta:       Mapped[Optional[dict]] = mapped_column(JSONB, default=dict)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)

    ticket = relationship("Ticket", back_populates="events")




class TicketLink(Base):
    __tablename__ = "ticket_links"

    link_id: Mapped[str] = mapped_column(String, primary_key=True, index=True)
    source_ticket_id: Mapped[str] = mapped_column(String, ForeignKey("tickets.ticket_id", ondelete="CASCADE"), index=True, nullable=False)
    target_ticket_id: Mapped[str] = mapped_column(String, ForeignKey("tickets.ticket_id", ondelete="CASCADE"), index=True, nullable=False)

    link_type: Mapped[TicketLinkType] = mapped_column(ticket_link_type_enum, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint("source_ticket_id", "target_ticket_id", "link_type", name="uq_ticket_link_unique"),
        Index("ix_ticket_links_pair", "source_ticket_id", "target_ticket_id"),
    )


class TicketCollaborator(Base):
    __tablename__ = "ticket_collaborators"

    collab_id: Mapped[str] = mapped_column(String, primary_key=True, index=True)
    ticket_id: Mapped[str] = mapped_column(String, ForeignKey("tickets.ticket_id", ondelete="CASCADE"), index=True, nullable=False)
    user_id:   Mapped[str] = mapped_column(String, index=True, nullable=False)
    role:      Mapped[TicketCollaboratorRole] = mapped_column(ticket_collaborator_enum, default=TicketCollaboratorRole.contributor, nullable=False)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint("ticket_id", "user_id", name="uq_ticket_collaborator"),
    )


class TicketAssignment(Base):
    __tablename__ = "ticket_assignments"

    assignment_id: Mapped[str] = mapped_column(String, primary_key=True, index=True)
    ticket_id:     Mapped[str] = mapped_column(String, ForeignKey("tickets.ticket_id", ondelete="CASCADE"), index=True, nullable=False)
    actor_id:      Mapped[str] = mapped_column(String, index=True, nullable=False)  # who made the change
    from_assignee: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    to_assignee:   Mapped[Optional[str]] = mapped_column(String, nullable=True)
    created_at:    Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)


class TicketWorklog(Base):
    __tablename__ = "ticket_worklogs"

    worklog_id: Mapped[str] = mapped_column(String, primary_key=True, index=True)
    ticket_id:  Mapped[str] = mapped_column(String, ForeignKey("tickets.ticket_id", ondelete="CASCADE"), index=True, nullable=False)
    user_id:    Mapped[str] = mapped_column(String, index=True, nullable=False)
    minutes:    Mapped[int] = mapped_column(Integer, nullable=False)

    kind:       Mapped[WorklogType] = mapped_column(ticket_worklog_type_enum, default=WorklogType.other)
    note:       Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)


class TicketSLAStatus(Base):
    """
    Enhanced SLA tracking with pause/resume history
    """
    __tablename__ = "ticket_sla_status"

    ticket_id: Mapped[str] = mapped_column(
        String, 
        ForeignKey("tickets.ticket_id", ondelete="CASCADE"), 
        primary_key=True
    )
    sla_id: Mapped[Optional[str]] = mapped_column(
        String, 
        ForeignKey("slas.sla_id"), 
        nullable=True
    )

    # ============ FIRST RESPONSE TRACKING ============
    first_response_due_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    first_response_started_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    first_response_completed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    
    # Pause state for first response
    first_response_paused: Mapped[bool] = mapped_column(Boolean, default=False)
    first_response_paused_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    
    # Time tracking
    elapsed_first_response_minutes: Mapped[int] = mapped_column(Integer, default=0)
    total_paused_first_response_minutes: Mapped[int] = mapped_column(Integer, default=0)
    
    # Breach tracking
    breached_first_response: Mapped[bool] = mapped_column(Boolean, default=False)
    
    # Last resume timestamp (for calculating elapsed time)
    last_resume_first_response: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # ============ RESOLUTION TRACKING ============
    resolution_due_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    resolution_started_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    resolution_completed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    
    # Pause state for resolution
    resolution_paused: Mapped[bool] = mapped_column(Boolean, default=False)
    resolution_paused_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    
    # Time tracking
    elapsed_resolution_minutes: Mapped[int] = mapped_column(Integer, default=0)
    total_paused_resolution_minutes: Mapped[int] = mapped_column(Integer, default=0)
    
    # Breach tracking
    breached_resolution: Mapped[bool] = mapped_column(Boolean, default=False)
    
    # Last resume timestamp (for calculating elapsed time)
    last_resume_resolution: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # ============ LEGACY/GENERAL FIELDS ============
    # Keep for backward compatibility
    paused: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    pause_reason: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    # Calendar for business hours calculation
    calendar_id: Mapped[Optional[str]] = mapped_column(
        String, 
        ForeignKey("biz_calendars.calendar_id"), 
        nullable=True
    )

    # Metadata
    meta: Mapped[dict] = mapped_column(JSONB, default=dict)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), 
        server_default=func.now(), 
        onupdate=func.now()
    )

    # Relationships
    ticket = relationship("Ticket", back_populates="sla_status")
    sla = relationship("SLA", back_populates="statuses")
    pause_history = relationship(
        "TicketSLAPauseHistory", 
        back_populates="sla_status", 
        cascade="all, delete-orphan",
        order_by="TicketSLAPauseHistory.created_at.desc()"
    )



# ------------------------------- Pause/Resume History Table -------------------------------

class TicketSLAPauseHistory(Base):
    """
    Audit trail for every pause/resume action on SLA timers
    """
    __tablename__ = "ticket_sla_pause_history"

    pause_id: Mapped[str] = mapped_column(String, primary_key=True, index=True)
    ticket_id: Mapped[str] = mapped_column(
        String, 
        ForeignKey("ticket_sla_status.ticket_id", ondelete="CASCADE"), 
        index=True, 
        nullable=False
    )
    
    # Which dimension was paused (first_response or resolution)
    dimension: Mapped[str] = mapped_column(String, nullable=False, index=True)
    
    # Pause or Resume action
    action: Mapped[str] = mapped_column(String, nullable=False)  # "pause" or "resume"
    
    # Timestamps
    action_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), 
        nullable=False, 
        index=True
    )
    
    # Who triggered this action
    actor_id: Mapped[str] = mapped_column(String, index=True, nullable=False)
    
    # Pause reason (only for pause actions)
    reason: Mapped[Optional[SLAPauseReason]] = mapped_column(
        sla_pause_reason_enum, 
        nullable=True
    )
    reason_note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # Duration calculation (filled when resuming)
    pause_duration_minutes: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    
    # Due date adjustment (how much was added to due_at)
    due_date_extension_minutes: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    
    # Metadata
    meta: Mapped[dict] = mapped_column(JSONB, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), 
        server_default=func.now(), 
        index=True
    )

    # Relationships
    sla_status = relationship("TicketSLAStatus", back_populates="pause_history")

    __table_args__ = (
        Index("ix_sla_pause_history_ticket_dimension", "ticket_id", "dimension"),
        Index("ix_sla_pause_history_action_at", "ticket_id", "action_at"),
    )