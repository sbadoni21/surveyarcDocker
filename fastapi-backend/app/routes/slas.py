# app/routers/slas.py
from __future__ import annotations

import uuid
import json
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, Body, status, UploadFile, File
from fastapi.responses import StreamingResponse
from sqlalchemy import select, and_, or_, func, delete, update
from sqlalchemy.orm import Session
from pydantic import BaseModel

from ..db import get_db

# Schemas
from ..schemas.sla import (
    SLACreate, SLAUpdate, SLAOut,
    SLAObjectiveCreate, SLAObjectiveUpdate, SLAObjectiveOut,
    SLACreditRuleCreate, SLACreditRuleUpdate, SLACreditRuleOut,
    SLAAggregation, SLAScope, SLADimension, SLABreachGrade
)

# Models
from ..models.sla import (
    SLA, SLAObjective, SLACreditRule,
)

# Cache helpers (optional; safe no-ops if Redis is down)
from ..services.redis_sla_service import cache_sla, get_sla as cache_get_sla, invalidate_sla

router = APIRouter(prefix="/slas", tags=["SLAs"])


# ============================= BASIC CRUD =============================

@router.get("/", response_model=List[SLAOut])
def list_slas(
    org_id: str = Query(...),
    active: Optional[bool] = Query(None),
    scope: Optional[SLAScope] = Query(None),
    q: Optional[str] = Query(None, description="Search by name/slug (case-insensitive)"),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    """List SLAs with filtering and pagination"""
    stmt = select(SLA).where(SLA.org_id == org_id)
    if active is not None:
        stmt = stmt.where(SLA.active == active)
    if scope is not None:
        stmt = stmt.where(SLA.scope == scope)
    if q:
        like = f"%{q.lower()}%"
        stmt = stmt.where(or_(func.lower(SLA.name).like(like), func.lower(SLA.slug).like(like)))
    stmt = stmt.order_by(SLA.precedence.asc(), SLA.created_at.desc()).limit(limit).offset(offset)
    rows = db.execute(stmt).scalars().all()
    return [SLAOut.model_validate(r, from_attributes=True) for r in rows]


@router.get("/{sla_id}", response_model=SLAOut)
def get_sla(sla_id: str, db: Session = Depends(get_db)):
    """Get a single SLA by ID"""

    # Try Redis (best effort, fail silently if Redis unavailable)
    cached = None
    try:
        cached = cache_get_sla(sla_id)
        if cached is not None:
            return SLAOut.model_validate(cached)
    except Exception as e:
        # Log warning but don't fail
        print(f"[Warning] Redis read failed: {e}")

    # Fallback to DB
    row = db.get(SLA, sla_id)
    if not row:
        raise HTTPException(404, "SLA not found")

    dto = SLAOut.model_validate(row, from_attributes=True)

    # Try to cache back in Redis (non-blocking)
    try:
        cache_sla(sla_id, dto.model_dump())
    except Exception as e:
        print(f"[Warning] Redis write failed: {e}")

    return dto


@router.post("/", response_model=SLAOut, status_code=201)
def create_sla(payload: SLACreate, db: Session = Depends(get_db)):
    """Create a new SLA"""
    sla_id = payload.sla_id or f"sla_{uuid.uuid4().hex[:10]}"
    row = SLA(
        sla_id=sla_id,
        org_id=payload.org_id,
        name=payload.name,
        description=payload.description,
        slug=payload.slug,
        active=payload.active,
        first_response_minutes=payload.first_response_minutes,
        resolution_minutes=payload.resolution_minutes,
        rules=payload.rules or {},
        target_matrix=payload.target_matrix or {},
        pause_rules=payload.pause_rules or {},
        reminder_policy=payload.reminder_policy or {},
        escalation_policy=payload.escalation_policy or {},
        kpi_targets=payload.kpi_targets or {},
        exclusions=payload.exclusions or {},
        penalties=payload.penalties or {},
        aggregation=payload.aggregation or SLAAggregation.monthly_percent,
        scope=payload.scope or SLAScope.org,
        scope_ids=payload.scope_ids or {},
        precedence=payload.precedence or 100,
        version=payload.version or 1,
        effective_from=payload.effective_from,
        effective_to=payload.effective_to,
        published_at=payload.published_at,
        requires_contract_accept=payload.requires_contract_accept or False,
        audit_tags=payload.audit_tags or {},
        data_retention_days=payload.data_retention_days,
        grace_minutes=payload.grace_minutes or 0,
        auto_close_after_days=payload.auto_close_after_days,
        created_by=payload.created_by,
        meta=payload.meta or {},
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    dto = SLAOut.model_validate(row, from_attributes=True)
    try:
        cache_sla(sla_id, dto.model_dump())
    except Exception:
        pass
    return dto


@router.patch("/{sla_id}", response_model=SLAOut)
def update_sla(sla_id: str, payload: SLAUpdate, db: Session = Depends(get_db)):
    """Update an existing SLA"""
    row: SLA | None = db.get(SLA, sla_id)
    if not row:
        raise HTTPException(404, "SLA not found")
    data = payload.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(row, k, v)
    db.commit()
    db.refresh(row)
    dto = SLAOut.model_validate(row, from_attributes=True)
    try:
        cache_sla(sla_id, dto.model_dump())
    except Exception:
        pass
    return dto


@router.delete("/{sla_id}", status_code=204)
def delete_sla(sla_id: str, force: bool = Query(False), db: Session = Depends(get_db)):
    """Delete an SLA (with optional force to ignore dependencies)"""
    row: SLA | None = db.get(SLA, sla_id)
    if not row:
        raise HTTPException(404, "SLA not found")
    
    # Check for dependencies if not forcing
    if not force:
        # Check if there are any active ticket SLA statuses
        from ..models.sla import TicketSLAStatus
        active_tickets = db.execute(
            select(func.count(TicketSLAStatus.ticket_id))
            .where(TicketSLAStatus.sla_id == sla_id)
        ).scalar()
        if active_tickets > 0:
            raise HTTPException(
                400, 
                f"Cannot delete SLA: {active_tickets} tickets are using this SLA. Use force=true to override."
            )
    
    db.delete(row)
    db.commit()
    try:
        invalidate_sla(sla_id)
    except Exception:
        pass
    return None


# ============================= BULK OPERATIONS =============================

class BulkSLAResult(BaseModel):
    created: int
    updated: int
    failed: int
    errors: List[Dict[str, Any]]


@router.post("/bulk", response_model=BulkSLAResult)
def bulk_create_update_slas(
    slas: List[SLACreate] = Body(...),
    update_existing: bool = Query(True, description="Update if slug exists"),
    db: Session = Depends(get_db),
):
    """Bulk create or update SLAs"""
    result = BulkSLAResult(created=0, updated=0, failed=0, errors=[])
    
    for payload in slas:
        try:
            # Check if exists by slug
            existing = None
            if payload.slug and update_existing:
                existing = db.execute(
                    select(SLA).where(
                        and_(SLA.org_id == payload.org_id, SLA.slug == payload.slug)
                    )
                ).scalar_one_or_none()
            
            if existing:
                # Update
                for k, v in payload.model_dump(exclude_unset=True).items():
                    if k != 'sla_id':
                        setattr(existing, k, v)
                db.commit()
                result.updated += 1
            else:
                # Create
                sla_id = payload.sla_id or f"sla_{uuid.uuid4().hex[:10]}"
                row = SLA(sla_id=sla_id, **payload.model_dump(exclude={'sla_id'}))
                db.add(row)
                db.commit()
                result.created += 1
        except Exception as e:
            result.failed += 1
            result.errors.append({
                "sla": payload.name,
                "error": str(e)
            })
            db.rollback()
    
    return result


@router.delete("/bulk", response_model=Dict[str, Any])
def bulk_delete_slas(
    sla_ids: List[str] = Body(..., embed=True),
    force: bool = Query(False),
    db: Session = Depends(get_db),
):
    """Bulk delete SLAs"""
    deleted = 0
    failed = 0
    errors = []
    
    for sla_id in sla_ids:
        try:
            row = db.get(SLA, sla_id)
            if not row:
                failed += 1
                errors.append({"sla_id": sla_id, "error": "Not found"})
                continue
            
            if not force:
                from ..models.sla import TicketSLAStatus
                active_tickets = db.execute(
                    select(func.count(TicketSLAStatus.ticket_id))
                    .where(TicketSLAStatus.sla_id == sla_id)
                ).scalar()
                if active_tickets > 0:
                    failed += 1
                    errors.append({
                        "sla_id": sla_id, 
                        "error": f"{active_tickets} active tickets"
                    })
                    continue
            
            db.delete(row)
            deleted += 1
            try:
                invalidate_sla(sla_id)
            except:
                pass
        except Exception as e:
            failed += 1
            errors.append({"sla_id": sla_id, "error": str(e)})
            db.rollback()
    
    db.commit()
    return {"deleted": deleted, "failed": failed, "errors": errors}


# ============================= SLA ACTIONS =============================

@router.post("/{sla_id}/activate", response_model=SLAOut)
def activate_sla(sla_id: str, db: Session = Depends(get_db)):
    """Activate an SLA"""
    row = db.get(SLA, sla_id)
    if not row:
        raise HTTPException(404, "SLA not found")
    row.active = True
    db.commit(); db.refresh(row)
    dto = SLAOut.model_validate(row, from_attributes=True)
    try:
        cache_sla(sla_id, dto.model_dump())
    except Exception:
        pass
    return dto


@router.post("/{sla_id}/deactivate", response_model=SLAOut)
def deactivate_sla(sla_id: str, db: Session = Depends(get_db)):
    """Deactivate an SLA"""
    row = db.get(SLA, sla_id)
    if not row:
        raise HTTPException(404, "SLA not found")
    row.active = False
    db.commit(); db.refresh(row)
    dto = SLAOut.model_validate(row, from_attributes=True)
    try:
        cache_sla(sla_id, dto.model_dump())
    except Exception:
        pass
    return dto


@router.post("/{sla_id}/duplicate", response_model=SLAOut, status_code=status.HTTP_201_CREATED)
def duplicate_sla(
    sla_id: str,
    overrides: Dict[str, Any] = Body(default_factory=dict, description="Optional fields to override in the clone"),
    db: Session = Depends(get_db),
):
    """Duplicate an SLA with all its objectives and credit rules"""
    src: SLA | None = db.get(SLA, sla_id)
    if not src:
        raise HTTPException(404, "SLA not found")

    clone_id = overrides.get("sla_id") or f"sla_{uuid.uuid4().hex[:10]}"
    clone = SLA(
        sla_id=clone_id,
        org_id=overrides.get("org_id", src.org_id),
        name=overrides.get("name", f"{src.name} (Copy)"),
        description=overrides.get("description", src.description),
        slug=overrides.get("slug", None),
        active=overrides.get("active", False),  # clones default to inactive
        first_response_minutes=overrides.get("first_response_minutes", src.first_response_minutes),
        resolution_minutes=overrides.get("resolution_minutes", src.resolution_minutes),
        rules=overrides.get("rules", dict(src.rules or {})),
        target_matrix=overrides.get("target_matrix", dict(src.target_matrix or {})),
        pause_rules=overrides.get("pause_rules", dict(src.pause_rules or {})),
        reminder_policy=overrides.get("reminder_policy", dict(src.reminder_policy or {})),
        escalation_policy=overrides.get("escalation_policy", dict(src.escalation_policy or {})),
        kpi_targets=overrides.get("kpi_targets", dict(src.kpi_targets or {})),
        exclusions=overrides.get("exclusions", dict(src.exclusions or {})),
        penalties=overrides.get("penalties", dict(src.penalties or {})),
        aggregation=overrides.get("aggregation", src.aggregation),
        scope=overrides.get("scope", src.scope),
        scope_ids=overrides.get("scope_ids", dict(src.scope_ids or {})),
        precedence=overrides.get("precedence", src.precedence),
        version=overrides.get("version", (src.version or 1) + 1),
        effective_from=overrides.get("effective_from", None),
        effective_to=overrides.get("effective_to", None),
        published_at=overrides.get("published_at", None),
        requires_contract_accept=overrides.get("requires_contract_accept", src.requires_contract_accept),
        audit_tags=overrides.get("audit_tags", dict(src.audit_tags or {})),
        data_retention_days=overrides.get("data_retention_days", src.data_retention_days),
        grace_minutes=overrides.get("grace_minutes", src.grace_minutes),
        auto_close_after_days=overrides.get("auto_close_after_days", src.auto_close_after_days),
        meta=overrides.get("meta", dict(src.meta or {})),
        created_by=overrides.get("created_by", None),
        updated_by=overrides.get("updated_by", None),
    )

    db.add(clone)
    db.flush()

    # Clone Objectives
    objs = db.execute(select(SLAObjective).where(SLAObjective.sla_id == sla_id)).scalars().all()
    for o in objs:
        db.add(SLAObjective(
            objective_id=f"slo_{uuid.uuid4().hex[:10]}",
            sla_id=clone.sla_id,
            objective=o.objective,
            target_minutes=o.target_minutes,
            match=dict(o.match or {}),
            breach_grades=dict(o.breach_grades or {}),
            active=o.active,
            meta=dict(o.meta or {}),
        ))

    # Clone Credit Rules
    rules = db.execute(select(SLACreditRule).where(SLACreditRule.sla_id == sla_id)).scalars().all()
    for r in rules:
        db.add(SLACreditRule(
            rule_id=f"scr_{uuid.uuid4().hex[:10]}",
            sla_id=clone.sla_id,
            objective=r.objective,
            grade=r.grade,
            credit_unit=r.credit_unit,
            credit_value=r.credit_value,
            cap_per_period=r.cap_per_period,
            period_days=r.period_days,
            active=r.active,
            meta=dict(r.meta or {}),
        ))

    db.commit()
    db.refresh(clone)

    dto = SLAOut.model_validate(clone, from_attributes=True)
    try:
        cache_sla(clone.sla_id, dto.model_dump())
    except Exception:
        pass
    return dto


@router.post("/{sla_id}/publish", response_model=SLAOut)
def publish_sla(
    sla_id: str,
    effective_from: Optional[datetime] = Body(None),
    db: Session = Depends(get_db)
):
    """Publish an SLA (make it effective)"""
    row = db.get(SLA, sla_id)
    if not row:
        raise HTTPException(404, "SLA not found")
    
    row.published_at = datetime.utcnow()
    row.effective_from = effective_from or datetime.utcnow()
    row.active = True
    
    db.commit()
    db.refresh(row)
    
    dto = SLAOut.model_validate(row, from_attributes=True)
    try:
        cache_sla(sla_id, dto.model_dump())
    except Exception:
        pass
    return dto


@router.post("/{sla_id}/archive", response_model=SLAOut)
def archive_sla(sla_id: str, db: Session = Depends(get_db)):
    """Archive an SLA (set effective_to to now)"""
    row = db.get(SLA, sla_id)
    if not row:
        raise HTTPException(404, "SLA not found")
    
    row.effective_to = datetime.utcnow()
    row.active = False
    
    db.commit()
    db.refresh(row)
    
    dto = SLAOut.model_validate(row, from_attributes=True)
    try:
        cache_sla(sla_id, dto.model_dump())
    except Exception:
        pass
    return dto


# ============================= QUERY & MATCHING =============================

class SLAMatchRequest(BaseModel):
    ticket_id: Optional[str] = None
    priority: Optional[str] = None
    severity: Optional[str] = None
    channel: Optional[str] = None
    tags: List[str] = []
    group_id: Optional[str] = None
    team_id: Optional[str] = None
    product_id: Optional[str] = None
    requester_tier: Optional[str] = None
    custom_fields: Dict[str, Any] = {}


@router.post("/{org_id}/match", response_model=List[SLAOut])
def match_slas(
    org_id: str,
    criteria: SLAMatchRequest = Body(...),
    db: Session = Depends(get_db),
):
    """Find applicable SLAs for given criteria (sorted by precedence)"""
    # Get active SLAs for org
    stmt = select(SLA).where(
        and_(
            SLA.org_id == org_id,
            SLA.active == True
        )
    ).order_by(SLA.precedence.asc())
    
    slas = db.execute(stmt).scalars().all()
    
    # Filter by rules (simplified matching logic - extend as needed)
    matched = []
    for sla in slas:
        rules = sla.rules or {}
        
        # Check if criteria matches rules
        if _matches_criteria(sla, criteria):
            matched.append(sla)
    
    return [SLAOut.model_validate(s, from_attributes=True) for s in matched]


def _matches_criteria(sla: SLA, criteria: SLAMatchRequest) -> bool:
    """Helper to check if SLA rules match criteria"""
    rules = sla.rules or {}
    
    # Priority check
    if "priority_in" in rules and criteria.priority:
        if criteria.priority not in rules["priority_in"]:
            return False
    
    # Severity check
    if "severity_in" in rules and criteria.severity:
        if criteria.severity not in rules["severity_in"]:
            return False
    
    # Tag check (any)
    if "tag_any" in rules and criteria.tags:
        if not any(tag in rules["tag_any"] for tag in criteria.tags):
            return False
    
    # Group/Team/Product checks
    if "group_id_in" in rules and criteria.group_id:
        if criteria.group_id not in rules["group_id_in"]:
            return False
    
    if "team_id_in" in rules and criteria.team_id:
        if criteria.team_id not in rules["team_id_in"]:
            return False
    
    if "product_id_in" in rules and criteria.product_id:
        if criteria.product_id not in rules["product_id_in"]:
            return False
    
    return True


@router.get("/{org_id}/effective", response_model=List[SLAOut])
def get_effective_slas(
    org_id: str,
    at_time: Optional[datetime] = Query(None),
    scope: Optional[SLAScope] = Query(None),
    db: Session = Depends(get_db),
):
    """Get all SLAs effective at a given time"""
    check_time = at_time or datetime.utcnow()
    
    stmt = select(SLA).where(
        and_(
            SLA.org_id == org_id,
            SLA.active == True,
            or_(
                SLA.effective_from.is_(None),
                SLA.effective_from <= check_time
            ),
            or_(
                SLA.effective_to.is_(None),
                SLA.effective_to >= check_time
            )
        )
    )
    
    if scope:
        stmt = stmt.where(SLA.scope == scope)
    
    stmt = stmt.order_by(SLA.precedence.asc())
    
    rows = db.execute(stmt).scalars().all()
    return [SLAOut.model_validate(r, from_attributes=True) for r in rows]


# ============================= ANALYTICS & REPORTING =============================

class SLAStats(BaseModel):
    total_slas: int
    active_slas: int
    by_scope: Dict[str, int]
    by_aggregation: Dict[str, int]
    with_objectives: int
    with_credit_rules: int


@router.get("/{org_id}/stats", response_model=SLAStats)
def get_sla_stats(org_id: str, db: Session = Depends(get_db)):
    """Get statistics about SLAs in an organization"""
    total = db.execute(
        select(func.count(SLA.sla_id)).where(SLA.org_id == org_id)
    ).scalar()
    
    active = db.execute(
        select(func.count(SLA.sla_id)).where(
            and_(SLA.org_id == org_id, SLA.active == True)
        )
    ).scalar()
    
    # By scope
    scope_counts = db.execute(
        select(SLA.scope, func.count(SLA.sla_id))
        .where(SLA.org_id == org_id)
        .group_by(SLA.scope)
    ).all()
    by_scope = {str(scope): count for scope, count in scope_counts}
    
    # By aggregation
    agg_counts = db.execute(
        select(SLA.aggregation, func.count(SLA.sla_id))
        .where(SLA.org_id == org_id)
        .group_by(SLA.aggregation)
    ).all()
    by_aggregation = {str(agg): count for agg, count in agg_counts}
    
    # With objectives
    with_objectives = db.execute(
        select(func.count(func.distinct(SLAObjective.sla_id)))
        .join(SLA, SLAObjective.sla_id == SLA.sla_id)
        .where(SLA.org_id == org_id)
    ).scalar()
    
    # With credit rules
    with_credit_rules = db.execute(
        select(func.count(func.distinct(SLACreditRule.sla_id)))
        .join(SLA, SLACreditRule.sla_id == SLA.sla_id)
        .where(SLA.org_id == org_id)
    ).scalar()
    
    return SLAStats(
        total_slas=total,
        active_slas=active,
        by_scope=by_scope,
        by_aggregation=by_aggregation,
        with_objectives=with_objectives or 0,
        with_credit_rules=with_credit_rules or 0
    )


class SLAComplianceStats(BaseModel):
    sla_id: str
    sla_name: str
    total_tickets: int
    met: int
    breached: int
    in_progress: int
    compliance_rate: float


@router.get("/{org_id}/compliance", response_model=List[SLAComplianceStats])
def get_compliance_stats(
    org_id: str,
    from_date: Optional[datetime] = Query(None),
    to_date: Optional[datetime] = Query(None),
    db: Session = Depends(get_db),
):
    """Get SLA compliance statistics"""
    from ..models.sla import TicketSLAStatus
    
    # Base query
    stmt = select(
        SLA.sla_id,
        SLA.name,
        func.count(TicketSLAStatus.ticket_id).label('total'),
        func.sum(func.cast(TicketSLAStatus.met, Integer)).label('met'),
        func.sum(func.cast(TicketSLAStatus.breached, Integer)).label('breached'),
    ).join(
        TicketSLAStatus, SLA.sla_id == TicketSLAStatus.sla_id
    ).where(
        SLA.org_id == org_id
    )
    
    if from_date:
        stmt = stmt.where(TicketSLAStatus.created_at >= from_date)
    if to_date:
        stmt = stmt.where(TicketSLAStatus.created_at <= to_date)
    
    stmt = stmt.group_by(SLA.sla_id, SLA.name)
    
    results = db.execute(stmt).all()
    
    stats = []
    for sla_id, sla_name, total, met, breached in results:
        met = met or 0
        breached = breached or 0
        in_progress = total - met - breached
        compliance = (met / total * 100) if total > 0 else 0
        
        stats.append(SLAComplianceStats(
            sla_id=sla_id,
            sla_name=sla_name,
            total_tickets=total,
            met=met,
            breached=breached,
            in_progress=in_progress,
            compliance_rate=round(compliance, 2)
        ))
    
    return stats


# ============================= VALIDATION & TESTING =============================

class ValidationResult(BaseModel):
    valid: bool
    errors: List[str]
    warnings: List[str]


@router.post("/{sla_id}/validate", response_model=ValidationResult)
def validate_sla(sla_id: str, db: Session = Depends(get_db)):
    """Validate SLA configuration"""
    sla = db.get(SLA, sla_id)
    if not sla:
        raise HTTPException(404, "SLA not found")
    
    errors = []
    warnings = []
    
    # Check for objectives
    obj_count = db.execute(
        select(func.count(SLAObjective.objective_id))
        .where(SLAObjective.sla_id == sla_id)
    ).scalar()
    
    if obj_count == 0:
        warnings.append("No objectives defined")
    
    # Check for conflicting rules
    if sla.first_response_minutes and obj_count > 0:
        warnings.append("Both default targets and objectives defined - objectives take precedence")
    
    # Check effective dates
    if sla.effective_from and sla.effective_to:
        if sla.effective_from >= sla.effective_to:
            errors.append("effective_from must be before effective_to")
    
    # Check slug uniqueness
    if sla.slug:
        duplicate = db.execute(
            select(func.count(SLA.sla_id))
            .where(
                and_(
                    SLA.org_id == sla.org_id,
                    SLA.slug == sla.slug,
                    SLA.sla_id != sla_id
                )
            )
        ).scalar()
        if duplicate > 0:
            errors.append(f"Slug '{sla.slug}' is already in use")
    
    # Validate JSON structures
    if sla.rules:
        if not isinstance(sla.rules, dict):
            errors.append("rules must be a JSON object")
    
    if sla.target_matrix:
        if not isinstance(sla.target_matrix, dict):
            errors.append("target_matrix must be a JSON object")
    
    return ValidationResult(
        valid=len(errors) == 0,
        errors=errors,
        warnings=warnings
    )


class SimulationResult(BaseModel):
    sla_id: str
    sla_name: str
    matched: bool
    objectives: List[Dict[str, Any]]
    estimated_targets: Dict[str, int]


@router.post("/{org_id}/simulate", response_model=List[SimulationResult])
def simulate_sla_match(
    org_id: str,
    criteria: SLAMatchRequest = Body(...),
    db: Session = Depends(get_db),
):
    """Simulate which SLAs would match and what targets would apply"""
    matched_slas = match_slas(org_id, criteria, db)
    
    results = []
    for sla_dto in matched_slas:
        sla = db.get(SLA, sla_dto.sla_id)
        
        # Get objectives
        objectives = db.execute(
            select(SLAObjective)
            .where(and_(
                SLAObjective.sla_id == sla.sla_id,
                SLAObjective.active == True
            ))
        ).scalars().all()
        
        obj_list = []
        targets = {}
        
        for obj in objectives:
            obj_list.append({
                "objective": obj.objective.value,
                "target_minutes": obj.target_minutes,
                "match": obj.match
            })
            targets[obj.objective.value] = obj.target_minutes
        
        # Add default targets if no objectives
        if not targets:
            if sla.first_response_minutes:
                targets["first_response"] = sla.first_response_minutes
            if sla.resolution_minutes:
                targets["resolution"] = sla.resolution_minutes
        
        results.append(SimulationResult(
            sla_id=sla.sla_id,
            sla_name=sla.name,
            matched=True,
            objectives=obj_list,
            estimated_targets=targets
        ))
    
    return results


# ============================= IMPORT / EXPORT =============================

@router.get("/{org_id}/export")
def export_slas(
    org_id: str,
    include_objectives: bool = Query(True),
    include_credit_rules: bool = Query(True),
    db: Session = Depends(get_db),
):
    """Export SLAs as JSON"""
    slas = db.execute(
        select(SLA).where(SLA.org_id == org_id)
    ).scalars().all()
    
    export_data = []
    for sla in slas:
        sla_dict = SLAOut.model_validate(sla, from_attributes=True).model_dump()
        
        if include_objectives:
            objectives = db.execute(
                select(SLAObjective).where(SLAObjective.sla_id == sla.sla_id)
            ).scalars().all()
            sla_dict["objectives"] = [
                SLAObjectiveOut.model_validate(o, from_attributes=True).model_dump()
                for o in objectives
            ]
        
        if include_credit_rules:
            rules = db.execute(
                select(SLACreditRule).where(SLACreditRule.sla_id == sla.sla_id)
            ).scalars().all()
            sla_dict["credit_rules"] = [
                SLACreditRuleOut.model_validate(r, from_attributes=True).model_dump()
                for r in rules
            ]
        
        export_data.append(sla_dict)
    
    # Create JSON file
    import io
    output = io.StringIO()
    json.dump(export_data, output, indent=2, default=str)
    output.seek(0)
    
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode()),
        media_type="application/json",
        headers={
            "Content-Disposition": f"attachment; filename=slas_{org_id}_{datetime.now().strftime('%Y%m%d')}.json"
        }
    )


