# app/models/tickets.py
from sqlalchemy import (
    Column, String, Integer, Boolean, DateTime, Text, ForeignKey, Enum, Index,
    
    UniqueConstraint, BigInteger
)
from sqlalchemy.dialects.postgresql import ARRAY
from pydantic import BaseModel, Field
from typing import Literal, Dict, Any, List, Optional
from datetime import datetime
from sqlalchemy.orm import relationship, Mapped, mapped_column
from sqlalchemy.sql import func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy import Table
import enum
from .sla import SLADimension
from ..db import Base


# ------------------------------- Enums -------------------------------
# ---------- payloads ----------

class AssignGroupBody(BaseModel):
    group_id: Optional[str] = Field(None, description="Support group to assign; null to clear")

class PatchTeamsBody(BaseModel):
    team_ids: List[str] = Field(default_factory=list)
    mode: Literal["add", "replace", "remove"] = "add"

class PatchAgentsBody(BaseModel):
    agent_ids: List[str] = Field(default_factory=list)
    mode: Literal["add", "replace", "remove"] = "add"

class TicketStatus(str, enum.Enum):
    new = "new"
    open = "open"
    pending = "pending"
    on_hold = "on_hold"
    resolved = "resolved"
    closed = "closed"
    canceled = "canceled"


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


ticket_tags = Table(
    "ticket_tags",
    Base.metadata,
    Column("ticket_id", String, ForeignKey("tickets.ticket_id", ondelete="CASCADE"), primary_key=True),
    Column("tag_id", String, ForeignKey("tags.tag_id", ondelete="CASCADE"), primary_key=True),
    Index("ix_ticket_tags_ticket_id", "ticket_id"),
    Index("ix_ticket_tags_tag_id", "tag_id"),
)


class Ticket(Base):
    __tablename__ = "tickets"

    ticket_id: Mapped[str] = mapped_column(String, primary_key=True, index=True)
    org_id:    Mapped[str] = mapped_column(String, index=True, nullable=False)
    project_id: Mapped[str | None] = mapped_column(String, index=True, nullable=True)
    number:    Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    subject:     Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)  # initial body
    status:   Mapped[TicketStatus]  = mapped_column(Enum(TicketStatus), default=TicketStatus.new, index=True, nullable=False)
    priority: Mapped[TicketPriority] = mapped_column(Enum(TicketPriority), default=TicketPriority.normal, index=True, nullable=False)
    severity: Mapped[TicketSeverity] = mapped_column(Enum(TicketSeverity), default=TicketSeverity.sev4, index=True, nullable=False)
    requester_id: Mapped[str] = mapped_column(String, index=True, nullable=False)  # who opened
    assignee_id:  Mapped[str | None] = mapped_column(String, index=True, nullable=True)
    group_id:     Mapped[str | None] = mapped_column(String, ForeignKey("support_groups.group_id"), index=True, nullable=True)
    category:     Mapped[str | None] = mapped_column(String, nullable=True)
    subcategory:  Mapped[str | None] = mapped_column(String, nullable=True)
    product_id:   Mapped[str | None] = mapped_column(String, nullable=True)
    sla_id:       Mapped[str | None] = mapped_column(String, ForeignKey("slas.sla_id"), nullable=True)
    due_at:                 Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    first_response_at:      Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    resolved_at:            Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    closed_at:              Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_activity_at:       Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), index=True, nullable=True)
    last_public_comment_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    reply_count:   Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    follower_count:Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    custom_fields: Mapped[dict] = mapped_column(JSONB, default=dict)   # arbitrary per-org fields
    meta:          Mapped[dict] = mapped_column(JSONB, default=dict)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    updated_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    group = relationship("SupportGroup", back_populates="tickets")
    tags  = relationship("Tag", secondary=ticket_tags, back_populates="tickets")
    comments = relationship("TicketComment", back_populates="ticket", cascade="all, delete-orphan")
    attachments = relationship("TicketAttachment", back_populates="ticket", cascade="all, delete-orphan")
    watchers = relationship("TicketWatcher", back_populates="ticket", cascade="all, delete-orphan")
    events   = relationship("TicketEvent", back_populates="ticket", cascade="all, delete-orphan")
    sla_status = relationship("TicketSLAStatus", uselist=False, back_populates="ticket", cascade="all, delete-orphan")
    team_ids:  Mapped[list[str]] = mapped_column(ARRAY(String), default=list, nullable=False, index=False)
    agent_ids: Mapped[list[str]] = mapped_column(ARRAY(String), default=list, nullable=False, index=False)
    category_id:    Mapped[str | None] = mapped_column(String, index=True, nullable=True)
    subcategory_id: Mapped[str | None] = mapped_column(String, index=True, nullable=True)
    

    __table_args__ = (
        Index("ix_ticket_org_status", "org_id", "status"),
        Index("ix_ticket_org_assignee", "org_id", "assignee_id"),
        UniqueConstraint("org_id", "number", name="uq_ticket_org_number"),
        Index("gin_tickets_team_ids",  team_ids,  postgresql_using="gin"),
        Index("gin_tickets_agent_ids", agent_ids, postgresql_using="gin"),
    )


