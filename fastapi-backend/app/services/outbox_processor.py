# ============================================
# SINGLE-ATTEMPT OUTBOX PROCESSOR
# app/services/outbox_processor_single.py
# ============================================

from __future__ import annotations
import os
import time
import logging
import httpx
from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified
from sqlalchemy import and_, or_, cast, DateTime
from typing import Optional
from enum import Enum

from ..db import SessionLocal
from ..models.outbox import Outbox
from ..models.campaigns import (
    Campaign, 
    CampaignResult, 
    CampaignChannel, 
    RecipientStatus,
    CampaignStatus
)

# ============================================
# CONFIGURATION
# ============================================

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

MAIL_RELAY_URL = os.getenv("MAIL_RELAY_URL", "http://localhost:4001")
MAIL_API_TOKEN = os.getenv("MAIL_API_TOKEN", "supersecrettoken")
UTC = timezone.utc

# ✅ SINGLE ATTEMPT ONLY - NO RETRIES
MAX_RETRY_ATTEMPTS = 0  # Changed from 2 to 0
PROCESSING_TIMEOUT_MINUTES = 10

consecutive_errors = 0
is_processing = False

logger.info(f"📧 Mail Relay URL: {MAIL_RELAY_URL}")
logger.info(f"🎯 SINGLE ATTEMPT MODE - No retries, move to next message")


# ============================================
# PROCESSING RESULT
# ============================================

class ProcessingResult:
    def __init__(
        self,
        success: bool,
        message_id: Optional[str] = None,
        error: Optional[str] = None
    ):
        self.success = success
        self.message_id = message_id
        self.error = error


# ============================================
# MAIL RELAY COMMUNICATION
# ============================================

async def send_to_mail_relay(kind: str, payload: dict) -> dict:
    """Send message to mail relay service - single attempt"""
    try:
        headers = {"Content-Type": "application/json"}
        
        if MAIL_API_TOKEN:
            headers["Authorization"] = f"Bearer {MAIL_API_TOKEN}"
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            logger.debug(f"📤 POST {MAIL_RELAY_URL}/send/from-payload")
            
            response = await client.post(
                f"{MAIL_RELAY_URL}/send/from-payload",
                json={"kind": kind, "payload": payload},
                headers=headers
            )
            
            response.raise_for_status()
            result = response.json()
            
            message_id = result.get('messageId', 'unknown')
            logger.info(f"✅ Mail sent successfully: {message_id}")
            return result
            
    except httpx.HTTPStatusError as e:
        error_msg = f"HTTP {e.response.status_code}: {e.response.text[:200]}"
        logger.error(f"❌ {error_msg}")
        raise Exception(error_msg) from e
        
    except httpx.TimeoutException as e:
        error_msg = "Request timeout (30s)"
        logger.error(f"❌ {error_msg}")
        raise Exception(error_msg) from e
        
    except httpx.NetworkError as e:
        error_msg = f"Network error: {str(e)[:100]}"
        logger.error(f"❌ {error_msg}")
        raise Exception(error_msg) from e
        
    except Exception as e:
        error_msg = f"Unexpected error: {str(e)[:100]}"
        logger.error(f"❌ {error_msg}")
        raise Exception(error_msg) from e


# ============================================
# CAMPAIGN RESULT UPDATES
# ============================================

def update_campaign_result_sent(
    session: Session,
    result_id: str,
    sent_at: datetime,
    message_id: Optional[str] = None
):
    """Update result to DELIVERED"""
    try:
        result = session.query(CampaignResult).filter(
            CampaignResult.result_id == result_id
        ).with_for_update().first()
        
        if not result:
            logger.warning(f"⚠️  CampaignResult {result_id} not found")
            return
        
        if result.status == RecipientStatus.delivered:
            logger.debug(f"ℹ️  Result {result_id} already delivered")
            return
        
        result.status = RecipientStatus.delivered
        result.sent_at = sent_at
        result.delivered_at = sent_at
        
        if message_id:
            result.message_id = message_id
        
        logger.debug(f"✅ Result {result_id} → delivered")
        
        campaign = session.query(Campaign).filter(
            Campaign.campaign_id == result.campaign_id
        ).with_for_update().first()
        
        if campaign:
            campaign.sent_count = (campaign.sent_count or 0) + 1
            campaign.delivered_count = (campaign.delivered_count or 0) + 1
            
            if not campaign.channel_stats:
                campaign.channel_stats = {}
            
            channel_key = result.channel_used.value
            
            if channel_key not in campaign.channel_stats:
                campaign.channel_stats[channel_key] = {
                    "sent": 0, "delivered": 0, "opened": 0, 
                    "clicked": 0, "bounced": 0, "failed": 0
                }
            
            campaign.channel_stats[channel_key]["sent"] += 1
            campaign.channel_stats[channel_key]["delivered"] += 1
            flag_modified(campaign, "channel_stats")
        
        session.flush()
        
    except Exception as e:
        logger.error(f"❌ Error updating result {result_id}: {e}", exc_info=True)


