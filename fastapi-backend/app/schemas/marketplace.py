from pydantic import BaseModel
from typing import Optional, Dict
from datetime import datetime

class MarketplaceBase(BaseModel):
    org_id: str
    name: str
    description: Optional[str] = None
    enabled: Optional[bool] = True
    config: Optional[Dict] = {}

class MarketplaceCreate(MarketplaceBase):
    app_id: str

class MarketplaceResponse(MarketplaceBase):
    app_id: str
    installed_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True
