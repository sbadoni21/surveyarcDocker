# schemas/campaign.py
from pydantic import BaseModel, Field, validator
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum

# ==================== ENUMS ====================

class CampaignStatusEnum(str, Enum):
    draft = "draft"
    scheduled = "scheduled"
    sending = "sending"
    sent = "sent"
    paused = "paused"
    cancelled = "cancelled"

class CampaignChannelEnum(str, Enum):
    email = "email"
    sms = "sms"
    whatsapp = "whatsapp"
    voice = "voice"
    multi = "multi"

class RecipientStatusEnum(str, Enum):
    pending = "pending"
    queued = "queued"
    sending = "sending"
    sent = "sent"
    delivered = "delivered"
    failed = "failed"
    bounced = "bounced"
    skipped = "skipped"
    unreachable = "unreachable"

# ==================== CAMPAIGN SCHEMAS ====================

class CampaignBase(BaseModel):
    campaign_name: str = Field(..., min_length=1, max_length=255)
    survey_id: str
    org_id:str
    user_id:str
    channel: CampaignChannelEnum = CampaignChannelEnum.email
    fallback_channel: Optional[CampaignChannelEnum] = None
    channel_priority: Optional[List[str]] = Field(default=None, description="Channel priority order for 'multi' channel")
    
    # Targeting
    contact_list_id: Optional[str] = None
    contact_filters: Optional[Dict[str, Any]] = Field(default_factory=dict)
    
    # Email content
    email_subject: Optional[str] = None
    email_body_html: Optional[str] = None
    email_from_name: Optional[str] = None
    email_reply_to: Optional[str] = None
    
    # SMS content
    sms_message: Optional[str] = Field(None, max_length=1600, description="SMS message with {survey_link} placeholder")
    
    # WhatsApp content
    whatsapp_message: Optional[str] = None
    whatsapp_template_id: Optional[str] = None
    
    # Voice content
    voice_script: Optional[str] = None
    
    # Scheduling
    scheduled_at: Optional[datetime] = None
    
    # Metadata
    meta_data: Optional[Dict[str, Any]] = Field(default_factory=dict)

    @validator('channel_priority')
    def validate_channel_priority(cls, v):
        if v is not None:
            valid_channels = ['email', 'sms', 'whatsapp', 'voice']
            for ch in v:
                if ch not in valid_channels:
                    raise ValueError(f"Invalid channel in priority: {ch}")
        return v

    @validator('email_body_html')
    def validate_email_content(cls, v, values):
        if values.get('channel') == CampaignChannelEnum.email and not v:
            raise ValueError("email_body_html is required when channel is 'email'")
        return v

    @validator('sms_message')
    def validate_sms_content(cls, v, values):
        if values.get('channel') == CampaignChannelEnum.sms and not v:
            raise ValueError("sms_message is required when channel is 'sms'")
        return v

    class Config:
        use_enum_values = True


class CampaignCreate(CampaignBase):
    """Schema for creating a new campaign"""
    pass


class CampaignUpdate(BaseModel):
    """Schema for updating a campaign"""
    campaign_name: Optional[str] = Field(None, min_length=1, max_length=255)
    channel: Optional[CampaignChannelEnum] = None
    fallback_channel: Optional[CampaignChannelEnum] = None
    channel_priority: Optional[List[str]] = None
    org_id:Optional[List[str]] = None

    
    contact_list_id: Optional[str] = None
    contact_filters: Optional[Dict[str, Any]] = None
    
    email_subject: Optional[str] = None
    email_body_html: Optional[str] = None
    email_from_name: Optional[str] = None
    email_reply_to: Optional[str] = None
    
    sms_message: Optional[str] = None
    whatsapp_message: Optional[str] = None
    whatsapp_template_id: Optional[str] = None
    voice_script: Optional[str] = None
    
    scheduled_at: Optional[datetime] = None
    status: Optional[CampaignStatusEnum] = None
    
    meta_data: Optional[Dict[str, Any]] = None

    class Config:
        use_enum_values = True


class ChannelStats(BaseModel):
    """Per-channel statistics"""
    sent: int = 0
    delivered: int = 0
    opened: int = 0
    clicked: int = 0
    replied: int = 0
    failed: int = 0
    bounced: int = 0


