# models/campaign_result.py
from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime, Text
from sqlalchemy.sql import func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.mutable import MutableDict
from ..db import Base

class CampaignResult(Base):
    __tablename__ = "campaign_results"

    result_id = Column(String, primary_key=True, index=True)
    campaign_id = Column(String, index=True, nullable=False)
    org_id = Column(String, index=True, nullable=False)
    project_id = Column(String, index=True, nullable=False)
    
    # Message details
    contact_id = Column(String, nullable=True)
    contact_email = Column(String, nullable=True)
    contact_phone = Column(String, nullable=True)
    
    # Delivery status
    status = Column(String, nullable=False)  # "sent", "failed", "queued", "skipped"
    channel = Column(String, nullable=False)  # "email", "whatsapp", "sms"
    
    # Result details
    message_id = Column(String, nullable=True)  # external provider message ID
    error = Column(Text, nullable=True)
    error_code = Column(String, nullable=True)
    
    # Timing
    sent_at = Column(DateTime(timezone=True), nullable=True)
    failed_at = Column(DateTime(timezone=True), nullable=True)
    delivered_at = Column(DateTime(timezone=True), nullable=True)
    opened_at = Column(DateTime(timezone=True), nullable=True)
    clicked_at = Column(DateTime(timezone=True), nullable=True)
    
    # Metadata
    meta_data = Column(MutableDict.as_mutable(JSONB), default=dict)
    
    # Audit
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