@router.post("/{org_id}/import", response_model=BulkSLAResult)
async def import_slas(
    org_id: str,
    file: UploadFile = File(...),
    update_existing: bool = Query(True),
    db: Session = Depends(get_db),
):
    """Import SLAs from JSON file"""
    content = await file.read()
    try:
        data = json.loads(content)
    except json.JSONDecodeError:
        raise HTTPException(400, "Invalid JSON file")
    
    if not isinstance(data, list):
        raise HTTPException(400, "JSON must be an array of SLAs")
    
    result = BulkSLAResult(created=0, updated=0, failed=0, errors=[])
    
    for item in data:
        try:
            # Extract nested data
            objectives_data = item.pop("objectives", [])
            credit_rules_data = item.pop("credit_rules", [])
            
            # Ensure org_id matches
            item["org_id"] = org_id
            
            # Check if exists
            existing = None
            if "slug" in item and item["slug"] and update_existing:
                existing = db.execute(
                    select(SLA).where(
                        and_(SLA.org_id == org_id, SLA.slug == item["slug"])
                    )
                ).scalar_one_or_none()
            
            if existing:
                # Update
                for k, v in item.items():
                    if k not in ["sla_id", "created_at", "updated_at"]:
                        setattr(existing, k, v)
                db.commit()
                sla_id = existing.sla_id
                result.updated += 1
            else:
                # Create
                sla_id = item.get("sla_id") or f"sla_{uuid.uuid4().hex[:10]}"
                item["sla_id"] = sla_id
                sla = SLA(**{k: v for k, v in item.items() if k in SLA.__table__.columns.keys()})
                db.add(sla)
                db.commit()
                result.created += 1
            
            # Import objectives
            for obj_data in objectives_data:
                obj_data["sla_id"] = sla_id
                obj_data["objective_id"] = f"slo_{uuid.uuid4().hex[:10]}"
                obj = SLAObjective(**{k: v for k, v in obj_data.items() if k in SLAObjective.__table__.columns.keys()})
                db.add(obj)
            
            # Import credit rules
            for rule_data in credit_rules_data:
                rule_data["sla_id"] = sla_id
                rule_data["rule_id"] = f"scr_{uuid.uuid4().hex[:10]}"
                rule = SLACreditRule(**{k: v for k, v in rule_data.items() if k in SLACreditRule.__table__.columns.keys()})
                db.add(rule)
            
            db.commit()
            
        except Exception as e:
            result.failed += 1
            result.errors.append({
                "sla": item.get("name", "Unknown"),
                "error": str(e)
            })
            db.rollback()
    
    return result


