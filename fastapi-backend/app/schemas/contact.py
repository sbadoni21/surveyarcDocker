from pydantic import BaseModel, EmailStr, ConfigDict
from typing import List, Optional, Dict
from datetime import datetime
from enum import Enum

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

    emails: Optional[List[ContactEmail]] = None     # full replace list if provided
    phones: Optional[List[ContactPhone]] = None     # full replace list if provided
    socials: Optional[List[ContactSocial]] = None   # full replace list if provided
    
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

    # ✅ Fix: Properly type these fields with the Pydantic schemas
    emails: Optional[List[ContactEmail]] = []
    phones: Optional[List[ContactPhone]] = []
    socials: Optional[List[ContactSocial]] = []


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
    contact_ids: Optional[List[str]] = None  # full replace
class ListOut(ListBase):
    list_id: str
    contacts: List[ContactOut] = []  # ✅ Add this - full contact objects

    contact_ids: List[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    deleted_at: Optional[datetime] = None

    class Config:
        orm_mode = True