def update_campaign_result_failed(
    session: Session,
    result_id: str,
    error_message: str
):
    """Update CampaignResult when message fails"""
    try:
        result = session.query(CampaignResult).filter(
            CampaignResult.result_id == result_id
        ).with_for_update().first()
        
        if not result:
            logger.warning(f"⚠️  CampaignResult {result_id} not found")
            return
        
        if result.status == RecipientStatus.failed:
            logger.debug(f"ℹ️  Result {result_id} already failed")
            return
        
        result.status = RecipientStatus.failed
        result.error = error_message[:500]
        result.failed_at = datetime.now(UTC)
        result.retry_count = 1  # Always 1 since we only try once
        
        logger.debug(f"❌ Result {result_id} → failed")
        
        campaign = session.query(Campaign).filter(
            Campaign.campaign_id == result.campaign_id
        ).with_for_update().first()
        
        if campaign:
            campaign.failed_count = (campaign.failed_count or 0) + 1
            
            if not campaign.channel_stats:
                campaign.channel_stats = {}
            
            channel_key = result.channel_used.value
            
            if channel_key not in campaign.channel_stats:
                campaign.channel_stats[channel_key] = {
                    "sent": 0, "delivered": 0, "opened": 0,
                    "clicked": 0, "bounced": 0, "failed": 0
                }
            
            campaign.channel_stats[channel_key]["failed"] += 1
            flag_modified(campaign, "channel_stats")
        
        session.flush()
        
    except Exception as e:
        logger.error(f"❌ Error updating failed result {result_id}: {e}", exc_info=True)


# ============================================
# CAMPAIGN COMPLETION CHECKER
# ============================================

def check_campaign_completion(session: Session, campaign_id: str):
    """Check if campaign should be marked as completed"""
    try:
        campaign = session.query(Campaign).filter(
            Campaign.campaign_id == campaign_id
        ).with_for_update().first()
        
        if not campaign:
            return
        
        if campaign.status != CampaignStatus.sending:
            return
        
        pending_count = session.query(CampaignResult).filter(
            CampaignResult.campaign_id == campaign_id,
            CampaignResult.status.in_([
                RecipientStatus.queued,
                RecipientStatus.pending
            ])
        ).count()
        
        logger.debug(
            f"📊 Campaign {campaign_id}: {pending_count} pending/queued results remaining"
        )
        
        if pending_count == 0:
            campaign.status = CampaignStatus.completed
            campaign.completed_at = datetime.now(UTC)
            
            total_results = session.query(CampaignResult).filter(
                CampaignResult.campaign_id == campaign_id
            ).count()
            
            logger.info(
                f"🎉 Campaign {campaign_id} COMPLETED! "
                f"Total: {total_results}, "
                f"Sent: {campaign.sent_count or 0}, "
                f"Delivered: {campaign.delivered_count or 0}, "
                f"Failed: {campaign.failed_count or 0}"
            )
            
            session.flush()
    
    except Exception as e:
        logger.error(f"❌ Error checking campaign completion: {e}", exc_info=True)


# ============================================
# CORE PROCESSING LOGIC - SINGLE ATTEMPT
# ============================================