# ============================= VERSIONING =============================

@router.post("/{sla_id}/version", response_model=SLAOut)
def create_new_version(
    sla_id: str,
    changes: SLAUpdate = Body(...),
    db: Session = Depends(get_db)
):
    """Create a new version of an SLA"""
    current = db.get(SLA, sla_id)
    if not current:
        raise HTTPException(404, "SLA not found")
    
    # Archive current version
    current.effective_to = datetime.utcnow()
    current.active = False
    
    # Create new version
    new_version = duplicate_sla(sla_id, {
        "version": current.version + 1,
        "effective_from": datetime.utcnow(),
        "published_at": None,
        **changes.model_dump(exclude_unset=True)
    }, db)
    
    return new_version


@router.get("/{sla_id}/versions", response_model=List[SLAOut])
def list_versions(sla_id: str, db: Session = Depends(get_db)):
    """Get all versions of an SLA (matched by slug)"""
    sla = db.get(SLA, sla_id)
    if not sla or not sla.slug:
        raise HTTPException(404, "SLA not found or has no slug")
    
    versions = db.execute(
        select(SLA).where(
            and_(SLA.org_id == sla.org_id, SLA.slug == sla.slug)
        ).order_by(SLA.version.desc())
    ).scalars().all()
    
    return [SLAOut.model_validate(v, from_attributes=True) for v in versions]


