# app/schemas/salesforce.py
from pydantic import BaseModel
from typing import Optional, List, Dict, Any


class SalesforceContact(BaseModel):
    id: str
    firstName: Optional[str] = None
    lastName: Optional[str] = None
    email: Optional[str] = None
    accountName: Optional[str] = None
    raw: Optional[Dict[str, Any]] = None  # optional full record

    class Config:
        from_attributes = True


class SalesforceContactList(BaseModel):
    total: int
    items: List[SalesforceContact]


class SalesforceGenericRecord(BaseModel):
    id: str
    name: Optional[str] = None
    raw: Dict[str, Any]


class SalesforceListResponse(BaseModel):
    total: int
    items: List[SalesforceGenericRecord]

class SalesforceContactUpdate(BaseModel):
    firstName: Optional[str] = None
    lastName: Optional[str] = None
    email: Optional[str] = None
    
class SalesforceAccount(BaseModel):
    id: str
    name: Optional[str] = None
    type: Optional[str] = None
    website: Optional[str] = None
    phone: Optional[str] = None
    raw: Optional[Dict[str, Any]] = None

class SalesforceContactMini(BaseModel):
    id: str
    firstName: Optional[str]
    lastName: Optional[str]
    email: Optional[str]

class SalesforceAccountWithContacts(BaseModel):
    account: SalesforceAccount
    contacts: List[SalesforceContactMini]
