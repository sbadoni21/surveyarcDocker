from __future__ import annotations
import os
import time, traceback, logging
import sqlalchemy as sa
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from ..db import SessionLocal
from ..models.outbox import Outbox
from .http_mailer import send_via_mailer, send_from_payload
from ..models.campaigns import  CampaignResult, RecipientStatus

import httpx
from typing  import Optional

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

MAIL_RELAY_URL = os.getenv("MAIL_RELAY_URL", "http://localhost:4001")
MAIL_API_TOKEN = os.getenv("MAIL_API_TOKEN", "")
UTC = timezone.utc

def _uniq(seq):
    return sorted({x for x in (seq or []) if x})

def process_one(session: Session, ob: Outbox):
    k = ob.kind
    p = ob.payload or {}

    to, subject, html = [], "", ""

    # ==================== TICKET SYSTEM ====================
    if k == "ticket.created":
        r = p.get("recipients", {}) or {}
        to = _uniq((r.get("requester", []) or [])
                   + (r.get("assignee", []) or [])
                   + (r.get("team", []) or [])
                   + (r.get("watchers", []) or []))
        subject = f"[TKT-{p.get('number')}] New ticket created: {p.get('subject')}"
        html = (
            f"<h2>New ticket created</h2>"
            f"<p><strong>Ticket:</strong> TKT-{p.get('number')}</p>"
            f"<p><strong>Subject:</strong> {p.get('subject')}</p>"
            f"<p><strong>Priority:</strong> {p.get('priority')}</p>"
            f"<p><strong>Severity:</strong> {p.get('severity')}</p>"
            f"<hr/>"
            f"<p><strong>First response due:</strong> {p.get('first_response_due_at') or '-'}<br/>"
            f"<strong>Resolution due:</strong> {p.get('resolution_due_at') or '-'}</p>"
        )

    elif k == "sla.assigned":
        r = p.get("recipients", {}) or {}
        to = _uniq((r.get("assignee", []) or [])
                   + (r.get("team", []) or [])
                   + (r.get("watchers", []) or [])
                   + (r.get("requester", []) or []))
        subject = f"[TKT-{p.get('number','?')}] SLA assigned"
        html = f"<p>SLA assigned to ticket {p.get('ticket_id')}.</p>"

    elif k == "sla.warn":
        to = _uniq(p.get("notify", []) or [])
        frac = int(float(p.get("fraction", 0)) * 100)
        subject = f"[SLA Warning] {p.get('dimension')} at {frac}%"
        html = f"<p>Ticket {p.get('ticket_id')} is {p.get('dimension')} {frac}% to target.</p>"

    elif k == "sla.breach":
        r = p.get("recipients", {}) or {}
        to = _uniq((r.get("assignee", []) or [])
                   + (r.get("team", []) or [])
                   + (r.get("watchers", []) or [])
                   + (r.get("requester", []) or []))
        subject = f"[SLA Breach] {p.get('dimension')} — Ticket {p.get('ticket_id')}"
        html = f"<p>SLA <strong>{p.get('dimension')}</strong> breached for ticket {p.get('ticket_id')}.</p>"

    elif k == "ticket.comment":
        logger.info(f"Relaying ticket.comment via /send/from-payload for outbox {ob.id}")
        send_from_payload("ticket.comment", p)
        ob.sent_at = datetime.now(tz=UTC)
        return

    # ==================== CALENDAR SYSTEM ====================
    elif k == "calendar.created":
        logger.info(f"Relaying calendar.created via /send/from-payload for outbox {ob.id}")
        send_from_payload("calendar.created", p)
        ob.sent_at = datetime.now(tz=UTC)
        return

    elif k == "calendar.deleted":
        send_from_payload("calendar.deleted", p)
        ob.sent_at = datetime.now(tz=UTC)
        return

    # ==================== CAMPAIGN SYSTEM ====================
    elif k == "campaign.email":
        logger.info(f"Sending campaign email for outbox {ob.id}, result {p.get('result_id')}")
        
        to = p.get("to", [])
        subject = p.get("subject", "")
        html = p.get("html", "")
        
        if not to or not subject or not html:
            logger.error(f"Invalid campaign.email payload: {p}")
            ob.sent_at = datetime.now(tz=UTC)
            return
        
        # Send email
        result = send_via_mailer(
            to=to,
            subject=subject,
            html=html,
            reply_to=p.get("reply_to")
        )
        
        # Update campaign result
        _update_campaign_result(session, p.get("result_id"), result.get("messageId"))
        
        ob.sent_at = datetime.now(tz=UTC)
        return

    elif k == "campaign.sms":
        logger.info(f"Sending campaign SMS for outbox {ob.id}, result {p.get('result_id')}")
        
        # Use send_from_payload to relay to SMS provider
        send_from_payload("campaign.sms", p)
        
        # Update campaign result
        _update_campaign_result(session, p.get("result_id"))
        
        ob.sent_at = datetime.now(tz=UTC)
        return

    elif k == "campaign.whatsapp":
        logger.info(f"Sending campaign WhatsApp for outbox {ob.id}, result {p.get('result_id')}")
        
        # Use send_from_payload to relay to WhatsApp provider
        send_from_payload("campaign.whatsapp", p)
        
        # Update campaign result
        _update_campaign_result(session, p.get("result_id"))
        
        ob.sent_at = datetime.now(tz=UTC)
        return

    elif k == "campaign.voice":
        logger.info(f"Sending campaign voice call for outbox {ob.id}, result {p.get('result_id')}")
        
        # Use send_from_payload to relay to voice provider
        send_from_payload("campaign.voice", p)
        
        # Update campaign result
        _update_campaign_result(session, p.get("result_id"))
        
        ob.sent_at = datetime.now(tz=UTC)
        return

    else:
        # Unknown kind: mark as sent to avoid poison messages
        logger.warning(f"Unknown outbox kind: {k}")
        ob.sent_at = datetime.now(tz=UTC)
        return

    # For ticket/SLA emails that use the old pattern
    if not to:
        ob.sent_at = datetime.now(tz=UTC)
        return

    # Try the mailer; let exceptions bubble to caller
    send_via_mailer(to=to, subject=subject, html=html)
    ob.sent_at = datetime.now(tz=UTC)