# ============================= DEPENDENCY MANAGEMENT =============================

class DependencyInfo(BaseModel):
    active_tickets: int
    affected_ticket_ids: List[str]
    can_delete: bool


@router.get("/{sla_id}/dependencies", response_model=DependencyInfo)
def check_dependencies(
    sla_id: str,
    limit: int = Query(100),
    db: Session = Depends(get_db)
):
    """Check what depends on this SLA"""
    sla = db.get(SLA, sla_id)
    if not sla:
        raise HTTPException(404, "SLA not found")
    
    from ..models.sla import TicketSLAStatus
    
    ticket_ids = db.execute(
        select(TicketSLAStatus.ticket_id)
        .where(TicketSLAStatus.sla_id == sla_id)
        .limit(limit)
    ).scalars().all()
    
    count = db.execute(
        select(func.count(TicketSLAStatus.ticket_id))
        .where(TicketSLAStatus.sla_id == sla_id)
    ).scalar()
    
    return DependencyInfo(
        active_tickets=count,
        affected_ticket_ids=list(ticket_ids),
        can_delete=count == 0
    )


# ============================= MAINTENANCE =============================

@router.post("/{org_id}/cleanup", response_model=Dict[str, Any])
def cleanup_inactive_slas(
    org_id: str,
    older_than_days: int = Query(90, ge=1),
    dry_run: bool = Query(True),
    db: Session = Depends(get_db)
):
    """Cleanup old inactive SLAs"""
    cutoff_date = datetime.utcnow() - timedelta(days=older_than_days)
    
    stmt = select(SLA).where(
        and_(
            SLA.org_id == org_id,
            SLA.active == False,
            or_(
                SLA.effective_to < cutoff_date,
                and_(SLA.effective_to.is_(None), SLA.updated_at < cutoff_date)
            )
        )
    )
    
    slas = db.execute(stmt).scalars().all()
    
    if dry_run:
        return {
            "dry_run": True,
            "would_delete": len(slas),
            "slas": [{"id": s.sla_id, "name": s.name} for s in slas]
        }
    
    deleted = 0
    for sla in slas:
        db.delete(sla)
        deleted += 1
    
    db.commit()
    
    return {
        "dry_run": False,
        "deleted": deleted
    }


