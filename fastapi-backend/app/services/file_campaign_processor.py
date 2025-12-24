# ============================================
# FIXED B2C CAMPAIGN FILE PROCESSOR
# Replace app/services/file_campaign_processor.py
# ============================================
"""
Process B2C campaigns from CSV/Excel files.

✅ FIXES:
1. Accepts IDs instead of objects for background tasks
2. Creates own database session (not tied to request)
3. Uses audience_file.storage_key instead of hardcoded path
4. Proper error handling and session cleanup
"""

import os
import csv
import uuid
import logging
from datetime import datetime, timezone
from typing import Dict, Any, Optional

from ..db import SessionLocal  # ✅ Import SessionLocal
from ..models.campaigns import CampaignStatus
from ..models.campaigns import Campaign, CampaignChannel, RecipientStatus
from ..models.audience_file import AudienceFile
from ..models.outbox import Outbox
from .variable_replacement_service import replace_variables, build_tracking_url

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)
UTC = timezone.utc


def generate_tracking_token():
    """Generate unique tracking token"""
    return f"camp_tracking_{uuid.uuid4().hex[:8]}"


def get_survey_url_for_b2c(campaign: Campaign, row: Dict[str, str], tracking_token: str) -> str:
    """
    Build survey URL for B2C recipient.
    
    Since we don't have Contact object, we use CSV row data directly.
    """
    base_url = os.getenv("SURVEY_BASE_URL", "https://surveyarc-docker.vercel.app/form")
    
    # Build URL with tracking params
    from urllib.parse import urlencode
    
    tracking_params = {
        'campaign_id': campaign.campaign_id,
        'survey_id': campaign.survey_id,
        'tracking_token': tracking_token,
        'org_id': campaign.org_id,
        'source': campaign.channel.value,
        'channel': 'campaign',
        'utm_source': 'campaign',
        'utm_medium': campaign.channel.value,
        'utm_campaign': campaign.campaign_name,
    }
    
    # Add email/phone from CSV if available
    if row.get('email'):
        tracking_params['email'] = row['email']
    if row.get('phone'):
        tracking_params['phone'] = row['phone']
    
    query_string = urlencode(tracking_params)
    final_url = f"{base_url}?{query_string}"
    
    return final_url


def replace_variables_from_row(
    template: str,
    row: Dict[str, str],
    campaign: Campaign,
    survey_url: str,
    tracking_token: str
) -> str:
    """
    Replace variables in template using CSV row data.
    
    Supports:
    - {{name}}, {{email}}, {{phone}}
    - {{survey_link}}, {{short_link}}
    - {{campaign_name}}
    - Any custom column from CSV (e.g., {{company}}, {{city}})
    """
    import re
    
    if not template:
        return ""
    
    # Build replacements from CSV columns
    replacements = {}
    
    # Standard fields
    replacements['name'] = row.get('name', row.get('full_name', 'there'))
    replacements['first_name'] = replacements['name'].split()[0] if replacements['name'] != 'there' else 'there'
    replacements['email'] = row.get('email', '')
    replacements['phone'] = row.get('phone', '')
    
    # Campaign info
    replacements['campaign_name'] = campaign.campaign_name
    replacements['campaign_id'] = campaign.campaign_id
    replacements['survey_id'] = campaign.survey_id
    
    # Tracking
    replacements['tracking_token'] = tracking_token
    replacements['survey_link'] = survey_url
    replacements['short_link'] = survey_url
    replacements['link'] = survey_url
    
    # Date/time
    now = datetime.now(UTC)
    replacements['current_date'] = now.strftime('%B %d, %Y')
    replacements['current_year'] = now.strftime('%Y')
    replacements['current_time'] = now.strftime('%I:%M %p')
    
    # Add ALL CSV columns as variables (company, city, etc.)
    for key, value in row.items():
        if key not in replacements:  # Don't override standard fields
            replacements[key.lower()] = value
    
    # Replace all {{variable}} patterns
    result_text = template
    for key, value in replacements.items():
        pattern = r'\{\{\s*' + re.escape(key) + r'\s*\}\}'
        result_text = re.sub(pattern, str(value), result_text, flags=re.IGNORECASE)
    
    return result_text


