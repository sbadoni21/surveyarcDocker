from sqlalchemy import (
    Column, String, DateTime, JSON, Integer, 
    ForeignKey, Boolean, Enum, Text
)
from sqlalchemy.dialects.postgresql import JSONB, ARRAY
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from ..db import Base
import enum
from sqlalchemy.ext.mutable import MutableDict
from sqlalchemy import Enum as SQLEnum

class CampaignStatus(str, Enum):
    draft = "draft"
    scheduled = "scheduled"
    sending = "sending"
    completed = "completed"
    sent = "sent"
    paused = "paused"
    cancelled = "cancelled"


class CampaignChannel(str, enum.Enum):
    email = "email"
    sms = "sms"
    whatsapp = "whatsapp"
    voice = "voice"
    multi = "multi"  

class Campaign(Base):
    __tablename__ = "campaigns"
    audience_file_id = Column(
        String,
        ForeignKey("audience_files.id"),
        nullable=True,
        index=True,
    )

    # Relationship
    audience_file = relationship("AudienceFile", backref="campaigns")
    campaign_id = Column(String, primary_key=True, index=True)
    org_id = Column(String, index=True, nullable=False)
    user_id = Column(String, nullable=True)
    
    campaign_name = Column(String, nullable=False)
    survey_id = Column(String, ForeignKey("surveys.survey_id"), nullable=False, index=True)
    
    # Channel selection
    channel = Column(Enum(CampaignChannel), nullable=False, default=CampaignChannel.email, index=True)
    fallback_channel = Column(Enum(CampaignChannel), nullable=True)
    
    # ✅ NEW: Channel priority when using 'multi'
    channel_priority = Column(JSONB, default=list)
    # Example: ["whatsapp", "email", "sms"] - try in this order
    
    # Targeting
    contact_list_id = Column(String, ForeignKey("contact_lists.list_id"), nullable=True, index=True)
    contact_filters = Column(MutableDict.as_mutable(JSONB), default=dict)
    
    # Content by channel
    email_subject = Column(String, nullable=True)
    email_body_html = Column(Text, nullable=True)
    email_from_name = Column(String, nullable=True)
    email_reply_to = Column(String, nullable=True)
    
    sms_message = Column(Text, nullable=True)
    whatsapp_message = Column(Text, nullable=True)
    whatsapp_template_id = Column(String, nullable=True)
    voice_script = Column(Text, nullable=True)
    
    # Scheduling
    status = Column(String, default="scheduled", index=True)
    scheduled_at = Column(DateTime(timezone=True), nullable=True)
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    
    # Analytics - denormalized counters
    total_recipients = Column(Integer, default=0)
    sent_count = Column(Integer, default=0)
    delivered_count = Column(Integer, default=0)
    failed_count = Column(Integer, default=0)
    bounced_count = Column(Integer, default=0)
    opened_count = Column(Integer, default=0)
    clicked_count = Column(Integer, default=0)
    replied_count = Column(Integer, default=0)
    unsubscribed_count = Column(Integer, default=0)
    survey_started_count = Column(Integer, default=0)
    survey_completed_count = Column(Integer, default=0)
    
    # Per-channel stats
    channel_stats = Column(MutableDict.as_mutable(JSONB), default=dict)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    deleted_at = Column(DateTime(timezone=True), nullable=True)
    
    meta_data = Column(MutableDict.as_mutable(JSONB), default=dict)
    
    # Relationships
    survey = relationship("Survey", backref="campaigns")
    contact_list = relationship("ContactList", backref="campaigns")
    results = relationship("CampaignResult", back_populates="campaign", cascade="all, delete-orphan")

    # ✅ NEW: Helper method to determine channel for a contact
    def get_channel_for_contact(self, contact):
        """
        Determine which channel to use for this contact based on:
        1. Campaign channel setting (if not 'multi')
        2. Contact's is_primary flags
        3. Channel priority order
        4. Fallback channel
        
        Returns: (channel, recipient_address) tuple or (None, None) if no valid channel
        """
        # If campaign has a specific channel (not multi), use it
        if self.channel != CampaignChannel.multi:
            return self._get_address_for_channel(contact, self.channel)
        
        # Use campaign's channel priority if set
        priority_order = self.channel_priority or ["email", "whatsapp", "sms", "voice"]
        
        # Try each channel in priority order
        for channel_str in priority_order:
            try:
                channel = CampaignChannel(channel_str)
                result = self._get_address_for_channel(contact, channel)
                if result[0]:  # If we got a valid channel and address
                    return result
            except (ValueError, KeyError):
                continue
        
        # Try fallback channel if set
        if self.fallback_channel:
            return self._get_address_for_channel(contact, self.fallback_channel)
        
        return None, None

    def _get_address_for_channel(self, contact, channel):
        """
        Get the recipient address for a specific channel.
        Prioritizes is_primary=True entries.
        
        Returns: (channel, address) or (None, None)
        """
        # Skip if contact status is invalid
        if contact.status in ['unsubscribed', 'blocked', 'bounced']:
            return None, None
        
        if channel == CampaignChannel.email:
            # Find primary email or first active email
            primary_email = next(
                (e for e in contact.emails if e.is_primary and e.status == 'active'),
                None
            )
            if primary_email:
                return CampaignChannel.email, primary_email.email
            
            # Fallback to first active email
            active_email = next(
                (e for e in contact.emails if e.status == 'active'),
                None
            )
            if active_email:
                return CampaignChannel.email, active_email.email
        
        elif channel == CampaignChannel.whatsapp:
            # Find primary WhatsApp-enabled phone
            primary_whatsapp = next(
                (p for p in contact.phones if p.is_primary and p.is_whatsapp),
                None
            )
            if primary_whatsapp:
                return CampaignChannel.whatsapp, f"{primary_whatsapp.country_code}{primary_whatsapp.phone_number}"
            
            # Fallback to first WhatsApp-enabled phone
            whatsapp_phone = next(
                (p for p in contact.phones if p.is_whatsapp),
                None
            )
            if whatsapp_phone:
                return CampaignChannel.whatsapp, f"{whatsapp_phone.country_code}{whatsapp_phone.phone_number}"
        
        elif channel in [CampaignChannel.sms, CampaignChannel.voice]:
            # Find primary phone
            primary_phone = next(
                (p for p in contact.phones if p.is_primary),
                None
            )
            if primary_phone:
                return channel, f"{primary_phone.country_code}{primary_phone.phone_number}"
            
            # Fallback to first phone
            if contact.phones:
                phone = contact.phones[0]
                return channel, f"{phone.country_code}{phone.phone_number}"
        
        return None, None

    def validate_content_for_channel(self, channel):
        """
        Check if campaign has required content for the given channel
        """
        if channel == CampaignChannel.email:
            return bool(self.email_subject and self.email_body_html)
        elif channel == CampaignChannel.sms:
            return bool(self.sms_message)
        elif channel == CampaignChannel.whatsapp:
            return bool(self.whatsapp_message or self.whatsapp_template_id)
        elif channel == CampaignChannel.voice:
            return bool(self.voice_script)
        return False


class RecipientStatus(str, enum.Enum):
    pending = "pending"
    queued = "queued"
    sending = "sending"
    sent = "sent"
    delivered = "delivered"
    failed = "failed"
    bounced = "bounced"
    skipped = "skipped"
    unreachable = "unreachable"



class CampaignEvent(Base):
    """Granular event tracking - works for all channels"""
    __tablename__ = "campaign_events"

    event_id = Column(String, primary_key=True)
    campaign_id = Column(String, ForeignKey("campaigns.campaign_id"), nullable=False, index=True)
    result_id = Column(String, ForeignKey("campaign_results.result_id"), nullable=False, index=True)
    
    event_type = Column(String, nullable=False, index=True)
    channel = Column(Enum(CampaignChannel), nullable=False, index=True)
    event_data = Column(MutableDict.as_mutable(JSONB), default=dict)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    
    # Relationships
    campaign = relationship("Campaign")
    result = relationship("CampaignResult")