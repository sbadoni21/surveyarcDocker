from pydantic import BaseModel
from typing import Optional, Dict
from datetime import datetime

class IntegrationBase(BaseModel):
    org_id: str
    type: str
    config: Optional[Dict] = {}
    enabled: Optional[bool] = True
    installed_by: Optional[str] = None

class IntegrationCreate(IntegrationBase):
    int_id: str

class IntegrationResponse(IntegrationBase):
    int_id: str
    installed_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True
