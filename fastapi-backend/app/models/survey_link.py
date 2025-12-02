# ============================================
# SURVEY LINK REFERENCE MODEL (FIXED)
# app/models/survey_link.py
# ============================================

from sqlalchemy import Column, String, DateTime, Index, Text, Integer
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func
from datetime import datetime, timezone
from typing import Optional, Dict, Any

from ..db import Base


class SurveyLinkReference(Base):
    """
    Stores the actual tracking URL and provides a short reference ID
    This prevents exposing sensitive tracking parameters to clients
    """

    __tablename__ = "survey_link_references"

    # Short reference ID (e.g., "slr_abc123def456")
    reference_id: Mapped[str] = mapped_column(String, primary_key=True, index=True)

    # The full URL with all tracking parameters (stored securely)
    full_url: Mapped[str] = mapped_column(Text, nullable=False)

    # Campaign context
    campaign_id: Mapped[str] = mapped_column(String, index=True, nullable=False)
    result_id: Mapped[str] = mapped_column(String, index=True, nullable=False)
    contact_id: Mapped[str] = mapped_column(String, index=True, nullable=False)
    org_id: Mapped[str] = mapped_column(String, index=True, nullable=False)

    # Tracking token (for internal use)
    tracking_token: Mapped[str] = mapped_column(String, index=True, nullable=False)

    # Channel information
    channel: Mapped[str] = mapped_column(String, nullable=False)

    # ✅ RENAMED: metadata → meta_data (to avoid SQLAlchemy reserved name conflict)
    meta_data: Mapped[Dict[str, Any]] = mapped_column(
        'meta_data',  # Column name in database
        JSONB, 
        default=dict, 
        nullable=False
    )

    # Access tracking
    access_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    first_accessed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    last_accessed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Expiration (optional)
    expires_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Audit timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    __table_args__ = (
        Index("ix_survey_link_campaign_result", "campaign_id", "result_id"),
        Index("ix_survey_link_org_campaign", "org_id", "campaign_id"),
        Index("ix_survey_link_tracking_token", "tracking_token"),
        Index("ix_survey_link_expires_at", "expires_at"),
    )

    def is_expired(self) -> bool:
        """Check if the link has expired"""
        if not self.expires_at:
            return False
        return datetime.now(timezone.utc) > self.expires_at

    def increment_access(self, session):
        """Track link access"""
        now = datetime.now(timezone.utc)
        self.access_count += 1
        if not self.first_accessed_at:
            self.first_accessed_at = now
        self.last_accessed_at = now
        session.flush()