# ============================= OBJECTIVES CRUD =============================

@router.get("/{sla_id}/objectives", response_model=List[SLAObjectiveOut])
def list_objectives(sla_id: str, db: Session = Depends(get_db)):
    """List all objectives for an SLA"""
    parent = db.get(SLA, sla_id)
    if not parent:
        raise HTTPException(404, "SLA not found")
    rows = db.execute(select(SLAObjective).where(SLAObjective.sla_id == sla_id).order_by(SLAObjective.created_at.asc())).scalars().all()
    return [SLAObjectiveOut.model_validate(r, from_attributes=True) for r in rows]


@router.post("/{sla_id}/objectives", response_model=SLAObjectiveOut, status_code=201)
def create_objective(sla_id: str, payload: SLAObjectiveCreate, db: Session = Depends(get_db)):
    """Create a new objective for an SLA"""
    parent = db.get(SLA, sla_id)
    if not parent:
        raise HTTPException(404, "SLA not found")
    objective_id = payload.objective_id or f"slo_{uuid.uuid4().hex[:10]}"
    row = SLAObjective(
        objective_id=objective_id,
        sla_id=sla_id,
        objective=payload.objective,
        target_minutes=payload.target_minutes,
        match=payload.match or {},
        breach_grades=payload.breach_grades or {},
        active=payload.active if payload.active is not None else True,
        meta=payload.meta or {},
    )
    db.add(row); db.commit(); db.refresh(row)
    try:
        invalidate_sla(sla_id)
    except Exception:
        pass
    return SLAObjectiveOut.model_validate(row, from_attributes=True)


