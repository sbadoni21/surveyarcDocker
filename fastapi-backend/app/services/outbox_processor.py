# ============================================
# SMART FAIL-SAFE OUTBOX PROCESSOR V3 (CORRECTED)
# app/services/outbox_processor_v3.py
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
from typing import Optional, Tuple
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

MAX_RETRY_ATTEMPTS = 2
RETRY_BACKOFF_MINUTES = [5, 15]
PROCESSING_TIMEOUT_MINUTES = 10
PERMANENT_ERROR_CODES = [400, 401, 403, 404, 422]
TEMPORARY_ERROR_CODES = [429, 500, 502, 503, 504]

# ✅ FIXED: Initialize global variables
consecutive_errors = 0
is_processing = False

logger.info(f"📧 Mail Relay URL: {MAIL_RELAY_URL}")
logger.info(f"🔄 Smart Retries: {MAX_RETRY_ATTEMPTS} attempts only")
logger.info(f"⏰ Retry Backoff: {RETRY_BACKOFF_MINUTES} minutes")


# ============================================
# ERROR CLASSIFICATION
# ============================================

class ErrorType(str, Enum):
    PERMANENT = "permanent"
    TEMPORARY = "temporary"
    UNKNOWN = "unknown"


class ProcessingResult:
    def __init__(
        self,
        success: bool,
        message_id: Optional[str] = None,
        error: Optional[str] = None,
        error_type: ErrorType = ErrorType.UNKNOWN,
        should_retry: bool = False
    ):
        self.success = success
        self.message_id = message_id
        self.error = error
        self.error_type = error_type
        self.should_retry = should_retry


def classify_error(exception: Exception) -> ErrorType:
    """Classify error to determine retry strategy"""
    error_str = str(exception).lower()
    
    if isinstance(exception, httpx.HTTPStatusError):
        status = exception.response.status_code
        
        if status in PERMANENT_ERROR_CODES:
            return ErrorType.PERMANENT
        
        if status in TEMPORARY_ERROR_CODES:
            return ErrorType.TEMPORARY
        
        if 500 <= status < 600:
            return ErrorType.TEMPORARY
    
    if isinstance(exception, (
        httpx.TimeoutException,
        httpx.NetworkError,
        httpx.ConnectError,
        httpx.ReadTimeout,
        httpx.WriteTimeout,
        httpx.PoolTimeout
    )):
        return ErrorType.TEMPORARY
    
    permanent_patterns = [
        "invalid email", "malformed", "authentication failed",
        "unauthorized", "forbidden", "not found", "bad request",
        "validation error"
    ]
    if any(pattern in error_str for pattern in permanent_patterns):
        return ErrorType.PERMANENT
    
    temporary_patterns = [
        "timeout", "connection", "network", "temporary",
        "rate limit", "service unavailable", "too many requests", "gateway"
    ]
    if any(pattern in error_str for pattern in temporary_patterns):
        return ErrorType.TEMPORARY
    
    return ErrorType.UNKNOWN


# ============================================
# MAIL RELAY COMMUNICATION
# ============================================

async def send_to_mail_relay(kind: str, payload: dict) -> dict:
    """Send message to mail relay service"""
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
# RETRY LOGIC
# ============================================

def should_retry_message(outbox: Outbox, error_type: ErrorType) -> Tuple[bool, Optional[datetime]]:
    """Determine if message should be retried"""
    # ✅ FIXED: Safely get meta_data
    meta_data = getattr(outbox, 'meta_data', None) or {}
    retry_count = meta_data.get("retry_count", 0)
    
    if error_type == ErrorType.PERMANENT:
        logger.info(f"⛔ Permanent error - outbox #{outbox.id} will not retry")
        return False, None
    
    if retry_count >= MAX_RETRY_ATTEMPTS:
        logger.info(f"⛔ Max retries ({MAX_RETRY_ATTEMPTS}) reached for outbox #{outbox.id}")
        return False, None
    
    if retry_count < len(RETRY_BACKOFF_MINUTES):
        backoff_minutes = RETRY_BACKOFF_MINUTES[retry_count]
    else:
        backoff_minutes = RETRY_BACKOFF_MINUTES[-1]
    
    retry_at = datetime.now(UTC) + timedelta(minutes=backoff_minutes)
    
    logger.info(
        f"🔄 Outbox #{outbox.id} will retry in {backoff_minutes}min "
        f"(attempt {retry_count + 1}/{MAX_RETRY_ATTEMPTS})"
    )
    
    return True, retry_at


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
    """Update CampaignResult when message permanently fails"""
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
        result.retry_count = (result.retry_count or 0) + 1
        
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
    """
    ✅ ENHANCED: Check if campaign should be marked as completed
    More aggressive completion checking
    """
    try:
        campaign = session.query(Campaign).filter(
            Campaign.campaign_id == campaign_id
        ).with_for_update().first()
        
        if not campaign:
            return
        
        # Only check campaigns in "sending" status
        if campaign.status != CampaignStatus.sending:
            return
        
        # Count remaining pending/queued results
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
            # ✅ All messages processed - mark campaign as completed
            campaign.status = CampaignStatus.completed
            campaign.completed_at = datetime.now(UTC)
            
            # Calculate final stats
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
# CORE PROCESSING LOGIC
# ============================================

