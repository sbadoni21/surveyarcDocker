from sqlalchemy import Column, String, Boolean, DateTime, Index, UniqueConstraint, ForeignKey
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from datetime import datetime
from typing import Optional, Dict, Any

from ..db import Base


class Theme(Base):
    """
    Theme definition for surveys
    Supports brand colors + logos + dark mode
    """

    __tablename__ = "themes"

    # Primary keys
    theme_id: Mapped[str] = mapped_column(String, primary_key=True, index=True)

    # Multi-tenant org
    org_id: Mapped[str] = mapped_column(String, index=True, nullable=False)

    # Name (unique per org)
    name: Mapped[str] = mapped_column(String, nullable=False)

    # Light mode colors
    light_primary_color: Mapped[str] = mapped_column(String, nullable=False)
    light_secondary_color: Mapped[str] = mapped_column(String, nullable=False)
    light_text_color: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    light_background_color: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    # Dark mode colors
    dark_primary_color: Mapped[str] = mapped_column(String, nullable=False)
    dark_secondary_color: Mapped[str] = mapped_column(String, nullable=False)
    dark_text_color: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    dark_background_color: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    # Branding
    logo_url: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    # Meta configuration (optional fields from UI)
    meta: Mapped[Dict[str, Any]] = mapped_column(JSONB, default=dict)

    # Soft delete / status
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Audit
    created_by: Mapped[str] = mapped_column(String, nullable=False)

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
        UniqueConstraint("org_id", "name", name="uq_theme_org_name"),
        Index("ix_theme_org_active", "org_id", "is_active"),
    )
