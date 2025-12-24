# ============================================
# UNIFIED OUTBOX PROCESSOR - B2B + B2C SUPPORT
# app/services/outbox_processor_unified.py
# ============================================
"""
Unified outbox processor that handles BOTH:
- B2B campaigns (with CampaignResult updates)
- B2C campaigns (with CSV file updates)

Automatically detects campaign type from payload.b2c_mode flag.
"""

from __future__ import annotations
import os
import time
import logging
import httpx
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified
from sqlalchemy import and_, or_
from typing import Optional

from ..db import SessionLocal
from ..models.outbox import Outbox
from ..models.campaigns import Campaign, RecipientStatus, CampaignStatus
from ..models.campaign_result import CampaignResult

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

MAIL_RELAY_URL = os.getenv("MAIL_RELAY_URL", "http://localhost:4001")
MAIL_API_TOKEN = os.getenv("MAIL_API_TOKEN", "supersecrettoken")
UTC = timezone.utc

MAX_RETRY_ATTEMPTS = 0  # Single attempt only
HEALTH_CHECK_INTERVAL = 30

consecutive_errors = 0
is_processing = False
last_health_check = None
relay_is_healthy = False

logger.info("=" * 80)
logger.info("🚀 UNIFIED OUTBOX PROCESSOR - B2B + B2C SUPPORT")
logger.info("=" * 80)
logger.info(f"📧 Mail Relay URL: {MAIL_RELAY_URL}")
logger.info(f"🎯 Single attempt mode - No retries")
logger.info(f"🏥 Health check interval: {HEALTH_CHECK_INTERVAL}s")
logger.info("=" * 80)


# ============================================
# HEALTH CHECK
# ============================================

async def check_relay_health() -> bool:
    """Check if mail relay is accessible"""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
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
        self.should_skip = should_skip


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


# ============================================
# B2B CAMPAIGN RESULT UPDATES
# ============================================

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
            logger.warning(f"⚠️  B2B CampaignResult {result_id} not found")
            return
        
        if result.status == RecipientStatus.delivered:
            logger.debug(f"ℹ️  B2B Result {result_id} already delivered")
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
            
            channel_key = result.channel.value
            
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
            logger.warning(f"⚠️  B2B CampaignResult {result_id} not found")
            return
        
        if result.status == RecipientStatus.failed:
            logger.debug(f"ℹ️  B2B Result {result_id} already failed")
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
            
            channel_key = result.channel.value
            
            if channel_key not in campaign.channel_stats:
                campaign.channel_stats[channel_key] = {
                    "sent": 0, "delivered": 0, "opened": 0,
                    "clicked": 0, "bounced": 0, "failed": 0
                }
            
            campaign.channel_stats[channel_key]["failed"] += 1
            flag_modified(campaign, "channel_stats")
        
        session.flush()
        
    except Exception as e:
        logger.error(f"❌ Error updating B2B failed result {result_id}: {e}", exc_info=True)


# ============================================
# B2C CSV FILE UPDATES
# ============================================

def update_b2c_status_from_outbox(
    session: Session,
    campaign_id: str,
    tracking_token: str,
    status: str,
    message_id: Optional[str] = None,
    error: Optional[str] = None
):
    """
    Update CSV status when B2C outbox message is processed.
    
    This updates the CSV file stored for the campaign.
    """
    import csv
    import tempfile
    
    try:
        logger.debug(f"📝 Updating B2C CSV: {tracking_token} → {status}")
        
        # Get campaign and audience file
        campaign = session.query(Campaign).filter(
            Campaign.campaign_id == campaign_id
        ).first()
        
        if not campaign or not campaign.audience_file_id:
            logger.warning(f"⚠️  B2C Campaign or audience file not found: {campaign_id}")
            return
        
        from ..models.audience_file import AudienceFile
        
        audience_file = session.query(AudienceFile).filter(
            AudienceFile.id == campaign.audience_file_id
        ).first()
        
        if not audience_file:
            logger.warning(f"⚠️  Audience file not found: {campaign.audience_file_id}")
            return
        
        # Get file path (assumes file is in /tmp - adjust for your storage)