def process_outbox_message(session: Session, outbox: Outbox) -> ProcessingResult:
    """Process a single outbox message with smart retry logic"""
    try:
        session.refresh(outbox)
        
        if outbox.sent_at is not None:
            logger.info(f"⏭️  Outbox #{outbox.id} already sent - skipping")
            return ProcessingResult(success=True, message_id="already-sent")
        
        # ✅ FIXED: Safely check if meta_data attribute exists
        meta_data = getattr(outbox, 'meta_data', None) or {}
        
        # ✅ FIXED: Safely check if meta_data attribute exists
        meta_data = getattr(outbox, 'meta_data', None) or {}
        
        if meta_data:
            retry_at_str = meta_data.get("retry_at")
            if retry_at_str:
                retry_at = datetime.fromisoformat(retry_at_str)
                if retry_at > datetime.now(UTC):
                    logger.debug(f"⏰ Outbox #{outbox.id} scheduled for {retry_at}")
                    return ProcessingResult(
                        success=False,
                        should_retry=True,
                        error="Scheduled for future"
                    )
            
            retry_count = meta_data.get("retry_count", 0)
            if retry_count >= MAX_RETRY_ATTEMPTS:
                logger.error(f"⛔ Outbox #{outbox.id} max retries exceeded")
                
                outbox.sent_at = datetime.now(UTC)
                if not hasattr(outbox, 'meta_data'):
                    outbox.meta_data = {}
                outbox.meta_data["failed"] = True
                outbox.meta_data["failure_reason"] = "Max retries exceeded"
                flag_modified(outbox, "meta_data")
                
                if outbox.kind.startswith("campaign."):
                    result_id = outbox.payload.get("result_id")
                    campaign_id = outbox.payload.get("campaign_id")
                    
                    if result_id:
                        update_campaign_result_failed(
                            session,
                            result_id,
                            "Max retries exceeded after 2 attempts"
                        )
                    
                    if campaign_id:
                        check_campaign_completion(session, campaign_id)
                
                session.commit()
                
                return ProcessingResult(
                    success=False,
                    error="Max retries exceeded",
                    error_type=ErrorType.PERMANENT
                )
        
        # ✅ FIXED: Safely get retry count
        attempt = (meta_data.get("retry_count", 0) if meta_data else 0) + 1
        logger.info(f"📤 Processing outbox #{outbox.id} (attempt {attempt}/{MAX_RETRY_ATTEMPTS}): {outbox.kind}")
        
        import asyncio
        
        try:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            result = loop.run_until_complete(
                send_to_mail_relay(outbox.kind, outbox.payload)
            )
            loop.close()
            
            message_id = result.get("messageId", "unknown")
            sent_timestamp = datetime.now(UTC)
            
            outbox.sent_at = sent_timestamp
            
            # ✅ FIXED: Safely handle meta_data attribute
            if not hasattr(outbox, 'meta_data') or outbox.meta_data is None:
                outbox.meta_data = {}
            
            outbox.meta_data["message_id"] = message_id
            outbox.meta_data["sent_successfully"] = True
            outbox.meta_data["sent_timestamp"] = sent_timestamp.isoformat()
            
            if "processing_started" in outbox.meta_data:
                del outbox.meta_data["processing_started"]
            
            flag_modified(outbox, "meta_data")
            
            try:
                session.commit()
                logger.info(f"✅ Outbox #{outbox.id} committed as sent: {message_id}")
            except Exception as commit_error:
                logger.error(f"❌ Failed to commit: {commit_error}")
                session.rollback()
                logger.critical(
                    f"🚨 MESSAGE SENT BUT COMMIT FAILED: "
                    f"outbox_id={outbox.id}, message_id={message_id}"
                )
                raise
            
            # ✅ ENHANCED: Update campaign and check completion immediately
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
                
                # ✅ CRITICAL: Check completion after EVERY successful send
                if campaign_id:
                    check_campaign_completion(session, campaign_id)
                
                session.commit()
                logger.info(f"✅ Outbox #{outbox.id} sent, campaign {campaign_id} checked")
            else:
                logger.info(f"✅ Outbox #{outbox.id} sent successfully: {message_id}")
            
            return ProcessingResult(success=True, message_id=message_id)
            
        except Exception as e:
            error_type = classify_error(e)
            error_msg = str(e)[:500]
            
            logger.error(
                f"❌ Outbox #{outbox.id} failed: {error_msg} "
                f"(type: {error_type.value})"
            )
            
            should_retry, retry_at = should_retry_message(outbox, error_type)
            
            # ✅ FIXED: Safely handle meta_data
            if not hasattr(outbox, 'meta_data') or outbox.meta_data is None:
                outbox.meta_data = {}
            
            retry_count = outbox.meta_data.get("retry_count", 0)
            outbox.meta_data["retry_count"] = retry_count + 1
            outbox.meta_data["last_error"] = error_msg
            outbox.meta_data["error_type"] = error_type.value
            outbox.meta_data["last_attempt"] = datetime.now(UTC).isoformat()
            
            if should_retry and retry_at:
                outbox.meta_data["retry_at"] = retry_at.isoformat()
                logger.info(f"🔄 Will retry at {retry_at}")
            else:
                outbox.sent_at = datetime.now(UTC)
                outbox.meta_data["failed"] = True
                outbox.meta_data["failure_reason"] = error_msg
                
                # Update campaign result
                if outbox.kind.startswith("campaign."):
                    result_id = outbox.payload.get("result_id")
                    campaign_id = outbox.payload.get("campaign_id")
                    
                    if result_id:
                        update_campaign_result_failed(session, result_id, error_msg)
                    
                    # ✅ CRITICAL: Check completion even after failures
                    if campaign_id:
                        check_campaign_completion(session, campaign_id)
            
            if "processing_started" in outbox.meta_data:
                del outbox.meta_data["processing_started"]
            
            flag_modified(outbox, "meta_data")
            session.commit()
            
            return ProcessingResult(
                success=False,
                error=error_msg,
                error_type=error_type,
                should_retry=should_retry
            )
    
    except Exception as e:
        logger.error(f"❌ Unexpected error in outbox #{outbox.id}: {e}", exc_info=True)
        session.rollback()
        return ProcessingResult(
            success=False,
            error=f"Unexpected: {str(e)[:200]}",
            error_type=ErrorType.UNKNOWN,
            should_retry=False
        )


