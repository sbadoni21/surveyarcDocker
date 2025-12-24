# ============================================
# CAMPAIGN ROUTES - app/routes/campaign_routes.py
# ============================================
import os
from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, and_, or_
from typing import List, Optional
from datetime import datetime, timezone
from fastapi.responses import FileResponse

from ..db import get_db
from ..models.campaigns import Campaign, CampaignEvent, CampaignStatus, CampaignChannel, RecipientStatus
from ..models.campaign_result import CampaignResult
from ..models.contact import Contact, ContactList
from ..schemas.campaign import (
    CampaignCreate, CampaignUpdate, Campaign as CampaignSchema,
    CampaignList, CampaignAnalytics, CampaignSendRequest, CampaignActionResponse,
    CampaignResult as CampaignResultSchema, CampaignResultList,
    CampaignEvent as CampaignEventSchema,
    PaginatedCampaigns, PaginatedResults,
    CampaignFilter, ResultFilter,
    EmailTrackingEvent, SMSTrackingEvent, SurveyResponseEvent
)
from ..models.audience_file import AudienceFile

from ..services.redis_campaign_service import RedisCampaignService
from ..services.campaign_sender_service import (
    create_campaign_results, 
    process_campaign_batch
)
from ..policies.auth import get_current_user
import secrets
router = APIRouter(prefix="/campaigns", tags=["campaigns"])


# ==================== HELPER FUNCTIONS ====================
def generate_id():
    return "camp_"+ secrets.token_hex(4)
def generate_tracking_token():
    return "camp_tracking_"+ secrets.token_hex(4)

def get_campaign_or_404(db: Session, campaign_id: str, org_id: str) -> Campaign:
    """Get campaign and verify org access"""
    campaign = db.query(Campaign).filter(
        Campaign.campaign_id == campaign_id,
        Campaign.org_id == org_id,
        Campaign.deleted_at.is_(None)
    ).first()
    
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    return campaign


def calculate_campaign_analytics(campaign: Campaign) -> dict:
    """Calculate campaign analytics with rates"""
    analytics = {
        "total_recipients": campaign.total_recipients,
        "sent_count": campaign.sent_count,
        "delivered_count": campaign.delivered_count,
        "failed_count": campaign.failed_count,
        "bounced_count": campaign.bounced_count,
        "opened_count": campaign.opened_count,
        "clicked_count": campaign.clicked_count,
        "replied_count": campaign.replied_count,
        "unsubscribed_count": campaign.unsubscribed_count,
        "survey_started_count": campaign.survey_started_count,
        "survey_completed_count": campaign.survey_completed_count,
    }
    
    # Calculate rates
    if campaign.sent_count > 0:
        analytics["delivery_rate"] = round((campaign.delivered_count / campaign.sent_count) * 100, 2)
    
    if campaign.delivered_count > 0:
        analytics["open_rate"] = round((campaign.opened_count / campaign.delivered_count) * 100, 2)
        analytics["click_rate"] = round((campaign.clicked_count / campaign.delivered_count) * 100, 2)
        analytics["response_rate"] = round((campaign.survey_started_count / campaign.delivered_count) * 100, 2)
    
    if campaign.survey_started_count > 0:
        analytics["completion_rate"] = round((campaign.survey_completed_count / campaign.survey_started_count) * 100, 2)
    
    analytics["channel_stats"] = campaign.channel_stats or {}
    
    return analytics


# ==================== CAMPAIGN CRUD ====================



# app/routes/campaign_routes.py

