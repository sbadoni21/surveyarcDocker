# ============================================
# SMART CAMPAIGN SCHEDULER SERVICE V3 - DEBUG VERSION
# app/services/campaign_scheduler_service_v3.py
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
from .campaign_sender_service import (
    create_campaign_results, 
    process_campaign_batch,
    check_and_complete_campaigns
)
from ..models.contact import Contact, ContactList, list_members

logging.basicConfig(
    level=logging.DEBUG,  # ✅ Changed to DEBUG for maximum verbosity
    format='%(asctime)s - %(name)s - %(levelname)s - [%(funcName)s:%(lineno)d] - %(message)s'
)
logger = logging.getLogger(__name__)
UTC = timezone.utc


class CampaignScheduler:
    """
    ✅ SMART: Enhanced scheduler with comprehensive debug logging
    """
    
    def __init__(self, check_interval: int = 90):
        """
        Args:
            check_interval: How often to check (in seconds)
        """
        logger.info("=" * 80)
        logger.info("🚀 INITIALIZING CAMPAIGN SCHEDULER")
        logger.info("=" * 80)
        
        self.check_interval = check_interval
        self.running = False
        self.thread: Optional[threading.Thread] = None
        self.check_count = 0
        self.last_check_time = None
        
        logger.info(f"✅ Scheduler initialized with check_interval={check_interval}s")
        logger.info(f"   - Thread: {self.thread}")
        logger.info(f"   - Running: {self.running}")
        
    def start(self):
        """Start the scheduler in a background thread"""
        logger.info("=" * 80)
        logger.info("▶️  STARTING SCHEDULER")
        logger.info("=" * 80)
        
        if self.running:
            logger.warning("⚠️  Campaign scheduler is already running")
            logger.warning(f"   - Thread alive: {self.thread.is_alive() if self.thread else False}")
            return
        
        logger.info("📋 Pre-start checks:")
        logger.info(f"   - check_interval: {self.check_interval}s")
        logger.info(f"   - check_count: {self.check_count}")
        logger.info(f"   - running flag: {self.running}")
        
        self.running = True
        self.thread = threading.Thread(
            target=self._run_loop,
            daemon=True,
            name="CampaignSchedulerThread"
        )
        self.thread.start()
        
        logger.info("✅ Scheduler thread started successfully")
        logger.info(f"   - Thread name: {self.thread.name}")
        logger.info(f"   - Thread ID: {self.thread.ident}")
        logger.info(f"   - Thread alive: {self.thread.is_alive()}")
        logger.info(f"   - Running flag: {self.running}")
        logger.info("=" * 80)
    
    def stop(self):
        """Stop the scheduler"""
        logger.info("=" * 80)
        logger.info("⏹️  STOPPING SCHEDULER")
        logger.info("=" * 80)
        
        if not self.running:
            logger.warning("⚠️  Scheduler is not running")
            return
        
        logger.info(f"📊 Scheduler stats before stopping:")
        logger.info(f"   - Total checks performed: {self.check_count}")
        logger.info(f"   - Last check: {self.last_check_time}")
        logger.info(f"   - Thread alive: {self.thread.is_alive() if self.thread else False}")
        
        self.running = False
        
        if self.thread:
            logger.info("⏳ Waiting for thread to finish (timeout=5s)...")
            self.thread.join(timeout=5)
            
            if self.thread.is_alive():
                logger.warning("⚠️  Thread did not finish in time")
            else:
                logger.info("✅ Thread finished cleanly")
        
        logger.info(f"✅ Scheduler stopped after {self.check_count} checks")
        logger.info("=" * 80)
    
    def _run_loop(self):
        """Main scheduler loop with comprehensive logging"""
        logger.info("=" * 80)
        logger.info("🔄 SCHEDULER LOOP STARTED")
        logger.info("=" * 80)
        logger.info(f"   - Thread: {threading.current_thread().name}")
        logger.info(f"   - Thread ID: {threading.current_thread().ident}")
        logger.info(f"   - Check interval: {self.check_interval}s")
        
        while self.running:
            try:
                self.check_count += 1
                self.last_check_time = datetime.now(UTC)
                
                logger.info("")
                logger.info("━" * 80)
                logger.info(f"🔍 CHECK #{self.check_count} - {self.last_check_time.strftime('%Y-%m-%d %H:%M:%S UTC')}")
                logger.info("━" * 80)
                
                start_time = time.time()
                
                triggered = self._check_and_trigger_campaigns()
                
                elapsed = time.time() - start_time
                
                logger.info(f"⏱️  Check completed in {elapsed:.2f}s")
                logger.info(f"   - Campaigns triggered: {triggered}")
                logger.info(f"   - Next check in: {self.check_interval}s")
                logger.info("━" * 80)
                
                # Check for campaign completions
                logger.info("🔍 Checking for completed campaigns...")
                completion_result = check_and_complete_campaigns()
                logger.info(f"   - Campaigns completed: {completion_result.get('completed', 0)}")
                
                logger.info(f"💤 Sleeping for {self.check_interval}s...")
                time.sleep(self.check_interval)
                
            except Exception as e:
                logger.error("=" * 80)
                logger.error(f"❌ ERROR IN SCHEDULER LOOP (Check #{self.check_count})")
                logger.error("=" * 80)
                logger.error(f"Error: {e}", exc_info=True)
                logger.error("⏳ Waiting 60s before retry...")
                logger.error("=" * 80)
                time.sleep(60)
        
        logger.info("=" * 80)
        logger.info("🛑 SCHEDULER LOOP ENDED")
        logger.info("=" * 80)
        logger.info(f"   - Total checks: {self.check_count}")
        logger.info(f"   - Last check: {self.last_check_time}")
  
    def _check_and_trigger_campaigns(self) -> int:
        """
        ✅ SMART: Check for scheduled campaigns and trigger them
        """
        logger.info("┌─────────────────────────────────────────────────────────┐")
        logger.info("│  CHECKING FOR SCHEDULED CAMPAIGNS                      │")
        logger.info("└─────────────────────────────────────────────────────────┘")
        
        triggered_count = 0
        
        try:
            logger.debug("📂 Opening database session...")
            with SessionLocal() as session:
                logger.debug("✅ Database session created")
                
                now = datetime.now(UTC)
                logger.info(f"⏰ Current time (UTC): {now.strftime('%Y-%m-%d %H:%M:%S')}")
                
                # Build query
                logger.debug("🔍 Building query for scheduled campaigns...")
                query = session.query(Campaign).filter(
                    Campaign.status == CampaignStatus.scheduled,
                    Campaign.scheduled_at.isnot(None),
                    Campaign.scheduled_at <= now,
                )
                
                logger.debug("🔒 Adding row lock (skip_locked=True)...")
                query = query.with_for_update(skip_locked=True)
                
                logger.debug("📊 Executing query...")
                campaigns = query.all()
                
                logger.info(f"📋 Query returned {len(campaigns)} campaign(s)")
                
                if not campaigns:
                    logger.info("✅ No scheduled campaigns found")
                    logger.debug(f"   - Checked up to: {now.strftime('%Y-%m-%d %H:%M:%S UTC')}")
                    return 0
                
                logger.info("")
                logger.info("📬 FOUND SCHEDULED CAMPAIGNS:")
                logger.info("─" * 60)
                for idx, campaign in enumerate(campaigns, 1):
                    logger.info(f"{idx}. {campaign.campaign_name}")
                    logger.info(f"   - ID: {campaign.campaign_id}")
                    logger.info(f"   - Scheduled: {campaign.scheduled_at}")
                    logger.info(f"   - Status: {campaign.status.value if hasattr(campaign.status, 'value') else campaign.status}")
                    logger.info(f"   - Channel: {campaign.channel.value if hasattr(campaign.channel, 'value') else campaign.channel}")
                    logger.info(f"   - Contact List: {campaign.contact_list_id or 'N/A'}")
                    logger.info("")

                # Trigger each campaign
                for idx, campaign in enumerate(campaigns, 1):
                    logger.info("=" * 60)
                    logger.info(f"🚀 TRIGGERING CAMPAIGN {idx}/{len(campaigns)}")
                    logger.info("=" * 60)
                    
                    try:
                        self._trigger_campaign(session, campaign)
                        session.commit()
                        triggered_count += 1
                        
                        logger.info("✅ TRIGGER SUCCESSFUL")
                        logger.info(f"   - Campaign: {campaign.campaign_name}")
                        logger.info(f"   - ID: {campaign.campaign_id}")
                        logger.info("=" * 60)
                        
                    except Exception as e:
                        session.rollback()
                        logger.error("=" * 60)
                        logger.error(f"❌ TRIGGER FAILED")
                        logger.error(f"   - Campaign: {campaign.campaign_name}")
                        logger.error(f"   - ID: {campaign.campaign_id}")
                        logger.error(f"   - Error: {e}")
                        logger.error("=" * 60)
                        logger.error("Full traceback:", exc_info=True)
        
        except Exception as e:
            logger.error("=" * 60)
            logger.error("❌ ERROR IN CHECK_AND_TRIGGER")
            logger.error("=" * 60)
            logger.error(f"Error: {e}", exc_info=True)
        
        logger.info("")
        logger.info("┌─────────────────────────────────────────────────────────┐")
        logger.info(f"│  CHECK COMPLETE - Triggered: {triggered_count:2d} campaign(s)       │")
        logger.info("└─────────────────────────────────────────────────────────┘")
        logger.info("")
        
        return triggered_count
    
    def _trigger_campaign(self, session: Session, campaign: Campaign):
        """
        ✅ SMART: Trigger a single campaign with detailed logging
        """
        logger.info("┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓")
        logger.info("┃  TRIGGERING CAMPAIGN                                   ┃")
        logger.info("┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛")
        logger.info(f"📋 Campaign: {campaign.campaign_name}")
        logger.info(f"🆔 ID: {campaign.campaign_id}")
        logger.info(f"📊 Status: {campaign.status.value if hasattr(campaign.status, 'value') else campaign.status}")
        logger.info(f"📅 Scheduled: {campaign.scheduled_at}")
        logger.info(f"📡 Channel: {campaign.channel.value if hasattr(campaign.channel, 'value') else campaign.channel}")
        logger.info("")
        
        # Step 1: Validate contact list
        logger.info("STEP 1: VALIDATING CONTACT LIST")
        logger.info("─" * 40)
        
        if campaign.contact_list_id:
            logger.debug(f"🔍 Looking for list: {campaign.contact_list_id}")
            
            contact_list = session.query(ContactList).filter(
                ContactList.list_id == campaign.contact_list_id,
                ContactList.deleted_at.is_(None)
            ).first()
            
            if not contact_list:
                logger.error("❌ VALIDATION FAILED: Contact list not found")
                logger.error(f"   - List ID: {campaign.contact_list_id}")
                
                campaign.status = CampaignStatus.cancelled
                campaign.meta_data = campaign.meta_data or {}
                campaign.meta_data["cancel_reason"] = "Contact list not found"
                campaign.meta_data["cancelled_at"] = datetime.now(UTC).isoformat()
                
                logger.error("✋ Campaign cancelled")
                return
            
            logger.info(f"✅ Contact list found: {contact_list.list_name}")
            logger.debug(f"   - List ID: {contact_list.list_id}")
            logger.debug(f"   - Org ID: {contact_list.org_id}")
            logger.debug(f"   - Status: {contact_list.status}")
        else:
            logger.info("ℹ️  No specific contact list (using all contacts)")
        
        logger.info("")
        
        # Step 2: Validate content
        logger.info("STEP 2: VALIDATING CAMPAIGN CONTENT")
        logger.info("─" * 40)
        
        has_content = campaign.validate_content_for_channel(campaign.channel)
        logger.debug(f"   - Channel: {campaign.channel.value if hasattr(campaign.channel, 'value') else campaign.channel}")
        logger.debug(f"   - Has content: {has_content}")
        
        if not has_content:
            logger.error("❌ VALIDATION FAILED: Missing content")
            logger.error(f"   - Channel: {campaign.channel.value if hasattr(campaign.channel, 'value') else campaign.channel}")
            
            campaign.status = CampaignStatus.cancelled
            campaign.meta_data = campaign.meta_data or {}
            campaign.meta_data["cancel_reason"] = "Missing required content"
            campaign.meta_data["cancelled_at"] = datetime.now(UTC).isoformat()
            
            logger.error("✋ Campaign cancelled")
            return
        
        logger.info("✅ Content validation passed")
        logger.info("")
        
        # Step 3: Get recipients
        logger.info("STEP 3: GETTING RECIPIENTS")
        logger.info("─" * 40)
        logger.debug(f"   - Org ID: {campaign.org_id}")
        logger.debug(f"   - Contact List ID: {campaign.contact_list_id or 'All'}")
        
        contacts = self._get_campaign_contacts(session, campaign)
        
        logger.info(f"📊 Recipients found: {len(contacts)}")
        
        if not contacts:
            logger.warning("⚠️  NO RECIPIENTS FOUND")
            
            campaign.status = CampaignStatus.cancelled
            campaign.meta_data = campaign.meta_data or {}
            campaign.meta_data["cancel_reason"] = "No recipients found"
            campaign.meta_data["cancelled_at"] = datetime.now(UTC).isoformat()
            
            logger.warning("✋ Campaign cancelled")
            return
        
        # Log sample contacts
        logger.debug("📋 Sample contacts:")
        for idx, contact in enumerate(contacts[:3], 1):
            logger.debug(f"   {idx}. {contact.name} ({contact.primary_identifier})")
        if len(contacts) > 3:
            logger.debug(f"   ... and {len(contacts) - 3} more")
        
        logger.info("")
        
        # Step 4: Create campaign results
        logger.info("STEP 4: CREATING CAMPAIGN RESULTS")
        logger.info("─" * 40)
        
        results_created = create_campaign_results(session, campaign, contacts)
        
        logger.info(f"📝 Campaign results created: {results_created}")
        
        if results_created == 0:
            logger.warning("⚠️  NO VALID RECIPIENTS")
            logger.warning("   - All contacts may be missing required contact info")
            
            campaign.status = CampaignStatus.cancelled
            campaign.meta_data = campaign.meta_data or {}
            campaign.meta_data["cancel_reason"] = "No valid recipients"
            campaign.meta_data["cancelled_at"] = datetime.now(UTC).isoformat()
            
            logger.warning("✋ Campaign cancelled")
            return
        
        logger.info("")
        
        # Step 5: Update campaign status
        logger.info("STEP 5: UPDATING CAMPAIGN STATUS")
        logger.info("─" * 40)
        
        logger.debug(f"   - Old status: {campaign.status.value if hasattr(campaign.status, 'value') else campaign.status}")
        
        campaign.status = CampaignStatus.sending
        campaign.started_at = datetime.now(UTC)
        campaign.total_recipients = results_created
        
        session.flush()
        
        logger.info(f"✅ Campaign status updated: {campaign.status.value if hasattr(campaign.status, 'value') else campaign.status}")
        logger.info(f"   - Started at: {campaign.started_at}")
        logger.info(f"   - Total recipients: {campaign.total_recipients}")
        logger.info("")
        
        # Step 6: Start background processing
        logger.info("STEP 6: STARTING BACKGROUND PROCESSING")
        logger.info("─" * 40)
        
        thread_name = f"CampaignProcessor-{campaign.campaign_id[:8]}"
        
        processor_thread = threading.Thread(
            target=self._process_campaign_async,
            args=(campaign.campaign_id,),
            daemon=True,
            name=thread_name
        )
        
        logger.debug(f"   - Thread name: {thread_name}")
        logger.debug(f"   - Daemon: True")
        
        processor_thread.start()
        
        logger.info(f"✅ Background thread started")
        logger.info(f"   - Thread ID: {processor_thread.ident}")
        logger.info(f"   - Thread alive: {processor_thread.is_alive()}")
        logger.info("")
        
        logger.info("┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓")
        logger.info("┃  ✅ CAMPAIGN TRIGGERED SUCCESSFULLY                    ┃")
        logger.info("┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛")
        logger.info(f"📋 Campaign: {campaign.campaign_name}")
        logger.info(f"👥 Recipients: {results_created}")
        logger.info(f"🆔 Campaign ID: {campaign.campaign_id}")
        logger.info("")
    
    def _get_campaign_contacts(self, session: Session, campaign: Campaign) -> list:
        """Get contacts for a campaign with detailed logging"""
        logger.debug("┌─────────────────────────────────────────────┐")
        logger.debug("│  QUERYING CONTACTS                          │")
        logger.debug("└─────────────────────────────────────────────┘")
        
        logger.debug("🔍 Building query...")
        logger.debug(f"   - Org ID: {campaign.org_id}")
        logger.debug(f"   - Contact List ID: {campaign.contact_list_id or 'None (all contacts)'}")
        
        query = session.query(Contact).options(
            joinedload(Contact.emails),
            joinedload(Contact.phones),
            joinedload(Contact.socials)
        ).filter(
            Contact.org_id == campaign.org_id,
            Contact.status == "active",
            Contact.deleted_at.is_(None)
        )
        
        logger.debug("✅ Base query created (org + status + not deleted)")
        
        # Filter by contact list if specified
        if campaign.contact_list_id:
            logger.debug(f"🔗 Joining with list_members table...")
            logger.debug(f"   - List ID: {campaign.contact_list_id}")
            
            query = query.join(
                list_members, 
                list_members.c.contact_id == Contact.contact_id
            ).filter(
                list_members.c.list_id == campaign.contact_list_id
            )
            
            logger.debug("✅ List filter applied")
        
        # Apply additional filters
        if campaign.contact_filters:
            filters = campaign.contact_filters
            logger.debug(f"🔍 Applying additional filters: {filters}")
            
            if "contact_type" in filters and filters["contact_type"]:
                from ..models.contact import ContactType
                filter_type = ContactType(filters["contact_type"])
                query = query.filter(Contact.contact_type == filter_type)
                logger.debug(f"   - Contact type filter: {filter_type.value}")
        
        logger.debug("📊 Executing query...")
        contacts = query.all()
        
        logger.debug(f"✅ Query complete: {len(contacts)} contact(s) found")
        
        if len(contacts) > 0:
            logger.debug("📋 Sample contacts:")
            for idx, contact in enumerate(contacts[:5], 1):
                logger.debug(f"   {idx}. {contact.name}")
                logger.debug(f"      - ID: {contact.contact_id}")
                logger.debug(f"      - Type: {contact.contact_type.value if contact.contact_type else 'N/A'}")
                logger.debug(f"      - Primary: {contact.primary_identifier}")
            
            if len(contacts) > 5:
                logger.debug(f"   ... and {len(contacts) - 5} more")
        
        logger.debug("└─────────────────────────────────────────────┘")
        
        return contacts
    
    def _process_campaign_async(self, campaign_id: str):
        """
        ✅ SMART: Process campaign batches asynchronously with logging
        """
        logger.info("═" * 80)
        logger.info("🔄 ASYNC CAMPAIGN PROCESSING STARTED")
        logger.info("═" * 80)
        logger.info(f"🆔 Campaign ID: {campaign_id}")
        logger.info(f"🧵 Thread: {threading.current_thread().name}")
        logger.info(f"🧵 Thread ID: {threading.current_thread().ident}")
        logger.info("")
        
        try:
            logger.info("📤 Processing first batch...")
            logger.debug(f"   - Batch size: 100")
            
            start_time = time.time()
            result = process_campaign_batch(campaign_id, batch_size=100)
            elapsed = time.time() - start_time
            
            logger.info(f"⏱️  Batch processed in {elapsed:.2f}s")
            logger.info(f"📊 Result: {result}")
            
            if result.get("completed"):
                logger.info("🎉 CAMPAIGN COMPLETED AFTER FIRST BATCH!")
                logger.info(f"   - Queued: {result.get('queued', 0)}")
                logger.info(f"   - Status: {result.get('campaign_status', 'unknown')}")
            else:
                logger.info("ℹ️  Campaign still processing...")
                logger.info(f"   - Pending: {result.get('pending', 0)}")
            
        except Exception as e:
            logger.error("═" * 80)
            logger.error("❌ ERROR IN ASYNC PROCESSING")
            logger.error("═" * 80)
            logger.error(f"Campaign ID: {campaign_id}")
            logger.error(f"Error: {e}")
            logger.error("Full traceback:", exc_info=True)
            logger.error("═" * 80)
        
        logger.info("═" * 80)
        logger.info("🏁 ASYNC CAMPAIGN PROCESSING ENDED")
        logger.info("═" * 80)
        logger.info("")


