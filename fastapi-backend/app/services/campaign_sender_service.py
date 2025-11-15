# ============================================
# CAMPAIGN SENDER SERVICE - app/services/campaign_sender_service.py
# ============================================

import logging
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified
from typing import List, Optional

from ..models.campaigns import Campaign, CampaignResult, CampaignStatus, CampaignChannel, RecipientStatus
from ..models.outbox import Outbox
from ..models.contact import Contact
from ..utils.id_generator import generate_id

import secrets
logger = logging.getLogger(__name__)
UTC = timezone.utc


def generate_tracking_token():
    """Generate unique tracking token for campaign results"""
    return "camp_tracking_" + secrets.token_hex(4)


def create_campaign_results(
    session: Session, 
    campaign: Campaign, 
    contacts: List[Contact]
) -> int:
    """
    Create CampaignResult entries for all contacts
    Returns: number of results created
    """
    results_created = 0
    skipped_contacts = {
        "no_channel": 0,
        "no_content": 0,
        "no_address": 0
    }
    
    logger.info(f"📝 Creating campaign results for {len(contacts)} contact(s)...")
    
    for contact in contacts:
        # Determine channel and address for this contact
        channel, address = campaign.get_channel_for_contact(contact)
        
        if not channel or not address:
            logger.debug(f"⚠️  Skipping contact {contact.contact_id} ({contact.name}): No valid channel/address")
            skipped_contacts["no_address"] += 1
            continue
        
        # Validate campaign has content for this channel
        if not campaign.validate_content_for_channel(channel):
            logger.debug(f"⚠️  Skipping contact {contact.contact_id}: Missing content for {channel.value}")
            skipped_contacts["no_content"] += 1
            continue
        
        # Generate tracking token
        tracking_token = generate_tracking_token()
        
        # Create campaign result
        result = CampaignResult(
            result_id=generate_id(),
            campaign_id=campaign.campaign_id,
            contact_id=contact.contact_id,
            org_id=campaign.org_id,
            channel_used=channel,
            recipient_address=address,
            recipient_name=contact.name,
            tracking_token=tracking_token,
            status=RecipientStatus.queued
        )
        
        session.add(result)
        results_created += 1
        
        logger.debug(f"✅ Created result for {contact.name} ({address}) via {channel.value}")
    
    session.flush()
    
    if skipped_contacts["no_address"] > 0:
        logger.info(f"⚠️  Skipped {skipped_contacts['no_address']} contacts (no valid address)")
    if skipped_contacts["no_content"] > 0:
        logger.info(f"⚠️  Skipped {skipped_contacts['no_content']} contacts (missing content)")
    
    logger.info(f"✅ Created {results_created} campaign results")
    
    return results_created


def queue_campaign_sends(session: Session, campaign: Campaign, batch_size: int = 100) -> int:
    """
    Queue all pending campaign results to outbox
    Returns: number of messages queued
    """
    # Get all queued results
    results = session.query(CampaignResult).filter(
        CampaignResult.campaign_id == campaign.campaign_id,
        CampaignResult.status == RecipientStatus.queued
    ).limit(batch_size).all()
    
    queued_count = 0
    
    for result in results:
        try:
            # Create outbox entry based on channel
            kind = f"campaign.{result.channel_used.value}"
            
            # Build payload based on channel
            payload = build_campaign_payload(campaign, result)
            
            # Create dedupe key
            dedupe_key = f"campaign:{result.result_id}:{result.tracking_token}"
            
            # Create outbox entry
            outbox = Outbox(
                kind=kind,
                dedupe_key=dedupe_key,
                payload=payload
            )
            
            session.add(outbox)
            session.flush()  # Flush to get outbox.id
            
            # Update result status
            result.status = RecipientStatus.pending
            result.outbox_id = outbox.id
            
            queued_count += 1
            
        except Exception as e:
            logger.error(f"Error queuing result {result.result_id}: {e}")
            result.status = RecipientStatus.failed
            result.error = str(e)
    
    session.flush()
    logger.info(f"📤 Queued {queued_count} campaign messages to outbox")
    
    return queued_count


