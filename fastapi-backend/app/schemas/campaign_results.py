# schemas/campaign_results.py
from datetime import datetime
from typing import Optional, Dict, Any
from pydantic import BaseModel

class CampaignResultCreate(BaseModel):
    result_id: Optional[str] = None
    campaign_id: str
    org_id: str
    project_id: str
    contact_id: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    status: str
    channel: str
    message_id: Optional[str] = None
    error: Optional[str] = None
    error_code: Optional[str] = None
    meta_data: Optional[Dict[str, Any]] = {}

class CampaignResultUpdate(BaseModel):
    status: Optional[str] = None
    message_id: Optional[str] = None
    error: Optional[str] = None
    error_code: Optional[str] = None
    sent_at: Optional[datetime] = None
    failed_at: Optional[datetime] = None
    delivered_at: Optional[datetime] = None
    opened_at: Optional[datetime] = None
    clicked_at: Optional[datetime] = None
    meta_data: Optional[Dict[str, Any]] = None

class CampaignResultOut(BaseModel):
    result_id: str
    campaign_id: str
    org_id: str
    project_id: str
    contact_id: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    status: str
    channel: str
    message_id: Optional[str] = None
    error: Optional[str] = None
    error_code: Optional[str] = None
    sent_at: Optional[datetime] = None
    failed_at: Optional[datetime] = None
    delivered_at: Optional[datetime] = None
    opened_at: Optional[datetime] = None
    clicked_at: Optional[datetime] = None
    meta_data: Dict[str, Any]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