@router.get("/objectives/{objective_id}", response_model=SLAObjectiveOut)
def get_objective(objective_id: str, db: Session = Depends(get_db)):
    """Get a single objective"""
    row = db.get(SLAObjective, objective_id)
    if not row:
        raise HTTPException(404, "Objective not found")
    return SLAObjectiveOut.model_validate(row, from_attributes=True)


@router.patch("/objectives/{objective_id}", response_model=SLAObjectiveOut)
def update_objective(objective_id: str, payload: SLAObjectiveUpdate, db: Session = Depends(get_db)):
    """Update an objective"""
    row: SLAObjective | None = db.get(SLAObjective, objective_id)
    if not row:
        raise HTTPException(404, "Objective not found")
    data = payload.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(row, k, v)
    db.commit(); db.refresh(row)
    try:
        invalidate_sla(row.sla_id)
    except Exception:
        pass
    return SLAObjectiveOut.model_validate(row, from_attributes=True)


@router.delete("/objectives/{objective_id}", status_code=204)
def delete_objective(objective_id: str, db: Session = Depends(get_db)):
    """Delete an objective"""
    row: SLAObjective | None = db.get(SLAObjective, objective_id)
    if not row:
        raise HTTPException(404, "Objective not found")
    parent_id = row.sla_id
    db.delete(row); db.commit()
    try:
        invalidate_sla(parent_id)
    except Exception:
        pass
    return None


