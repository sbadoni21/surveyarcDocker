from sqlalchemy import Column, String, DateTime, JSON, Table, ForeignKey, Boolean
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from ..db import Base

# association table: lists ↔ contacts (many-to-many)
list_members = Table(
    "list_members",
    Base.metadata,
    Column("list_id", String, ForeignKey("contact_lists.list_id"), primary_key=True),
    Column("contact_id", String, ForeignKey("contacts.contact_id"), primary_key=True),
)

class Contact(Base):
    __tablename__ = "contacts"
    contact_id   = Column(String, primary_key=True, index=True)
    org_id       = Column(String, index=True, nullable=False)
    user_id      = Column(String, nullable=True)

    name         = Column(String, default="")
    email        = Column(String, index=True, nullable=False)
    email_lower  = Column(String, index=True, nullable=False)
    status       = Column(String, default="active")  # active, bounced, unsubscribed, etc.

    created_at   = Column(DateTime(timezone=True), server_default=func.now())
    updated_at   = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    meta         = Column(JSON, default=dict)

    lists        = relationship("ContactList", secondary=list_members, back_populates="contacts")

class ContactList(Base):
    __tablename__ = "contact_lists"
    list_id     = Column(String, primary_key=True, index=True)
    org_id      = Column(String, index=True, nullable=False)

    list_name   = Column(String, nullable=False)
    status      = Column(String, default="live")  # live | suspended | archived
    created_at  = Column(DateTime(timezone=True), server_default=func.now())
    updated_at  = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    deleted_at  = Column(DateTime(timezone=True), nullable=True)

    contacts    = relationship("Contact", secondary=list_members, back_populates="lists")
