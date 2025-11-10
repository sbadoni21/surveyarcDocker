# app/models/ticket_templates.py
from sqlalchemy import Column, String, Text, Boolean, DateTime, Index, UniqueConstraint, Integer, ForeignKey
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from datetime import datetime
from typing import Optional
import secrets
from ..db import Base
from .tickets import ticket_status_enum, ticket_priority_enum, ticket_severity_enum, TicketStatus, TicketPriority, TicketSeverity


class TicketTemplate(Base):
    """
    Predefined ticket templates that can be used to create tickets via API
    """
    __tablename__ = "ticket_templates"
    
    template_id: Mapped[str] = mapped_column(String, primary_key=True, index=True)
    org_id: Mapped[str] = mapped_column(String, index=True, nullable=False)
    
    # Template identification
    name: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # API key for this template (hashed in production)
    api_key: Mapped[str] = mapped_column(String, unique=True, index=True, nullable=False)
    
    # Is this template active?
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    
    # Predefined ticket fields
    subject_template: Mapped[str] = mapped_column(String, nullable=False)
    description_template: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # Default ticket properties
    default_status: Mapped[TicketStatus] = mapped_column(
        ticket_status_enum, 
        default=TicketStatus.new, 
        nullable=False
    )
    default_priority: Mapped[TicketPriority] = mapped_column(
        ticket_priority_enum, 
        default=TicketPriority.normal, 
        nullable=False
    )
    default_severity: Mapped[TicketSeverity] = mapped_column(
        ticket_severity_enum, 
        default=TicketSeverity.sev4, 
        nullable=False
    )
    
    # Default assignments
    default_assignee_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    default_team_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    default_group_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    
    # Default categorization
    default_category_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    default_subcategory_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    default_feature_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    default_impact_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    
    # Default SLA
    default_sla_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    
    # Default tags (array of tag IDs)
    default_tag_ids: Mapped[list] = mapped_column(JSONB, default=list)
    
    # Custom fields defaults
    default_custom_fields: Mapped[dict] = mapped_column(JSONB, default=dict)
    
    # Template variables that can be substituted
    # e.g., {{user_email}}, {{user_name}}, {{custom_var}}
    allowed_variables: Mapped[list] = mapped_column(JSONB, default=list)
    
    # Validation rules for variables
    validation_rules: Mapped[dict] = mapped_column(JSONB, default=dict)
    
    # Metadata
    meta: Mapped[dict] = mapped_column(JSONB, default=dict)
    
    # Usage statistics
    usage_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    last_used_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    
    # Audit fields
    created_by: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), 
        server_default=func.now(), 
        index=True
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), 
        server_default=func.now(), 
        onupdate=func.now()
    )
    
    # Relationships
    usage_logs = relationship(
        "TicketTemplateUsage", 
        back_populates="template", 
        cascade="all, delete-orphan"
    )
    
    __table_args__ = (
        UniqueConstraint("org_id", "name", name="uq_template_org_name"),
        Index("ix_template_org_active", "org_id", "is_active"),
    )
    
    @staticmethod
    def generate_api_key(prefix: str = "tpl") -> str:
        """Generate a secure API key for the template"""
        return f"{prefix}_{secrets.token_urlsafe(32)}"


class TicketTemplateUsage(Base):
    """
    Audit log for ticket template usage
    """
    __tablename__ = "ticket_template_usage"
    
    usage_id: Mapped[str] = mapped_column(String, primary_key=True, index=True)
    template_id: Mapped[str] = mapped_column(
        String, 
        ForeignKey("ticket_templates.template_id", ondelete="CASCADE"),
        index=True,
        nullable=False
    )
    
    # The ticket that was created
    ticket_id: Mapped[str] = mapped_column(
        String,
        ForeignKey("tickets.ticket_id", ondelete="SET NULL"),
        index=True,
        nullable=True
    )
    
    # Who/what created the ticket
    created_by: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    ip_address: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    user_agent: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    
    # Variables provided in the API call
    provided_variables: Mapped[dict] = mapped_column(JSONB, default=dict)
    
    # Success or failure
    success: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # Metadata
    meta: Mapped[dict] = mapped_column(JSONB, default=dict)
    
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), 
        server_default=func.now(), 
        index=True
    )
    
    # Relationships
    template = relationship("TicketTemplate", back_populates="usage_logs")
    
    __table_args__ = (
        Index("ix_template_usage_created_at", "template_id", "created_at"),
    )