# ============================================
# SCHEDULER ADMIN ROUTES - app/routes/scheduler_routes.py
# ============================================

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import sqlalchemy as sa
from typing import Optional
from datetime import datetime, timezone

from ..db import get_db
from ..models.campaigns import Campaign, CampaignStatus
from ..services.campaign_scheduler_service import (
    get_scheduler,
    trigger_scheduled_campaigns_now
)
from ..policies.auth import get_current_user
from pydantic import BaseModel

router = APIRouter(prefix="/scheduler", tags=["scheduler"])


class SchedulerStatus(BaseModel):
    """Scheduler status response"""
    running: bool
    check_interval: int
    scheduled_campaigns_count: int
    upcoming_campaigns: list


class TriggerResponse(BaseModel):
    """Manual trigger response"""
    success: bool
    message: str
    triggered: int
    campaigns: list


@router.get("/status", response_model=SchedulerStatus)
def get_scheduler_status(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Get current scheduler status and upcoming campaigns
    """
    scheduler = get_scheduler()
    
    # Count scheduled campaigns
    scheduled_count = db.query(Campaign).filter(
        Campaign.status == CampaignStatus.scheduled,
        Campaign.deleted_at.is_(None)
    ).count()
    
    # Get next 10 upcoming campaigns
    upcoming = db.query(Campaign).filter(
        Campaign.status == CampaignStatus.scheduled,
        Campaign.scheduled_at.isnot(None),
        Campaign.deleted_at.is_(None)
    ).order_by(Campaign.scheduled_at.asc()).limit(10).all()
    
    upcoming_list = [
        {
            "campaign_id": c.campaign_id,
            "campaign_name": c.campaign_name,
            "scheduled_at": c.scheduled_at,
            "channel": c.channel.value,
            "org_id": c.org_id
        }
        for c in upcoming
    ]
    
    return SchedulerStatus(
        running=scheduler.running,
        check_interval=scheduler.check_interval,
        scheduled_campaigns_count=scheduled_count,
        upcoming_campaigns=upcoming_list
    )


@router.post("/trigger", response_model=TriggerResponse)
def manual_trigger_campaigns(
    current_user: dict = Depends(get_current_user)
):
    """
    Manually trigger all scheduled campaigns that are due
    Useful for testing or forcing execution
    """
    try:
        result = trigger_scheduled_campaigns_now()
        
        return TriggerResponse(
            success=True,
            message=f"Successfully triggered {result['triggered']} campaigns",
            triggered=result['triggered'],
            campaigns=result['campaigns']
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error triggering campaigns: {str(e)}"
        )


@router.get("/upcoming", response_model=list)
def list_upcoming_campaigns(
    hours: int = 24,
    org_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    List campaigns scheduled in the next N hours
    """
    from datetime import timedelta
    
    now = datetime.now(timezone.utc)
    future = now + timedelta(hours=hours)
    
    query = db.query(Campaign).filter(
        Campaign.status == CampaignStatus.scheduled,
        Campaign.scheduled_at.isnot(None),
        Campaign.scheduled_at.between(now, future),
        Campaign.deleted_at.is_(None)
    )
    
    # Filter by org if not admin
    if org_id:
        query = query.filter(Campaign.org_id == org_id)
    elif not current_user.get("is_admin"):
        query = query.filter(Campaign.org_id == current_user.get("org_id"))
    
    campaigns = query.order_by(Campaign.scheduled_at.asc()).all()
    
    return [
        {
            "campaign_id": c.campaign_id,
            "campaign_name": c.campaign_name,
            "scheduled_at": c.scheduled_at,
            "channel": c.channel.value,
            "org_id": c.org_id,
            "total_recipients": c.total_recipients,
            "minutes_until_send": int((c.scheduled_at - now).total_seconds() / 60)
        }
        for c in campaigns
    ]


@router.post("/campaigns/{campaign_id}/reschedule")
def reschedule_campaign(
    campaign_id: str,
    new_scheduled_at: datetime,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Reschedule a campaign to a new time
    """
    org_id = current_user.get("org_id")
    
    campaign = db.query(Campaign).filter(
        Campaign.campaign_id == campaign_id,
        Campaign.org_id == org_id,
        Campaign.deleted_at.is_(None)
    ).first()
    
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    if campaign.status not in [CampaignStatus.draft, CampaignStatus.scheduled]:
        raise HTTPException(
            status_code=400,
            detail="Can only reschedule draft or scheduled campaigns"
        )
    
    campaign.scheduled_at = new_scheduled_at
    campaign.status = CampaignStatus.scheduled
    campaign.updated_at = datetime.now(timezone.utc)
    
    db.commit()
    
    return {
        "success": True,
        "message": "Campaign rescheduled",
        "campaign_id": campaign_id,
        "new_scheduled_at": new_scheduled_at
    }


@router.post("/campaigns/{campaign_id}/unschedule")
def unschedule_campaign(
    campaign_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Unschedule a campaign (move back to draft)
    """
    org_id = current_user.get("org_id")
    
    campaign = db.query(Campaign).filter(
        Campaign.campaign_id == campaign_id,
        Campaign.org_id == org_id,
        Campaign.deleted_at.is_(None)
    ).first()
    
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    if campaign.status != CampaignStatus.scheduled:
        raise HTTPException(
            status_code=400,
            detail="Campaign is not scheduled"
        )
    
    campaign.status = CampaignStatus.draft
    campaign.scheduled_at = None
    campaign.updated_at = datetime.now(timezone.utc)
    
    db.commit()
    
    return {
        "success": True,
        "message": "Campaign unscheduled",
        "campaign_id": campaign_id
    }