def prepare_b2c_campaign_file(
    file_path: str,
    campaign: Campaign
) -> str:
    """
    Step 1: Read CSV and add tracking columns.
    
    Adds:
    - tracking_token
    - status (pending)
    - sent_at
    - delivered_at
    - message_id
    - error
    
    Returns: Path to updated file
    """
    logger.info("=" * 80)
    logger.info(f"📋 PREPARING B2C CAMPAIGN FILE")
    logger.info(f"   Campaign: {campaign.campaign_name}")
    logger.info(f"   File: {file_path}")
    logger.info("=" * 80)
    
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"CSV file not found: {file_path}")
    
    # Read original CSV
    rows = []
    with open(file_path, 'r', newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        original_fieldnames = reader.fieldnames
        
        for row in reader:
            rows.append(row)
    
    logger.info(f"   ✅ Read {len(rows)} rows")
    
    # Add tracking columns
    new_fieldnames = list(original_fieldnames) + [
        'tracking_token',
        'status',
        'sent_at',
        'delivered_at',
        'message_id',
        'error'
    ]
    
    # Write updated CSV
    with open(file_path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=new_fieldnames)
        writer.writeheader()
        
        for row in rows:
            # Add tracking columns
            row['tracking_token'] = generate_tracking_token()
            row['status'] = 'pending'
            row['sent_at'] = ''
            row['delivered_at'] = ''
            row['message_id'] = ''
            row['error'] = ''
            
            writer.writerow(row)
    
    logger.info(f"   ✅ Added tracking columns")
    logger.info("=" * 80)
    
    return file_path


# ✅ NEW ASYNC VERSION - Accepts IDs, creates own session
def process_b2c_campaign_async(
    campaign_id: str,
    audience_file_id: str
):
    """
    Main B2C campaign processor for background tasks.
    
    ✅ FIXED:
    - Accepts IDs instead of objects
    - Creates own database session
    - Uses storage_key for file path
    
    Flow:
    1. Create new database session
    2. Load campaign and audience file
    3. Validate file exists at storage_key
    4. Prepare file with tracking columns
    5. Process batch-by-batch
    6. Create outbox entries
    7. Update campaign status
    """
    logger.info("=" * 80)
    logger.info(f"🚀 STARTING B2C CAMPAIGN PROCESSING (ASYNC)")
    logger.info(f"   Campaign ID: {campaign_id}")
    logger.info(f"   Audience File ID: {audience_file_id}")
    logger.info("=" * 80)
    
    # ✅ Create new session for background task
    db = SessionLocal()
    
    try:
        # ✅ Load campaign and audience file
        campaign = db.query(Campaign).filter(
            Campaign.campaign_id == campaign_id
        ).first()
        
        if not campaign:
            raise Exception(f"Campaign {campaign_id} not found")
        
        audience_file = db.query(AudienceFile).filter(
            AudienceFile.id == audience_file_id
        ).first()
        
        if not audience_file:
            raise Exception(f"Audience file {audience_file_id} not found")
        
        logger.info(f"   ✅ Loaded campaign: {campaign.campaign_name}")
        logger.info(f"   ✅ Loaded file: {audience_file.filename}")
        
        # ✅ FIX: Use storage_key from database
        file_path = audience_file.storage_key
        
        if not file_path:
            raise Exception("Audience file has no storage_key")
        
        logger.info(f"   📁 File path: {file_path}")
        
        # Validate file exists
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"File not found at: {file_path}")
        
        # Prepare file with tracking columns
        file_path = prepare_b2c_campaign_file(file_path, campaign)
        
        # Process all rows
        queued_count = queue_b2c_campaign_batch(db, campaign, file_path)
        
        # Update campaign
        campaign.total_recipients = queued_count
        campaign.status = CampaignStatus.sending
        db.commit()
        
        logger.info("=" * 80)
        logger.info(f"✅ B2C CAMPAIGN PROCESSING COMPLETE")
        logger.info(f"   Queued: {queued_count} messages")
        logger.info("=" * 80)
        
    except Exception as e:
        logger.error(f"❌ B2C Campaign processing failed: {e}", exc_info=True)
        
        # Update campaign status
        try:
            campaign = db.query(Campaign).filter(
                Campaign.campaign_id == campaign_id
            ).first()
            
            if campaign:
                campaign.status = CampaignStatus.failed
                db.commit()
        except:
            pass
        
        raise
    
    finally:
        # ✅ Always close session
        db.close()