class CampaignAnalytics(BaseModel):
    """Campaign analytics summary"""
    total_recipients: int = 0
    sent_count: int = 0
    delivered_count: int = 0
    failed_count: int = 0
    bounced_count: int = 0
    opened_count: int = 0
    clicked_count: int = 0
    replied_count: int = 0
    unsubscribed_count: int = 0
    survey_started_count: int = 0
    survey_completed_count: int = 0
    
    # Calculated rates
    delivery_rate: Optional[float] = None
    open_rate: Optional[float] = None
    click_rate: Optional[float] = None
    response_rate: Optional[float] = None
    completion_rate: Optional[float] = None
    
    # Per-channel breakdown
    channel_stats: Optional[Dict[str, ChannelStats]] = Field(default_factory=dict)


class Campaign(CampaignBase):
    """Full campaign response schema"""
    campaign_id: str
    org_id: str
    
    status: CampaignStatusEnum
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    
    # Analytics
    total_recipients: int = 0
    sent_count: int = 0
    delivered_count: int = 0
    failed_count: int = 0
    bounced_count: int = 0
    opened_count: int = 0
    clicked_count: int = 0
    replied_count: int = 0
    unsubscribed_count: int = 0
    survey_started_count: int = 0
    survey_completed_count: int = 0
    
    channel_stats: Optional[Dict[str, Any]] = Field(default_factory=dict)
    
    created_at: datetime
    updated_at: datetime
    deleted_at: Optional[datetime] = None

    class Config:
        from_attributes = True
        use_enum_values = True


class CampaignList(BaseModel):
    """Simplified campaign list view"""
    campaign_id: str
    campaign_name: str
    survey_id: str
    org_id:str
    channel: CampaignChannelEnum
    status: CampaignStatusEnum
    total_recipients: int = 0
    sent_count: int = 0
    delivered_count: int = 0
    created_at: datetime
    scheduled_at: Optional[datetime] = None

    class Config:
        from_attributes = True
        use_enum_values = True


# ==================== CAMPAIGN RESULT SCHEMAS ====================

class CampaignResultBase(BaseModel):
    channel_used: CampaignChannelEnum
    recipient_address: str
    recipient_name: Optional[str] = None
    status: RecipientStatusEnum = RecipientStatusEnum.pending


class CampaignResultCreate(CampaignResultBase):
    """Schema for creating a campaign result"""
    campaign_id: str
    contact_id: str
    tracking_token: str
    short_link: Optional[str] = None


class CampaignResultUpdate(BaseModel):
    """Schema for updating campaign result status"""
    status: Optional[RecipientStatusEnum] = None
    message_id: Optional[str] = None
    error: Optional[str] = None
    error_code: Optional[str] = None
    
    sent_at: Optional[datetime] = None
    delivered_at: Optional[datetime] = None
    failed_at: Optional[datetime] = None
    bounced_at: Optional[datetime] = None
    
    failure_reason: Optional[str] = None
    bounce_reason: Optional[str] = None
    bounce_type: Optional[str] = None
    
    meta_data: Optional[Dict[str, Any]] = None


class CampaignResult(CampaignResultBase):
    """Full campaign result response"""
    result_id: str
    campaign_id: str
    contact_id: str
    org_id: str
    
    outbox_id: Optional[int] = None
    message_id: Optional[str] = None
    
    tracking_token: str
    short_link: Optional[str] = None
    
    error: Optional[str] = None
    error_code: Optional[str] = None
    retry_count: int = 0
    
    # Delivery timestamps
    sent_at: Optional[datetime] = None
    delivered_at: Optional[datetime] = None
    failed_at: Optional[datetime] = None
    bounced_at: Optional[datetime] = None
    
    failure_reason: Optional[str] = None
    bounce_reason: Optional[str] = None
    bounce_type: Optional[str] = None
    
    # Engagement
    first_opened_at: Optional[datetime] = None
    last_opened_at: Optional[datetime] = None
    open_count: int = 0
    
    first_clicked_at: Optional[datetime] = None
    last_clicked_at: Optional[datetime] = None
    click_count: int = 0
    
    first_replied_at: Optional[datetime] = None
    last_replied_at: Optional[datetime] = None
    reply_count: int = 0
    reply_text: Optional[str] = None
    
    unsubscribed_at: Optional[datetime] = None
    
    # Survey engagement
    survey_started_at: Optional[datetime] = None
    survey_completed_at: Optional[datetime] = None
    survey_response_id: Optional[str] = None
    
    created_at: datetime
    updated_at: datetime
    
    meta_data: Optional[Dict[str, Any]] = Field(default_factory=dict)

    class Config:
        from_attributes = True
        use_enum_values = True


