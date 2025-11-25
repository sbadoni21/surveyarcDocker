from pydantic import BaseModel, EmailStr, ConfigDict, Field, field_validator
from typing import List, Optional, Dict
from datetime import datetime
from enum import Enum

class ListBasic(BaseModel):  # Simplified list info to avoid circular imports
    list_id: str
    list_name: str
    status: str
    
    model_config = ConfigDict(from_attributes=True)

class ContactType(str, Enum):
    email = "email"
    whatsapp = "whatsapp"
    phone = "phone"
    social = "social"
    other = "other"

class ContactEmail(BaseModel):
    id: Optional[str] = None
    email: EmailStr
    is_primary: bool = False
    is_verified: bool = False
    status: Optional[str] = "active"

    model_config = ConfigDict(from_attributes=True)

class ContactPhone(BaseModel):
    id: Optional[str] = None
    country_code: Optional[str] = ""
    phone_number: str
    is_primary: bool = False
    is_whatsapp: bool = False
    is_verified: bool = False

    model_config = ConfigDict(from_attributes=True)

class ContactSocial(BaseModel):
    id: Optional[str] = None
    platform: Optional[str] = None
    handle: Optional[str] = None
    link: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

class ContactBase(BaseModel):
    org_id: str
    name: Optional[str] = ""
    primary_identifier: str
    contact_type: ContactType = ContactType.other
    user_id: Optional[str] = None
    status: Optional[str] = "active"
    meta: Optional[Dict] = None

class ContactCreate(ContactBase):
    contact_id: Optional[str] = None
    emails: Optional[List[ContactEmail]] = []
    phones: Optional[List[ContactPhone]] = []
    socials: Optional[List[ContactSocial]] = []

class ContactUpdate(BaseModel):
    name: Optional[str] = None
    primary_identifier: Optional[str] = None
    contact_type: Optional[ContactType] = None
    status: Optional[str] = None
    meta: Optional[Dict] = None
    user_id: Optional[str] = None

    emails: Optional[List[ContactEmail]] = None
    phones: Optional[List[ContactPhone]] = None
    socials: Optional[List[ContactSocial]] = None
    
class ContactOut(BaseModel):
    contact_id: str
    org_id: str
    user_id: Optional[str]
    name: Optional[str]
    primary_identifier: Optional[str]
    contact_type: Optional[str]
    status: Optional[str]
    meta: dict | None = None
    
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    emails: List[ContactEmail] = Field(default_factory=list)
    phones: List[ContactPhone] = Field(default_factory=list)
    socials: List[ContactSocial] = Field(default_factory=list)
    lists: List[ListBasic] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)

class ListBase(BaseModel):
    org_id: str
    list_name: str
    status: Optional[str] = "live"

class ListCreate(ListBase):
    list_id: Optional[str] = None
    contact_ids: Optional[List[str]] = None

class ListUpdate(BaseModel):
    list_name: Optional[str] = None
    status: Optional[str] = None
    contact_ids: Optional[List[str]] = None

class ListOut(ListBase):
    list_id: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    deleted_at: Optional[datetime] = None
    
    # The full contact objects with their details
    contacts: List[ContactOut] = Field(default_factory=list)
    
    model_config = ConfigDict(from_attributes=True)
    
    @field_validator('contacts', mode='before')
    @classmethod
    def debug_contacts(cls, v):
        """Debug validator to see what we're getting"""
        if v is not None:
            print(f"ListOut validator: Received {len(v)} contacts")
            for contact in v:
                if hasattr(contact, 'contact_id'):
                    print(f"  - Contact ID: {contact.contact_id}, Name: {getattr(contact, 'name', 'N/A')}")
        return v