def queue_b2c_campaign_batch(
    db,  # Session from background task
    campaign: Campaign,
    file_path: str,
    batch_size: int = 100
) -> int:
    """
    Queue B2C campaign messages to outbox.
    
    Reads CSV and creates outbox entries for each recipient.
    """
    logger.info("=" * 80)
    logger.info(f"📤 QUEUEING B2C CAMPAIGN BATCH")
    logger.info(f"   File: {file_path}")
    logger.info(f"   Batch size: {batch_size}")
    logger.info("=" * 80)
    
    queued_count = 0
    skipped_count = 0
    error_count = 0
    
    with open(file_path, 'r', newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        
        for idx, row in enumerate(reader, 1):
            try:
                # Skip if already processed
                if row.get('status') not in ['pending', '']:
                    logger.debug(f"⏭️  Row {idx}: Already processed")
                    skipped_count += 1
                    continue
                
                # Validate email/phone based on channel
                if campaign.channel == CampaignChannel.email:
                    if not row.get('email'):
                        logger.warning(f"⚠️  Row {idx}: Missing email")
                        skipped_count += 1
                        continue
                    recipient_address = row['email']
                
                elif campaign.channel in [CampaignChannel.sms, CampaignChannel.whatsapp]:
                    if not row.get('phone'):
                        logger.warning(f"⚠️  Row {idx}: Missing phone")
                        skipped_count += 1
                        continue
                    recipient_address = row['phone']
                
                else:
                    logger.warning(f"⚠️  Row {idx}: Unsupported channel")
                    skipped_count += 1
                    continue
                
                # Get tracking token
                tracking_token = row.get('tracking_token')
                if not tracking_token:
                    tracking_token = generate_tracking_token()
                
                # Build survey URL
                survey_url = get_survey_url_for_b2c(campaign, row, tracking_token)
                
                # Build payload
                payload = build_b2c_payload(
                    campaign=campaign,
                    row=row,
                    tracking_token=tracking_token,
                    survey_url=survey_url,
                    recipient_address=recipient_address
                )
                
                # Create outbox entry
                dedupe_key = f"b2c:{campaign.campaign_id}:{tracking_token}"
                
                outbox = Outbox(
                    kind=f"campaign.{campaign.channel.value}",
                    dedupe_key=dedupe_key,
                    payload=payload
                )
                
                db.add(outbox)
                queued_count += 1
                
                if queued_count % 100 == 0:
                    db.flush()
                    logger.info(f"   ✅ Queued {queued_count} messages...")
                
            except Exception as e:
                logger.error(f"❌ Row {idx} failed: {e}")
                error_count += 1
        
        db.flush()
    
    logger.info("=" * 80)
    logger.info(f"📊 BATCH QUEUEING COMPLETE")
    logger.info(f"   ✅ Queued: {queued_count}")
    logger.info(f"   ⏭️  Skipped: {skipped_count}")
    logger.info(f"   ❌ Errors: {error_count}")
    logger.info("=" * 80)
    
    return queued_count


def build_b2c_payload(
    campaign: Campaign,
    row: Dict[str, str],
    tracking_token: str,
    survey_url: str,
    recipient_address: str
) -> dict:
    """
    Build outbox payload for B2C campaign message.
    """
    base_payload = {
        "campaign_id": campaign.campaign_id,
        "tracking_token": tracking_token,
        "recipient_name": row.get('name', row.get('full_name', 'there')),
        "survey_link": survey_url,
        "short_link": survey_url,
        "b2c_mode": True,  # 🔥 IMPORTANT: Flag for outbox processor
    }
    
    # Channel-specific payload
    if campaign.channel == CampaignChannel.email:
        email_subject = replace_variables_from_row(
            campaign.email_subject or 'Survey Invitation',
            row,
            campaign,
            survey_url,
            tracking_token
        )
        
        email_body = replace_variables_from_row(
            campaign.email_body_html or '',
            row,
            campaign,
            survey_url,
            tracking_token
        )
        
        payload = {
            **base_payload,
            "to": [recipient_address],
            "subject": email_subject,
            "html": email_body,
            "from_name": campaign.email_from_name,
            "reply_to": campaign.email_reply_to,
        }
    
    elif campaign.channel == CampaignChannel.sms:
        sms_message = replace_variables_from_row(
            campaign.sms_message or '',
            row,
            campaign,
            survey_url,
            tracking_token
        )
        
        payload = {
            **base_payload,
            "to": recipient_address,
            "message": sms_message,
        }
    
    elif campaign.channel == CampaignChannel.whatsapp:
        whatsapp_message = replace_variables_from_row(
            campaign.whatsapp_message or '',
            row,
            campaign,
            survey_url,
            tracking_token
        )
        
        payload = {
            **base_payload,
            "to": recipient_address,
            "message": whatsapp_message,
            "template_id": campaign.whatsapp_template_id,
        }
    
    else:
        payload = base_payload
    
    return payload


def get_b2c_campaign_stats(file_path: str) -> Dict[str, int]:
    """
    Get statistics from B2C campaign CSV file.
    
    Returns counts of: pending, sent, delivered, failed, etc.
    """
    if not os.path.exists(file_path):
        return {
            "total": 0,
            "pending": 0,
            "sent": 0,
            "delivered": 0,
            "failed": 0,
        }
    
    stats = {
        "total": 0,
        "pending": 0,
        "sent": 0,
        "delivered": 0,
        "failed": 0,
    }
    
    with open(file_path, 'r', newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        
        for row in reader:
            stats["total"] += 1
            
            status = row.get('status', 'pending').lower()
            
            if status in stats:
                stats[status] += 1
    
    return stats