# ============================================
# FIXED OUTBOX PROCESSOR WITH HEALTH CHECKS
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
from sqlalchemy import and_, or_
from typing import Optional

from ..db import SessionLocal
from ..models.outbox import Outbox
from ..models.campaigns import (
    Campaign, 
    RecipientStatus,
    CampaignStatus
)
from ..models.campaign_result import CampaignResult


# ============================================
# CONFIGURATION
# ============================================

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

MAIL_RELAY_URL = "http://localhost:4001"
MAIL_API_TOKEN =  "supersecrettoken"
UTC = timezone.utc

MAX_RETRY_ATTEMPTS = 0  # Single attempt only
PROCESSING_TIMEOUT_MINUTES = 10
HEALTH_CHECK_INTERVAL = 30  # Check health every 30 seconds

consecutive_errors = 0
is_processing = False
last_health_check = None
relay_is_healthy = False

logger.info(f"📧 Mail Relay URL: {MAIL_RELAY_URL}")
logger.info(f"🎯 SINGLE ATTEMPT MODE - No retries")


# ============================================
# HEALTH CHECK
# ============================================

async def check_relay_health() -> bool:
    """Check if mail relay is accessible"""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            # Try to reach the relay service (you may need to adjust endpoint)
            response = await client.get(
                f"{MAIL_RELAY_URL}/health",
                headers={"Authorization": f"Bearer {MAIL_API_TOKEN}"} if MAIL_API_TOKEN else {}
            )
            return response.status_code == 200
    except Exception as e:
        logger.warning(f"⚠️  Mail relay health check failed: {e}")
        return False


def should_check_health() -> bool:
    """Check if we should run health check"""
    global last_health_check
    if last_health_check is None:
        return True
    
    elapsed = (datetime.now(UTC) - last_health_check).total_seconds()
    return elapsed >= HEALTH_CHECK_INTERVAL


async def update_relay_health():
    """Update relay health status"""
    global relay_is_healthy, last_health_check
    
    relay_is_healthy = await check_relay_health()
    last_health_check = datetime.now(UTC)
    
    if relay_is_healthy:
        logger.info("✅ Mail relay is healthy")
    else:
        logger.error("❌ Mail relay is NOT reachable!")
    
    return relay_is_healthy


# ============================================
# PROCESSING RESULT
# ============================================

class ProcessingResult:
    def __init__(
        self,
        success: bool,
        message_id: Optional[str] = None,
        error: Optional[str] = None,
        should_skip: bool = False
    ):
        self.success = success
        self.message_id = message_id
        self.error = error
        self.should_skip = should_skip  # If True, don't mark as processed


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
            
    except httpx.ConnectError as e:
        # Connection failed - relay might be down
        error_msg = f"Connection failed: {str(e)[:100]}"
        logger.error(f"🔌 {error_msg} - Mail relay may be down!")
        raise ConnectionError(error_msg) from e
        
    except httpx.HTTPStatusError as e:
        error_msg = f"HTTP {e.response.status_code}: {e.response.text[:200]}"
        logger.error(f"❌ {error_msg}")
        raise Exception(error_msg) from e
        
    except httpx.TimeoutException as e:
        error_msg = "Request timeout (30s)"
        logger.error(f"⏱️  {error_msg}")
        raise Exception(error_msg) from e
        
    except Exception as e:
        error_msg = f"Unexpected error: {str(e)[:100]}"
        logger.error(f"❌ {error_msg}")
        raise Exception(error_msg) from e


def update_b2b_result_sent(
    session: Session,
    result_id: str,
    sent_at: datetime,
    message_id: Optional[str] = None
):
    """Update B2B CampaignResult to DELIVERED"""
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
        
        logger.debug(f"✅ B2B Result {result_id} → delivered")
        
        # Update campaign stats
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
        logger.error(f"❌ Error updating B2B result {result_id}: {e}", exc_info=True)


