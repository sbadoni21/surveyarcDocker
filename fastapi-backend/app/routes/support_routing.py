# app/routers/support_routing.py
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import select
from typing import List, Optional
import uuid

from ..db import get_db
from ..models.support import RoutingPolicy, RoutingTarget
from ..schemas.support import RoutingPolicyCreate, RoutingPolicyUpdate, RoutingPolicyOut
from ..services.redis_support_service import RedisSupportService

router = APIRouter(prefix="/support/routing", tags=["Routing Policies"])

@router.get("/", response_model=List[RoutingPolicyOut])
def list_policies(org_id: str = Query(...), db: Session = Depends(get_db)):
    cached = RedisSupportService.get_policies_by_org(org_id)
    if cached is not None:
        return cached
    rows = db.execute(select(RoutingPolicy).where(RoutingPolicy.org_id == org_id)).scalars().all()
    out = [RoutingPolicyOut.model_validate(r, from_attributes=True).model_dump() for r in rows]
    RedisSupportService.cache_policies_by_org(org_id, out)
    return out

@router.get("/{policy_id}", response_model=RoutingPolicyOut)
def get_policy(policy_id: str, db: Session = Depends(get_db)):
    p = db.get(RoutingPolicy, policy_id)
    if not p:
        raise HTTPException(404, "Policy not found")
    return RoutingPolicyOut.model_validate(p, from_attributes=True)

@router.post("/", response_model=RoutingPolicyOut, status_code=201)
def create_policy(body: RoutingPolicyCreate, db: Session = Depends(get_db)):
    policy_id = body.policy_id or f"rpol_{uuid.uuid4().hex[:10]}"
    p = RoutingPolicy(
        policy_id=policy_id,
        org_id=body.org_id,
        group_id=body.group_id,
        team_id=body.team_id,
        name=body.name,
        active=body.active,
        target=body.target,
        rules=body.rules,
        meta=body.meta,
    )
    db.add(p); db.commit(); db.refresh(p)
    RedisSupportService.invalidate_policies(p.org_id)
    return RoutingPolicyOut.model_validate(p, from_attributes=True)

@router.patch("/{policy_id}", response_model=RoutingPolicyOut)
def update_policy(policy_id: str, body: RoutingPolicyUpdate, db: Session = Depends(get_db)):
    p = db.get(RoutingPolicy, policy_id)
    if not p:
        raise HTTPException(404, "Policy not found")
    data = body.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(p, k, v)
    db.commit(); db.refresh(p)
    RedisSupportService.invalidate_policies(p.org_id)
    return RoutingPolicyOut.model_validate(p, from_attributes=True)

@router.delete("/{policy_id}", status_code=204)
def delete_policy(policy_id: str, db: Session = Depends(get_db)):
    p = db.get(RoutingPolicy, policy_id)
    if not p:
        raise HTTPException(404, "Policy not found")
    org_id = p.org_id
    db.delete(p); db.commit()
    RedisSupportService.invalidate_policies(org_id)
    return None

# ---- quick simulator (purely heuristic, you’ll plug your engine later) ----

@router.post("/evaluate", response_model=dict)
def evaluate(org_id: str, ticket: dict, db: Session = Depends(get_db)):
    """
    ticket example:
      {
        "priority": "urgent",
        "severity": "sev1",
        "category": "payments",
        "tags": ["vip"]
      }
    Returns: {"matched_policy": ..., "route_to": {"target": "...", "id": "..."}} or {}
    """
    rows = db.execute(select(RoutingPolicy).where(RoutingPolicy.org_id == org_id, RoutingPolicy.active == True)).scalars().all()

    def matches(rule_when: dict, t: dict) -> bool:
        # very simple matcher; extend as needed
        if not rule_when:
            return False
        pri = rule_when.get("priority_in")
        if pri and t.get("priority") not in pri:
            return False
        sev = rule_when.get("severity_in")
        if sev and t.get("severity") not in sev:
            return False
        cat = rule_when.get("category_any")
        if cat and t.get("category") not in cat:
            return False
        tag_any = rule_when.get("tag_any")
        if tag_any:
            ttags = set(t.get("tags") or [])
            if not ttags.intersection(set(tag_any)):
                return False
        return True

    for p in rows:
        when = (p.rules or {}).get("when") or {}
        if matches(when, ticket):
            route_to = (p.rules or {}).get("route_to") or {}
            return {
                "matched_policy": {"policy_id": p.policy_id, "name": p.name},
                "route_to": route_to or {"target": p.target.value, "id": p.team_id or p.group_id},
            }
    # fallback
    return {}
