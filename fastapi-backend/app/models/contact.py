from sqlalchemy import (
    Column, String, DateTime, JSON, Table, 
    ForeignKey, Boolean, Enum, UniqueConstraint
)
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from ..db import Base
import enum

# ✅ ADD THIS
list_members = Table(
    "list_members",
    Base.metadata,
    Column("list_id", String, ForeignKey("contact_lists.list_id"), primary_key=True),
    Column("contact_id", String, ForeignKey("contacts.contact_id"), primary_key=True)
)
class ContactType(str, enum.Enum):
    email = "email"
    whatsapp = "whatsapp"
    phone = "phone"
    social = "social"
    other = "other"
class Contact(Base):
    __tablename__ = "contacts"

    contact_id        = Column(String, primary_key=True, index=True)
    org_id            = Column(String, index=True, nullable=False)
    user_id           = Column(String, nullable=True)

    # primary name
    name              = Column(String, default="")

    # universal identity
    contact_type      = Column(Enum(ContactType), default=ContactType.other)
    primary_identifier = Column(String, index=True, nullable=False)

    status      = Column(
        String, default="active"
    )   # active | bounced | unsubscribed | inactive | blocked

    created_at   = Column(DateTime(timezone=True), server_default=func.now())
    updated_at   = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now()
    )
    deleted_at   = Column(DateTime(timezone=True), nullable=True)

    meta         = Column(JSON, default=dict)  # extra info

    lists        = relationship(
        "ContactList", 
        secondary="list_members", 
        back_populates="contacts"
    )

    # child relations
    emails       = relationship("ContactEmail",back_populates="contact", cascade="all, delete-orphan")
    phones       = relationship("ContactPhone",back_populates="contact", cascade="all, delete-orphan")
    socials      = relationship("ContactSocial",back_populates="contact", cascade="all, delete-orphan")
class ContactEmail(Base):
    __tablename__ = "contact_emails"

    id          = Column(String, primary_key=True)
    contact_id  = Column(String, ForeignKey("contacts.contact_id"), index=True)
    
    email       = Column(String, index=True, nullable=False)
    email_lower = Column(String, index=True, nullable=False)

    is_primary  = Column(Boolean, default=False)
    is_verified = Column(Boolean, default=False)

    created_at  = Column(DateTime(timezone=True), server_default=func.now())
    status      = Column(String, default="active")  # bounced/unsubscribed
    contact = relationship("Contact", back_populates="emails")


    __table_args__ = (UniqueConstraint("email_lower", "contact_id"),)
class ContactPhone(Base):
    __tablename__ = "contact_phones"

    id          = Column(String, primary_key=True)
    contact_id  = Column(String, ForeignKey("contacts.contact_id"), index=True)
    
    country_code     = Column(String, default="")
    phone_number     = Column(String, nullable=False)
    
    is_primary       = Column(Boolean, default=False)
    is_whatsapp      = Column(Boolean, default=False)
    is_verified      = Column(Boolean, default=False)

    created_at  = Column(DateTime(timezone=True), server_default=func.now())
    contact = relationship("Contact", back_populates="phones")


    __table_args__ = (UniqueConstraint("country_code", "phone_number", "contact_id"),)
class ContactSocial(Base):
    __tablename__ = "contact_socials"

    id          = Column(String, primary_key=True)
    contact_id  = Column(String, ForeignKey("contacts.contact_id"), index=True)

    platform    = Column(String)  # ig, fb, x, linkedin
    handle      = Column(String)
    link        = Column(String)

    created_at  = Column(DateTime(timezone=True), server_default=func.now())
    contact = relationship("Contact", back_populates="socials")

    
class ContactList(Base):
    __tablename__ = "contact_lists"
    list_id     = Column(String, primary_key=True, index=True)
    org_id      = Column(String, index=True, nullable=False)

    list_name   = Column(String, nullable=False)
    status      = Column(String, default="live")  # live | suspended | archived
    created_at  = Column(DateTime(timezone=True), server_default=func.now())
    updated_at  = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    deleted_at  = Column(DateTime(timezone=True), nullable=True)

    contacts    = relationship("Contact", secondary="list_members", back_populates="lists")