# ============================================
# STUCK MESSAGE RECOVERY
# ============================================

def reset_stuck_messages(session: Session, timeout_minutes: int = 30) -> int:
    """Reset messages stuck in processing state"""
    timeout_threshold = datetime.now(timezone.utc) - timedelta(minutes=timeout_minutes)
    
    try:
        stuck_messages = session.query(Outbox).filter(
            Outbox.sent_at.is_(None),
            Outbox.created_at < timeout_threshold
        ).all()
        
        reset_count = 0
        for msg in stuck_messages:
            logger.warning(
                f"⚠️  Stuck message found: #{msg.id} (kind: {msg.kind}, "
                f"age: {(datetime.now(timezone.utc) - msg.created_at).total_seconds() / 60:.1f} minutes)"
            )
            reset_count += 1
        
        if reset_count > 0:
            logger.info(f"🔄 Found {reset_count} stuck message(s)")
        
        return reset_count
        
    except Exception as e:
        logger.error(f"❌ Error checking stuck messages: {e}", exc_info=True)
        return 0


# ============================================
# BATCH PROCESSING
# ============================================

def process_batch(batch_size: int = 25) -> dict:
    """
    ✅ FIXED: Process a batch of outbox messages (synchronous)
    """
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
            return {"processed": 0, "success": 0, "failed": 0, "retrying": 0}
        
        
        success_count = 0
        failed_count = 0
        retrying_count = 0
        
        for msg in messages:
            try:
                # ✅ FIXED: Call the correct function
                result = process_outbox_message(session, msg)
                
                if result.success:
                    success_count += 1
                elif result.should_retry:
                    retrying_count += 1
                else:
                    failed_count += 1
                
            except Exception as e:
                session.rollback()
                logger.error(
                    f"❌ Error processing message #{msg.id}: {e}",
                    exc_info=True
                )
                failed_count += 1
                # Recreate session after rollback
                session = SessionLocal()
        
        if success_count > 0:
            consecutive_errors = 0
        
        # ✅ NEW: Check all campaigns for completion after batch
        check_all_campaigns_for_completion(session)
        
        result = {
            "processed": len(messages),
            "success": success_count,
            "failed": failed_count,
            "retrying": retrying_count
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
            "failed": 0,
            "retrying": 0
        }
        
    finally:
        is_processing = False
        if session:
            session.close()