def build_campaign_payload(campaign: Campaign, result: CampaignResult) -> dict:
    """
    Build payload for outbox based on channel
    """
    # Build survey link with tracking token
    survey_link = f"{get_survey_base_url()}/s/{campaign.survey_id}?token={result.tracking_token}"
    
    # Shorten link for SMS/WhatsApp if needed
    if result.channel_used in [CampaignChannel.sms, CampaignChannel.whatsapp]:
        short_link = survey_link  # TODO: Integrate with URL shortener
        result.short_link = short_link
    else:
        short_link = survey_link
    
    base_payload = {
        "campaign_id": campaign.campaign_id,
        "result_id": result.result_id,
        "contact_id": result.contact_id,
        "tracking_token": result.tracking_token,
        "recipient_name": result.recipient_name or "there",
        "survey_link": survey_link,
        "short_link": short_link,
    }
    
    if result.channel_used == CampaignChannel.email:
        # Email payload
        html_body = campaign.email_body_html or ""
        html_body = html_body.replace("{survey_link}", survey_link)
        html_body = html_body.replace("{name}", result.recipient_name or "")
        
        return {
            **base_payload,
            "to": [result.recipient_address],
            "subject": campaign.email_subject,
            "html": html_body,
            "from_name": campaign.email_from_name,
            "reply_to": campaign.email_reply_to,
        }
    
    elif result.channel_used == CampaignChannel.sms:
        # SMS payload
        sms_message = campaign.sms_message or ""
        sms_message = sms_message.replace("{survey_link}", short_link)
        sms_message = sms_message.replace("{name}", result.recipient_name or "")
        
        return {
            **base_payload,
            "to": result.recipient_address,
            "message": sms_message,
        }
    
    elif result.channel_used == CampaignChannel.whatsapp:
        # WhatsApp payload
        whatsapp_message = campaign.whatsapp_message or ""
        whatsapp_message = whatsapp_message.replace("{survey_link}", short_link)
        whatsapp_message = whatsapp_message.replace("{name}", result.recipient_name or "")
        
        return {
            **base_payload,
            "to": result.recipient_address,
            "message": whatsapp_message,
            "template_id": campaign.whatsapp_template_id,
        }
    
    elif result.channel_used == CampaignChannel.voice:
        # Voice payload
        voice_script = campaign.voice_script or ""
        voice_script = voice_script.replace("{survey_link}", short_link)
        voice_script = voice_script.replace("{name}", result.recipient_name or "")
        
        return {
            **base_payload,
            "to": result.recipient_address,
            "script": voice_script,
        }
    
    return base_payload


def get_survey_base_url() -> str:
    """Get base URL for survey links"""
    import os
    return os.getenv("SURVEY_BASE_URL", "https://survey.example.com")


def get_tracking_base_url() -> str:
    """Get base URL for tracking endpoints"""
    import os
    return os.getenv("TRACKING_BASE_URL", "https://api.example.com")


def process_campaign_batch(campaign_id: str, batch_size: int = 100) -> dict:
    """
    Background task to process a batch of campaign sends
    """
    from ..db import SessionLocal
    
    with SessionLocal() as session:
        campaign = session.query(Campaign).filter(
            Campaign.campaign_id == campaign_id
        ).first()
        
        if not campaign:
            logger.error(f"Campaign {campaign_id} not found")
            return {"success": False, "error": "Campaign not found"}
        
        if campaign.status != CampaignStatus.sending:
            logger.warning(f"Campaign {campaign_id} is not in sending status")
            return {"success": False, "error": "Campaign not in sending status"}
        
        # Queue batch
        queued = queue_campaign_sends(session, campaign, batch_size)
        
        # Update campaign counters
        pending_count = session.query(CampaignResult).filter(
            CampaignResult.campaign_id == campaign_id,
            CampaignResult.status.in_([RecipientStatus.queued, RecipientStatus.pending])
        ).count()
        
        # If no more pending, mark campaign as sent
        if pending_count == 0:
            campaign.status = CampaignStatus.sent
            campaign.completed_at = datetime.now(UTC)
            logger.info(f"🎉 Campaign {campaign_id} completed!")
        
        session.commit()
        
        logger.info(f"Processed batch for campaign {campaign_id}: {queued} queued, {pending_count} pending")
        
        return {
            "success": True,
            "queued": queued,
            "pending": pending_count,
            "completed": pending_count == 0
        }


def update_result_from_outbox(session: Session, result_id: str, sent_at: datetime, message_id: str = None):
    """
    Update campaign result when outbox message is sent
    Called by outbox processor after successful send
    """
    result = session.query(CampaignResult).filter(
        CampaignResult.result_id == result_id
    ).first()
    
    if not result:
        logger.warning(f"Result {result_id} not found for outbox update")
        return
    
    # Update result
    result.status = RecipientStatus.sent
    result.sent_at = sent_at
    if message_id:
        result.message_id = message_id
    
    # Get campaign
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
        
        # Mark as modified for SQLAlchemy
        flag_modified(campaign, "channel_stats")
        
        logger.debug(f"📊 Campaign stats updated: sent_count={campaign.sent_count}")
    
    session.flush()