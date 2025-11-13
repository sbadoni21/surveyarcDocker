# ============================================
# CAMPAIGN SCHEDULER SERVICE - app/services/campaign_scheduler_service.py
# ============================================

import logging
import time
import threading
from datetime import datetime, timezone, timedelta
from typing import Optional
import sqlalchemy as sa
from sqlalchemy.orm import Session, joinedload

from ..db import SessionLocal
from ..models.campaigns import Campaign, CampaignStatus
from .campaign_sender_service import create_campaign_results, process_campaign_batch
from ..models.contact import Contact, ContactList, list_members

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)
UTC = timezone.utc


class CampaignScheduler:
    """
    Background service that checks for scheduled campaigns
    and automatically triggers them when their scheduled time arrives
    """
    
    def __init__(self, check_interval: int = 60):
        """
        Args:
            check_interval: How often to check for scheduled campaigns (in seconds)
        """
        self.check_interval = check_interval
        self.running = False
        self.thread: Optional[threading.Thread] = None
        self.check_count = 0
        self.last_check_time = None
        
    def start(self):
        """Start the scheduler in a background thread"""
        if self.running:
            logger.warning("Campaign scheduler is already running")
            return
        
        self.running = True
        self.thread = threading.Thread(target=self._run_loop, daemon=True)
        self.thread.start()
        logger.info(f"📅 Campaign scheduler started (check_interval={self.check_interval}s)")
    
    def stop(self):
        """Stop the scheduler"""
        if not self.running:
            return
        
        self.running = False
        if self.thread:
            self.thread.join(timeout=5)
        logger.info(f"📅 Campaign scheduler stopped after {self.check_count} checks")
    
    def _run_loop(self):
        """Main scheduler loop"""
        logger.info(f"🔄 Scheduler loop started - checking every {self.check_interval}s")
        
        while self.running:
            try:
                self.check_count += 1
                self.last_check_time = datetime.now(UTC)
                
                logger.info(f"🔍 [Check #{self.check_count}] Scanning for scheduled campaigns at {self.last_check_time.strftime('%Y-%m-%d %H:%M:%S UTC')}")
                
                triggered_count = self._check_and_trigger_campaigns()
                
                if triggered_count > 0:
                    logger.info(f"✅ [Check #{self.check_count}] Triggered {triggered_count} campaign(s)")
                else:
                    logger.info(f"ℹ️  [Check #{self.check_count}] No campaigns to trigger")
                    
            except Exception as e:
                logger.error(f"❌ Error in campaign scheduler loop: {e}", exc_info=True)
            
            # Sleep for check_interval
            logger.debug(f"😴 Sleeping for {self.check_interval}s until next check...")
            time.sleep(self.check_interval)
        
        logger.info("🛑 Scheduler loop ended")
    
    def _check_and_trigger_campaigns(self) -> int:
        """
        Check for scheduled campaigns and trigger them
        Returns: Number of campaigns triggered
        """
        triggered_count = 0
        
        with SessionLocal() as session:
            now = datetime.now(UTC)
            
            # Find campaigns that should be triggered
            campaigns = session.query(Campaign).filter(
                Campaign.status == CampaignStatus.scheduled,
                Campaign.scheduled_at.isnot(None),
                Campaign.scheduled_at <= now,
                Campaign.deleted_at.is_(None)
            ).with_for_update(skip_locked=True).all()
            
            if not campaigns:
                logger.debug(f"No scheduled campaigns found (checked up to {now.strftime('%Y-%m-%d %H:%M:%S UTC')})")
                return 0
            
            logger.info(f"📬 Found {len(campaigns)} campaign(s) ready to trigger:")
            for campaign in campaigns:
                logger.info(f"   - {campaign.campaign_name} (ID: {campaign.campaign_id}, scheduled: {campaign.scheduled_at})")
            
            for campaign in campaigns:
                try:
                    self._trigger_campaign(session, campaign)
                    session.commit()
                    triggered_count += 1
                    logger.info(f"✅ Successfully triggered campaign: {campaign.campaign_name}")
                except Exception as e:
                    session.rollback()
                    logger.error(
                        f"❌ Error triggering campaign {campaign.campaign_id} ({campaign.campaign_name}): {e}",
                        exc_info=True
                    )
        
        return triggered_count
    
    def _trigger_campaign(self, session: Session, campaign: Campaign):
        """Trigger a single campaign"""
        logger.info(f"🚀 Triggering campaign: {campaign.campaign_name} (ID: {campaign.campaign_id})")
        
        # ✅ Validate contact list exists
        if campaign.contact_list_id:
            contact_list = session.query(ContactList).filter(
                ContactList.list_id == campaign.contact_list_id,
                ContactList.deleted_at.is_(None)
            ).first()
            
            if not contact_list:
                logger.error(f"❌ Contact list {campaign.contact_list_id} not found or deleted")
                campaign.status = CampaignStatus.cancelled
                campaign.meta_data = campaign.meta_data or {}
                campaign.meta_data["cancel_reason"] = "Contact list not found"
                campaign.meta_data["cancelled_at"] = datetime.now(UTC).isoformat()
                return
            
            logger.info(f"📋 Using contact list: {contact_list.list_name}")
        
        # Validate campaign has content
        if not campaign.validate_content_for_channel(campaign.channel):
            logger.error(
                f"❌ Campaign {campaign.campaign_id} missing content for channel {campaign.channel}"
            )
            campaign.status = CampaignStatus.cancelled
            campaign.meta_data = campaign.meta_data or {}
            campaign.meta_data["cancel_reason"] = "Missing required content"
            campaign.meta_data["cancelled_at"] = datetime.now(UTC).isoformat()
            return
        
        # Get recipients
        logger.info(f"👥 Getting recipients for campaign {campaign.campaign_id}...")
        contacts = self._get_campaign_contacts(session, campaign)
        
        if not contacts:
            logger.warning(f"⚠️  No contacts found for campaign {campaign.campaign_id}")
            campaign.status = CampaignStatus.cancelled
            campaign.meta_data = campaign.meta_data or {}
            campaign.meta_data["cancel_reason"] = "No recipients found"
            campaign.meta_data["cancelled_at"] = datetime.now(UTC).isoformat()
            return
        
        logger.info(f"👥 Found {len(contacts)} contact(s) for campaign")
        
        # Create campaign results
        logger.info(f"📝 Creating campaign results...")
        results_created = create_campaign_results(session, campaign, contacts)
        
        if results_created == 0:
            logger.warning(f"⚠️  No valid recipients for campaign {campaign.campaign_id}")
            campaign.status = CampaignStatus.cancelled
            campaign.meta_data = campaign.meta_data or {}
            campaign.meta_data["cancel_reason"] = "No valid recipients"
            campaign.meta_data["cancelled_at"] = datetime.now(UTC).isoformat()
            return
        
        logger.info(f"✅ Created {results_created} campaign result(s)")
        
        # Update campaign status
        campaign.status = CampaignStatus.sending
        campaign.started_at = datetime.now(UTC)
        campaign.total_recipients = results_created
        
        session.flush()
        
        logger.info(f"📤 Campaign {campaign.campaign_id} status updated to 'sending'")
        
        # Trigger background batch processing
        logger.info(f"🔄 Starting background batch processing for campaign {campaign.campaign_id}...")
        threading.Thread(
            target=self._process_campaign_async,
            args=(campaign.campaign_id,),
            daemon=True,
            name=f"CampaignProcessor-{campaign.campaign_id[:8]}"
        ).start()
        
        logger.info(
            f"✅ Campaign {campaign.campaign_id} ({campaign.campaign_name}) triggered successfully "
            f"with {results_created} recipient(s)"
        )
    
    def _get_campaign_contacts(self, session: Session, campaign: Campaign) -> list:
        """Get contacts for a campaign based on contact_list_id or filters"""
        
        # ✅ Eager load emails and phones to avoid N+1 queries
        query = session.query(Contact).options(
            joinedload(Contact.emails),
            joinedload(Contact.phones),
            joinedload(Contact.socials)
        ).filter(
            Contact.org_id == campaign.org_id,
            Contact.status == "active",
            Contact.deleted_at.is_(None)
        )
        
        # Filter by contact list if specified
        if campaign.contact_list_id:
            logger.debug(f"Filtering by contact_list_id: {campaign.contact_list_id}")
            
            query = query.join(
                list_members, 
                list_members.c.contact_id == Contact.contact_id
            ).filter(
                list_members.c.list_id == campaign.contact_list_id
            )
        
        # Apply additional filters
        if campaign.contact_filters:
            filters = campaign.contact_filters
            logger.debug(f"Applying contact filters: {filters}")
            
            if "contact_type" in filters and filters["contact_type"]:
                from ..models.contact import ContactType
                query = query.filter(Contact.contact_type == ContactType(filters["contact_type"]))
        
        contacts = query.all()
        logger.info(f"✅ Query returned {len(contacts)} contact(s)")
        
        return contacts
    
    def _process_campaign_async(self, campaign_id: str):
        """Process campaign batches asynchronously"""
        logger.info(f"🔄 Starting async processing for campaign {campaign_id}")
        
        try:
            # Process first batch
            result = process_campaign_batch(campaign_id, batch_size=100)
            logger.info(f"✅ Processed first batch for campaign {campaign_id}: {result}")
        except Exception as e:
            logger.error(
                f"❌ Error processing campaign batch {campaign_id}: {e}",
                exc_info=True
            )