# ============================= CREDIT RULES CRUD =============================

@router.get("/{sla_id}/credit-rules", response_model=List[SLACreditRuleOut])
def list_credit_rules(sla_id: str, db: Session = Depends(get_db)):
    """List all credit rules for an SLA"""
    parent = db.get(SLA, sla_id)
    if not parent:
        raise HTTPException(404, "SLA not found")
    rows = db.execute(select(SLACreditRule).where(SLACreditRule.sla_id == sla_id).order_by(SLACreditRule.created_at.asc())).scalars().all()
    return [SLACreditRuleOut.model_validate(r, from_attributes=True) for r in rows]


@router.post("/{sla_id}/credit-rules", response_model=SLACreditRuleOut, status_code=201)
def create_credit_rule(sla_id: str, payload: SLACreditRuleCreate, db: Session = Depends(get_db)):
    """Create a new credit rule for an SLA"""
    parent = db.get(SLA, sla_id)
    if not parent:
        raise HTTPException(404, "SLA not found")
    rule_id = payload.rule_id or f"scr_{uuid.uuid4().hex[:10]}"
    row = SLACreditRule(
        rule_id=rule_id,
        sla_id=sla_id,
        objective=payload.objective,
        grade=payload.grade,
        credit_unit=payload.credit_unit,
        credit_value=payload.credit_value,
        cap_per_period=payload.cap_per_period,
        period_days=payload.period_days,
        active=payload.active if payload.active is not None else True,
        meta=payload.meta or {},
    )
    db.add(row); db.commit(); db.refresh(row)
    try:
        invalidate_sla(sla_id)
    except Exception:
        pass
    return SLACreditRuleOut.model_validate(row, from_attributes=True)


