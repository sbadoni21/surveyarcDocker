import uuid
from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..db import get_db
from ..models.rule import Rule
from ..schemas.rule import RuleCreate, RuleUpdate, RuleOut
from ..services.redis_rule_service import RedisRuleService

router = APIRouter(prefix="/rules", tags=["Rules"])

@router.post("/", response_model=RuleOut)
def create_rule(data: RuleCreate, db: Session = Depends(get_db)):
    rid = data.rule_id or "rule_" + uuid.uuid4().hex[:10]
    row = Rule(
        rule_id=rid,
        org_id=data.org_id,
        survey_id=data.survey_id,
        project_id=data.project_id,
        name=data.name or "",
        block_id=data.block_id,
        enabled=data.enabled if data.enabled is not None else True,
        priority=data.priority or 1,
        conditions=data.conditions or [],
        actions=data.actions or [],
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(row)
    db.commit()
    db.refresh(row)

    RedisRuleService.cache_rule(row.survey_id, row)
    # merge list
    existing = RedisRuleService.get_rules_for_survey(row.survey_id) or []
    RedisRuleService.cache_rules_list(row.survey_id, existing + [row])
    return row

@router.get("/{survey_id}", response_model=List[RuleOut])
def list_rules(survey_id: str, db: Session = Depends(get_db)):
    cached = RedisRuleService.get_rules_for_survey(survey_id)
    if cached is not None:
        return cached
    rows = db.query(Rule).filter(Rule.survey_id == survey_id).all()
    if rows:
        RedisRuleService.cache_rules_list(survey_id, rows)
    return rows

@router.get("/{survey_id}/{rule_id}", response_model=RuleOut)
def get_rule(survey_id: str, rule_id: str, db: Session = Depends(get_db)):
    cached = RedisRuleService.get_rule(survey_id, rule_id)
    if cached is not None:
        return cached
    row = (
        db.query(Rule)
        .filter(Rule.survey_id == survey_id, Rule.rule_id == rule_id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Rule not found")
    RedisRuleService.cache_rule(survey_id, row)
    return row

@router.patch("/{survey_id}/{rule_id}", response_model=RuleOut)
def update_rule(survey_id: str, rule_id: str, data: RuleUpdate, db: Session = Depends(get_db)):
    row = (
        db.query(Rule)
        .filter(Rule.survey_id == survey_id, Rule.rule_id == rule_id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Rule not found")

    payload = data.dict(exclude_unset=True)
    for k, v in payload.items():
        setattr(row, k, v)
    row.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(row)

    RedisRuleService.cache_rule(survey_id, row)
    # list membership unchanged
    return row

@router.delete("/{survey_id}/{rule_id}")
def delete_rule(survey_id: str, rule_id: str, db: Session = Depends(get_db)):
    row = (
        db.query(Rule)
        .filter(Rule.survey_id == survey_id, Rule.rule_id == rule_id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Rule not found")

    db.delete(row)
    db.commit()

    RedisRuleService.invalidate_rule(survey_id, rule_id)
    RedisRuleService.remove_from_list(survey_id, rule_id)
    return {"detail": "Rule deleted"}
