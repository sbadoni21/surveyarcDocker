# models/campaign_result.py
from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime, Text, Integer, ForeignKey, Enum
from sqlalchemy.sql import func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.mutable import MutableDict
from sqlalchemy.orm import relationship
from ..db import Base
import enum

class ResultStatus(str, enum.Enum):
    pending = "pending"
    queued = "queued"
    sending = "sending"
    sent = "sent"
    delivered = "delivered"
    failed = "failed"
    bounced = "bounced"
    skipped = "skipped"
    unreachable = "unreachable"

class CampaignChannel(str, enum.Enum):
    email = "email"
    sms = "sms"
    whatsapp = "whatsapp"
    voice = "voice"

class CampaignResult(Base):
    """
    Tracks individual campaign sends - replaces CampaignRecipient
    One row per contact per campaign
    """
    __tablename__ = "campaign_results"

    result_id = Column(String, primary_key=True, index=True)
    campaign_id = Column(String, ForeignKey("campaigns.campaign_id"), index=True, nullable=False)
    org_id = Column(String, index=True, nullable=False)
    
    # Contact reference
    contact_id = Column(String, ForeignKey("contacts.contact_id"), index=True, nullable=False)
    contact_name = Column(String, nullable=True)  # denormalized for reporting
    
    # 🎯 Channel & recipient address
    channel = Column(Enum(CampaignChannel), nullable=False, index=True)
    recipient_address = Column(String, nullable=False, index=True)  
    # Email: user@example.com
    # SMS/WhatsApp: +919876543210
    # Voice: +919876543210
    
    # 📧 Email-specific (only populated if channel=email)
    contact_email = Column(String, nullable=True, index=True)  # kept for backward compatibility
    
    # 📱 Phone-specific (only populated if channel=sms/whatsapp/voice)
    contact_phone = Column(String, nullable=True, index=True)  # kept for backward compatibility
    
    # Delivery status
    status = Column(Enum(ResultStatus), nullable=False, default=ResultStatus.pending, index=True)
    
    # External provider tracking
    message_id = Column(String, nullable=True, index=True)  # Provider's message ID (Twilio SID, SendGrid ID, etc.)
    outbox_id = Column(Integer, nullable=True)  # Link to outbox table
    
    # 🔗 Tracking (for analytics)
    tracking_token = Column(String, unique=True, index=True, nullable=False)  # Unique token for this send
    short_link = Column(String, nullable=True)  # Shortened survey link (for SMS/WhatsApp)
    
    # Error handling
    error = Column(Text, nullable=True)
    error_code = Column(String, nullable=True)
    retry_count = Column(Integer, default=0)
    
    # ⏰ Timing - Delivery
    sent_at = Column(DateTime(timezone=True), nullable=True, index=True)
    delivered_at = Column(DateTime(timezone=True), nullable=True)
    failed_at = Column(DateTime(timezone=True), nullable=True)
    bounced_at = Column(DateTime(timezone=True), nullable=True)
    bounce_reason = Column(String, nullable=True)
    
    # ⏰ Timing - Engagement
    first_opened_at = Column(DateTime(timezone=True), nullable=True)  # Email open or link click
    last_opened_at = Column(DateTime(timezone=True), nullable=True)
    open_count = Column(Integer, default=0)
    
    first_clicked_at = Column(DateTime(timezone=True), nullable=True)  # Survey link click
    last_clicked_at = Column(DateTime(timezone=True), nullable=True)
    click_count = Column(Integer, default=0)
    
    # 💬 Engagement - Replies (SMS/WhatsApp)
    replied_at = Column(DateTime(timezone=True), nullable=True)
    reply_text = Column(Text, nullable=True)
    reply_count = Column(Integer, default=0)
    
    # 🚫 Opt-out
    unsubscribed_at = Column(DateTime(timezone=True), nullable=True)
    
    # 📊 Survey tracking
    survey_started_at = Column(DateTime(timezone=True), nullable=True)
    survey_completed_at = Column(DateTime(timezone=True), nullable=True)
    survey_response_id = Column(String, nullable=True)  # Link to survey response
    
    # Metadata - flexible storage for provider-specific data
    meta_data = Column(MutableDict.as_mutable(JSONB), default=dict)
    # Examples:
    # Email: {"user_agent": "...", "ip": "...", "spam_score": 0.1}
    # SMS: {"carrier": "Verizon", "segments": 2, "delivery_code": "0"}
    # WhatsApp: {"read_receipt": true, "template_name": "survey_invite"}
    # Voice: {"call_duration": 45, "dtmf": "1", "recording_url": "..."}
    
    # Audit
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    campaign = relationship("Campaign", back_populates="results")
    contact = relationship("Contact")