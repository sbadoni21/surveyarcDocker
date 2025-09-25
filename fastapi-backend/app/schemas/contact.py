from pydantic import BaseModel, EmailStr
from typing import List, Optional, Dict
from datetime import datetime

class ContactBase(BaseModel):
    org_id: str
    name: Optional[str] = ""
    email: EmailStr
    email_lower: Optional[str] = None
    user_id: Optional[str] = None
    status: Optional[str] = "active"
    meta: Optional[Dict] = {}

class ContactCreate(ContactBase):
    contact_id: Optional[str] = None

class ContactUpdate(BaseModel):
    name: Optional[str] = None
    status: Optional[str] = None
    meta: Optional[Dict] = None
    user_id: Optional[str] = None

class ContactOut(ContactBase):
    contact_id: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    class Config:
        orm_mode = True


class ListBase(BaseModel):
    org_id: str
    list_name: str
    status: Optional[str] = "live"

class ListCreate(ListBase):
    list_id: Optional[str] = None
    contact_ids: Optional[List[str]] = []

class ListUpdate(BaseModel):
    list_name: Optional[str] = None
    status: Optional[str] = None
    contact_ids: Optional[List[str]] = None  # full replace if provided

class ListOut(ListBase):
    list_id: str
    contact_ids: List[str] = []
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    deleted_at: Optional[datetime] = None
    class Config:
        orm_mode = True