def process_outbox_message(session: Session, outbox: Outbox) -> ProcessingResult:
    """
    Process a single outbox message - ONE ATTEMPT ONLY
    Always marks message as processed (sent_at set) regardless of outcome
    """
    try:
        session.refresh(outbox)
        
        if outbox.sent_at is not None:
            logger.info(f"⏭️  Outbox #{outbox.id} already processed - skipping")
            return ProcessingResult(success=True, message_id="already-processed")
        
        logger.info(f"📤 Processing outbox #{outbox.id}: {outbox.kind}")
        
        import asyncio
        
        try:
            # ✅ ATTEMPT TO SEND - ONLY ONCE
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            result = loop.run_until_complete(
                send_to_mail_relay(outbox.kind, outbox.payload)
            )
            loop.close()
            
            message_id = result.get("messageId", "unknown")
            sent_timestamp = datetime.now(UTC)
            
            # ✅ MARK AS SENT
            outbox.sent_at = sent_timestamp
            
            if not hasattr(outbox, 'meta_data') or outbox.meta_data is None:
                outbox.meta_data = {}
            
            outbox.meta_data["message_id"] = message_id
            outbox.meta_data["sent_successfully"] = True
            outbox.meta_data["sent_timestamp"] = sent_timestamp.isoformat()
            
            flag_modified(outbox, "meta_data")
            
            session.commit()
            logger.info(f"✅ Outbox #{outbox.id} sent successfully: {message_id}")
            
            # Update campaign if applicable
            if outbox.kind.startswith("campaign."):
                result_id = outbox.payload.get("result_id")
                campaign_id = outbox.payload.get("campaign_id")
                
                if result_id:
                    update_campaign_result_sent(
                        session,
                        result_id,
                        sent_timestamp,
                        message_id
                    )
                
                if campaign_id:
                    check_campaign_completion(session, campaign_id)
                
                session.commit()
            
            return ProcessingResult(success=True, message_id=message_id)
            
        except Exception as e:
            # ✅ FAILED - BUT MARK AS PROCESSED (NO RETRY)
            error_msg = str(e)[:500]
            
            logger.error(f"❌ Outbox #{outbox.id} failed: {error_msg} - SKIPPING (no retry)")
            
            # Mark as sent (processed) even though it failed
            outbox.sent_at = datetime.now(UTC)
            
            if not hasattr(outbox, 'meta_data') or outbox.meta_data is None:
                outbox.meta_data = {}
            
            outbox.meta_data["failed"] = True
            outbox.meta_data["failure_reason"] = error_msg
            outbox.meta_data["attempt_timestamp"] = datetime.now(UTC).isoformat()
            
            flag_modified(outbox, "meta_data")
            session.commit()
            
            # Update campaign result as failed
            if outbox.kind.startswith("campaign."):
                result_id = outbox.payload.get("result_id")
                campaign_id = outbox.payload.get("campaign_id")
                
                if result_id:
                    update_campaign_result_failed(session, result_id, error_msg)
                
                if campaign_id:
                    check_campaign_completion(session, campaign_id)
                
                session.commit()
            
            return ProcessingResult(success=False, error=error_msg)
    
    except Exception as e:
        logger.error(f"❌ Unexpected error in outbox #{outbox.id}: {e}", exc_info=True)
        session.rollback()
        return ProcessingResult(success=False, error=f"Unexpected: {str(e)[:200]}")


# ============================================
# BATCH PROCESSING
# ============================================

def process_batch(batch_size: int = 25) -> dict:
    """Process a batch of outbox messages - single attempt each"""
    global consecutive_errors, is_processing
    
    if is_processing:
        return {"skipped": True, "reason": "already_processing"}
    
    is_processing = True
    session = None
    
    try:
        session = SessionLocal()
        
        messages = session.query(Outbox).filter(
            Outbox.sent_at.is_(None)
        ).order_by(
            Outbox.created_at.asc()
        ).limit(batch_size).with_for_update(skip_locked=True).all()
        
        if not messages:
            consecutive_errors = 0
            return {"processed": 0, "success": 0, "failed": 0}
        
        success_count = 0
        failed_count = 0
        
        for msg in messages:
            try:
                result = process_outbox_message(session, msg)
                
                if result.success:
                    success_count += 1
                else:
                    failed_count += 1
                
            except Exception as e:
                session.rollback()
                logger.error(f"❌ Error processing message #{msg.id}: {e}", exc_info=True)
                failed_count += 1
                session = SessionLocal()
        
        if success_count > 0:
            consecutive_errors = 0
        
        # Check campaigns for completion
        check_all_campaigns_for_completion(session)
        
        result = {
            "processed": len(messages),
            "success": success_count,
            "failed": failed_count
        }
        
        return result
        
    except Exception as e:
        consecutive_errors += 1
        
        if consecutive_errors >= 10:
            logger.critical(
                f"🚨 CRITICAL: {consecutive_errors} consecutive errors! "
                f"Outbox processor may need restart"
            )
        
        return {
            "error": str(e), 
            "consecutive_errors": consecutive_errors,
            "processed": 0,
            "success": 0,
            "failed": 0
        }
        
    finally:
        is_processing = False
        if session:
            session.close()