class CampaignResultList(BaseModel):
    """Simplified result list view"""
    result_id: str
    contact_id: str
    recipient_name: Optional[str] = None
    recipient_address: str
    channel_used: CampaignChannelEnum
    status: RecipientStatusEnum
    sent_at: Optional[datetime] = None
    delivered_at: Optional[datetime] = None
    opened_at: Optional[datetime] = None
    clicked_at: Optional[datetime] = None

    class Config:
        from_attributes = True
        use_enum_values = True


# ==================== CAMPAIGN EVENT SCHEMAS ====================

class CampaignEventCreate(BaseModel):
    """Schema for creating campaign events"""
    result_id: str
    event_type: str = Field(..., description="sent, delivered, opened, clicked, bounced, failed, replied, unsubscribed")
    channel: CampaignChannelEnum
    event_data: Optional[Dict[str, Any]] = Field(default_factory=dict)


class CampaignEvent(CampaignEventCreate):
    """Full campaign event response"""
    event_id: str
    campaign_id: str
    created_at: datetime

    class Config:
        from_attributes = True
        use_enum_values = True


# ==================== WEBHOOK/TRACKING SCHEMAS ====================

class EmailTrackingEvent(BaseModel):
    """Schema for email tracking webhooks (from SendGrid, Mailgun, etc.)"""
    tracking_token: str
    event_type: str = Field(..., description="delivered, opened, clicked, bounced, unsubscribed")
    timestamp: datetime
    
    # Email-specific
    email: Optional[str] = None
    user_agent: Optional[str] = None
    ip_address: Optional[str] = None
    link_url: Optional[str] = None
    
    # Bounce info
    bounce_type: Optional[str] = None
    bounce_reason: Optional[str] = None
    smtp_code: Optional[str] = None


class SMSTrackingEvent(BaseModel):
    """Schema for SMS/WhatsApp tracking webhooks (from Twilio, etc.)"""
    tracking_token: str
    message_id: str
    event_type: str = Field(..., description="sent, delivered, failed, undelivered")
    timestamp: datetime
    
    # SMS-specific
    phone_number: Optional[str] = None
    error_code: Optional[str] = None
    error_message: Optional[str] = None
    carrier: Optional[str] = None
    price: Optional[float] = None


class SurveyResponseEvent(BaseModel):
    """Schema for survey response tracking"""
    tracking_token: str
    event_type: str = Field(..., description="survey_started, survey_completed")
    response_id: Optional[str] = None
    timestamp: datetime


# ==================== ACTION SCHEMAS ====================

class CampaignSendRequest(BaseModel):
    """Request to send/schedule a campaign"""
    send_immediately: bool = False
    scheduled_at: Optional[datetime] = None
    test_mode: bool = False
    test_contacts: Optional[List[str]] = Field(None, description="Contact IDs for test send")


class CampaignActionResponse(BaseModel):
    """Response for campaign actions"""
    success: bool
    message: str
    campaign_id: str
    action: str  # send, pause, resume, cancel
    affected_count: Optional[int] = None


# ==================== PAGINATION ====================

class PaginatedCampaigns(BaseModel):
    """Paginated campaign list"""
    items: List[CampaignList]
    total: int
    page: int
    page_size: int
    total_pages: int


class PaginatedResults(BaseModel):
    """Paginated campaign results"""
    items: List[CampaignResultList]
    total: int
    page: int
    page_size: int
    total_pages: int


# ==================== FILTER SCHEMAS ====================

class CampaignFilter(BaseModel):
    """Filter options for campaign listing"""
    status: Optional[List[CampaignStatusEnum]] = None
    channel: Optional[List[CampaignChannelEnum]] = None
    survey_id: Optional[str] = None
    contact_list_id: Optional[str] = None
    created_after: Optional[datetime] = None
    created_before: Optional[datetime] = None
    search: Optional[str] = Field(None, description="Search in campaign name")


class ResultFilter(BaseModel):
    """Filter options for result listing"""
    status: Optional[List[RecipientStatusEnum]] = None
    channel: Optional[List[CampaignChannelEnum]] = None
    contact_id: Optional[str] = None
    has_opened: Optional[bool] = None
    has_clicked: Optional[bool] = None
    has_replied: Optional[bool] = None
    has_completed_survey: Optional[bool] = None