# ✅ RIGHT
        file_path = audience_file.storage_key
        
        if not os.path.exists(file_path):
            logger.warning(f"⚠️  CSV file not found: {file_path}")
            return
        
        # Update CSV file
        temp_path = file_path + ".tmp"
        
        with open(file_path, newline="", encoding="utf-8") as src, \
             open(temp_path, "w", newline="", encoding="utf-8") as dst:
            
            reader = csv.DictReader(src)
            writer = csv.DictWriter(dst, fieldnames=reader.fieldnames)
            writer.writeheader()
            
            for row in reader:
                if row.get("tracking_token") == tracking_token:
                    # Update this row
                    row["status"] = status
                    
                    if status in ["sent", "delivered"]:
                        row["sent_at"] = datetime.now(UTC).isoformat()
                        
                        if status == "delivered":
                            row["delivered_at"] = datetime.now(UTC).isoformat()
                    
                    if message_id:
                        row["message_id"] = message_id
                    
                    if error:
                        row["error"] = error[:500]
                
                writer.writerow(row)
        
        os.replace(temp_path, file_path)
        
        logger.debug(f"   ✅ B2C CSV updated for token: {tracking_token}")
        
    except Exception as e:
        logger.error(f"❌ Error updating B2C CSV: {e}", exc_info=True)


# ============================================
# CAMPAIGN COMPLETION CHECKER
# ============================================

def check_b2b_campaign_completion(session: Session, campaign_id: str):
    """Check if B2B campaign should be marked as completed"""
    try:
        campaign = session.query(Campaign).filter(
            Campaign.campaign_id == campaign_id
        ).with_for_update().first()
        
        if not campaign:
            return
        
        if campaign.status != CampaignStatus.sending:
            return
        
        # Only for B2B campaigns (check CampaignResult table)
        if campaign.audience_file_id:
            # This is B2C - skip
            return
        
        pending_count = session.query(CampaignResult).filter(
            CampaignResult.campaign_id == campaign_id,
            CampaignResult.status.in_([
                RecipientStatus.queued,
                RecipientStatus.pending
            ])
        ).count()
        
        logger.debug(
            f"📊 B2B Campaign {campaign_id}: {pending_count} pending/queued results"
        )
        
        if pending_count == 0:
            campaign.status = CampaignStatus.completed
            campaign.completed_at = datetime.now(UTC)
            
            total = session.query(CampaignResult).filter(
                CampaignResult.campaign_id == campaign_id
            ).count()
            
            logger.info(
                f"🎉 B2B Campaign {campaign_id} COMPLETED! "
                f"Total: {total}, "
                f"Delivered: {campaign.delivered_count or 0}, "
                f"Failed: {campaign.failed_count or 0}"
            )
            
            session.flush()
    
    except Exception as e:
        logger.error(f"❌ Error checking B2B completion: {e}", exc_info=True)


# ============================================
# CORE PROCESSING - UNIFIED B2B + B2C
# ============================================