def check_all_campaigns_for_completion(session: Session):
    """Check all campaigns in 'sending' status and complete them if done"""
    try:
        sending_campaigns = session.query(Campaign).filter(
            Campaign.status == CampaignStatus.sending
        ).all()
        
        if not sending_campaigns:
            return
        
        logger.debug(f"🔍 Checking {len(sending_campaigns)} sending campaign(s)...")
        
        completed_count = 0
        
        for campaign in sending_campaigns:
            try:
                pending_count = session.query(CampaignResult).filter(
                    CampaignResult.campaign_id == campaign.campaign_id,
                    CampaignResult.status.in_([
                        RecipientStatus.queued,
                        RecipientStatus.pending
                    ])
                ).count()
                
                if pending_count == 0:
                    campaign.status = CampaignStatus.completed
                    campaign.completed_at = datetime.now(UTC)
                    completed_count += 1
                    
                    total_results = session.query(CampaignResult).filter(
                        CampaignResult.campaign_id == campaign.campaign_id
                    ).count()
                    
                    logger.info(
                        f"🎉 Campaign {campaign.campaign_id} COMPLETED! "
                        f"Total: {total_results}, "
                        f"Sent: {campaign.sent_count or 0}, "
                        f"Failed: {campaign.failed_count or 0}"
                    )
            
            except Exception as e:
                logger.error(f"❌ Error checking campaign {campaign.campaign_id}: {e}")
        
        if completed_count > 0:
            session.flush()
            logger.info(f"✅ Marked {completed_count} campaign(s) as completed")
    
    except Exception as e:
        logger.error(f"❌ Error in check_all_campaigns_for_completion: {e}", exc_info=True)


# ============================================
# MAIN PROCESSOR LOOP
# ============================================

def run_forever(poll_interval: float = 2.0, batch_size: int = 25):
    """Run outbox processor continuously - single attempt mode"""
    global consecutive_errors
    
    logger.info("🚀 Single-attempt outbox processor started")
    logger.info(f"   ⚙️  Batch size: {batch_size}")
    logger.info(f"   ⏱️  Poll interval: {poll_interval}s")
    logger.info(f"   🎯 SINGLE ATTEMPT MODE - No retries")
    
    iteration = 0
    max_consecutive_errors = 10
    
    while True:
        try:
            iteration += 1
            
            result = process_batch(batch_size=batch_size)
            
            if "error" in result:
                logger.error(
                    f"⚠️  Consecutive errors: "
                    f"{consecutive_errors}/{max_consecutive_errors}"
                )
                
                if consecutive_errors >= max_consecutive_errors:
                    logger.critical("🚨 Too many errors, backing off...")
                    time.sleep(poll_interval * 5)
                    consecutive_errors = 0
            else:
                consecutive_errors = 0
            
            if result.get("processed", 0) > 0:
                logger.info(
                    f"[#{iteration}] "
                    f"✅ {result['success']} sent | "
                    f"❌ {result['failed']} failed (skipped)"
                )
            else:
                logger.debug(f"[#{iteration}] Queue empty, sleeping...")
        
        except KeyboardInterrupt:
            logger.info("🛑 Gracefully shutting down...")
            break
        
        except Exception as e:
            consecutive_errors += 1
            logger.error(f"❌ Critical error: {e}", exc_info=True)
            
            if consecutive_errors >= max_consecutive_errors:
                logger.critical("🚨 Too many errors, sleeping 30s...")
                time.sleep(30)
                consecutive_errors = 0
        
        time.sleep(poll_interval)


# ============================================
# STATISTICS & MONITORING
# ============================================

def get_outbox_stats() -> dict:
    """Get comprehensive outbox statistics"""
    import sqlalchemy as sa
    
    with SessionLocal() as session:
        pending = session.execute(
            sa.select(sa.func.count(Outbox.id)).where(
                Outbox.sent_at.is_(None)
            )
        ).scalar() or 0
        
        sent = session.execute(
            sa.select(sa.func.count(Outbox.id)).where(
                and_(
                    Outbox.sent_at.isnot(None),
                    or_(
                        Outbox.meta_data.is_(None),
                        Outbox.meta_data['failed'].astext != 'true'
                    )
                )
            )
        ).scalar() or 0
        
        failed = session.execute(
            sa.select(sa.func.count(Outbox.id)).where(
                and_(
                    Outbox.sent_at.isnot(None),
                    Outbox.meta_data['failed'].astext == 'true'
                )
            )
        ).scalar() or 0
        
        return {
            "pending": pending,
            "sent": sent,
            "failed": failed,
            "total": pending + sent + failed,
            "timestamp": datetime.now(UTC).isoformat()
        }