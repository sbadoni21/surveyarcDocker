# ============================================
# B2C CAMPAIGN SENDER SERVICE
# app/services/b2c_campaign_sender_service.py
# ============================================
"""
Processes B2C campaigns from audience files (CSV/Excel).

Key differences from B2B:
❌ No CampaignResult table writes
✅ Updates CSV directly with status columns
✅ Smart outbox batching to prevent server overload
✅ Returns updated file to user for download
"""

import os
import csv
import tempfile
import logging
from datetime import datetime, timezone
from typing import List, Dict, Optional, Tuple
from sqlalchemy.orm import Session
from pathlib import Path

from ..models.campaigns import Campaign, CampaignChannel, CampaignStatus
from ..models.audience_file import AudienceFile
from ..models.outbox import Outbox
from ..utils.id_generator import generate_id
from .variable_replacement_service import replace_variables
import secrets

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)
UTC = timezone.utc

# ============================================
# CONFIGURATION
# ============================================

# Smart batching to prevent server overload
OUTBOX_BATCH_SIZE = 50  # Max outbox entries per batch
PROCESSING_DELAY_SECONDS = 2  # Delay between batches

# Required CSV columns for status tracking
REQUIRED_STATUS_COLUMNS = [
    "status",           # pending, sent, delivered, failed, bounced
    "sent_at",          # Timestamp when sent
    "delivered_at",     # Timestamp when delivered
    "message_id",       # Provider message ID
    "error",            # Error message if failed
    "tracking_token",   # Unique tracking token
]


# ============================================
# CSV FILE HANDLING
# ============================================

