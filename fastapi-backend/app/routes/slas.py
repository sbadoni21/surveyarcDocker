# app/routers/slas.py
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import select
from typing import List, Optional
import uuid

from ..db import get_db
from ..models.sla import BusinessCalendar
from ..schemas.sla import SLACreate, SLAUpdate, SLAOut
from ..models.tickets import SLA

router = APIRouter(prefix="/slas", tags=["SLAs"])

@router.get("/", response_model=List[SLAOut])
def list_slas(org_id: str = Query(...), active: Optional[bool] = Query(None), db: Session = Depends(get_db)):
    stmt = select(SLA).where(SLA.org_id == org_id)
    if active is not None:
        stmt = stmt.where(SLA.active == active)
    rows = db.execute(stmt).scalars().all()
    return [SLAOut.model_validate(r, from_attributes=True) for r in rows]

@router.get("/{sla_id}", response_model=SLAOut)
def get_sla(sla_id: str, db: Session = Depends(get_db)):
    row = db.get(SLA, sla_id)
    if not row:
        raise HTTPException(404, "SLA not found")
    return SLAOut.model_validate(row, from_attributes=True)

@router.post("/", response_model=SLAOut, status_code=201)
def create_sla(payload: SLACreate, db: Session = Depends(get_db)):
    sla_id = payload.sla_id or f"sla_{uuid.uuid4().hex[:10]}"
    row = SLA(
        sla_id=sla_id,
        org_id=payload.org_id,
        name=payload.name,
        active=payload.active,
        first_response_minutes=payload.first_response_minutes,
        resolution_minutes=payload.resolution_minutes,
        calendar_id=payload.calendar_id,
        rules=payload.rules or {},
        meta=payload.meta or {},
    )
    db.add(row); db.commit(); db.refresh(row)
    return SLAOut.model_validate(row, from_attributes=True)

@router.patch("/{sla_id}", response_model=SLAOut)
def update_sla(sla_id: str, payload: SLAUpdate, db: Session = Depends(get_db)):
    row: SLA | None = db.get(SLA, sla_id)
    if not row:
        raise HTTPException(404, "SLA not found")
    data = payload.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(row, k, v)
    db.commit(); db.refresh(row)
    return SLAOut.model_validate(row, from_attributes=True)

@router.delete("/{sla_id}", status_code=204)
def delete_sla(sla_id: str, db: Session = Depends(get_db)):
    row: SLA | None = db.get(SLA, sla_id)
    if not row:
        raise HTTPException(404, "SLA not found")
    db.delete(row); db.commit()
    return None

