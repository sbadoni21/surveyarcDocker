# schemas/campaign_results.py
from datetime import datetime
from typing import Optional, Dict, Any, List
from pydantic import BaseModel

class CampaignResultCreate(BaseModel):
    result_id: Optional[str] = None
    campaign_id: str
    org_id: str
    contact_id: str
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    status: str = "pending"
    channel: str
    message_id: Optional[str] = None
    error: Optional[str] = None
    error_code: Optional[str] = None
    meta_data: Optional[Dict[str, Any]] = None

class CampaignResultUpdate(BaseModel):
    status: Optional[str] = None
    message_id: Optional[str] = None
    error: Optional[str] = None
    error_code: Optional[str] = None
    sent_at: Optional[datetime] = None
    delivered_at: Optional[datetime] = None
    failed_at: Optional[datetime] = None
    bounced_at: Optional[datetime] = None
    first_opened_at: Optional[datetime] = None
    last_opened_at: Optional[datetime] = None
    open_count: Optional[int] = None
    first_clicked_at: Optional[datetime] = None
    last_clicked_at: Optional[datetime] = None
    click_count: Optional[int] = None
    survey_started_at: Optional[datetime] = None
    survey_completed_at: Optional[datetime] = None
    survey_response_id: Optional[str] = None
    meta_data: Optional[Dict[str, Any]] = None

class CampaignResultOut(BaseModel):
    result_id: str
    campaign_id: str
    org_id: str
    contact_id: str
    contact_email: Optional[str]
    contact_phone: Optional[str]
    status: str
    channel: str
    message_id: Optional[str]
    error: Optional[str]
    error_code: Optional[str]
    sent_at: Optional[datetime]
    delivered_at: Optional[datetime]
    failed_at: Optional[datetime]
    bounced_at: Optional[datetime]
    first_opened_at: Optional[datetime]
    last_opened_at: Optional[datetime]
    open_count: int
    first_clicked_at: Optional[datetime]
    last_clicked_at: Optional[datetime]
    click_count: int
    reply_count: int
    survey_started_at: Optional[datetime]
    survey_completed_at: Optional[datetime]
    survey_response_id: Optional[str]
    created_at: datetime
    updated_at: datetime
    meta_data: Optional[Dict[str, Any]]

    class Config:
        from_attributes = True

class ChannelBreakdown(BaseModel):
    channel: str
    total: int
    sent: int
    delivered: int
    failed: int
    bounced: int
    opened: int
    clicked: int
    completed: int
    delivery_rate: float
    open_rate: float
    click_rate: float
    completion_rate: float

class ResultTimelineData(BaseModel):
    date: str
    count: int
    delivered: int
    failed: int

class CampaignResultAnalytics(BaseModel):
    campaign_id: str
    total_results: int
    status_breakdown: Dict[str, int]
    channel_breakdown: List[ChannelBreakdown]
    engagement_metrics: Dict[str, Any]
    timeline_data: List[ResultTimelineData]
    failure_reasons: List[Dict[str, Any]]