def ensure_status_columns(file_path: str) -> List[str]:
    """
    Ensures tracking columns exist in CSV.
    - Adds only missing columns
    - Preserves row order
    - Safe to call multiple times
    
    Returns: List of all column names
    """
    logger.info(f"📋 Ensuring status columns in {Path(file_path).name}")
    
    with open(file_path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        existing_columns = reader.fieldnames or []
    
    logger.debug(f"   - Existing columns: {len(existing_columns)}")
    
    missing = [c for c in REQUIRED_STATUS_COLUMNS if c not in existing_columns]
    
    if not missing:
        logger.debug("   ✅ All status columns present")
        return existing_columns
    
    logger.info(f"   ➕ Adding {len(missing)} missing columns: {missing}")
    
    new_columns = existing_columns + missing
    temp_path = file_path + ".tmp"
    
    with open(file_path, newline="", encoding="utf-8") as src, \
         open(temp_path, "w", newline="", encoding="utf-8") as dst:
        
        reader = csv.DictReader(src)
        writer = csv.DictWriter(dst, fieldnames=new_columns)
        writer.writeheader()
        
        for row in reader:
            # Initialize new columns with empty values
            for col in missing:
                row[col] = ""
            writer.writerow(row)
    
    os.replace(temp_path, file_path)
    logger.info(f"   ✅ Status columns added successfully")
    
    return new_columns


def update_csv_row_status(
    file_path: str,
    row_index: int,
    status: str,
    message_id: Optional[str] = None,
    error: Optional[str] = None,
    sent_at: Optional[datetime] = None,
    delivered_at: Optional[datetime] = None
):
    """
    Update a specific row in the CSV with status information.
    
    Args:
        file_path: Path to CSV file
        row_index: 0-based row index (excluding header)
        status: Status value (pending, sent, delivered, failed, bounced)
        message_id: Provider message ID
        error: Error message if failed
        sent_at: Timestamp when sent
        delivered_at: Timestamp when delivered
    """
    logger.debug(f"📝 Updating CSV row {row_index}: status={status}")
    
    temp_path = file_path + ".tmp"
    
    with open(file_path, newline="", encoding="utf-8") as src, \
         open(temp_path, "w", newline="", encoding="utf-8") as dst:
        
        reader = csv.DictReader(src)
        writer = csv.DictWriter(dst, fieldnames=reader.fieldnames)
        writer.writeheader()
        
        for idx, row in enumerate(reader):
            if idx == row_index:
                # Update status fields
                row["status"] = status
                
                if message_id:
                    row["message_id"] = message_id
                
                if error:
                    row["error"] = error[:500]  # Truncate long errors
                
                if sent_at:
                    row["sent_at"] = sent_at.isoformat()
                
                if delivered_at:
                    row["delivered_at"] = delivered_at.isoformat()
            
            writer.writerow(row)
    
    os.replace(temp_path, file_path)
    logger.debug(f"   ✅ Row {row_index} updated")


def get_pending_rows(file_path: str) -> List[Tuple[int, Dict]]:
    """
    Get all pending rows from CSV.
    
    Returns: List of (row_index, row_dict) tuples
    """
    logger.info(f"🔍 Reading pending rows from {Path(file_path).name}")
    
    pending_rows = []
    
    with open(file_path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        
        for idx, row in enumerate(reader):
            status = row.get("status", "").strip()
            
            # Consider empty or "pending" as pending
            if not status or status == "pending":
                pending_rows.append((idx, row))
    
    logger.info(f"   ✅ Found {len(pending_rows)} pending rows")
    
    return pending_rows


# ============================================
# TRACKING TOKEN GENERATION
# ============================================

def generate_tracking_token() -> str:
    """Generate unique tracking token for B2C campaigns"""
    return "b2c_" + secrets.token_hex(6)


# ============================================
# PAYLOAD BUILDING
# ============================================

def build_b2c_payload(
    campaign: Campaign,
    row: Dict,
    tracking_token: str,
    channel: CampaignChannel
) -> Dict:
    """
    Build payload for outbox from CSV row.
    
    Args:
        campaign: Campaign object
        row: CSV row dict
        tracking_token: Unique tracking token
        channel: Channel to use
    
    Returns: Payload dict for outbox
    """
    logger.debug(f"🔨 Building B2C payload for channel: {channel.value}")
    
    # Extract recipient info from CSV
    recipient_email = row.get("email", "").strip()
    recipient_phone = row.get("phone", "").strip()
    recipient_name = row.get("name", "").strip() or "there"
    
    # Get survey URL
    survey_url = os.getenv(
        "SURVEY_BASE_URL", 
        "https://surveyarc-docker.vercel.app/form"
    )
    
    # Build base payload
    base_payload = {
        "campaign_id": campaign.campaign_id,
        "tracking_token": tracking_token,
        "recipient_name": recipient_name,
        "survey_link": survey_url,
        "short_link": survey_url,
        "b2c_mode": True,  # Flag to indicate B2C processing
    }
    
    # Build channel-specific payload
    if channel == CampaignChannel.email:
        if not recipient_email:
            raise ValueError("Email address required for email channel")
        
        # Simple variable replacement (no contact object needed)
        email_subject = campaign.email_subject or "Survey Invitation"
        email_body = campaign.email_body_html or ""
        
        # Replace basic variables
        email_subject = email_subject.replace("{{name}}", recipient_name)
        email_subject = email_subject.replace("{{survey_link}}", survey_url)
        
        email_body = email_body.replace("{{name}}", recipient_name)
        email_body = email_body.replace("{{survey_link}}", survey_url)
        email_body = email_body.replace("{{tracking_token}}", tracking_token)
        
        payload = {
            **base_payload,
            "to": [recipient_email],
            "subject": email_subject,
            "html": email_body,
            "from_name": campaign.email_from_name,
            "reply_to": campaign.email_reply_to,
        }
        
    elif channel == CampaignChannel.sms:
        if not recipient_phone:
            raise ValueError("Phone number required for SMS channel")
        
        sms_message = campaign.sms_message or ""
        sms_message = sms_message.replace("{{name}}", recipient_name)
        sms_message = sms_message.replace("{{survey_link}}", survey_url)
        
        payload = {
            **base_payload,
            "to": recipient_phone,
            "message": sms_message,
        }
        
    elif channel == CampaignChannel.whatsapp:
        if not recipient_phone:
            raise ValueError("Phone number required for WhatsApp channel")
        
        whatsapp_message = campaign.whatsapp_message or ""
        whatsapp_message = whatsapp_message.replace("{{name}}", recipient_name)
        whatsapp_message = whatsapp_message.replace("{{survey_link}}", survey_url)
        
        payload = {
            **base_payload,
            "to": recipient_phone,
            "message": whatsapp_message,
            "template_id": campaign.whatsapp_template_id,
        }
    
    else:
        raise ValueError(f"Unsupported channel: {channel.value}")
    
    logger.debug(f"   ✅ Payload built with {len(payload)} keys")
    
    return payload


# ============================================
# SMART OUTBOX BATCHING
# ============================================

def queue_b2c_campaign_batch(
    session: Session,
    campaign: Campaign,
    file_path: str,
    batch_size: int = OUTBOX_BATCH_SIZE
) -> Dict:
    """
    Queue a batch of B2C campaign sends to outbox.
    
    Smart batching prevents server overload:
    - Processes limited rows per call
    - Updates CSV with tracking tokens
    - Returns stats for progress tracking
    
    Args:
        session: Database session
        campaign: Campaign object
        file_path: Path to CSV file
        batch_size: Max rows to process (default: 50)
    
    Returns: Dict with stats
    """
    logger.info("=" * 80)
    logger.info("📤 QUEUEING B2C CAMPAIGN BATCH")
    logger.info("=" * 80)
    logger.info(f"📋 Campaign: {campaign.campaign_name}")
    logger.info(f"📁 File: {Path(file_path).name}")
    logger.info(f"📦 Batch size: {batch_size}")
    logger.info("")
    
    # Ensure status columns exist
    ensure_status_columns(file_path)
    
    # Get pending rows
    pending_rows = get_pending_rows(file_path)
    
    if not pending_rows:
        logger.info("✅ No pending rows to process")
        return {
            "queued": 0,
            "remaining": 0,
            "completed": True
        }
    
    logger.info(f"📊 Total pending: {len(pending_rows)}")
    
    # Limit to batch size
    rows_to_process = pending_rows[:batch_size]
    remaining = len(pending_rows) - len(rows_to_process)
    
    logger.info(f"📦 Processing: {len(rows_to_process)} rows")
    logger.info(f"⏳ Remaining: {remaining} rows")
    logger.info("")
    
    queued_count = 0
    skipped_count = 0
    
    for row_index, row in rows_to_process:
        try:
            logger.debug(f"─ Processing row {row_index + 1}")
            
            # Generate tracking token
            tracking_token = generate_tracking_token()
            
            # Get channel
            channel = campaign.channel
            
            # Build payload
            payload = build_b2c_payload(
                campaign, 
                row, 
                tracking_token, 
                channel
            )
            
            # Create dedupe key
            dedupe_key = f"b2c:{campaign.campaign_id}:{tracking_token}"
            
            # Check for duplicate
            existing = session.query(Outbox).filter(
                Outbox.dedupe_key == dedupe_key
            ).first()
            
            if existing:
                logger.debug(f"   ⚠️  Duplicate - skipping")
                skipped_count += 1
                continue
            
            # Create outbox entry
            kind = f"campaign.{channel.value}"
            
            outbox = Outbox(
                kind=kind,
                dedupe_key=dedupe_key,
                payload=payload
            )
            
            session.add(outbox)
            session.flush()
            
            logger.debug(f"   ✅ Queued to outbox #{outbox.id}")
            
            # Update CSV with tracking token and pending status
            update_csv_row_status(
                file_path,
                row_index,
                status="pending",
                sent_at=None
            )
            
            # Store tracking token in CSV (add to row)
            temp_path = file_path + ".tmp"
            with open(file_path, newline="", encoding="utf-8") as src, \
                 open(temp_path, "w", newline="", encoding="utf-8") as dst:
                
                reader = csv.DictReader(src)
                writer = csv.DictWriter(dst, fieldnames=reader.fieldnames)
                writer.writeheader()
                
                for idx, csv_row in enumerate(reader):
                    if idx == row_index:
                        csv_row["tracking_token"] = tracking_token
                    writer.writerow(csv_row)
            
            os.replace(temp_path, file_path)
            
            queued_count += 1
            
        except Exception as e:
            logger.error(f"❌ Error processing row {row_index}: {e}")
            
            # Update CSV with error
            update_csv_row_status(
                file_path,
                row_index,
                status="failed",
                error=str(e)[:500]
            )
            
            skipped_count += 1
    
    # Commit batch
    session.commit()
    
    logger.info("")
    logger.info("📊 BATCH SUMMARY:")
    logger.info(f"   ✅ Queued: {queued_count}")
    logger.info(f"   ⚠️  Skipped: {skipped_count}")
    logger.info(f"   ⏳ Remaining: {remaining}")
    logger.info("")
    
    return {
        "queued": queued_count,
        "skipped": skipped_count,
        "remaining": remaining,
        "completed": remaining == 0
    }


# ============================================
# B2C CAMPAIGN PROCESSING
# ============================================

def process_b2c_campaign(
    session: Session,
    campaign: Campaign,
    audience_file: AudienceFile
) -> Dict:
    """
    Process entire B2C campaign in smart batches.
    
    Args:
        session: Database session
        campaign: Campaign object
        audience_file: AudienceFile object
    
    Returns: Processing stats
    """
    logger.info("=" * 80)
    logger.info("🚀 PROCESSING B2C CAMPAIGN")
    logger.info("=" * 80)
    logger.info(f"📋 Campaign: {campaign.campaign_name}")
    logger.info(f"📁 Audience: {audience_file.audience_name}")
    logger.info(f"📊 Rows: {audience_file.row_count}")
    logger.info("")
    
    # Download file from storage (assuming Firebase/S3)
    # For now, assume file is at download_url
    file_url = audience_file.download_url
    
    if not file_url:
        raise ValueError("Audience file has no download URL")
    
    # Download to temp location
    import httpx
    
    temp_dir = tempfile.mkdtemp()
    file_path = os.path.join(temp_dir, audience_file.filename)
    
    logger.info(f"⬇️  Downloading file from: {file_url}")
    
    with httpx.Client() as client:
        response = client.get(file_url)
        response.raise_for_status()
        
        with open(file_path, "wb") as f:
            f.write(response.content)
    
    logger.info(f"   ✅ Downloaded to: {file_path}")
    logger.info("")
    
    # Update campaign status
    campaign.status = CampaignStatus.sending
    campaign.started_at = datetime.now(UTC)
    session.commit()
    
    # Process in batches
    total_queued = 0
    batch_num = 0
    
    while True:
        batch_num += 1
        
        logger.info(f"📦 Processing batch #{batch_num}...")
        
        result = queue_b2c_campaign_batch(
            session,
            campaign,
            file_path,
            batch_size=OUTBOX_BATCH_SIZE
        )
        
        total_queued += result["queued"]
        
        if result["completed"]:
            logger.info("🎉 All rows processed!")
            break
        
        logger.info(f"⏳ {result['remaining']} rows remaining...")
        
        # Small delay to prevent overwhelming server
        import time
        time.sleep(PROCESSING_DELAY_SECONDS)
    
    # Upload updated file back to storage
    logger.info("")
    logger.info("⬆️  Uploading updated file...")
    
    # TODO: Implement actual upload to Firebase/S3
    # For now, just log the path
    logger.info(f"   📁 Updated file at: {file_path}")
    
    # Update campaign
    campaign.total_recipients = total_queued
    campaign.status = CampaignStatus.completed
    campaign.completed_at = datetime.now(UTC)
    session.commit()
    
    logger.info("")
    logger.info("=" * 80)
    logger.info("✅ B2C CAMPAIGN PROCESSING COMPLETE")
    logger.info("=" * 80)
    logger.info(f"📊 Total queued: {total_queued}")
    logger.info(f"📁 Updated file: {file_path}")
    logger.info("")
    
    return {
        "success": True,
        "total_queued": total_queued,
        "batches_processed": batch_num,
        "updated_file_path": file_path
    }


# ============================================
# STATUS UPDATE FROM OUTBOX
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
    Update CSV status when outbox message is processed.
    
    This is called by the outbox processor after sending.
    
    Args:
        session: Database session
        campaign_id: Campaign ID
        tracking_token: Tracking token from payload
        status: New status (sent, delivered, failed)
        message_id: Provider message ID
        error: Error message if failed
    """
    logger.debug(f"📝 Updating B2C status: {tracking_token} → {status}")
    
    # Get campaign and audience file
    campaign = session.query(Campaign).filter(
        Campaign.campaign_id == campaign_id
    ).first()
    
    if not campaign or not campaign.audience_file_id:
        logger.warning(f"⚠️  Campaign or audience file not found")
        return
    
    audience_file = session.query(AudienceFile).filter(
        AudienceFile.id == campaign.audience_file_id
    ).first()
    
    if not audience_file:
        logger.warning(f"⚠️  Audience file not found")
        return
    
    # Get file path (TODO: download from storage if needed)
    file_path = f"/tmp/{audience_file.filename}"
    
    if not os.path.exists(file_path):
        logger.warning(f"⚠️  File not found: {file_path}")
        return
    
    # Find row with matching tracking token
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
    
    logger.debug(f"   ✅ CSV updated for token: {tracking_token}")
    
    # TODO: Re-upload file to storage


# ============================================
# HELPER FUNCTIONS
# ============================================

def get_b2c_campaign_stats(file_path: str) -> Dict:
    """Get campaign statistics from CSV file"""
    
    stats = {
        "total": 0,
        "pending": 0,
        "sent": 0,
        "delivered": 0,
        "failed": 0,
        "bounced": 0
    }
    
    with open(file_path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        
        for row in reader:
            stats["total"] += 1
            
            status = row.get("status", "").strip().lower()
            
            if not status or status == "pending":
                stats["pending"] += 1
            elif status == "sent":
                stats["sent"] += 1
            elif status == "delivered":
                stats["delivered"] += 1
            elif status == "failed":
                stats["failed"] += 1
            elif status == "bounced":
                stats["bounced"] += 1
    
    return stats