def update_b2b_result_failed(
    session: Session,
    result_id: str,
    error_message: str
):
    """Update B2B CampaignResult when message fails"""
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
        result.retry_count = 1
        
        logger.debug(f"❌ B2B Result {result_id} → failed")
        
        # Update campaign stats
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
        result.retry_count = 1
        
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
            f"📊 Campaign {campaign_id}: {pending_count} pending/queued results"
        )
        
        if pending_count == 0:
            campaign.status = CampaignStatus.completed
            campaign.completed_at = datetime.now(UTC)
            
            total = session.query(CampaignResult).filter(
                CampaignResult.campaign_id == campaign_id
            ).count()
            
            logger.info(
                f"🎉 Campaign {campaign_id} COMPLETED! "
                f"Total: {total}, "
                f"Delivered: {campaign.delivered_count or 0}, "
                f"Failed: {campaign.failed_count or 0}"
            )
            
            session.flush()
    
    except Exception as e:
        logger.error(f"❌ Error checking completion: {e}", exc_info=True)


# ============================================
# CORE PROCESSING - WITH CONNECTION HANDLING
# ============================================

def process_outbox_message(session: Session, outbox: Outbox) -> ProcessingResult:
    """
    Process outbox message - single attempt
    Returns should_skip=True if relay is down (don't mark as processed)
    """
    try:
        session.refresh(outbox)
        
        if outbox.sent_at is not None:
            logger.info(f"⏭️  Outbox #{outbox.id} already processed")
            return ProcessingResult(success=True, message_id="already-processed")
        
        logger.info(f"📤 Processing outbox #{outbox.id}: {outbox.kind}")
        
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
            
            # ✅ SUCCESS - Mark as sent
            outbox.sent_at = sent_timestamp
            
            if not hasattr(outbox, 'meta_data') or outbox.meta_data is None:
                outbox.meta_data = {}
            
            outbox.meta_data["message_id"] = message_id
            outbox.meta_data["sent_successfully"] = True
            outbox.meta_data["sent_timestamp"] = sent_timestamp.isoformat()
            
            flag_modified(outbox, "meta_data")
            session.commit()
            
            logger.info(f"✅ Outbox #{outbox.id} sent: {message_id}")
            
            # Update campaign
            if outbox.kind.startswith("campaign."):
                result_id = outbox.payload.get("result_id")
                campaign_id = outbox.payload.get("campaign_id")
                
                if result_id:
                    update_campaign_result_sent(
                        session, result_id, sent_timestamp, message_id
                    )
                
                if campaign_id:
                    check_campaign_completion(session, campaign_id)
                
                session.commit()
            
            return ProcessingResult(success=True, message_id=message_id)
            
        except ConnectionError as e:
            # 🔌 CONNECTION FAILED - Don't mark as processed, skip for now
            error_msg = str(e)[:500]
            logger.error(
                f"🔌 Outbox #{outbox.id} - Connection failed: {error_msg}"
            )
            logger.warning("⚠️  Message NOT marked as processed - will retry later")
            
            # DON'T commit, DON'T set sent_at
            session.rollback()
            
            return ProcessingResult(
                success=False,
                error=error_msg,
                should_skip=True  # Skip this batch, try again later
            )
            
        except Exception as e:
            # ❌ OTHER ERROR - Mark as permanently failed
            error_msg = str(e)[:500]
            logger.error(f"❌ Outbox #{outbox.id} failed: {error_msg}")
            
            # Mark as processed (failed)
            outbox.sent_at = datetime.now(UTC)
            
            if not hasattr(outbox, 'meta_data') or outbox.meta_data is None:
                outbox.meta_data = {}
            
            outbox.meta_data["failed"] = True
            outbox.meta_data["failure_reason"] = error_msg
            outbox.meta_data["attempt_timestamp"] = datetime.now(UTC).isoformat()
            
            flag_modified(outbox, "meta_data")
            session.commit()
            
            # Update campaign as failed
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
        logger.error(f"❌ Unexpected error: {e}", exc_info=True)
        session.rollback()
        return ProcessingResult(
            success=False,
            error=f"Unexpected: {str(e)[:200]}",
            should_skip=True
        )