@router.get("/credit-rules/{rule_id}", response_model=SLACreditRuleOut)
def get_credit_rule(rule_id: str, db: Session = Depends(get_db)):
    """Get a single credit rule"""
    row = db.get(SLACreditRule, rule_id)
    if not row:
        raise HTTPException(404, "Credit Rule not found")
    return SLACreditRuleOut.model_validate(row, from_attributes=True)


@router.patch("/credit-rules/{rule_id}", response_model=SLACreditRuleOut)
def update_credit_rule(rule_id: str, payload: SLACreditRuleUpdate, db: Session = Depends(get_db)):
    """Update a credit rule"""
    row: SLACreditRule | None = db.get(SLACreditRule, rule_id)
    if not row:
        raise HTTPException(404, "Credit Rule not found")
    data = payload.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(row, k, v)
    db.commit(); db.refresh(row)
    try:
        invalidate_sla(row.sla_id)
    except Exception:
        pass
    return SLACreditRuleOut.model_validate(row, from_attributes=True)


@router.delete("/credit-rules/{rule_id}", status_code=204)
def delete_credit_rule(rule_id: str, db: Session = Depends(get_db)):
    """Delete a credit rule"""
    row: SLACreditRule | None = db.get(SLACreditRule, rule_id)
    if not row:
        raise HTTPException(404, "Credit Rule not found")
    parent_id = row.sla_id
    db.delete(row); db.commit()
    try:
        invalidate_sla(parent_id)
    except Exception:
        pass
    return None