_scheduler_instance: Optional[CampaignScheduler] = None


def get_scheduler(check_interval: int = 60) -> CampaignScheduler:
    """Get or create the global scheduler instance"""
    global _scheduler_instance
    
    if _scheduler_instance is None:
        _scheduler_instance = CampaignScheduler(check_interval=check_interval)
        logger.info(f"Created new CampaignScheduler instance with {check_interval}s interval")
    
    return _scheduler_instance


def start_scheduler(check_interval: int = 60):
    """Start the global campaign scheduler"""
    logger.info(f"Starting global campaign scheduler...")
    scheduler = get_scheduler(check_interval)
    scheduler.start()


def stop_scheduler():
    """Stop the global campaign scheduler"""
    global _scheduler_instance
    
    if _scheduler_instance:
        logger.info("Stopping global campaign scheduler...")
        _scheduler_instance.stop()
        _scheduler_instance = None
    else:
        logger.warning("No scheduler instance to stop")


# ==================== MANUAL TRIGGER FUNCTION ====================

def trigger_scheduled_campaigns_now():
    """
    Manually trigger all scheduled campaigns that are due
    Useful for testing or manual execution
    """
    logger.info("🔧 Manual trigger requested for scheduled campaigns")
    
    with SessionLocal() as session:
        now = datetime.now(UTC)
        
        campaigns = session.query(Campaign).filter(
            Campaign.status == CampaignStatus.scheduled,
            Campaign.scheduled_at.isnot(None),
            Campaign.scheduled_at <= now,
            Campaign.deleted_at.is_(None)
        ).all()
        
        if not campaigns:
            logger.info("No scheduled campaigns to trigger")
            return {"triggered": 0, "campaigns": []}
        
        logger.info(f"Found {len(campaigns)} campaign(s) to manually trigger")
        
        scheduler = CampaignScheduler()
        triggered = []
        
        for campaign in campaigns:
            try:
                scheduler._trigger_campaign(session, campaign)
                session.commit()
                triggered.append({
                    "campaign_id": campaign.campaign_id,
                    "campaign_name": campaign.campaign_name,
                    "recipients": campaign.total_recipients
                })
                logger.info(f"✅ Manually triggered: {campaign.campaign_name}")
            except Exception as e:
                session.rollback()
                logger.error(f"❌ Error manually triggering campaign {campaign.campaign_id}: {e}")
        
        result = {
            "triggered": len(triggered),
            "campaigns": triggered
        }
        
        logger.info(f"Manual trigger complete: {result}")
        return result


# ==================== SCHEDULER STATUS ====================

def get_scheduler_status() -> dict:
    """Get current scheduler status"""
    global _scheduler_instance
    
    if _scheduler_instance is None:
        return {
            "running": False,
            "message": "Scheduler not initialized"
        }
    
    return {
        "running": _scheduler_instance.running,
        "check_interval": _scheduler_instance.check_interval,
        "total_checks": _scheduler_instance.check_count,
        "last_check": _scheduler_instance.last_check_time.isoformat() if _scheduler_instance.last_check_time else None,
        "thread_alive": _scheduler_instance.thread.is_alive() if _scheduler_instance.thread else False
    }