# ============================================
# BATCH PROCESSING WITH HEALTH CHECKS
# ============================================

def process_batch(batch_size: int = 25) -> dict:
    """Process batch with health checking"""
    global consecutive_errors, is_processing, relay_is_healthy
    
    if is_processing:
        return {"skipped": True, "reason": "already_processing"}
    
    is_processing = True
    session = None
    
    try:
        # Check relay health periodically
        if should_check_health():
            import asyncio
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            loop.run_until_complete(update_relay_health())
            loop.close()
        
        # If relay is known to be down, skip processing
        if not relay_is_healthy:
            logger.warning("⚠️  Skipping batch - relay is down")
            return {
                "skipped": True,
                "reason": "relay_down",
                "processed": 0,
                "success": 0,
                "failed": 0
            }
        
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
        connection_errors = 0
        
        for msg in messages:
            try:
                result = process_outbox_message(session, msg)
                
                if result.should_skip:
                    # Connection error - stop processing this batch
                    connection_errors += 1
                    if connection_errors >= 3:
                        logger.error("🔌 Multiple connection failures - stopping batch")
                        relay_is_healthy = False
                        break
                elif result.success:
                    success_count += 1
                else:
                    failed_count += 1
                
            except Exception as e:
                session.rollback()
                logger.error(f"❌ Error processing #{msg.id}: {e}", exc_info=True)
                failed_count += 1
                session = SessionLocal()
        
        if success_count > 0:
            consecutive_errors = 0
        
        return {
            "processed": success_count + failed_count,
            "success": success_count,
            "failed": failed_count,
            "connection_errors": connection_errors
        }
        
    except Exception as e:
        consecutive_errors += 1
        logger.error(f"❌ Batch error: {e}", exc_info=True)
        
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


# ============================================
# MAIN LOOP
# ============================================

def run_forever(poll_interval: float = 2.0, batch_size: int = 25):
    """Run processor with health monitoring"""
    global consecutive_errors
    
    logger.info("🚀 Outbox processor started with health checks")
    logger.info(f"   ⚙️  Batch size: {batch_size}")
    logger.info(f"   ⏱️  Poll interval: {poll_interval}s")
    logger.info(f"   🏥 Health check interval: {HEALTH_CHECK_INTERVAL}s")
    
    iteration = 0
    
    while True:
        try:
            iteration += 1
            result = process_batch(batch_size=batch_size)
            
            if result.get("skipped"):
                reason = result.get("reason", "unknown")
                if reason == "relay_down":
                    logger.warning(
                        f"[#{iteration}] ⏸️  Paused - waiting for relay to recover"
                    )
                    time.sleep(poll_interval * 3)  # Wait longer
                continue
            
            if result.get("processed", 0) > 0:
                logger.info(
                    f"[#{iteration}] "
                    f"✅ {result['success']} sent | "
                    f"❌ {result['failed']} failed"
                )
                
                if result.get("connection_errors", 0) > 0:
                    logger.warning(
                        f"   🔌 {result['connection_errors']} connection errors"
                    )
            else:
                logger.debug(f"[#{iteration}] Queue empty")
        
        except KeyboardInterrupt:
            logger.info("🛑 Shutting down...")
            break
        
        except Exception as e:
            consecutive_errors += 1
            logger.error(f"❌ Critical error: {e}", exc_info=True)
        
        time.sleep(poll_interval)


# ============================================
# STATS
# ============================================

def get_outbox_stats() -> dict:
    """Get outbox statistics"""
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
            "relay_healthy": relay_is_healthy,
            "timestamp": datetime.now(UTC).isoformat()
        }


if __name__ == "__main__":
    run_forever()