# ============================================
# MAIN PROCESSOR LOOP
# ============================================

def run_forever(poll_interval: float = 2.0, batch_size: int = 25):
    """Run outbox processor continuously"""
    global consecutive_errors
    
    logger.info("🚀 Smart fail-safe outbox processor v3 started")
    logger.info(f"   ⚙️  Batch size: {batch_size}")
    logger.info(f"   ⏱️  Poll interval: {poll_interval}s")
    logger.info(f"   🔄 Max retries: {MAX_RETRY_ATTEMPTS} (SMART MODE)")
    logger.info(f"   ⏰ Retry backoff: {RETRY_BACKOFF_MINUTES} min")
    
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
            
            # ✅ FIXED: Access correct keys
            if result.get("processed", 0) > 0:
                logger.info(
                    f"[#{iteration}] "
                    f"✅ {result['success']} sent | "
                    f"🔄 {result['retrying']} retrying | "
                    f"❌ {result['failed']} failed"
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
# Add this function to your outbox_processor.py file
# Place it after the check_campaign_completion function

def check_all_campaigns_for_completion(session: Session):
    """
    Check all campaigns in 'sending' status and complete them if done
    This is called after each batch to ensure campaigns are marked complete ASAP
    """
    try:
        sending_campaigns = session.query(Campaign).filter(
            Campaign.status == CampaignStatus.sending
        ).all()
        
        if not sending_campaigns:
            logger.debug("No campaigns in 'sending' status to check")
            return
        
        logger.debug(f"🔍 Checking {len(sending_campaigns)} sending campaign(s) for completion...")
        
        completed_count = 0
        
        for campaign in sending_campaigns:
            try:
                # Count remaining pending/queued results
                pending_count = session.query(CampaignResult).filter(
                    CampaignResult.campaign_id == campaign.campaign_id,
                    CampaignResult.status.in_([
                        RecipientStatus.queued,
                        RecipientStatus.pending
                    ])
                ).count()
                
                if pending_count == 0:
                    # All messages processed - mark campaign as completed
                    campaign.status = CampaignStatus.completed
                    campaign.completed_at = datetime.now(UTC)
                    
                    completed_count += 1
                    
                    # Calculate final stats
                    total_results = session.query(CampaignResult).filter(
                        CampaignResult.campaign_id == campaign.campaign_id
                    ).count()
                    
                    logger.info(
                        f"🎉 Campaign {campaign.campaign_id} ({campaign.campaign_name}) COMPLETED! "
                        f"Total: {total_results}, "
                        f"Sent: {campaign.sent_count or 0}, "
                        f"Delivered: {campaign.delivered_count or 0}, "
                        f"Failed: {campaign.failed_count or 0}"
                    )
                else:
                    logger.debug(
                        f"Campaign {campaign.campaign_id} still has {pending_count} pending results"
                    )
            
            except Exception as e:
                logger.error(
                    f"❌ Error checking campaign {campaign.campaign_id}: {e}",
                    exc_info=True
                )
        
        if completed_count > 0:
            session.flush()
            logger.info(f"✅ Marked {completed_count} campaign(s) as completed")
    
    except Exception as e:
        logger.error(f"❌ Error in check_all_campaigns_for_completion: {e}", exc_info=True)

# ============================================
# STATISTICS & MONITORING
# ============================================

def get_outbox_stats() -> dict:
    """Get comprehensive outbox statistics"""
    import sqlalchemy as sa
    
    with SessionLocal() as session:
        now = datetime.now(UTC)
        
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
        
        retrying = session.execute(
            sa.select(sa.func.count(Outbox.id)).where(
                and_(
                    Outbox.sent_at.is_(None),
                    Outbox.meta_data['retry_at'].astext.isnot(None),
                    cast(Outbox.meta_data['retry_at'].astext, DateTime) > now
                )
            )
        ).scalar() or 0
        
        return {
            "pending": pending,
            "sent": sent,
            "failed_permanently": failed,
            "retrying": retrying,
            "total": pending + sent + failed,
            "timestamp": datetime.now(UTC).isoformat()
        }