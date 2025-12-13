# app/routes/campaign_result_routes.py
import uuid
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, case
from ..db import get_db
from ..models.campaign_result import CampaignResult, ResultStatus, CampaignChannel
from ..schemas.campaign_results import (
    CampaignResultCreate, 
    CampaignResultUpdate, 
    CampaignResultOut,
    CampaignResultAnalytics,
    ResultTimelineData,
    ChannelBreakdown
)

router = APIRouter(prefix="/campaign-results", tags=["Campaign Results"])

@router.post("/", response_model=CampaignResultOut)
def create_result(data: CampaignResultCreate, db: Session = Depends(get_db)):
    rid = data.result_id or "result_" + uuid.uuid4().hex[:10]
    row = CampaignResult(
        result_id=rid,
        campaign_id=data.campaign_id,
        org_id=data.org_id,
        contact_id=data.contact_id,
        contact_email=data.contact_email,
        contact_phone=data.contact_phone,
        status=data.status,
        channel=data.channel,
        message_id=data.message_id,
        error=data.error,
        error_code=data.error_code,
        meta_data=data.meta_data or {},
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row

@router.get("", response_model=List[CampaignResultOut])
def list_results(
    campaign_id: str = Query(...), 
    status: Optional[str] = None,
    channel: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db)
):
    query = db.query(CampaignResult).filter(CampaignResult.campaign_id == campaign_id)
    
    if status:
        query = query.filter(CampaignResult.status == status)
    
    if channel:
        query = query.filter(CampaignResult.channel == channel)
    
    total = query.count()
    rows = query.order_by(CampaignResult.created_at.desc()).offset(
        (page - 1) * page_size
    ).limit(page_size).all()
    
    return rows