@router.get("/", response_model=PaginatedCampaigns)
def list_campaigns(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: Optional[List[str]] = Query(None),
    channel: Optional[List[str]] = Query(None),
    survey_id: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """List campaigns with filters and pagination"""
    
    # ✅ Get org_id from authenticated user
    org_id = current_user.get("org_id")
    
    if not org_id:
        raise HTTPException(
            status_code=400, 
            detail="Organization ID not found in user context"
        )
    
    print(f"📋 Listing campaigns for org_id: {org_id}")
    
    # Try cache first for simple queries
    if not status and not channel and not survey_id and not search and page == 1:
        cached = RedisCampaignService.get_campaigns_by_org(org_id)
        if cached:
            print(f"✅ Returning {len(cached)} campaigns from cache")
            return PaginatedCampaigns(
                items=cached[:page_size],
                total=len(cached),
                page=page,
                page_size=page_size,
                total_pages=(len(cached) + page_size - 1) // page_size
            )
    
    # Build query
    query = db.query(Campaign).filter(
        Campaign.org_id == org_id,
        Campaign.deleted_at.is_(None)
    )
    
    if status:
        query = query.filter(Campaign.status.in_(status))
    
    if channel:
        query = query.filter(Campaign.channel.in_(channel))
    
    if survey_id:
        query = query.filter(Campaign.survey_id == survey_id)
    
    if search:
        query = query.filter(Campaign.campaign_name.ilike(f"%{search}%"))
    
    # Get total count
    total = query.count()
    
    print(f"📊 Found {total} total campaigns")
    
    # Get paginated results
    campaigns = query.order_by(Campaign.created_at.desc()).offset(
        (page - 1) * page_size
    ).limit(page_size).all()
    
    print(f"✅ Returning {len(campaigns)} campaigns for page {page}")
    
    # Cache if simple query
    if not status and not channel and not survey_id and not search and page == 1:
        campaign_dicts = [CampaignList.model_validate(c).model_dump() for c in campaigns]
        RedisCampaignService.cache_campaigns_by_org(org_id, campaign_dicts)
    
    return PaginatedCampaigns(
        items=[CampaignList.model_validate(c) for c in campaigns],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=(total + page_size - 1) // page_size
    )


# ============================================
# FIXED CREATE CAMPAIGN ENDPOINT
# Replace the create_campaign function in app/routes/campaign_routes.py
# ============================================

@router.post("/", response_model=CampaignSchema, status_code=201)
def create_campaign(
    campaign_data: CampaignCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Create a new campaign"""
    
    print(f"📝 Creating campaign: {campaign_data.campaign_name}")
    print(f"   Org ID: {campaign_data.org_id}")
    print(f"   User ID: {campaign_data.user_id}")
    print(f"   Survey ID: {campaign_data.survey_id}")
    print(f"   Contact List ID: {campaign_data.contact_list_id}")
    print(f"   Audience File ID: {getattr(campaign_data, 'audience_file_id', None)}")
    
    # ✅ FIX: Convert empty strings to None for BOTH fields
    if campaign_data.contact_list_id == "":
        campaign_data.contact_list_id = None
        print("   ℹ️  Converted empty contact_list_id to None")
    
    if hasattr(campaign_data, 'audience_file_id') and campaign_data.audience_file_id == "":
        campaign_data.audience_file_id = None
        print("   ℹ️  Converted empty audience_file_id to None")
    
    # ✅ FIX: Enforce that contacts world and B2C audience world don't mix
    if campaign_data.contact_list_id and getattr(campaign_data, "audience_file_id", None):
        raise HTTPException(
            status_code=400,
            detail="Campaign cannot have both contact_list_id and audience_file_id"
        )
    
    # ✅ FIX: Require at least one source
    if not campaign_data.contact_list_id and not getattr(campaign_data, "audience_file_id", None):
        raise HTTPException(
            status_code=400,
            detail="Either contact_list_id or audience_file_id is required"
        )

    # ✅ Validate user has access to this org
    user_org_id = current_user.get("org_id")
    if campaign_data.org_id != user_org_id:
        raise HTTPException(
            status_code=403,
            detail="Cannot create campaign for different organization"
        )
    
    # Validate contact list exists if provided (B2B)
    if campaign_data.contact_list_id:
        contact_list = db.query(ContactList).filter(
            ContactList.list_id == campaign_data.contact_list_id,
            ContactList.org_id == campaign_data.org_id
        ).first()
        if not contact_list:
            raise HTTPException(status_code=404, detail="Contact list not found")
        
        print(f"   ✅ Using contact list: {contact_list.list_name} (B2B)")
    
    # ✅ Validate audience file if provided (B2C)
    if getattr(campaign_data, "audience_file_id", None):
        audience_file = db.query(AudienceFile).filter(
            AudienceFile.id == campaign_data.audience_file_id,
            AudienceFile.org_id == campaign_data.org_id
        ).first()
        if not audience_file:
            raise HTTPException(status_code=404, detail="Audience file not found")
        
        # ✅ Validate file exists at storage_key
        if not audience_file.storage_key or not os.path.exists(audience_file.storage_key):
            raise HTTPException(
                status_code=400,
                detail=f"Audience file not found at storage location. Please re-upload."
            )

        print(f"   ✅ Using audience file: {audience_file.filename} (B2C)")
        print(f"   📁 Storage path: {audience_file.storage_key}")

    # Create campaign
    campaign = Campaign(
        campaign_id=generate_id(),
        **campaign_data.model_dump()
    )
    
    db.add(campaign)
    db.commit()
    db.refresh(campaign)
    
    campaign_type = "B2C" if campaign.audience_file_id else "B2B"
    print(f"✅ Campaign created: {campaign.campaign_id} ({campaign_type})")
    
    # Cache the campaign
    campaign_dict = CampaignSchema.model_validate(campaign).model_dump()
    RedisCampaignService.cache_campaign(campaign.campaign_id, campaign_dict)
    
    # Invalidate list caches
    RedisCampaignService.invalidate_campaign_caches(
        campaign.campaign_id, campaign_data.org_id, campaign.survey_id
    )
    
    return campaign


@router.get("/{campaign_id}", response_model=CampaignSchema)
def get_campaign(
    campaign_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get a single campaign"""
    org_id = current_user.get("org_id")
    
    # Try cache first
    cached = RedisCampaignService.get_campaign(campaign_id)
    if cached and cached.get("org_id") == org_id:
        return CampaignSchema(**cached)
    
    # Query database
    campaign = get_campaign_or_404(db, campaign_id, org_id)
    
    # Cache it
    campaign_dict = CampaignSchema.model_validate(campaign).model_dump()
    RedisCampaignService.cache_campaign(campaign_id, campaign_dict)
    
    return campaign


@router.patch("/{campaign_id}", response_model=CampaignSchema)
def update_campaign(
    campaign_id: str,
    campaign_data: CampaignUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Update a campaign"""
    org_id = current_user.get("org_id")
    campaign = get_campaign_or_404(db, campaign_id, org_id)
    
    # Prevent updating sent campaigns (except status)
    if campaign.status in [CampaignStatus.sent, CampaignStatus.sending]:
        allowed_fields = {"status"}
        update_fields = {k for k, v in campaign_data.model_dump(exclude_unset=True).items() if v is not None}
        if not update_fields.issubset(allowed_fields):
            raise HTTPException(
                status_code=400, 
                detail="Cannot update sent campaigns except status"
            )
    
    # Update fields
    for field, value in campaign_data.model_dump(exclude_unset=True).items():
        if value is not None:
            setattr(campaign, field, value)
    
    campaign.updated_at = datetime.now(timezone.utc)
    
    db.commit()
    db.refresh(campaign)
    
    # Invalidate caches
    RedisCampaignService.invalidate_campaign_caches(
        campaign_id, org_id, campaign.survey_id
    )
    
    return campaign


@router.delete("/{campaign_id}", status_code=204)
def delete_campaign(
    campaign_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Soft delete a campaign"""
    org_id = current_user.get("org_id")
    campaign = get_campaign_or_404(db, campaign_id, org_id)
    
    if campaign.status in [CampaignStatus.sending, CampaignStatus.sent]:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete a campaign that is sending or has been sent"
        )
    
    campaign.deleted_at = datetime.now(timezone.utc)
    campaign.status = CampaignStatus.cancelled
    
    db.commit()
    
    # Invalidate caches
    RedisCampaignService.invalidate_campaign_caches(
        campaign_id, org_id, campaign.survey_id
    )
    
    return None

@router.post("/{campaign_id}/send", response_model=CampaignActionResponse)
def send_campaign(
    campaign_id: str,
    send_request: CampaignSendRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    
    import logging
    logger = logging.getLogger(__name__)
    
    org_id = current_user.get("org_id")
    campaign = get_campaign_or_404(db, campaign_id, org_id)
    
    if campaign.status not in [CampaignStatus.draft, CampaignStatus.scheduled]:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot send campaign with status: {campaign.status}"
        )
    
    # Validate campaign has content
    if not campaign.validate_content_for_channel(campaign.channel):
        raise HTTPException(
            status_code=400,
            detail=f"Campaign missing required content for channel: {campaign.channel}"
        )
    
    # ============================================
    # DETERMINE CAMPAIGN TYPE: B2B or B2C
    # ============================================
    
    # ✅ FIX: Convert empty strings to None for proper validation
    audience_file_id = campaign.audience_file_id
    if audience_file_id == "":
        audience_file_id = None
        campaign.audience_file_id = None
        db.commit()
    
    contact_list_id = campaign.contact_list_id
    if contact_list_id == "":
        contact_list_id = None
        campaign.contact_list_id = None
        db.commit()
    
    is_b2c = audience_file_id is not None
    is_b2b = contact_list_id is not None
    
    if not is_b2c and not is_b2b:
        raise HTTPException(
            status_code=400,
            detail="Campaign must have either contact_list_id (B2B) or audience_file_id (B2C)"
        )
    
    if is_b2c and is_b2b:
        raise HTTPException(
            status_code=400,
            detail="Campaign cannot have both contact_list_id and audience_file_id"
        )
    
    # ============================================
    # B2C CAMPAIGN PROCESSING - READS FROM CSV
    # ============================================
    
    if is_b2c:
        logger.info(f"🎯 Processing B2C campaign: {campaign.campaign_name}")
        
        # ✅ FIX: Import at function level
        from ..services.file_campaign_processor import process_b2c_campaign_async
        from ..models.audience_file import AudienceFile
        
        # Get audience file record
        audience_file = db.query(AudienceFile).filter(
            AudienceFile.id == campaign.audience_file_id,
            AudienceFile.org_id == org_id
        ).first()
        
        if not audience_file:
            raise HTTPException(
                status_code=404,
                detail="Audience file not found"
            )
        
        # ✅ FIX: Validate file exists using storage_key
        file_path = None
        
        if audience_file.storage_key and os.path.exists(audience_file.storage_key):
            file_path = audience_file.storage_key
            logger.info(f"   ✅ Found file at: {file_path}")
        else:
            raise HTTPException(
                status_code=400,
                detail=f"CSV file not found at: {audience_file.storage_key}. Please re-upload."
            )
        
        logger.info(f"   📊 Expected rows: {audience_file.row_count or 0}")
        
        # Update campaign status
        if send_request.send_immediately:
            campaign.status = CampaignStatus.sending
            campaign.started_at = datetime.now(timezone.utc)
            db.commit()
            
            logger.info(f"   🚀 Starting B2C campaign in background")
            
            # ✅ FIX: Pass IDs only, not objects or session
            background_tasks.add_task(
                process_b2c_campaign_async,
                campaign_id=campaign.campaign_id,
                audience_file_id=audience_file.id
            )
            
            message = f"B2C campaign started - processing {audience_file.row_count or 0} recipients from CSV"
            
        else:
            campaign.status = CampaignStatus.scheduled
            campaign.scheduled_at = send_request.scheduled_at
            db.commit()
            message = f"B2C campaign scheduled for {audience_file.row_count or 0} recipients"
        
        logger.info(f"   ✅ {message}")
        
        return CampaignActionResponse(
            success=True,
            message=message,
            campaign_id=campaign_id,
            action="send",
            affected_count=audience_file.row_count or 0
        )
    
    # ============================================
    # B2B CAMPAIGN PROCESSING - USES CONTACT LIST
    # ============================================
    
    logger.info(f"🎯 Processing B2B campaign: {campaign.campaign_name}")
    
    # Get recipients from contact list
    if send_request.test_mode and send_request.test_contacts:
        contacts = db.query(Contact).filter(
            Contact.contact_id.in_(send_request.test_contacts),
            Contact.org_id == org_id
        ).all()
    elif campaign.contact_list_id:
        contacts = db.query(Contact).join(
            Contact.lists
        ).filter(
            ContactList.list_id == campaign.contact_list_id,
            Contact.status == "active"
        ).all()
    else:
        raise HTTPException(status_code=400, detail="No recipients specified")
    
    if not contacts:
        raise HTTPException(status_code=400, detail="No valid contacts found")
    
    logger.info(f"   📋 Found {len(contacts)} contacts in list")
    
    # Create campaign results
    from ..services.campaign_sender_service import (
        create_campaign_results,
        process_campaign_batch
    )
    
    results_created = create_campaign_results(db, campaign, contacts)
    
    if results_created == 0:
        raise HTTPException(status_code=400, detail="No valid recipients found")
    
    logger.info(f"   ✅ Created {results_created} campaign results")
    
    # Update campaign
    campaign.total_recipients = results_created
    
    if send_request.send_immediately:
        campaign.status = CampaignStatus.sending
        campaign.started_at = datetime.now(timezone.utc)
        db.commit()
        
        # Queue first batch
        background_tasks.add_task(
            process_campaign_batch, 
            campaign_id, 
            batch_size=100
        )
        
        message = f"B2B campaign queued for sending to {results_created} contacts"
    else:
        campaign.status = CampaignStatus.scheduled
        campaign.scheduled_at = send_request.scheduled_at
        db.commit()
        message = f"B2B campaign scheduled for {results_created} contacts"
    
    # Invalidate caches
    RedisCampaignService.invalidate_campaign_caches(
        campaign_id, org_id, campaign.survey_id
    )
    
    logger.info(f"   ✅ {message}")
    
    return CampaignActionResponse(
        success=True,
        message=message,
        campaign_id=campaign_id,
        action="send",
        affected_count=results_created
    )

@router.get("/{campaign_id}/b2c/file", response_class=FileResponse)
def get_b2c_campaign_file(
    campaign_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Download updated audience file with campaign status.
    
    For B2C campaigns only - returns CSV with status columns.
    """
    org_id = current_user.get("org_id")
    campaign = get_campaign_or_404(db, campaign_id, org_id)
    
    if not campaign.audience_file_id:
        raise HTTPException(
            status_code=400,
            detail="This is not a B2C campaign (no audience file)"
        )
    
    from ..models.audience_file import AudienceFile
    
    audience_file = db.query(AudienceFile).filter(
        AudienceFile.id == campaign.audience_file_id
    ).first()
    
    if not audience_file:
        raise HTTPException(status_code=404, detail="Audience file not found")
    
    # ✅ FIX: Use storage_key from database
    file_path = audience_file.storage_key
    
    if not file_path:
        raise HTTPException(
            status_code=400,
            detail="Audience file has no storage location"
        )
    
    if not os.path.exists(file_path):
        raise HTTPException(
            status_code=404,
            detail="Campaign file not found on server"
        )
    
    # Return file
    from fastapi.responses import FileResponse
    
    return FileResponse(
        path=file_path,
        filename=f"{campaign.campaign_name}_results.csv",
        media_type="text/csv"
    )


@router.get("/{campaign_id}/b2c/stats")
def get_b2c_campaign_stats(
    campaign_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Get statistics from B2C campaign file.
    
    Returns counts of pending, sent, delivered, failed, etc.
    """
    org_id = current_user.get("org_id")
    campaign = get_campaign_or_404(db, campaign_id, org_id)
    
    if not campaign.audience_file_id:
        raise HTTPException(
            status_code=400,
            detail="This is not a B2C campaign (no audience file)"
        )
    
    from ..models.audience_file import AudienceFile
    from ..services.file_campaign_processor import get_b2c_campaign_stats
    
    audience_file = db.query(AudienceFile).filter(
        AudienceFile.id == campaign.audience_file_id
    ).first()
    
    if not audience_file:
        raise HTTPException(status_code=404, detail="Audience file not found")
    
    # ✅ FIX: Use storage_key from database
    file_path = audience_file.storage_key
    
    if not file_path:
        raise HTTPException(
            status_code=400,
            detail="Audience file has no storage location"
        )
    
    if not os.path.exists(file_path):
        raise HTTPException(
            status_code=404,
            detail="Campaign file not found - campaign may not have started"
        )
    
    # Get stats from CSV
    stats = get_b2c_campaign_stats(file_path)
    
    # Calculate rates
    if stats["total"] > 0:
        stats["pending_rate"] = round((stats["pending"] / stats["total"]) * 100, 2)
        stats["sent_rate"] = round((stats["sent"] / stats["total"]) * 100, 2)
        stats["delivered_rate"] = round((stats["delivered"] / stats["total"]) * 100, 2)
        stats["failed_rate"] = round((stats["failed"] / stats["total"]) * 100, 2)
    
    return {
        "campaign_id": campaign_id,
        "campaign_name": campaign.campaign_name,
        "campaign_type": "B2C",
        "audience_file": audience_file.audience_name,
        "file_path": file_path,  # Include for debugging
        "stats": stats
    }
@router.post("/{campaign_id}/pause", response_model=CampaignActionResponse)
def pause_campaign(
    campaign_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Pause a sending campaign"""
    org_id = current_user.get("org_id")
    campaign = get_campaign_or_404(db, campaign_id, org_id)
    
    if campaign.status != CampaignStatus.sending:
        raise HTTPException(status_code=400, detail="Can only pause sending campaigns")
    
    campaign.status = CampaignStatus.paused
    db.commit()
    
    RedisCampaignService.invalidate_campaign_caches(
        campaign_id, org_id, campaign.survey_id
    )
    
    return CampaignActionResponse(
        success=True,
        message="Campaign paused",
        campaign_id=campaign_id,
        action="pause"
    )


@router.post("/{campaign_id}/resume", response_model=CampaignActionResponse)
def resume_campaign(
    campaign_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Resume a paused campaign"""
    org_id = current_user.get("org_id")
    campaign = get_campaign_or_404(db, campaign_id, org_id)
    
    if campaign.status != CampaignStatus.paused:
        raise HTTPException(status_code=400, detail="Can only resume paused campaigns")
    
    campaign.status = CampaignStatus.sending
    db.commit()
    
    # Re-queue batch processing
    background_tasks.add_task(process_campaign_batch, campaign_id, batch_size=100)
    
    RedisCampaignService.invalidate_campaign_caches(
        campaign_id, org_id, campaign.survey_id
    )
    
    return CampaignActionResponse(
        success=True,
        message="Campaign resumed",
        campaign_id=campaign_id,
        action="resume"
    )


# ==================== CAMPAIGN ANALYTICS ====================

@router.get("/{campaign_id}/analytics", response_model=CampaignAnalytics)
def get_campaign_analytics(
    campaign_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get campaign analytics"""
    org_id = current_user.get("org_id")
    
    # Try cache first
    cached = RedisCampaignService.get_campaign_analytics(campaign_id)
    if cached:
        return CampaignAnalytics(**cached)
    
    # Query database
    campaign = get_campaign_or_404(db, campaign_id, org_id)
    analytics = calculate_campaign_analytics(campaign)
    
    # Cache analytics
    RedisCampaignService.cache_campaign_analytics(campaign_id, analytics)
    
    return CampaignAnalytics(**analytics)


# ==================== CAMPAIGN RESULTS ====================

@router.get("/{campaign_id}/results", response_model=PaginatedResults)
def list_campaign_results(
    campaign_id: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    status: Optional[List[str]] = Query(None),
    channel: Optional[List[str]] = Query(None),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """List campaign results with filters"""
    org_id = current_user.get("org_id")
    
    # Verify campaign access
    campaign = get_campaign_or_404(db, campaign_id, org_id)
    
    # Try cache for simple queries
    if not status and not channel and page <= 3:
        cached = RedisCampaignService.get_results_by_campaign(campaign_id, page)
        if cached:
            return PaginatedResults(
                items=cached,
                total=campaign.total_recipients,
                page=page,
                page_size=page_size,
                total_pages=(campaign.total_recipients + page_size - 1) // page_size
            )
    
    # Build query
    query = db.query(CampaignResult).filter(
        CampaignResult.campaign_id == campaign_id,
        CampaignResult.org_id == org_id
    )
    
    if status:
        query = query.filter(CampaignResult.status.in_(status))
    
    if channel:
        query = query.filter(CampaignResult.channel.in_(channel))
    
    # Get total
    total = query.count()
    
    # Get paginated results
    results = query.order_by(CampaignResult.created_at.desc()).offset(
        (page - 1) * page_size
    ).limit(page_size).all()
    
    result_list = [CampaignResultList.model_validate(r) for r in results]
    
    # Cache simple queries
    if not status and not channel and page <= 3:
        result_dicts = [r.model_dump() for r in result_list]
        RedisCampaignService.cache_results_by_campaign(campaign_id, result_dicts, page)
    
    return PaginatedResults(
        items=result_list,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=(total + page_size - 1) // page_size
    )


@router.get("/results/{result_id}", response_model=CampaignResultSchema)
def get_campaign_result(
    result_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get a single campaign result"""
    org_id = current_user.get("org_id")
    
    # Try cache first
    cached = RedisCampaignService.get_result(result_id)
    if cached and cached.get("org_id") == org_id:
        return CampaignResultSchema(**cached)
    
    # Query database
    result = db.query(CampaignResult).filter(
        CampaignResult.result_id == result_id,
        CampaignResult.org_id == org_id
    ).first()
    
    if not result:
        raise HTTPException(status_code=404, detail="Result not found")
    
    # Cache it
    result_dict = CampaignResultSchema.model_validate(result).model_dump()
    RedisCampaignService.cache_result(result_id, result_dict)
    
    return result


# ==================== WEBHOOKS & TRACKING ====================

@router.post("/webhooks/email", status_code=200)
def email_tracking_webhook(event: EmailTrackingEvent, db: Session = Depends(get_db)):
    """Handle email tracking webhooks from providers"""
    
    # Get result by tracking token
    result_id = RedisCampaignService.get_result_id_by_token(event.tracking_token)
    
    if not result_id:
        result = db.query(CampaignResult).filter(
            CampaignResult.tracking_token == event.tracking_token
        ).first()
        if not result:
            raise HTTPException(status_code=404, detail="Tracking token not found")
        result_id = result.result_id
        # Cache the lookup
        RedisCampaignService.cache_tracking_token_to_result(event.tracking_token, result_id)
    else:
        result = db.query(CampaignResult).filter(
            CampaignResult.result_id == result_id
        ).first()
    
    # Update result based on event type
    now = datetime.now(timezone.utc)
    
    if event.event_type == "delivered":
        result.status = RecipientStatus.delivered
        result.delivered_at = event.timestamp or now
        RedisCampaignService.increment_campaign_counter(result.campaign_id, "delivered_count")
    
    elif event.event_type == "opened":
        if not result.first_opened_at:
            result.first_opened_at = event.timestamp or now
            RedisCampaignService.increment_campaign_counter(result.campaign_id, "opened_count")
        result.last_opened_at = event.timestamp or now
        result.open_count += 1
    
    elif event.event_type == "clicked":
        if not result.first_clicked_at:
            result.first_clicked_at = event.timestamp or now
            RedisCampaignService.increment_campaign_counter(result.campaign_id, "clicked_count")
        result.last_clicked_at = event.timestamp or now
        result.click_count += 1
    
    elif event.event_type == "bounced":
        result.status = RecipientStatus.bounced
        result.bounced_at = event.timestamp or now
        result.bounce_type = event.bounce_type
        result.bounce_reason = event.bounce_reason
        RedisCampaignService.increment_campaign_counter(result.campaign_id, "bounced_count")
    
    elif event.event_type == "unsubscribed":
        result.unsubscribed_at = event.timestamp or now
        RedisCampaignService.increment_campaign_counter(result.campaign_id, "unsubscribed_count")
    
    # Update metadata
    if not result.meta_data:
        result.meta_data = {}
    result.meta_data["last_event"] = event.event_type
    result.meta_data["last_event_time"] = str(event.timestamp or now)
    
    db.commit()
    
    # Invalidate caches
    RedisCampaignService.invalidate_result_caches(
        result.result_id, result.campaign_id, result.contact_id, event.tracking_token
    )
    RedisCampaignService.invalidate_analytics_caches(result.campaign_id, result.org_id)
    
    return {"status": "ok", "processed": event.event_type}


@router.post("/webhooks/sms", status_code=200)
def sms_tracking_webhook(event: SMSTrackingEvent, db: Session = Depends(get_db)):
    """Handle SMS/WhatsApp tracking webhooks"""
    
    result_id = RedisCampaignService.get_result_id_by_token(event.tracking_token)
    
    if not result_id:
        result = db.query(CampaignResult).filter(
            CampaignResult.tracking_token == event.tracking_token
        ).first()
        if not result:
            raise HTTPException(status_code=404, detail="Tracking token not found")
        RedisCampaignService.cache_tracking_token_to_result(event.tracking_token, result.result_id)
    else:
        result = db.query(CampaignResult).filter(
            CampaignResult.result_id == result_id
        ).first()
    
    now = datetime.now(timezone.utc)
    
    if event.event_type in ["sent", "queued"]:
        result.status = RecipientStatus.sent
        result.sent_at = event.timestamp or now
        result.message_id = event.message_id
        RedisCampaignService.increment_campaign_counter(result.campaign_id, "sent_count")
    
    elif event.event_type == "delivered":
        result.status = RecipientStatus.delivered
        result.delivered_at = event.timestamp or now
        RedisCampaignService.increment_campaign_counter(result.campaign_id, "delivered_count")
    
    elif event.event_type in ["failed", "undelivered"]:
        result.status = RecipientStatus.failed
        result.failed_at = event.timestamp or now
        result.error = event.error_message
        result.error_code = event.error_code
        RedisCampaignService.increment_campaign_counter(result.campaign_id, "failed_count")
    
    db.commit()
    
    # Invalidate caches
    RedisCampaignService.invalidate_result_caches(
        result.result_id, result.campaign_id, result.contact_id, event.tracking_token
    )
    
    return {"status": "ok", "processed": event.event_type}


@router.post("/webhooks/survey-response", status_code=200)
def survey_response_webhook(event: SurveyResponseEvent, db: Session = Depends(get_db)):
    """Handle survey response tracking"""
    
    result = db.query(CampaignResult).filter(
        CampaignResult.tracking_token == event.tracking_token
    ).first()
    
    if not result:
        raise HTTPException(status_code=404, detail="Tracking token not found")
    
    now = datetime.now(timezone.utc)
    
    if event.event_type == "survey_started":
        if not result.survey_started_at:
            result.survey_started_at = event.timestamp or now
            RedisCampaignService.increment_campaign_counter(result.campaign_id, "survey_started_count")
    
    elif event.event_type == "survey_completed":
        result.survey_completed_at = event.timestamp or now
        result.survey_response_id = event.response_id
        RedisCampaignService.increment_campaign_counter(result.campaign_id, "survey_completed_count")
    
    db.commit()
    
    # Invalidate caches
    RedisCampaignService.invalidate_result_caches(
        result.result_id, result.campaign_id, result.contact_id, event.tracking_token
    )
    RedisCampaignService.invalidate_analytics_caches(result.campaign_id, result.org_id)
    
    return {"status": "ok", "processed": event.event_type}