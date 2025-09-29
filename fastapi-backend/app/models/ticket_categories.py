# ============================================
# DATABASE MODELS - app/models/ticket_categories.py
# ============================================

from sqlalchemy import String, Boolean, DateTime, Text, Integer, ForeignKey, Index
from sqlalchemy.orm import relationship, Mapped, mapped_column
from sqlalchemy.sql import func
from sqlalchemy.dialects.postgresql import JSONB

from ..db import Base

class TicketCategory(Base):
    __tablename__ = "ticket_categories"

    category_id: Mapped[str] = mapped_column(String, primary_key=True, index=True)
    org_id: Mapped[str] = mapped_column(String, index=True, nullable=False)
    
    name: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    icon: Mapped[str | None] = mapped_column(String, nullable=True)  # e.g., "bug", "feature"
    color: Mapped[str | None] = mapped_column(String, nullable=True)  # hex color
    
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    display_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    
    meta: Mapped[dict] = mapped_column(JSONB, default=dict)
    
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    subcategories = relationship("TicketSubcategory", back_populates="category", cascade="all, delete-orphan")
    
    __table_args__ = (
        Index("ix_ticket_categories_org", "org_id"),
        Index("ix_ticket_categories_active", "active"),
    )


class TicketSubcategory(Base):
    __tablename__ = "ticket_subcategories"

    subcategory_id: Mapped[str] = mapped_column(String, primary_key=True, index=True)
    category_id: Mapped[str] = mapped_column(
        String, 
        ForeignKey("ticket_categories.category_id", ondelete="CASCADE"),
        index=True, 
        nullable=False
    )
    org_id: Mapped[str] = mapped_column(String, index=True, nullable=False)
    
    name: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    display_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    
    # Optional: auto-assign settings
    default_priority: Mapped[str | None] = mapped_column(String, nullable=True)
    default_severity: Mapped[str | None] = mapped_column(String, nullable=True)
    default_sla_id: Mapped[str | None] = mapped_column(String, nullable=True)
    
    meta: Mapped[dict] = mapped_column(JSONB, default=dict)
    
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    category = relationship("TicketCategory", back_populates="subcategories")
    
    __table_args__ = (
        Index("ix_ticket_subcategories_category", "category_id"),
        Index("ix_ticket_subcategories_org", "org_id"),
        Index("ix_ticket_subcategories_active", "active"),
    )


class TicketProduct(Base):
    __tablename__ = "ticket_products"

    product_id: Mapped[str] = mapped_column(String, primary_key=True, index=True)
    org_id: Mapped[str] = mapped_column(String, index=True, nullable=False)
    
    name: Mapped[str] = mapped_column(String, nullable=False)
    code: Mapped[str] = mapped_column(String, nullable=False)  # e.g., "web-app", "mobile-ios"
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    
    version: Mapped[str | None] = mapped_column(String, nullable=True)
    platform: Mapped[str | None] = mapped_column(String, nullable=True)  # web, mobile, desktop, api
    
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    display_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    
    meta: Mapped[dict] = mapped_column(JSONB, default=dict)
    
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    __table_args__ = (
        Index("ix_ticket_products_org", "org_id"),
        Index("ix_ticket_products_code", "code"),
        Index("ix_ticket_products_active", "active"),
    )

