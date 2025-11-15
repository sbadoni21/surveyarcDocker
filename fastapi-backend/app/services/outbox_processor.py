from __future__ import annotations
import os
import time
import logging
import httpx
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified
from typing import Optional

from ..db import SessionLocal
from ..models.outbox import Outbox
from ..models.campaigns import Campaign, CampaignResult, RecipientStatus

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Load environment variables
MAIL_RELAY_URL = "http://localhost:4001"
MAIL_API_TOKEN = "supersecrettoken"
UTC = timezone.utc

# Log configuration at startup
logger.info(f"📧 Mail Relay URL: {MAIL_RELAY_URL}")
logger.info(f"🔐 Mail API Token: {'✅ CONFIGURED' if MAIL_API_TOKEN else '⚠️  NOT SET (auth disabled)'}")


async def send_to_mail_relay(kind: str, payload: dict) -> dict:
    """
    Send message to mail relay service
    Returns: response from mail relay
    """
    try:
        headers = {"Content-Type": "application/json"}
        
        # Add auth token if configured
        if MAIL_API_TOKEN:
            headers["Authorization"] = f"Bearer {MAIL_API_TOKEN}"
            logger.debug(f"🔐 Sending with auth token")
        else:
            logger.debug(f"⚠️  Sending without auth token")
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{MAIL_RELAY_URL}/send/from-payload",
                json={"kind": kind, "payload": payload},
                headers=headers
            )
            
            response.raise_for_status()
            result = response.json()
            
            logger.info(f"✅ Mail relay success for {kind}: {result.get('messageId', 'no-id')}")
            return result
            
    except httpx.HTTPStatusError as e:
        logger.error(f"❌ Mail relay HTTP {e.response.status_code} for {kind}")
        logger.error(f"   URL: {e.request.url}")
        logger.error(f"   Response: {e.response.text}")
        raise
    except Exception as e:
        logger.error(f"❌ Unexpected error sending to mail relay: {e}")
        raise


def process_outbox_message(session: Session, outbox: Outbox) -> bool:
    """
    Process a single outbox message by sending to mail relay
    Returns: True if successful, False otherwise
    """
    try:
        logger.info(f"📤 Processing outbox #{outbox.id}: {outbox.kind}")
        
        # Import asyncio to run async function
        import asyncio
        
        # Send to mail relay
        try:
            # Run async function in sync context
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            result = loop.run_until_complete(
                send_to_mail_relay(outbox.kind, outbox.payload)
            )
            loop.close()
            
            # Mark as sent
            outbox.sent_at = datetime.now(UTC)
            
            # Update campaign result if this is a campaign message
            if outbox.kind.startswith("campaign."):
                result_id = outbox.payload.get("result_id")
                if result_id:
                    update_campaign_result_sent(
                        session, 
                        result_id,
                        outbox.sent_at,
                        result.get("messageId")
                    )
            
            session.flush()
            logger.info(f"✅ Successfully sent outbox #{outbox.id}")
            return True
            
        except Exception as e:
            logger.error(f"❌ Failed to send outbox #{outbox.id}: {e}")
            
            # Update campaign result if this is a campaign message
            if outbox.kind.startswith("campaign."):
                result_id = outbox.payload.get("result_id")
                if result_id:
                    update_campaign_result_failed(session, result_id, str(e))
            
            # Mark as sent to avoid infinite retries on permanent failures
            if "401" in str(e) or "400" in str(e):
                logger.warning(f"⚠️  Marking outbox #{outbox.id} as sent due to permanent error")
                outbox.sent_at = datetime.now(UTC)
            
            return False
            
    except Exception as e:
        logger.error(f"❌ Error processing outbox #{outbox.id}: {e}", exc_info=True)
        return False


def update_campaign_result_sent(
    session: Session, 
    result_id: str, 
    sent_at: datetime, 
    message_id: Optional[str] = None
):
    """Update campaign result when message is sent"""
    try:
        result = session.query(CampaignResult).filter(
            CampaignResult.result_id == result_id
        ).first()
        
        if not result:
            logger.warning(f"⚠️  Campaign result {result_id} not found")
            return
        
        # Update result status
        result.status = RecipientStatus.sent
        result.sent_at = sent_at
        if message_id:
            result.message_id = message_id
        
        # Get campaign and update counters
        campaign = session.query(Campaign).filter(
            Campaign.campaign_id == result.campaign_id
        ).first()
        
        if campaign:
            # Increment sent_count
            campaign.sent_count = (campaign.sent_count or 0) + 1
            
            # Initialize channel_stats if needed
            if not campaign.channel_stats:
                campaign.channel_stats = {}
            
            # Get channel key
            channel_key = result.channel_used.value
            
            # Initialize channel stats if needed
            if channel_key not in campaign.channel_stats:
                campaign.channel_stats[channel_key] = {
                    "sent": 0, 
                    "delivered": 0, 
                    "opened": 0, 
                    "clicked": 0,
                    "bounced": 0,
                    "failed": 0
                }
            
            # Increment sent count for this channel
            campaign.channel_stats[channel_key]["sent"] += 1
            
            # Mark the dict as modified so SQLAlchemy tracks the change
            from sqlalchemy.orm.attributes import flag_modified
            flag_modified(campaign, "channel_stats")
            
            logger.debug(f"📊 Updated campaign stats: sent_count={campaign.sent_count}, channel={channel_key}")
        
        session.flush()
        logger.info(f"✅ Updated campaign result {result_id} to 'sent'")
        
    except Exception as e:
        logger.error(f"❌ Error updating campaign result {result_id}: {e}", exc_info=True)