class TicketComment(Base):
    __tablename__ = "ticket_comments"

    comment_id: Mapped[str] = mapped_column(String, primary_key=True, index=True)
    ticket_id:  Mapped[str] = mapped_column(String, ForeignKey("tickets.ticket_id", ondelete="CASCADE"), index=True, nullable=False)
    author_id:  Mapped[str] = mapped_column(String, index=True, nullable=False)

    body:       Mapped[str] = mapped_column(Text, nullable=False)
    is_internal:Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    updated_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    ticket = relationship("Ticket", back_populates="comments")
    attachments = relationship("TicketAttachment", back_populates="comment", cascade="all, delete-orphan")


class Tag(Base):
    __tablename__ = "tags"

    tag_id: Mapped[str] = mapped_column(String, primary_key=True, index=True)
    org_id:  Mapped[str] = mapped_column(String, index=True, nullable=False)

    # keep attribute names for ORM, physical names for DB
    name:  Mapped[str] = mapped_column("tag_name", String, nullable=False)
    color: Mapped[str] = mapped_column("tag_colour", String, nullable=False, server_default="#808080")

    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    category:    Mapped[str | None] = mapped_column(String, nullable=True)
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
    comment_id:    Mapped[str | None] = mapped_column(String, ForeignKey("ticket_comments.comment_id", ondelete="SET NULL"), nullable=True)

    filename:      Mapped[str] = mapped_column(String, nullable=False)
    content_type:  Mapped[str | None] = mapped_column(String, nullable=True)
    size_bytes:    Mapped[int | None] = mapped_column(Integer, nullable=True)

    storage_key:   Mapped[str] = mapped_column(String, nullable=False)  # e.g., S3 key / GCS path
    url:           Mapped[str | None] = mapped_column(String, nullable=True)
    checksum:      Mapped[str | None] = mapped_column(String, nullable=True)

    uploaded_by:   Mapped[str] = mapped_column(String, nullable=False)
    created_at:    Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    ticket  = relationship("Ticket", back_populates="attachments")
    comment = relationship("TicketComment", back_populates="attachments")


class TicketWatcher(Base):
    __tablename__ = "ticket_watchers"

    watcher_id: Mapped[str] = mapped_column(String, primary_key=True, index=True)
    ticket_id:  Mapped[str] = mapped_column(String, ForeignKey("tickets.ticket_id", ondelete="CASCADE"), index=True, nullable=False)
    user_id:    Mapped[str] = mapped_column(String, index=True, nullable=False)

    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())

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
    from_value: Mapped[dict | None] = mapped_column(JSONB, default=dict)
    to_value:   Mapped[dict | None] = mapped_column(JSONB, default=dict)
    meta:   Mapped[dict | None] = mapped_column(JSONB, default=dict)

    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)

    ticket = relationship("Ticket", back_populates="events")


