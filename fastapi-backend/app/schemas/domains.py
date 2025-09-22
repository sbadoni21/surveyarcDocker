from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class DomainBase(BaseModel):
    org_id: str
    domain: str
    ssl_status: Optional[str] = "pending"
    verification_token: Optional[str] = None
    is_primary: Optional[bool] = False

class DomainCreate(DomainBase):
    domain_id: str

class DomainResponse(DomainBase):
    domain_id: str
    added_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True
