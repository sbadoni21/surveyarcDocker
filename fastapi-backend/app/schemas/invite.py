from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class InviteBase(BaseModel):
    org_id: str
    email: str
    role: str
    invited_by: str
    status: Optional[str] = "pending"
    sent_at: Optional[datetime] = None
    accepted_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None

class InviteCreate(InviteBase):
    invite_id: str

class InviteResponse(InviteBase):
    invite_id: str
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