# ============================================
# GLOBAL SCHEDULER INSTANCE
# ============================================

_scheduler_instance: Optional[CampaignScheduler] = None


def get_scheduler(check_interval: int = 60) -> CampaignScheduler:
    """Get or create the global scheduler instance"""
    global _scheduler_instance
    
    logger.debug("get_scheduler() called")
    logger.debug(f"   - check_interval: {check_interval}")
    logger.debug(f"   - Existing instance: {_scheduler_instance is not None}")
    
    if _scheduler_instance is None:
        logger.info("Creating new CampaignScheduler instance...")
        _scheduler_instance = CampaignScheduler(check_interval=check_interval)
        logger.info(f"✅ Scheduler instance created with {check_interval}s interval")
    else:
        logger.debug("Using existing scheduler instance")
    
    return _scheduler_instance


def start_scheduler(check_interval: int = 60):
    """Start the global campaign scheduler"""
    logger.info("=" * 80)
    logger.info("🚀 START_SCHEDULER CALLED")
    logger.info("=" * 80)
    logger.info(f"   - Check interval: {check_interval}s")
    
    scheduler = get_scheduler(check_interval)
    scheduler.start()
    
    logger.info("=" * 80)


def stop_scheduler():
    """Stop the global campaign scheduler"""
    global _scheduler_instance
    
    logger.info("=" * 80)
    logger.info("🛑 STOP_SCHEDULER CALLED")
    logger.info("=" * 80)
    
    if _scheduler_instance:
        logger.info("Stopping scheduler instance...")
        _scheduler_instance.stop()
        _scheduler_instance = None
        logger.info("✅ Scheduler stopped and instance cleared")
    else:
        logger.warning("⚠️  No scheduler instance to stop")
    
    logger.info("=" * 80)


