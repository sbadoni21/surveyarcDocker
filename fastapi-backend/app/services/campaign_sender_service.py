# ============================================
# SMART CAMPAIGN SENDER SERVICE V3 (CORRECTED)
# app/services/campaign_sender_service_v3.py
# ============================================

from sqlalchemy.orm import joinedload
import logging
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified
from typing import List, Optional
from .variable_replacement_service import replace_variables, build_tracking_url
from ..models.campaigns import (
    Campaign, 
    CampaignResult, 
    CampaignStatus, 
    CampaignChannel, 
    RecipientStatus
)
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
    ✅ SMART: Skip contacts that already have results
    """
    results_created = 0
    skipped_contacts = {
        "no_channel": 0,
        "no_content": 0,
        "no_address": 0,
        "already_exists": 0
    }
    
    logger.info(f"📝 Creating campaign results for {len(contacts)} contact(s)...")
    
    for contact in contacts:
        existing_result = session.query(CampaignResult).filter(
            CampaignResult.campaign_id == campaign.campaign_id,
            CampaignResult.contact_id == contact.contact_id
        ).first()
        
        if existing_result:
            logger.debug(
                f"⚠️  Skipping contact {contact.contact_id} - "
                f"result already exists (status: {existing_result.status.value})"
            )
            skipped_contacts["already_exists"] += 1
            continue
        
        channel, address = campaign.get_channel_for_contact(contact)
        
        if not channel or not address:
            logger.debug(
                f"⚠️  Skipping contact {contact.contact_id} ({contact.name}): "
                f"No valid channel/address"
            )
            skipped_contacts["no_address"] += 1
            continue
        
        if not campaign.validate_content_for_channel(channel):
            logger.debug(
                f"⚠️  Skipping contact {contact.contact_id}: "
                f"Missing content for {channel.value}"
            )
            skipped_contacts["no_content"] += 1
            continue
        
        tracking_token = generate_tracking_token()
        
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
        
        logger.debug(
            f"✅ Created result for {contact.name} ({address}) "
            f"via {channel.value}"
        )
    
    session.flush()
    
    if skipped_contacts["already_exists"] > 0:
        logger.info(
            f"⚠️  Skipped {skipped_contacts['already_exists']} contacts "
            f"(already have results)"
        )
    if skipped_contacts["no_address"] > 0:
        logger.info(
            f"⚠️  Skipped {skipped_contacts['no_address']} contacts "
            f"(no valid address)"
        )
    if skipped_contacts["no_content"] > 0:
        logger.info(
            f"⚠️  Skipped {skipped_contacts['no_content']} contacts "
            f"(missing content)"
        )
    
    logger.info(f"✅ Created {results_created} NEW campaign results")
    
    return results_created


def queue_campaign_sends(
    session: Session, 
    campaign: Campaign, 
    batch_size: int = 100
) -> int:
    """
    ✅ SMART: Queue only QUEUED results with contact data for variable replacement
    Returns: number of messages queued
    """
    # ✅ FIXED: Remove duplicate import (already imported at top)
    results = session.query(CampaignResult).options(
        joinedload(CampaignResult.contact).joinedload(Contact.emails),
        joinedload(CampaignResult.contact).joinedload(Contact.phones),
        joinedload(CampaignResult.contact).joinedload(Contact.socials)
    ).filter(
        CampaignResult.campaign_id == campaign.campaign_id,
        CampaignResult.status == RecipientStatus.queued
    ).limit(batch_size).all()
    
    if not results:
        logger.info(f"ℹ️  No queued results to process for campaign {campaign.campaign_id}")
        return 0
    
    logger.info(f"📤 Queueing {len(results)} results to outbox...")
    
    queued_count = 0
    
    for result in results:
        try:
            contact = result.contact
            
            if not contact:
                logger.error(
                    f"❌ Contact {result.contact_id} not found for result {result.result_id}"
                )
                result.status = RecipientStatus.failed
                result.error = "Contact not found"
                continue
            
            if result.outbox_id:
                existing_outbox = session.query(Outbox).filter(
                    Outbox.id == result.outbox_id
                ).first()
                
                if existing_outbox:
                    logger.debug(
                        f"⚠️  Result {result.result_id} already has outbox entry "
                        f"#{existing_outbox.id}"
                    )
                    result.status = RecipientStatus.pending
                    continue
            
            kind = f"campaign.{result.channel_used.value}"
            
            payload = build_campaign_payload(campaign, result, contact)
            
            dedupe_key = f"campaign:{campaign.campaign_id}:{result.result_id}"
            
            existing_outbox = session.query(Outbox).filter(
                Outbox.dedupe_key == dedupe_key
            ).first()
            
            if existing_outbox:
                logger.warning(
                    f"⚠️  Outbox entry already exists for result {result.result_id} "
                    f"(dedupe_key: {dedupe_key})"
                )
                result.status = RecipientStatus.pending
                result.outbox_id = existing_outbox.id
                continue
            
            outbox = Outbox(
                kind=kind,
                dedupe_key=dedupe_key,
                payload=payload
            )
            
            session.add(outbox)
            session.flush()
            
            result.status = RecipientStatus.pending
            result.outbox_id = outbox.id
            
            queued_count += 1
            
            logger.debug(
                f"✅ Queued result {result.result_id} → outbox #{outbox.id} "
                f"(contact: {contact.name})"
            )
            
        except Exception as e:
            logger.error(
                f"❌ Error queuing result {result.result_id}: {e}", 
                exc_info=True
            )
            result.status = RecipientStatus.failed
            result.error = str(e)[:500]
    
    session.flush()
    logger.info(f"📤 Queued {queued_count} NEW messages to outbox")
    
    return queued_count


def build_campaign_payload(campaign: Campaign, result: CampaignResult, contact: Contact) -> dict:
    """
    ✅ SMART: Build payload with full variable replacement
    Supports: {{name}}, {{email}}, {{phone}}, {{survey_link}}, {{tracking_token}}, etc.
    """
    survey_base_url = get_survey_base_url()
    survey_link = build_tracking_url(
        f"{survey_base_url}",
        campaign,
        contact,
        result
    )
    
    if result.channel_used in [CampaignChannel.sms, CampaignChannel.whatsapp]:
        short_link = shorten_url(survey_link)
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
        email_subject = replace_variables(
            campaign.email_subject or 'Survey Invitation',
            contact,
            campaign,
            result,
            survey_link,
            short_link
        )
        
        email_body = replace_variables(
            campaign.email_body_html or '',
            contact,
            campaign,
            result,
            survey_link,
            short_link
        )
        
        return {
            **base_payload,
            "to": [result.recipient_address],
            "subject": email_subject,
            "html": email_body,
            "from_name": campaign.email_from_name,
            "reply_to": campaign.email_reply_to,
        }
    
    elif result.channel_used == CampaignChannel.sms:
        sms_message = replace_variables(
            campaign.sms_message or '',
            contact,
            campaign,
            result,
            survey_link,
            short_link
        )
        
        return {
            **base_payload,
            "to": result.recipient_address,
            "message": sms_message,
        }
    
    elif result.channel_used == CampaignChannel.whatsapp:
        whatsapp_message = replace_variables(
            campaign.whatsapp_message or '',
            contact,
            campaign,
            result,
            survey_link,
            short_link
        )
        
        return {
            **base_payload,
            "to": result.recipient_address,
            "message": whatsapp_message,
            "template_id": campaign.whatsapp_template_id,
        }
    
    elif result.channel_used == CampaignChannel.voice:
        voice_script = replace_variables(
            campaign.voice_script or '',
            contact,
            campaign,
            result,
            survey_link,
            short_link
        )
        
        return {
            **base_payload,
            "to": result.recipient_address,
            "script": voice_script,
        }
    
    return base_payload


def shorten_url(long_url: str) -> str:
    """
    Shorten URL for SMS/WhatsApp
    TODO: Integrate with URL shortener service (Bitly, TinyURL, etc.)
    """
    logger.debug(f"URL shortening not implemented, using full URL")
    return long_url


def get_survey_base_url() -> str:
    """Get base URL for survey links"""
    import os
    return os.getenv("SURVEY_BASE_URL", "https://surveyarc-docker.vercel.app/form")


def get_tracking_base_url() -> str:
    """Get base URL for tracking endpoints"""
    import os
    return os.getenv("TRACKING_BASE_URL", "https://api.example.com")


def process_campaign_batch(campaign_id: str, batch_size: int = 100) -> dict:
    """
    ✅ SMART: Process campaign batch with completion checking
    """
    from ..db import SessionLocal
    
    with SessionLocal() as session:
        campaign = session.query(Campaign).filter(
            Campaign.campaign_id == campaign_id
        ).with_for_update().first()
        
        if not campaign:
            logger.error(f"❌ Campaign {campaign_id} not found")
            return {"success": False, "error": "Campaign not found"}
        
        if campaign.status not in [CampaignStatus.sending, CampaignStatus.scheduled]:
            logger.warning(
                f"⚠️  Campaign {campaign_id} status is {campaign.status.value}, "
                f"not sending or scheduled"
            )
            return {
                "success": False, 
                "error": f"Campaign status is {campaign.status.value}"
            }
        
        queued = queue_campaign_sends(session, campaign, batch_size)
        
        pending_count = session.query(CampaignResult).filter(
            CampaignResult.campaign_id == campaign_id,
            CampaignResult.status.in_([
                RecipientStatus.queued, 
                RecipientStatus.pending
            ])
        ).count()
        
        logger.info(
            f"📊 Campaign {campaign_id}: "
            f"queued={queued}, pending={pending_count}"
        )
        
        if pending_count == 0:
            total_results = session.query(CampaignResult).filter(
                CampaignResult.campaign_id == campaign_id
            ).count()
            
            sent_count = session.query(CampaignResult).filter(
                CampaignResult.campaign_id == campaign_id,
                CampaignResult.status.in_([
                    RecipientStatus.sent,
                    RecipientStatus.delivered
                ])
            ).count()
            
            failed_count = session.query(CampaignResult).filter(
                CampaignResult.campaign_id == campaign_id,
                CampaignResult.status == RecipientStatus.failed
            ).count()
            
            if campaign.status == CampaignStatus.sending:
                campaign.status = CampaignStatus.completed
                campaign.completed_at = datetime.now(UTC)
                
                logger.info(
                    f"🎉 Campaign {campaign_id} COMPLETED! "
                    f"Total: {total_results}, "
                    f"Sent/Delivered: {sent_count}, "
                    f"Failed: {failed_count}"
                )
        
        session.commit()
        
        result = {
            "success": True,
            "queued": queued,
            "pending": pending_count,
            "completed": pending_count == 0,
            "campaign_status": campaign.status.value
        }
        
        logger.info(f"✅ Batch processing result: {result}")
        
        return result


def update_result_from_outbox(
    session: Session, 
    result_id: str, 
    sent_at: datetime, 
    message_id: str = None
):
    """
    ✅ SMART: Update result to DELIVERED immediately
    """
    result = session.query(CampaignResult).filter(
        CampaignResult.result_id == result_id
    ).with_for_update().first()
    
    if not result:
        logger.warning(f"⚠️  Result {result_id} not found for outbox update")
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
        
        logger.debug(
            f"📊 Campaign stats: "
            f"sent={campaign.sent_count}, "
            f"delivered={campaign.delivered_count}"
        )
    
    session.flush()


# ============================================
# ✅ CAMPAIGN COMPLETION CHECKER
# ============================================

def check_and_complete_campaigns():
    """
    ✅ SMART: Check all sending campaigns and complete them if done
    """
    from ..db import SessionLocal
    
    with SessionLocal() as session:
        sending_campaigns = session.query(Campaign).filter(
            Campaign.status == CampaignStatus.sending
        ).all()
        
        if not sending_campaigns:
            logger.debug("No campaigns in 'sending' status")
            return {"completed": 0}
        
        logger.info(f"🔍 Checking {len(sending_campaigns)} sending campaign(s)...")
        
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
                    
                    logger.info(
                        f"🎉 Campaign {campaign.campaign_id} ({campaign.campaign_name}) "
                        f"marked as COMPLETED! "
                        f"Sent: {campaign.sent_count}, "
                        f"Delivered: {campaign.delivered_count}, "
                        f"Failed: {campaign.failed_count}"
                    )
                else:
                    logger.debug(
                        f"Campaign {campaign.campaign_id} still has "
                        f"{pending_count} pending result(s)"
                    )
            
            except Exception as e:
                logger.error(
                    f"❌ Error checking campaign {campaign.campaign_id}: {e}",
                    exc_info=True
                )
        
        if completed_count > 0:
            session.commit()
            logger.info(f"✅ Completed {completed_count} campaign(s)")
        
        return {"completed": completed_count}