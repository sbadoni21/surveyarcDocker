# ============================================
# OUTBOX MODEL - app/models/outbox.py
# ============================================

from sqlalchemy import Column, Integer, String, DateTime, Text, JSON
from sqlalchemy.sql import func
from datetime import datetime, timezone
from ..db import Base


class Outbox(Base):
    """
    Outbox table for transactional outbox pattern
    Ensures reliable message delivery
    """
    __tablename__ = "outbox"
    
    # Primary Key
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    
    # Message Type (e.g., "campaign.email", "campaign.sms")
    kind = Column(String(100), nullable=False, index=True)
    
    # Deduplication Key (prevents duplicate sends)
    dedupe_key = Column(String(255), unique=True, nullable=True, index=True)
    
    # Message Payload (JSON)
    payload = Column(JSON, nullable=False)
    
    # ✅ CRITICAL: Meta Data field for tracking retry logic
    meta_data = Column(JSON, nullable=True, default=dict)
    
    # Status Tracking
    sent_at = Column(DateTime(timezone=True), nullable=True, index=True)
    created_at = Column(
        DateTime(timezone=True), 
        nullable=False, 
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now()
    )
    
    def __repr__(self):
        return (
            f"<Outbox(id={self.id}, kind='{self.kind}', "
            f"sent_at={self.sent_at}, created_at={self.created_at})>"
        )
    
    @property
    def is_sent(self) -> bool:
        """Check if message has been sent"""
        return self.sent_at is not None
    
    @property
    def is_failed(self) -> bool:
        """Check if message has permanently failed"""
        if not self.meta_data:
            return False
        return self.meta_data.get("failed", False)
    
    @property
    def retry_count(self) -> int:
        """Get current retry count"""
        if not self.meta_data:
            return 0
        return self.meta_data.get("retry_count", 0)