def process_outbox_message(session: Session, outbox: Outbox) -> ProcessingResult:
    """
    Process outbox message - UNIFIED for both B2B and B2C.
    
    Detects campaign type from payload.b2c_mode flag:
    - B2B (b2c_mode=False): Updates CampaignResult table
    - B2C (b2c_mode=True): Updates CSV file
    """
    try:
        session.refresh(outbox)
        
        if outbox.sent_at is not None:
            logger.info(f"⏭️  Outbox #{outbox.id} already processed")
            return ProcessingResult(success=True, message_id="already-processed")
        
        # Detect campaign type
        is_b2c = outbox.payload.get("b2c_mode", False)
        campaign_type = "B2C" if is_b2c else "B2B"
        
        logger.info(
            f"📤 Processing outbox #{outbox.id}: {outbox.kind} ({campaign_type})"
        )
        
        import asyncio
        
        try:
            # Send email via relay
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            result = loop.run_until_complete(
                send_to_mail_relay(outbox.kind, outbox.payload)
            )
            loop.close()
            
            message_id = result.get("messageId", "unknown")
            sent_timestamp = datetime.now(UTC)
            
            # ✅ SUCCESS - Mark outbox as sent
            outbox.sent_at = sent_timestamp
            
            if not hasattr(outbox, 'meta_data') or outbox.meta_data is None:
                outbox.meta_data = {}
            
            outbox.meta_data["message_id"] = message_id
            outbox.meta_data["sent_successfully"] = True
            outbox.meta_data["sent_timestamp"] = sent_timestamp.isoformat()
            outbox.meta_data["b2c_mode"] = is_b2c
            
            flag_modified(outbox, "meta_data")
            session.commit()
            
            logger.info(f"✅ Outbox #{outbox.id} sent: {message_id}")
            
            # Update campaign tracking based on type
            if outbox.kind.startswith("campaign."):
                campaign_id = outbox.payload.get("campaign_id")
                
                if is_b2c:
                    # ===================================
                    # B2C: Update CSV file
                    # ===================================
                    tracking_token = outbox.payload.get("tracking_token")
                    
                    if tracking_token:
                        update_b2c_status_from_outbox(
                            session,
                            campaign_id,
                            tracking_token,
                            status="delivered",
                            message_id=message_id
                        )
                        logger.debug(f"   ✅ B2C CSV updated: {tracking_token}")
                    
                else:
                    # ===================================
                    # B2B: Update CampaignResult table
                    # ===================================
                    result_id = outbox.payload.get("result_id")
                    
                    if result_id:
                        update_b2b_result_sent(
                            session, result_id, sent_timestamp, message_id
                        )
                        logger.debug(f"   ✅ B2B CampaignResult updated: {result_id}")
                    
                    if campaign_id:
                        check_b2b_campaign_completion(session, campaign_id)
                    
                    session.commit()
            
            return ProcessingResult(success=True, message_id=message_id)
            
        except ConnectionError as e:
            # 🔌 CONNECTION FAILED - Don't mark as processed
            error_msg = str(e)[:500]
            logger.error(
                f"🔌 Outbox #{outbox.id} - Connection failed: {error_msg}"
            )
            logger.warning("⚠️  Message NOT marked as processed - will retry later")
            
            session.rollback()
            
            return ProcessingResult(
                success=False,
                error=error_msg,
                should_skip=True  # Skip batch, try again later
            )
            
        except Exception as e:
            # ❌ OTHER ERROR - Mark as permanently failed
            error_msg = str(e)[:500]
            logger.error(f"❌ Outbox #{outbox.id} failed: {error_msg}")
            
            # Mark outbox as processed (failed)
            outbox.sent_at = datetime.now(UTC)
            
            if not hasattr(outbox, 'meta_data') or outbox.meta_data is None:
                outbox.meta_data = {}
            
            outbox.meta_data["failed"] = True
            outbox.meta_data["failure_reason"] = error_msg
            outbox.meta_data["attempt_timestamp"] = datetime.now(UTC).isoformat()
            outbox.meta_data["b2c_mode"] = is_b2c
            
            flag_modified(outbox, "meta_data")
            session.commit()
            
            # Update campaign as failed based on type
            if outbox.kind.startswith("campaign."):
                campaign_id = outbox.payload.get("campaign_id")
                
                if is_b2c:
                    # ===================================
                    # B2C: Update CSV with error
                    # ===================================
                    tracking_token = outbox.payload.get("tracking_token")
                    
                    if tracking_token:
                        update_b2c_status_from_outbox(
                            session,
                            campaign_id,
                            tracking_token,
                            status="failed",
                            error=error_msg
                        )
                        logger.debug(f"   ❌ B2C CSV error logged: {tracking_token}")
                
                else:
                    # ===================================
                    # B2B: Update CampaignResult as failed
                    # ===================================
                    result_id = outbox.payload.get("result_id")
                    
                    if result_id:
                        update_b2b_result_failed(session, result_id, error_msg)
                        logger.debug(f"   ❌ B2B CampaignResult failed: {result_id}")
                    
                    if campaign_id:
                        check_b2b_campaign_completion(session, campaign_id)
                
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
        b2b_count = 0
        b2c_count = 0
        
        for msg in messages:
            try:
                # Track campaign types
                if msg.payload.get("b2c_mode", False):
                    b2c_count += 1
                else:
                    b2b_count += 1
                
                result = process_outbox_message(session, msg)
                
                if result.should_skip:
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
            "connection_errors": connection_errors,
            "b2b_count": b2b_count,
            "b2c_count": b2c_count
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
    
    logger.info("🚀 Unified Outbox Processor Started")
    logger.info(f"   ⚙️  Batch size: {batch_size}")
    logger.info(f"   ⏱️  Poll interval: {poll_interval}s")
    logger.info(f"   🏥 Health check interval: {HEALTH_CHECK_INTERVAL}s")
    logger.info(f"   📊 Supports: B2B (CampaignResult) + B2C (CSV)")
    
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
                    time.sleep(poll_interval * 3)
                continue
            
            if result.get("processed", 0) > 0:
                b2b = result.get("b2b_count", 0)
                b2c = result.get("b2c_count", 0)
                
                logger.info(
                    f"[#{iteration}] "
                    f"✅ {result['success']} sent | "
                    f"❌ {result['failed']} failed | "
                    f"B2B: {b2b} | B2C: {b2c}"
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
        
        # Count B2B vs B2C
        b2c_pending = session.execute(
            sa.select(sa.func.count(Outbox.id)).where(
                and_(
                    Outbox.sent_at.is_(None),
                    Outbox.payload['b2c_mode'].astext == 'true'
                )
            )
        ).scalar() or 0
        
        b2b_pending = pending - b2c_pending
        
        return {
            "pending": pending,
            "sent": sent,
            "failed": failed,
            "total": pending + sent + failed,
            "b2b_pending": b2b_pending,
            "b2c_pending": b2c_pending,
            "relay_healthy": relay_is_healthy,
            "timestamp": datetime.now(UTC).isoformat()
        }


if __name__ == "__main__":
    run_forever()