def update_campaign_result_failed(session: Session, result_id: str, error_message: str):
    """Update campaign result when message fails"""
    try:
        result = session.query(CampaignResult).filter(
            CampaignResult.result_id == result_id
        ).first()
        
        if not result:
            logger.warning(f"⚠️  Campaign result {result_id} not found")
            return
        
        # Update result status
        result.status = RecipientStatus.failed
        result.error = error_message
        result.failed_at = datetime.now(UTC)
        result.retry_count = (result.retry_count or 0) + 1
        
        # Get campaign and update counters
        campaign = session.query(Campaign).filter(
            Campaign.campaign_id == result.campaign_id
        ).first()
        
        if campaign:
            # Increment failed_count
            campaign.failed_count = (campaign.failed_count or 0) + 1
            
            # Initialize channel_stats if needed
            if not campaign.channel_stats:
                campaign.channel_stats = {}
            
            # Get channel key
            channel_key = result.channel_used.value
            
            # Initialize channel stats if needed
            if channel_key not in campaign.channel_stats:
                campaign.channel_stats[channel_key] = {
                    "sent": 0, 
                    "delivered": 0, 
                    "opened": 0, 
                    "clicked": 0,
                    "bounced": 0,
                    "failed": 0
                }
            
            # Increment failed count for this channel
            campaign.channel_stats[channel_key]["failed"] += 1
            
            # Mark the dict as modified so SQLAlchemy tracks the change
            from sqlalchemy.orm.attributes import flag_modified
            flag_modified(campaign, "channel_stats")
            
            logger.debug(f"📊 Updated campaign stats: failed_count={campaign.failed_count}, channel={channel_key}")
        
        session.flush()
        logger.info(f"⚠️  Updated campaign result {result_id} to 'failed'")
        
    except Exception as e:
        logger.error(f"❌ Error updating failed campaign result {result_id}: {e}", exc_info=True)


def process_batch(batch_size: int = 25) -> dict:
    """
    Process a batch of outbox messages
    Returns: dict with statistics
    """
    import sqlalchemy as sa
    
    with SessionLocal() as session:
        # Get unsent messages
        messages = session.execute(
            sa.select(Outbox)
            .where(Outbox.sent_at.is_(None))
            .order_by(Outbox.id.asc())
            .limit(batch_size)
            .with_for_update(skip_locked=True)
        ).scalars().all()
        
        if not messages:
            return {"processed": 0, "success": 0, "failed": 0}
                
        success_count = 0
        failed_count = 0
        
        for message in messages:
            try:
                if process_outbox_message(session, message):
                    success_count += 1
                else:
                    failed_count += 1
                
                session.commit()
                
            except Exception as e:
                logger.error(f"❌ Error processing message {message.id}: {e}")
                session.rollback()
                failed_count += 1
        
        result = {
            "processed": len(messages),
            "success": success_count,
            "failed": failed_count
        }
        
        return result


def run_forever(poll_interval: float = 2.0, batch: int = 25):
    """
    Run the outbox processor forever
    Args:
        poll_interval: Time to wait between batches (seconds)
        batch: Number of messages to process per batch
    """
    logger.info(f"🚀 Outbox processor started (interval={poll_interval}s, batch={batch})")
    
    iteration = 0
    
    while True:
        try:
            iteration += 1
            
            # Process batch
            result = process_batch(batch_size=batch)
            
            if result["processed"] > 0:
                logger.info(
                    f"[#{iteration}] Processed {result['processed']}: "
                    f"{result['success']} ✅ / {result['failed']} ❌"
                )
            
        except KeyboardInterrupt:
            logger.info("🛑 Shutting down outbox processor")
            break
            
        except Exception as e:
            logger.error(f"❌ Error in processor loop: {e}", exc_info=True)
        
        # Wait before next batch
        time.sleep(poll_interval)


def get_outbox_stats() -> dict:
    """Get outbox statistics"""
    import sqlalchemy as sa
    
    with SessionLocal() as session:
        pending = session.execute(
            sa.select(sa.func.count(Outbox.id)).where(Outbox.sent_at.is_(None))
        ).scalar()
        
        sent = session.execute(
            sa.select(sa.func.count(Outbox.id)).where(Outbox.sent_at.isnot(None))
        ).scalar()
        
        return {
            "pending": pending,
            "sent": sent,
            "total": pending + sent
        }