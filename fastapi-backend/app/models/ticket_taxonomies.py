# ============================================
# DATABASE MODELS - app/models/ticket_taxonomies.py
# ============================================

from sqlalchemy import String, Boolean, DateTime, Text, Integer, ForeignKey, Index
from sqlalchemy.orm import relationship, Mapped, mapped_column
from sqlalchemy.sql import func
from sqlalchemy.dialects.postgresql import JSONB

from ..db import Base

# ---------- Feature / Function ----------
class TicketFeature(Base):
    """
    A functional slice within a Product (e.g., 'Login', 'Reports', 'Leads Board').
    Scopes analytics and routing more finely than Product.
    """
    __tablename__ = "ticket_features"

    feature_id: Mapped[str] = mapped_column(String, primary_key=True, index=True)
    org_id: Mapped[str] = mapped_column(String, index=True, nullable=False)

    # optional linkage to product
    product_id: Mapped[str | None] = mapped_column(
        String, ForeignKey("ticket_products.product_id", ondelete="SET NULL"),
        index=True, nullable=True
    )

    name: Mapped[str] = mapped_column(String, nullable=False)
    code: Mapped[str | None] = mapped_column(String, nullable=True)  # e.g., "login", "reports"
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    display_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    meta: Mapped[dict] = mapped_column(JSONB, default=dict)

    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("ix_ticket_features_org", "org_id"),
        Index("ix_ticket_features_product", "product_id"),
        Index("ix_ticket_features_active", "active"),
        Index("ix_ticket_features_org_code", "org_id", "code"),
    )


# ---------- Impact Area / Business Function ----------
class TicketImpactArea(Base):
    """
    Business-facing process/area impacted by the ticket.
    Examples: 'Sales Ops', 'Billing', 'Onboarding', 'Collections'.
    """
    __tablename__ = "ticket_impact_areas"

    impact_id: Mapped[str] = mapped_column(String, primary_key=True, index=True)
    org_id: Mapped[str] = mapped_column(String, index=True, nullable=False)

    # optional hierarchy
    parent_id: Mapped[str | None] = mapped_column(
        String, ForeignKey("ticket_impact_areas.impact_id", ondelete="SET NULL"),
        index=True, nullable=True
    )

    name: Mapped[str] = mapped_column(String, nullable=False)
    code: Mapped[str | None] = mapped_column(String, nullable=True)  # e.g., "sales_ops"
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # optional ownership hints (string IDs so you can map to your groups table later)
    owner_group_id: Mapped[str | None] = mapped_column(String, nullable=True)
    owner_team_id: Mapped[str | None] = mapped_column(String, nullable=True)

    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    display_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    meta: Mapped[dict] = mapped_column(JSONB, default=dict)

    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("ix_ticket_impact_areas_org", "org_id"),
        Index("ix_ticket_impact_areas_parent", "parent_id"),
        Index("ix_ticket_impact_areas_active", "active"),
        Index("ix_ticket_impact_areas_org_code", "org_id", "code"),
    )


# ---------- Root Cause Type (post-resolution) ----------
class TicketRootCauseType(Base):
    """
    Post-resolution classification for analytics (Problem Mgmt).
    Examples: 'Code Defect', 'Configuration Error', 'Human Error', 'Vendor Outage'.
    Supports hierarchy (parent/child).
    """
    __tablename__ = "ticket_root_cause_types"

    rca_id: Mapped[str] = mapped_column(String, primary_key=True, index=True)
    org_id: Mapped[str] = mapped_column(String, index=True, nullable=False)

    parent_id: Mapped[str | None] = mapped_column(
        String, ForeignKey("ticket_root_cause_types.rca_id", ondelete="SET NULL"),
        index=True, nullable=True
    )

    name: Mapped[str] = mapped_column(String, nullable=False)
    code: Mapped[str | None] = mapped_column(String, nullable=True)  # e.g., "code_defect"
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # optional grouping (process/people/technology/vendor/etc.)
    category: Mapped[str | None] = mapped_column(String, nullable=True)

    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    display_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    meta: Mapped[dict] = mapped_column(JSONB, default=dict)

    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("ix_ticket_rca_org", "org_id"),
        Index("ix_ticket_rca_parent", "parent_id"),
        Index("ix_ticket_rca_active", "active"),
        Index("ix_ticket_rca_org_code", "org_id", "code"),
        Index("ix_ticket_rca_org_category", "org_id", "category"),
    )