# ============================================
# MANUAL TRIGGER FUNCTION
# ============================================

def trigger_scheduled_campaigns_now():
    """
    Manually trigger all scheduled campaigns that are due
    """
    logger.info("=" * 80)
    logger.info("🔧 MANUAL TRIGGER REQUESTED")
    logger.info("=" * 80)
    
    with SessionLocal() as session:
        now = datetime.now(UTC)
        logger.info(f"⏰ Current time: {now.strftime('%Y-%m-%d %H:%M:%S UTC')}")
        
        logger.debug("🔍 Querying for scheduled campaigns...")
        campaigns = session.query(Campaign).filter(
            Campaign.status == CampaignStatus.scheduled,
            Campaign.scheduled_at.isnot(None),
            Campaign.scheduled_at <= now,
            Campaign.deleted_at.is_(None)
        ).all()
        
        logger.info(f"📋 Found {len(campaigns)} scheduled campaign(s)")
        
        if not campaigns:
            logger.info("✅ No campaigns to trigger")
            return {"triggered": 0, "campaigns": []}
        
        for idx, campaign in enumerate(campaigns, 1):
            logger.info(f"{idx}. {campaign.campaign_name} ({campaign.campaign_id})")
        
        scheduler = CampaignScheduler()
        triggered = []
        
        for campaign in campaigns:
            logger.info("")
            logger.info("─" * 60)
            logger.info(f"🚀 Manually triggering: {campaign.campaign_name}")
            
            try:
                scheduler._trigger_campaign(session, campaign)
                session.commit()
                
                triggered.append({
                    "campaign_id": campaign.campaign_id,
                    "campaign_name": campaign.campaign_name,
                    "recipients": campaign.total_recipients
                })
                
                logger.info(f"✅ Successfully triggered: {campaign.campaign_name}")
                
            except Exception as e:
                session.rollback()
                logger.error(f"❌ Failed to trigger {campaign.campaign_id}: {e}")
                logger.error("Full traceback:", exc_info=True)
        
        result = {
            "triggered": len(triggered),
            "campaigns": triggered
        }
        
        logger.info("")
        logger.info("=" * 80)
        logger.info(f"✅ MANUAL TRIGGER COMPLETE")
        logger.info(f"   - Triggered: {result['triggered']} campaign(s)")
        logger.info("=" * 80)
        
        return result


# ============================================
# SCHEDULER STATUS
# ============================================

def get_scheduler_status() -> dict:
    """Get current scheduler status"""
    global _scheduler_instance
    
    logger.debug("get_scheduler_status() called")
    
    if _scheduler_instance is None:
        logger.debug("No scheduler instance exists")
        return {
            "running": False,
            "message": "Scheduler not initialized"
        }
    
    status = {
        "running": _scheduler_instance.running,
        "check_interval": _scheduler_instance.check_interval,
        "total_checks": _scheduler_instance.check_count,
        "last_check": (
            _scheduler_instance.last_check_time.isoformat() 
            if _scheduler_instance.last_check_time 
            else None
        ),
        "thread_alive": (
            _scheduler_instance.thread.is_alive() 
            if _scheduler_instance.thread 
            else False
        )
    }
    
    logger.debug(f"Scheduler status: {status}")
    
    return status