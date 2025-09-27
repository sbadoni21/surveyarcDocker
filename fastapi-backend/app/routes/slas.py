# app/routers/slas.py
from __future__ import annotations

import uuid
from typing import List, Optional, Dict, Any

from fastapi import APIRouter, Depends, HTTPException, Query, Body, status
from sqlalchemy import select, and_, or_, func
from sqlalchemy.orm import Session

from ..db import get_db

# Schemas
from ..schemas.sla import (
    SLACreate, SLAUpdate, SLAOut,
    SLAObjectiveCreate, SLAObjectiveUpdate, SLAObjectiveOut,
    SLACreditRuleCreate, SLACreditRuleUpdate, SLACreditRuleOut,
    SLAAggregation, SLAScope
)

# Models
from ..models.sla import (
    SLA, SLAObjective, SLACreditRule,
)

# Cache helpers (optional; safe no-ops if Redis is down)
from ..services.redis_sla_service import cache_sla, get_sla as cache_get_sla, invalidate_sla

router = APIRouter(prefix="/slas", tags=["SLAs"])


# ----------------------------- SLA CRUD -----------------------------

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
    # try redis first (best-effort)
    cached = cache_get_sla(sla_id)
    if cached:
        return SLAOut.model_validate(cached)
    row = db.get(SLA, sla_id)
    if not row:
        raise HTTPException(404, "SLA not found")
    dto = SLAOut.model_validate(row, from_attributes=True)
    try:
        cache_sla(sla_id, dto.model_dump())
    except Exception:
        pass
    return dto


@router.post("/", response_model=SLAOut, status_code=201)
def create_sla(payload: SLACreate, db: Session = Depends(get_db)):
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
def delete_sla(sla_id: str, db: Session = Depends(get_db)):
    row: SLA | None = db.get(SLA, sla_id)
    if not row:
        raise HTTPException(404, "SLA not found")
    db.delete(row)
    db.commit()
    try:
        invalidate_sla(sla_id)
    except Exception:
        pass
    return None


# -------------------------- SLA Actions -----------------------------

@router.post("/{sla_id}/activate", response_model=SLAOut)
def activate_sla(sla_id: str, db: Session = Depends(get_db)):
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


# --------------------------- Objectives CRUD ---------------------------

@router.get("/{sla_id}/objectives", response_model=List[SLAObjectiveOut])
def list_objectives(sla_id: str, db: Session = Depends(get_db)):
    parent = db.get(SLA, sla_id)
    if not parent:
        raise HTTPException(404, "SLA not found")
    rows = db.execute(select(SLAObjective).where(SLAObjective.sla_id == sla_id).order_by(SLAObjective.created_at.asc())).scalars().all()
    return [SLAObjectiveOut.model_validate(r, from_attributes=True) for r in rows]


@router.post("/{sla_id}/objectives", response_model=SLAObjectiveOut, status_code=201)
def create_objective(sla_id: str, payload: SLAObjectiveCreate, db: Session = Depends(get_db)):
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
    # refresh parent cache
    try:
        invalidate_sla(sla_id)
    except Exception:
        pass
    return SLAObjectiveOut.model_validate(row, from_attributes=True)


@router.get("/objectives/{objective_id}", response_model=SLAObjectiveOut)
def get_objective(objective_id: str, db: Session = Depends(get_db)):
    row = db.get(SLAObjective, objective_id)
    if not row:
        raise HTTPException(404, "Objective not found")
    return SLAObjectiveOut.model_validate(row, from_attributes=True)


@router.patch("/objectives/{objective_id}", response_model=SLAObjectiveOut)
def update_objective(objective_id: str, payload: SLAObjectiveUpdate, db: Session = Depends(get_db)):
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


# ------------------------- Credit Rules CRUD --------------------------

@router.get("/{sla_id}/credit-rules", response_model=List[SLACreditRuleOut])
def list_credit_rules(sla_id: str, db: Session = Depends(get_db)):
    parent = db.get(SLA, sla_id)
    if not parent:
        raise HTTPException(404, "SLA not found")
    rows = db.execute(select(SLACreditRule).where(SLACreditRule.sla_id == sla_id).order_by(SLACreditRule.created_at.asc())).scalars().all()
    return [SLACreditRuleOut.model_validate(r, from_attributes=True) for r in rows]


@router.post("/{sla_id}/credit-rules", response_model=SLACreditRuleOut, status_code=201)
def create_credit_rule(sla_id: str, payload: SLACreditRuleCreate, db: Session = Depends(get_db)):
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
    row = db.get(SLACreditRule, rule_id)
    if not row:
        raise HTTPException(404, "Credit Rule not found")
    return SLACreditRuleOut.model_validate(row, from_attributes=True)


@router.patch("/credit-rules/{rule_id}", response_model=SLACreditRuleOut)
def update_credit_rule(rule_id: str, payload: SLACreditRuleUpdate, db: Session = Depends(get_db)):
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
