import uuid
from datetime import datetime
from typing import List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from ..db import get_db
from ..models.campaign_result import CampaignResult
from ..schemas.campaign_results import CampaignResultCreate, CampaignResultUpdate, CampaignResultOut

router = APIRouter(prefix="/campaign-results", tags=["Campaign Results"])

@router.post("/", response_model=CampaignResultOut)
def create_result(data: CampaignResultCreate, db: Session = Depends(get_db)):
    rid = data.result_id or "result_" + uuid.uuid4().hex[:10]
    row = CampaignResult(
        result_id=rid,
        campaign_id=data.campaign_id,
        org_id=data.org_id,
        project_id=data.project_id,
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
def list_results(campaign_id: str = Query(...), db: Session = Depends(get_db)):
    rows = (
        db.query(CampaignResult)
        .filter(CampaignResult.campaign_id == campaign_id)
        .order_by(CampaignResult.created_at.desc())
        .all()
    )
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