@router.get("/{result_id}", response_model=CampaignResultOut)
def get_result(result_id: str, db: Session = Depends(get_db)):
    row = db.query(CampaignResult).filter(CampaignResult.result_id == result_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Result not found")
    return row

@router.patch("/{result_id}", response_model=CampaignResultOut)
def update_result(result_id: str, data: CampaignResultUpdate, db: Session = Depends(get_db)):
    row = db.query(CampaignResult).filter(CampaignResult.result_id == result_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Result not found")
    
    upd = data.dict(exclude_unset=True)
    for k, v in upd.items():
        setattr(row, k, v)
    row.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(row)
    return row

@router.get("/{campaign_id}/analytics", response_model=CampaignResultAnalytics)
def get_result_analytics(campaign_id: str, db: Session = Depends(get_db)):
    """
    Get comprehensive analytics for campaign results
    """
    # Total results
    total_results = db.query(func.count(CampaignResult.result_id)).filter(
        CampaignResult.campaign_id == campaign_id
    ).scalar() or 0
    
    if total_results == 0:
        return CampaignResultAnalytics(
            campaign_id=campaign_id,
            total_results=0,
            status_breakdown={},
            channel_breakdown=[],
            engagement_metrics={},
            timeline_data=[],
            failure_reasons=[]
        )
    
    # Status breakdown
    status_query = db.query(
        CampaignResult.status,
        func.count(CampaignResult.result_id).label('count')
    ).filter(
        CampaignResult.campaign_id == campaign_id
    ).group_by(CampaignResult.status).all()
    
    status_breakdown = {str(row.status): row.count for row in status_query}
    
    # Channel breakdown with metrics
    channel_query = db.query(
        CampaignResult.channel,
        func.count(CampaignResult.result_id).label('total'),
        func.sum(case((CampaignResult.status == 'sent', 1), else_=0)).label('sent'),
        func.sum(case((CampaignResult.status == 'delivered', 1), else_=0)).label('delivered'),
        func.sum(case((CampaignResult.status == 'failed', 1), else_=0)).label('failed'),
        func.sum(case((CampaignResult.status == 'bounced', 1), else_=0)).label('bounced'),
        func.sum(case((CampaignResult.open_count > 0, 1), else_=0)).label('opened'),
        func.sum(case((CampaignResult.click_count > 0, 1), else_=0)).label('clicked'),
        func.sum(case((CampaignResult.survey_completed_at.isnot(None), 1), else_=0)).label('completed')
    ).filter(
        CampaignResult.campaign_id == campaign_id
    ).group_by(CampaignResult.channel).all()
    
    channel_breakdown = [
        ChannelBreakdown(
            channel=str(row.channel),
            total=row.total,
            sent=row.sent or 0,
            delivered=row.delivered or 0,
            failed=row.failed or 0,
            bounced=row.bounced or 0,
            opened=row.opened or 0,
            clicked=row.clicked or 0,
            completed=row.completed or 0,
            delivery_rate=round((row.delivered / row.total * 100), 2) if row.total > 0 else 0,
            open_rate=round((row.opened / row.delivered * 100), 2) if row.delivered and row.delivered > 0 else 0,
            click_rate=round((row.clicked / row.delivered * 100), 2) if row.delivered and row.delivered > 0 else 0,
            completion_rate=round((row.completed / row.delivered * 100), 2) if row.delivered and row.delivered > 0 else 0
        )
        for row in channel_query
    ]
    
    # Engagement metrics
    engagement_query = db.query(
        func.count(CampaignResult.result_id).label('total'),
        func.sum(case((CampaignResult.open_count > 0, 1), else_=0)).label('opened'),
        func.sum(case((CampaignResult.click_count > 0, 1), else_=0)).label('clicked'),
        func.sum(case((CampaignResult.reply_count > 0, 1), else_=0)).label('replied'),
        func.sum(case((CampaignResult.survey_started_at.isnot(None), 1), else_=0)).label('survey_started'),
        func.sum(case((CampaignResult.survey_completed_at.isnot(None), 1), else_=0)).label('survey_completed'),
        func.sum(case((CampaignResult.unsubscribed_at.isnot(None), 1), else_=0)).label('unsubscribed'),
        func.sum(CampaignResult.open_count).label('total_opens'),
        func.sum(CampaignResult.click_count).label('total_clicks'),
        func.sum(CampaignResult.reply_count).label('total_replies')
    ).filter(
        CampaignResult.campaign_id == campaign_id
    ).first()
    
    engagement_metrics = {
        "total_opens": engagement_query.total_opens or 0,
        "total_clicks": engagement_query.total_clicks or 0,
        "total_replies": engagement_query.total_replies or 0,
        "unique_opens": engagement_query.opened or 0,
        "unique_clicks": engagement_query.clicked or 0,
        "unique_replies": engagement_query.replied or 0,
        "survey_started": engagement_query.survey_started or 0,
        "survey_completed": engagement_query.survey_completed or 0,
        "unsubscribed": engagement_query.unsubscribed or 0,
        "open_rate": round((engagement_query.opened / total_results * 100), 2) if total_results > 0 else 0,
        "click_rate": round((engagement_query.clicked / total_results * 100), 2) if total_results > 0 else 0,
        "response_rate": round((engagement_query.survey_started / total_results * 100), 2) if total_results > 0 else 0,
        "completion_rate": round((engagement_query.survey_completed / engagement_query.survey_started * 100), 2) if engagement_query.survey_started and engagement_query.survey_started > 0 else 0
    }
    
    # Timeline data (results over time)
    timeline_query = db.query(
        func.date(CampaignResult.created_at).label('date'),
        func.count(CampaignResult.result_id).label('count'),
        func.sum(case((CampaignResult.status == 'delivered', 1), else_=0)).label('delivered'),
        func.sum(case((CampaignResult.status == 'failed', 1), else_=0)).label('failed')
    ).filter(
        CampaignResult.campaign_id == campaign_id
    ).group_by(func.date(CampaignResult.created_at)).order_by(func.date(CampaignResult.created_at)).all()
    
    timeline_data = [
        ResultTimelineData(
            date=str(row.date),
            count=row.count,
            delivered=row.delivered or 0,
            failed=row.failed or 0
        )
        for row in timeline_query
    ]
    
    # Failure reasons
    failure_query = db.query(
        CampaignResult.error,
        func.count(CampaignResult.result_id).label('count')
    ).filter(
        CampaignResult.campaign_id == campaign_id,
        CampaignResult.status.in_(['failed', 'bounced']),
        CampaignResult.error.isnot(None)
    ).group_by(CampaignResult.error).order_by(func.count(CampaignResult.result_id).desc()).limit(10).all()
    
    failure_reasons = [
        {"reason": row.error[:100], "count": row.count}
        for row in failure_query
    ]
    
    return CampaignResultAnalytics(
        campaign_id=campaign_id,
        total_results=total_results,
        status_breakdown=status_breakdown,
        channel_breakdown=channel_breakdown,
        engagement_metrics=engagement_metrics,
        timeline_data=timeline_data,
        failure_reasons=failure_reasons
    )
@router.post("/get-or-create", response_model=CampaignResultOut)
def get_or_create_result(data: CampaignResultCreate, db: Session = Depends(get_db)):
    """
    Get existing result or create new one for campaign + contact
    """
    # Try to find existing result
    existing = db.query(CampaignResult).filter(
        CampaignResult.campaign_id == data.campaign_id,
        CampaignResult.contact_id == data.contact_id
    ).first()
    
    if existing:
        # Update metadata if provided
        if data.meta_data:
            existing.meta_data = {**(existing.meta_data or {}), **data.meta_data}
            existing.updated_at = datetime.utcnow()
            db.commit()
            db.refresh(existing)
        return existing
    
    # Create new result
    rid = data.result_id or "result_" + uuid.uuid4().hex[:10]
    row = CampaignResult(
        result_id=rid,
        campaign_id=data.campaign_id,
        org_id=data.org_id,
        contact_id=data.contact_id,
        contact_email=data.contact_email,
        contact_phone=data.contact_phone,
        status=data.status,
        channel=data.channel,
        message_id=data.message_id,
        error=data.error,
        error_code=data.error_code,
        meta_data=data.meta_data or {},
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row