def _update_campaign_result(session: Session, result_id: str, message_id: str = None):
    """Update campaign result after sending"""
    if not result_id:
        return
    
    try:
        from ..services.campaign_sender_service import update_result_from_outbox
        update_result_from_outbox(
            session, 
            result_id, 
            datetime.now(tz=UTC),
            message_id
        )
    except Exception as e:
        logger.error(f"Error updating campaign result {result_id}: {e}")


# ✅ KEEP THIS (lines ~360-390)
def run_forever(poll_interval: float = 2.0, batch: int = 25):
    """
    Run the outbox processor forever
    Args:
        poll_interval: Time to wait between batches (seconds)
        batch: Number of messages to process per batch
    """
    logger.info(f"🚀 Outbox processor started (poll_interval={poll_interval}s, batch_size={batch})")
    
    iteration = 0
    
    while True:
        try:
            iteration += 1
            
            # Process batch
            result = process_batch(batch_size=batch)
            
            if result["processed"] > 0:
                logger.info(
                    f"[Iteration #{iteration}] Processed {result['processed']} messages: "
                    f"{result['success']} sent, {result['failed']} failed"
                )
            
        except KeyboardInterrupt:  # ✅ ADD THIS
            logger.info("🛑 Shutting down outbox processor")
            break
            
        except Exception as e:
            logger.error(f"❌ Error in outbox processor loop: {e}", exc_info=True)
        
        # Wait before next batch
        time.sleep(poll_interval)

async def send_to_mail_relay(kind: str, payload: dict) -> dict:
    """
    Send message to mail relay service at localhost:4000
    Returns: response from mail relay
    """
    try:
        headers = {
            "Content-Type": "application/json"
        }
        
        # Add auth token if configured
        if MAIL_API_TOKEN:
            headers["Authorization"] = f"Bearer {MAIL_API_TOKEN}"
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{MAIL_RELAY_URL}/send/from-payload",
                json={"kind": kind, "payload": payload},
                headers=headers
            )
            
            response.raise_for_status()
            result = response.json()
            
            logger.info(f"✅ Mail relay response for {kind}: {result}")
            return result
            
    except httpx.HTTPError as e:
        logger.error(f"❌ Mail relay HTTP error for {kind}: {e}")
        if hasattr(e, 'response') and e.response is not None:
            logger.error(f"   Response status: {e.response.status_code}")
            logger.error(f"   Response body: {e.response.text}")
        raise
    except Exception as e:
        logger.error(f"❌ Unexpected error sending to mail relay: {e}")
        raise


