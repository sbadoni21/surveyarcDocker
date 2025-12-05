# ============================================
# SMART CAMPAIGN SENDER SERVICE V3 - DEBUG VERSION
# app/services/campaign_sender_service_v3.py
# ============================================
import os
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
from .survey_link_service import create_survey_link_reference, get_reference_url

import secrets

# Configure debug logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - [%(funcName)s:%(lineno)d] - %(message)s'
)
logger = logging.getLogger(__name__)
UTC = timezone.utc


def get_final_survey_url(campaign: Campaign, contact: Contact, result: CampaignResult) -> str:
    """
    ✅ NEW: Get the FINAL survey form URL after variable replacement
    This is what gets stored in the reference link database
    
    Returns: https://surveyarc-docker.vercel.app/form/{form_id}
    """
    logger.debug("Getting final survey URL...")
    
    # Get base survey URL from environment
    base_url = os.getenv("SURVEY_BASE_URL", "https://surveyarc-docker.vercel.app/form")
    
    # Build the survey URL template (may contain {{variables}})
    # Assuming campaign has a survey_link or we construct it
    if hasattr(campaign, 'survey_link') and campaign.survey_link:
        survey_url_template = campaign.survey_link
    else:
        # Construct default: base_url/survey_id
        survey_url_template = f"{base_url}/{campaign.survey_id}"
    
    logger.debug(f"   - Template: {survey_url_template}")
    
    # ✅ CRITICAL: Replace variables in the survey URL
    # This ensures {{survey_id}} or other variables are replaced
    final_url = replace_variables(
        template=survey_url_template,
        contact=contact,
        campaign=campaign,
        result=result,
        survey_link="",  # Not used in URL replacement
        short_link=None
    )
    
    logger.debug(f"   - Final URL: {final_url}")
    
    # Verify it's a valid URL
    if not final_url.startswith('http'):
        logger.warning(f"⚠️  URL doesn't start with http: {final_url}")
        final_url = f"{base_url}/{campaign.survey_id}"
    
    return final_url


def generate_tracking_token():
    """Generate unique tracking token for campaign results"""
    token = "camp_tracking_" + secrets.token_hex(4)
    logger.debug(f"Generated tracking token: {token}")
    return token


