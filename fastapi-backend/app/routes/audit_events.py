# app/routers/audit_events.py
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import select, and_, desc
from ..db import get_db
from ..models.audit_event import AuditEvent
from ..schemas.audit_event import AuditEventCreate, AuditEventOut
from ..services.audit import audit

router = APIRouter(prefix="/audit-events", tags=["Audit"])

@router.post("/", response_model=AuditEventOut, status_code=201)
def create_audit_event(payload: AuditEventCreate, db: Session = Depends(get_db)):
    return audit(db, **payload.model_dump())

@router.get("/by-entity", response_model=list[AuditEventOut])
def by_entity(
    entity_type: str = Query(...),
    entity_id: str = Query(...),
    org_id: str | None = Query(None),
    since: str | None = Query(None),  # ISO date strings
    until: str | None = Query(None),
    event_type: str | None = Query(None),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    stmt = select(AuditEvent).where(
        AuditEvent.entity_type == entity_type,
        AuditEvent.entity_id == entity_id
    )
    if org_id:
        stmt = stmt.where(AuditEvent.org_id == org_id)
    if event_type:
        stmt = stmt.where(AuditEvent.event_type == event_type)
    if since:
        stmt = stmt.where(AuditEvent.occurred_at >= since)
    if until:
        stmt = stmt.where(AuditEvent.occurred_at < until)
    rows = db.execute(stmt.order_by(desc(AuditEvent.occurred_at)).limit(limit).offset(offset)).scalars().all()
    return rows

@router.get("/by-org", response_model=list[AuditEventOut])
def by_org(
    org_id: str = Query(...),
    entity_type: str | None = Query(None),
    event_type: str | None = Query(None),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    stmt = select(AuditEvent).where(AuditEvent.org_id == org_id)
    if entity_type:
        stmt = stmt.where(AuditEvent.entity_type == entity_type)
    if event_type:
        stmt = stmt.where(AuditEvent.event_type == event_type)
    rows = db.execute(stmt.order_by(desc(AuditEvent.occurred_at)).limit(limit).offset(offset)).scalars().all()
    return rows