class TicketSLAStatus(Base):
    __tablename__ = "ticket_sla_status"

    ticket_id: Mapped[str] = mapped_column(String, ForeignKey("tickets.ticket_id", ondelete="CASCADE"), primary_key=True)
    sla_id:    Mapped[str | None] = mapped_column(String, ForeignKey("slas.sla_id"), nullable=True)

    first_response_due_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    resolution_due_at:     Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    breached_first_response: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    breached_resolution:     Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    paused:     Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    pause_reason: Mapped[str | None] = mapped_column(String, nullable=True)

    updated_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    first_response_started_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    resolution_started_at:     Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    elapsed_first_response_minutes: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    elapsed_resolution_minutes:     Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # last_resume_{dimension} is useful to accumulate elapsed segments
    last_resume_first_response: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_resume_resolution:     Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Which calendar governs this ticket’s SLA (optional; falls back to org/team default)
    calendar_id: Mapped[str | None] = mapped_column(String, ForeignKey("biz_calendars.calendar_id"), nullable=True)

    ticket = relationship("Ticket", back_populates="sla_status")
    sla    = relationship("SLA", back_populates="statuses")


class TicketLink(Base):
    __tablename__ = "ticket_links"

    link_id: Mapped[str] = mapped_column(String, primary_key=True, index=True)
    source_ticket_id: Mapped[str] = mapped_column(String, ForeignKey("tickets.ticket_id", ondelete="CASCADE"), index=True, nullable=False)
    target_ticket_id: Mapped[str] = mapped_column(String, ForeignKey("tickets.ticket_id", ondelete="CASCADE"), index=True, nullable=False)

    link_type: Mapped[TicketLinkType] = mapped_column(Enum(TicketLinkType), nullable=False)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint("source_ticket_id", "target_ticket_id", "link_type", name="uq_ticket_link_unique"),
        Index("ix_ticket_links_pair", "source_ticket_id", "target_ticket_id"),
    )

class TicketCollaboratorRole(str, enum.Enum):
    contributor = "contributor"   # can work/comment internally
    reviewer    = "reviewer"      # approves or reviews
    observer    = "observer"      # just watching (like watcher)

class TicketCollaborator(Base):
    __tablename__ = "ticket_collaborators"

    collab_id: Mapped[str] = mapped_column(String, primary_key=True, index=True)
    ticket_id: Mapped[str] = mapped_column(String, ForeignKey("tickets.ticket_id", ondelete="CASCADE"), index=True, nullable=False)
    user_id:   Mapped[str] = mapped_column(String, index=True, nullable=False)
    role:      Mapped[TicketCollaboratorRole] = mapped_column(Enum(TicketCollaboratorRole), default=TicketCollaboratorRole.contributor, nullable=False)

    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint("ticket_id", "user_id", name="uq_ticket_collaborator"),
    )

class TicketAssignment(Base):
    __tablename__ = "ticket_assignments"
    assignment_id: Mapped[str] = mapped_column(String, primary_key=True, index=True)
    ticket_id:     Mapped[str] = mapped_column(String, ForeignKey("tickets.ticket_id", ondelete="CASCADE"), index=True, nullable=False)
    actor_id:      Mapped[str] = mapped_column(String, index=True, nullable=False)  # who made the change
    from_assignee: Mapped[str | None] = mapped_column(String, nullable=True)
    to_assignee:   Mapped[str | None] = mapped_column(String, nullable=True)
    created_at:    Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)

class WorklogType(str, enum.Enum):
    analysis = "analysis"
    investigation = "investigation"
    comms = "comms"
    fix = "fix"
    review = "review"
    other = "other"

class TicketWorklog(Base):
    __tablename__ = "ticket_worklogs"
    worklog_id: Mapped[str] = mapped_column(String, primary_key=True, index=True)
    ticket_id:  Mapped[str] = mapped_column(String, ForeignKey("tickets.ticket_id", ondelete="CASCADE"), index=True, nullable=False)
    user_id:    Mapped[str] = mapped_column(String, index=True, nullable=False)
    minutes:    Mapped[int] = mapped_column(Integer, nullable=False)
    kind:       Mapped[WorklogType] = mapped_column(Enum(WorklogType), default=WorklogType.other)
    note:       Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)