def create_campaign_results(
    session: Session, 
    campaign: Campaign, 
    contacts: List[Contact]
) -> int:
    """
    Create CampaignResult entries for all contacts
    ✅ SMART: Skip contacts that already have results
    """
    logger.info("╔═══════════════════════════════════════════════════════════╗")
    logger.info("║  CREATING CAMPAIGN RESULTS                                ║")
    logger.info("╚═══════════════════════════════════════════════════════════╝")
    logger.info(f"📊 Input: {len(contacts)} contact(s)")
    logger.info(f"🆔 Campaign ID: {campaign.campaign_id}")
    logger.info(f"📡 Channel: {campaign.channel.value if hasattr(campaign.channel, 'value') else campaign.channel}")
    logger.info("")
    
    results_created = 0
    skipped_contacts = {
        "no_channel": 0,
        "no_content": 0,
        "no_address": 0,
        "already_exists": 0
    }
    
    for idx, contact in enumerate(contacts, 1):
        logger.debug("─" * 60)
        logger.debug(f"Processing contact {idx}/{len(contacts)}")
        logger.debug(f"   - Name: {contact.name}")
        logger.debug(f"   - ID: {contact.contact_id}")
        logger.debug(f"   - Primary: {contact.primary_identifier}")
        
        # Check for existing result
        logger.debug("🔍 Checking for existing result...")
        existing_result = session.query(CampaignResult).filter(
            CampaignResult.campaign_id == campaign.campaign_id,
            CampaignResult.contact_id == contact.contact_id
        ).first()
        
        if existing_result:
            logger.debug(f"⚠️  SKIPPED - Result already exists")
            logger.debug(f"   - Result ID: {existing_result.result_id}")
            logger.debug(f"   - Status: {existing_result.status.value}")
            skipped_contacts["already_exists"] += 1
            continue
        
        # Get channel and address
        logger.debug("🔍 Getting channel and address for contact...")
        channel, address = campaign.get_channel_for_contact(contact)
        
        logger.debug(f"   - Channel: {channel.value if hasattr(channel, 'value') else channel if channel else 'None'}")
        logger.debug(f"   - Address: {address or 'None'}")
        
        if not channel or not address:
            logger.debug(f"⚠️  SKIPPED - No valid channel/address")
            skipped_contacts["no_address"] += 1
            continue
        
        # Validate content
        logger.debug(f"🔍 Validating content for channel: {channel.value if hasattr(channel, 'value') else channel}")
        has_content = campaign.validate_content_for_channel(channel)
        logger.debug(f"   - Has content: {has_content}")
        
        if not has_content:
            logger.debug(f"⚠️  SKIPPED - Missing content for {channel.value if hasattr(channel, 'value') else channel}")
            skipped_contacts["no_content"] += 1
            continue
        
        # Create result
        tracking_token = generate_tracking_token()
        result_id = generate_id()
        
        logger.debug("✅ Creating CampaignResult...")
        logger.debug(f"   - Result ID: {result_id}")
        logger.debug(f"   - Channel: {channel.value if hasattr(channel, 'value') else channel}")
        logger.debug(f"   - Address: {address}")
        logger.debug(f"   - Tracking token: {tracking_token}")
        
        result = CampaignResult(
            result_id=result_id,
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
        
        logger.debug(f"✅ Result created for {contact.name}")
    
    logger.debug("─" * 60)
    logger.info("")
    logger.info("📊 RESULTS SUMMARY:")
    logger.info(f"   ✅ Created: {results_created}")
    logger.info(f"   ⚠️  Already exists: {skipped_contacts['already_exists']}")
    logger.info(f"   ⚠️  No address: {skipped_contacts['no_address']}")
    logger.info(f"   ⚠️  No content: {skipped_contacts['no_content']}")
    logger.info("")
    
    logger.debug("💾 Flushing session...")
    session.flush()
    logger.debug("✅ Session flushed")
    
    logger.info("╔═══════════════════════════════════════════════════════════╗")
    logger.info(f"║  ✅ CREATED {results_created:3d} NEW CAMPAIGN RESULTS                 ║")
    logger.info("╚═══════════════════════════════════════════════════════════╝")
    logger.info("")
    
    return results_created

def queue_campaign_sends(
    session: Session, 
    campaign: Campaign, 
    batch_size: int = 100
) -> int:
    """
    ✅ UPDATED: Queue campaign sends with reference URL creation
    """
    logger.info("╔═══════════════════════════════════════════════════════════╗")
    logger.info("║  QUEUEING CAMPAIGN SENDS (WITH REFERENCE URLS)            ║")
    logger.info("╚═══════════════════════════════════════════════════════════╝")
    logger.info(f"🆔 Campaign ID: {campaign.campaign_id}")
    logger.info(f"📦 Batch size: {batch_size}")
    logger.info("")
    
    results = session.query(CampaignResult).options(
        joinedload(CampaignResult.contact).joinedload(Contact.emails),
        joinedload(CampaignResult.contact).joinedload(Contact.phones),
        joinedload(CampaignResult.contact).joinedload(Contact.socials)
    ).filter(
        CampaignResult.campaign_id == campaign.campaign_id,
        CampaignResult.status == RecipientStatus.queued
    ).limit(batch_size).all()
    
    logger.info(f"📋 Found {len(results)} queued result(s)")
    
    if not results:
        logger.info("ℹ️  No results to process")
        logger.info("")
        return 0
    
    queued_count = 0
    skipped_count = 0
    error_count = 0
    
    for idx, result in enumerate(results, 1):
        logger.debug("─" * 60)
        logger.debug(f"Processing result {idx}/{len(results)}")
        
        try:
            contact = result.contact
            
            if not contact:
                logger.error(f"❌ Contact {result.contact_id} not found!")
                result.status = RecipientStatus.failed
                result.error = "Contact not found"
                error_count += 1
                continue
            
            # Check for existing outbox entry
            if result.outbox_id:
                existing_outbox = session.query(Outbox).filter(
                    Outbox.id == result.outbox_id
                ).first()
                
                if existing_outbox:
                    logger.debug(f"⚠️  SKIPPED - Outbox entry already exists")
                    result.status = RecipientStatus.pending
                    skipped_count += 1
                    continue
            
            # Build payload with reference URL (✅ UPDATED)
            kind = f"campaign.{result.channel_used.value if hasattr(result.channel_used, 'value') else result.channel_used}"
            payload = build_campaign_payload(campaign, result, contact, session)  # Pass session
            
            dedupe_key = f"campaign:{campaign.campaign_id}:{result.result_id}"
            
            # Check for duplicate
            existing_outbox = session.query(Outbox).filter(
                Outbox.dedupe_key == dedupe_key
            ).first()
            
            if existing_outbox:
                logger.warning(f"⚠️  SKIPPED - Duplicate dedupe_key")
                result.status = RecipientStatus.pending
                result.outbox_id = existing_outbox.id
                skipped_count += 1
                continue
            
            # Create outbox entry
            outbox = Outbox(
                kind=kind,
                dedupe_key=dedupe_key,
                payload=payload
            )
            
            session.add(outbox)
            session.flush()
            
            logger.debug(f"✅ Outbox created: #{outbox.id}")
            
            # Update result
            result.status = RecipientStatus.pending
            result.outbox_id = outbox.id
            
            queued_count += 1
            
        except Exception as e:
            logger.error(f"❌ ERROR processing result {result.result_id}")
            logger.error(f"   - Error: {e}", exc_info=True)
            
            result.status = RecipientStatus.failed
            result.error = str(e)[:500]
            error_count += 1
    
    session.flush()
    
    logger.info("")
    logger.info("📊 QUEUEING SUMMARY:")
    logger.info(f"   ✅ Queued: {queued_count}")
    logger.info(f"   ⚠️  Skipped: {skipped_count}")
    logger.info(f"   ❌ Errors: {error_count}")
    logger.info("")
    
    return queued_count



def build_campaign_payload(campaign: Campaign, result: CampaignResult, contact: Contact, session: Session) -> dict:
    """
    Build payload with the ORIGINAL survey URL (no reference / short link indirection).

    Flow:
    1. Get final survey form URL (after variable replacement)
    2. Use that URL directly as survey_link and short_link in templates
    """
    logger.debug("┌─────────────────────────────────────────────┐")
    logger.debug("│  BUILDING CAMPAIGN PAYLOAD (DIRECT URL)    │")
    logger.debug("└─────────────────────────────────────────────┘")
    logger.debug(f"   - Channel: {result.channel_used.value if hasattr(result.channel_used, 'value') else result.channel_used}")
    logger.debug(f"   - Contact: {contact.name}")
    logger.debug(f"   - Tracking token: {result.tracking_token}")
    
    # ✅ STEP 1: Get the FINAL survey form URL (after variable replacement)
    # This is the actual destination URL: e.g. https://surveyarc-docker.vercel.app/form/{form_id}
    final_survey_url = get_final_survey_url(campaign, contact, result)
    logger.debug(f"   - Final survey URL: {final_survey_url}")

    # (Optional) – if you ever want tracking params, you could do:
    # final_survey_url = build_tracking_url(final_survey_url, campaign, contact, result)

    # ✅ We are NOT creating any SurveyLinkReference now
    # result.short_link can be set to the same URL for compatibility
    result.short_link = final_survey_url

    # ✅ STEP 2: Build base payload using the ORIGINAL URL
    base_payload = {
        "campaign_id": campaign.campaign_id,
        "result_id": result.result_id,
        "contact_id": result.contact_id,
        "tracking_token": result.tracking_token,
        "recipient_name": result.recipient_name or "there",
        "survey_link": final_survey_url,   # 🔥 Original URL
        "short_link": final_survey_url,    # 🔥 Also original URL
        "reference_id": None,              # No reference ID anymore
    }
    
    logger.debug(f"   - survey_link in payload: {base_payload['survey_link']}")

    public_url = final_survey_url  # just for readability in replace_variables calls

    # ✅ STEP 3: Build channel-specific payload with variable replacement
    if result.channel_used == CampaignChannel.email:
        logger.debug("📧 Building EMAIL payload...")
        
        email_subject = replace_variables(
            campaign.email_subject or 'Survey Invitation',
            contact,
            campaign,
            result,
            public_url,  # {{survey_link}}
            public_url   # {{short_link}}
        )
        
        email_body = replace_variables(
            campaign.email_body_html or '',
            contact,
            campaign,
            result,
            public_url,
            public_url
        )
        
        payload = {
            **base_payload,
            "to": [result.recipient_address],
            "subject": email_subject,
            "html": email_body,
            "from_name": campaign.email_from_name,
            "reply_to": campaign.email_reply_to,
        }
        
    elif result.channel_used == CampaignChannel.sms:
        logger.debug("📱 Building SMS payload...")
        
        sms_message = replace_variables(
            campaign.sms_message or '',
            contact,
            campaign,
            result,
            public_url,
            public_url
        )
        
        payload = {
            **base_payload,
            "to": result.recipient_address,
            "message": sms_message,
        }
        
    elif result.channel_used == CampaignChannel.whatsapp:
        logger.debug("💬 Building WhatsApp payload...")
        
        whatsapp_message = replace_variables(
            campaign.whatsapp_message or '',
            contact,
            campaign,
            result,
            public_url,
            public_url
        )
        
        payload = {
            **base_payload,
            "to": result.recipient_address,
            "message": whatsapp_message,
            "template_id": campaign.whatsapp_template_id,
        }
        
    elif result.channel_used == CampaignChannel.voice:
        logger.debug("📞 Building VOICE payload...")
        
        voice_script = replace_variables(
            campaign.voice_script or '',
            contact,
            campaign,
            result,
            public_url,
            public_url
        )
        
        payload = {
            **base_payload,
            "to": result.recipient_address,
            "script": voice_script,
        }
    
    else:
        logger.warning(f"⚠️  Unknown channel: {result.channel_used.value if hasattr(result.channel_used, 'value') else result.channel_used}")
        payload = base_payload
    
    logger.debug(f"✅ Payload built with {len(payload)} keys")
    logger.debug("└─────────────────────────────────────────────┘")
    
    return payload



def shorten_url(long_url: str) -> str:
    """Shorten URL for SMS/WhatsApp"""
    logger.debug(f"shorten_url() called (not implemented, using full URL)")
    return long_url


def get_survey_base_url() -> str:
    """Get base URL for survey links"""
    import os
    url = os.getenv("SURVEY_BASE_URL", "https://surveyarc-docker.vercel.app/form")
    logger.debug(f"Survey base URL: {url}")
    return url


def get_tracking_base_url() -> str:
    """Get base URL for tracking endpoints"""
    import os
    url = os.getenv("TRACKING_BASE_URL", "https://api.example.com")
    logger.debug(f"Tracking base URL: {url}")
    return url


def process_campaign_batch(campaign_id: str, batch_size: int = 100) -> dict:
    """
    ✅ SMART: Process campaign batch with completion checking
    """
    from ..db import SessionLocal
    
    logger.info("╔═══════════════════════════════════════════════════════════╗")
    logger.info("║  PROCESSING CAMPAIGN BATCH                                ║")
    logger.info("╚═══════════════════════════════════════════════════════════╝")
    logger.info(f"🆔 Campaign ID: {campaign_id}")
    logger.info(f"📦 Batch size: {batch_size}")
    logger.info("")
    
    with SessionLocal() as session:
        logger.debug("📂 Session opened")
        
        logger.debug("🔍 Looking up campaign with lock...")
        campaign = session.query(Campaign).filter(
            Campaign.campaign_id == campaign_id
        ).with_for_update().first()
        
        if not campaign:
            logger.error(f"❌ Campaign {campaign_id} not found")
            return {"success": False, "error": "Campaign not found"}
        
        logger.info(f"📋 Campaign: {campaign.campaign_name}")
        logger.info(f"📊 Status: {campaign.status.value if hasattr(campaign.status, 'value') else campaign.status}")
        logger.info("")
        
        if campaign.status not in [CampaignStatus.sending, CampaignStatus.scheduled]:
            logger.warning(f"⚠️  Campaign status is {campaign.status.value if hasattr(campaign.status, 'value') else campaign.status}")
            logger.warning("   Cannot process (must be 'sending' or 'scheduled')")
            return {
                "success": False, 
                "error": f"Campaign status is {campaign.status.value if hasattr(campaign.status, 'value') else campaign.status}"
            }
        
        logger.info("📤 Queueing campaign sends...")
        queued = queue_campaign_sends(session, campaign, batch_size)
        logger.info(f"✅ Queued: {queued}")
        logger.info("")
        
        logger.debug("🔍 Checking for pending results...")
        pending_count = session.query(CampaignResult).filter(
            CampaignResult.campaign_id == campaign_id,
            CampaignResult.status.in_([
                RecipientStatus.queued, 
                RecipientStatus.pending
            ])
        ).count()
        
        logger.info(f"📊 Pending results: {pending_count}")
        
        if pending_count == 0:
            logger.info("🎉 ALL RESULTS PROCESSED!")
            logger.info("")
            logger.info("📊 Calculating final stats...")
            
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
            
            logger.info(f"   - Total: {total_results}")
            logger.info(f"   - Sent/Delivered: {sent_count}")
            logger.info(f"   - Failed: {failed_count}")
            logger.info("")
            
            if campaign.status == CampaignStatus.sending:
                logger.info("🔄 Updating campaign to COMPLETED...")
                campaign.status = CampaignStatus.completed
                campaign.completed_at = datetime.now(UTC)
                logger.info(f"✅ Campaign completed at: {campaign.completed_at}")
        
        logger.debug("💾 Committing transaction...")
        session.commit()
        logger.debug("✅ Transaction committed")
        
        result = {
            "success": True,
            "queued": queued,
            "pending": pending_count,
            "completed": pending_count == 0,
            "campaign_status": campaign.status.value if hasattr(campaign.status, 'value') else campaign.status
        }
        
        logger.info("")
        logger.info("╔═══════════════════════════════════════════════════════════╗")
        logger.info("║  ✅ BATCH PROCESSING COMPLETE                             ║")
        logger.info("╚═══════════════════════════════════════════════════════════╝")
        logger.info(f"📊 Result: {result}")
        logger.info("")
        
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
    logger.debug("─" * 60)
    logger.debug("UPDATE RESULT FROM OUTBOX")
    logger.debug(f"   - Result ID: {result_id}")
    logger.debug(f"   - Sent at: {sent_at}")
    logger.debug(f"   - Message ID: {message_id or 'None'}")
    
    result = session.query(CampaignResult).filter(
        CampaignResult.result_id == result_id
    ).with_for_update().first()
    
    if not result:
        logger.warning(f"⚠️  Result {result_id} not found")
        return
    
    logger.debug(f"   - Current status: {result.status.value if hasattr(result.status, 'value') else result.status}")
    
    if result.status == RecipientStatus.delivered:
        logger.debug(f"ℹ️  Already delivered, skipping")
        return
    
    result.status = RecipientStatus.delivered
    result.sent_at = sent_at
    result.delivered_at = sent_at
    
    if message_id:
        result.message_id = message_id
    
    logger.debug(f"✅ Result updated to 'delivered'")
    
    # Update campaign stats
    logger.debug("📊 Updating campaign stats...")
    campaign = session.query(Campaign).filter(
        Campaign.campaign_id == result.campaign_id
    ).with_for_update().first()
    
    if campaign:
        campaign.sent_count = (campaign.sent_count or 0) + 1
        campaign.delivered_count = (campaign.delivered_count or 0) + 1
        
        if not campaign.channel_stats:
            campaign.channel_stats = {}
        
        channel_key = result.channel_used.value if hasattr(result.channel_used, 'value') else result.channel_used
        
        if channel_key not in campaign.channel_stats:
            campaign.channel_stats[channel_key] = {
                "sent": 0, "delivered": 0, "opened": 0,
                "clicked": 0, "bounced": 0, "failed": 0
            }
        
        campaign.channel_stats[channel_key]["sent"] += 1
        campaign.channel_stats[channel_key]["delivered"] += 1
        flag_modified(campaign, "channel_stats")
        
        logger.debug(f"   - Sent: {campaign.sent_count}")
        logger.debug(f"   - Delivered: {campaign.delivered_count}")
    
    session.flush()
    logger.debug("─" * 60)







def check_and_complete_campaigns():
    """
    ✅ SMART: Check all sending campaigns and complete them if done
    """
    from ..db import SessionLocal
    
    logger.info("╔═══════════════════════════════════════════════════════════╗")
    logger.info("║  CHECKING FOR COMPLETED CAMPAIGNS                         ║")
    logger.info("╚═══════════════════════════════════════════════════════════╝")
    
    with SessionLocal() as session:
        logger.debug("🔍 Querying for 'sending' campaigns...")
        
        sending_campaigns = session.query(Campaign).filter(
            Campaign.status == CampaignStatus.sending
        ).all()
        
        logger.info(f"📋 Found {len(sending_campaigns)} sending campaign(s)")
        
        if not sending_campaigns:
            logger.info("✅ No campaigns to check")
            logger.info("")
            return {"completed": 0}
        
        logger.info("")
        
        completed_count = 0
        
        for idx, campaign in enumerate(sending_campaigns, 1):
            logger.info(f"━━━ Checking campaign {idx}/{len(sending_campaigns)} ━━━")
            logger.info(f"📋 {campaign.campaign_name}")
            logger.info(f"🆔 {campaign.campaign_id}")
            
            try:
                logger.debug("🔍 Counting pending results...")
                pending_count = session.query(CampaignResult).filter(
                    CampaignResult.campaign_id == campaign.campaign_id,
                    CampaignResult.status.in_([
                        RecipientStatus.queued,
                        RecipientStatus.pending
                    ])
                ).count()
                
                logger.info(f"📊 Pending: {pending_count}")
                
                if pending_count == 0:
                    logger.info("🎉 CAMPAIGN IS COMPLETE!")
                    
                    campaign.status = CampaignStatus.completed
                    campaign.completed_at = datetime.now(UTC)
                    
                    completed_count += 1
                    
                    logger.info(f"✅ Marked as COMPLETED")
                    logger.info(f"   - Completed at: {campaign.completed_at}")
                    logger.info(f"   - Sent: {campaign.sent_count or 0}")
                    logger.info(f"   - Delivered: {campaign.delivered_count or 0}")
                    logger.info(f"   - Failed: {campaign.failed_count or 0}")
                else:
                    logger.debug(f"ℹ️  Still has {pending_count} pending result(s)")
            
            except Exception as e:
                logger.error(f"❌ Error checking campaign {campaign.campaign_id}")
                logger.error(f"   Error: {e}", exc_info=True)
            
            logger.info("")
        
        if completed_count > 0:
            logger.debug("💾 Committing changes...")
            session.commit()
            logger.debug("✅ Changes committed")
        
        logger.info("╔═══════════════════════════════════════════════════════════╗")
        logger.info(f"║  ✅ COMPLETED {completed_count:2d} CAMPAIGN(S)                          ║")
        logger.info("╚═══════════════════════════════════════════════════════════╝")
        logger.info("")
        
        return {"completed": completed_count}