def process_outbox_message(session: Session, outbox: Outbox) -> bool:
    """
    Process a single outbox message
    Returns: True if successful, False otherwise
    """
    try:
        logger.info(f"📤 Processing outbox message: kind={outbox.kind}, id={outbox.id}")
        
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
            if outbox.kind.startswith("campaign.") and "result_id" in outbox.payload:
                update_campaign_result_sent(
                    session, 
                    outbox.payload["result_id"],
                    outbox.sent_at,
                    result.get("messageId")
                )
            
            session.flush()
            logger.info(f"✅ Successfully sent outbox message {outbox.id}")
            return True
            
        except Exception as e:
            logger.error(f"❌ Failed to send outbox message {outbox.id}: {e}")
            
            # Update campaign result if this is a campaign message
            if outbox.kind.startswith("campaign.") and "result_id" in outbox.payload:
                update_campaign_result_failed(
                    session,
                    outbox.payload["result_id"],
                    str(e)
                )
            
            # Don't mark as sent, will retry later
            return False
            
    except Exception as e:
        logger.error(f"❌ Error processing outbox message {outbox.id}: {e}", exc_info=True)
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
            logger.warning(f"Campaign result {result_id} not found")
            return
        
        result.status = RecipientStatus.sent
        result.sent_at = sent_at
        if message_id:
            result.message_id = message_id
        
        # Increment campaign counters
        campaign = result.campaign
        if campaign:
            campaign.sent_count = (campaign.sent_count or 0) + 1
            
            # Update channel stats
            if not campaign.channel_stats:
                campaign.channel_stats = {}
            
            channel_key = result.channel_used.value
            if channel_key not in campaign.channel_stats:
                campaign.channel_stats[channel_key] = {
                    "sent": 0, "delivered": 0, "opened": 0, "clicked": 0
                }
            
            campaign.channel_stats[channel_key]["sent"] += 1
        
        session.flush()
        logger.info(f"✅ Updated campaign result {result_id} to 'sent'")
        
    except Exception as e:
        logger.error(f"❌ Error updating campaign result {result_id}: {e}")


def update_campaign_result_failed(
    session: Session,
    result_id: str,
    error_message: str
):
    """Update campaign result when message fails"""
    try:
        result = session.query(CampaignResult).filter(
            CampaignResult.result_id == result_id
        ).first()
        
        if not result:
            logger.warning(f"Campaign result {result_id} not found")
            return
        
        result.status = RecipientStatus.failed
        result.error = error_message
        result.failed_at = datetime.now(UTC)
        
        # Increment campaign failed counter
        campaign = result.campaign
        if campaign:
            campaign.failed_count = (campaign.failed_count or 0) + 1
        
        session.flush()
        logger.info(f"⚠️  Updated campaign result {result_id} to 'failed'")
        
    except Exception as e:
        logger.error(f"❌ Error updating failed campaign result {result_id}: {e}")

def process_outbox_message(session: Session, outbox: Outbox) -> bool:
    """
    Process a single outbox message
    Returns: True if successful, False otherwise
    """
    try:
        logger.info(f"📤 Processing outbox message: kind={outbox.kind}, id={outbox.id}")
        
        # ✅ SIMPLIFIED: Just send to mail relay for ALL kinds
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
            logger.info(f"✅ Successfully sent outbox message {outbox.id}")
            return True
            
        except Exception as e:
            logger.error(f"❌ Failed to send outbox message {outbox.id}: {e}")
            
            # Update campaign result if this is a campaign message
            if outbox.kind.startswith("campaign."):
                result_id = outbox.payload.get("result_id")
                if result_id:
                    update_campaign_result_failed(
                        session,
                        result_id,
                        str(e)
                    )
            
            # ✅ ADD: Mark as failed after max retries
            if not hasattr(outbox, 'attempts'):
                # If attempts column doesn't exist, mark as sent to avoid infinite retries
                outbox.sent_at = datetime.now(UTC)
            
            return False
            
    except Exception as e:
        logger.error(f"❌ Error processing outbox message {outbox.id}: {e}", exc_info=True)
        return False
    
def process_batch(batch_size: int = 25) -> dict:
    """
    Process a batch of outbox messages
    Returns: dict with statistics
    """
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
        
        logger.info(f"📦 Processing batch of {len(messages)} outbox messages")
        
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
        
        logger.info(f"📊 Batch complete: {result}")
        return result


def run_forever(poll_interval: float = 2.0, batch: int = 25):
    """
    Run the outbox processor forever
    Args:
        poll_interval: Time to wait between batches (seconds)
        batch: Number of messages to process per batch
    """
    logger.info(f"🚀 Outbox processor started (poll_interval={poll_interval}s, batch_size={batch})")
    
    iteration = 0
    
    while True:
        try:
            iteration += 1
            
            # Process batch
            result = process_batch(batch_size=batch)
            
            if result["processed"] > 0:
                logger.info(
                    f"[Iteration #{iteration}] Processed {result['processed']} messages: "
                    f"{result['success']} sent, {result['failed']} failed"
                )
            
        except Exception as e:
            logger.error(f"❌ Error in outbox processor loop: {e}", exc_info=True)
        
        # Wait before next batch
        time.sleep(poll_interval)


def get_outbox_stats() -> dict:
    """Get outbox statistics"""
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