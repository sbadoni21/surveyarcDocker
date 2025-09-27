# app/routers/support_groups.py
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import select
from typing import List
import uuid

from ..db import get_db
from ..models.support import (
    SupportGroup,
    SupportGroupMember,
    GroupMemberRole,
    ProficiencyLevel,
    UserStubTub,  # FK target for group members
)
from ..schemas.support import (
    SupportGroupCreate,
    SupportGroupUpdate,
    SupportGroupOut,
    GroupMemberAdd,
    GroupMemberOut,
    GroupMemberUpdate,
)
from ..services.redis_support_service import RedisSupportService

router = APIRouter(prefix="/support-groups", tags=["Support Groups"])

# ---------- helpers ----------
def ensure_user_in_user_stub_tub(db: Session, user_id: str) -> None:
    """Make sure user_id exists in user_stub_tub for FK; flush so it works in same transaction."""
    found = db.scalar(select(UserStubTub).where(UserStubTub.user_id == user_id))
    if not found:
        db.add(UserStubTub(user_id=user_id))
        db.flush()

def invalidate_group_caches(group_id: str, org_id: str | None) -> None:
    try:
        RedisSupportService.invalidate_group(group_id=group_id, org_id=org_id)
    except Exception:
        pass

# ---------- groups ----------
@router.get("/", response_model=List[SupportGroupOut])
def list_groups(org_id: str = Query(...), db: Session = Depends(get_db)):
    cached = RedisSupportService.get_groups_by_org(org_id)
    if cached is not None:
        return cached
    rows = db.execute(select(SupportGroup).where(SupportGroup.org_id == org_id)).scalars().all()
    out = [SupportGroupOut.model_validate(r, from_attributes=True).model_dump() for r in rows]
    RedisSupportService.cache_groups_by_org(org_id, out)
    return out

@router.get("/{group_id}", response_model=SupportGroupOut)
def get_group(group_id: str, db: Session = Depends(get_db)):
    g = db.get(SupportGroup, group_id)
    if not g:
        raise HTTPException(status_code=404, detail="Group not found")
    return SupportGroupOut.model_validate(g, from_attributes=True)

@router.post("/", response_model=SupportGroupOut, status_code=201)
def create_group(payload: SupportGroupCreate, db: Session = Depends(get_db)):
    group_id = payload.group_id or f"grp_{uuid.uuid4().hex[:10]}"
    g = SupportGroup(
        group_id=group_id,
        org_id=payload.org_id,
        name=payload.name,
        email=payload.email,
        description=payload.description,
    )
    db.add(g); db.commit(); db.refresh(g)
    invalidate_group_caches(group_id=g.group_id, org_id=g.org_id)
    return SupportGroupOut.model_validate(g, from_attributes=True)

@router.patch("/{group_id}", response_model=SupportGroupOut)
def update_group(group_id: str, payload: SupportGroupUpdate, db: Session = Depends(get_db)):
    g = db.get(SupportGroup, group_id)
    if not g:
        raise HTTPException(status_code=404, detail="Group not found")
    data = payload.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(g, k, v)
    db.commit(); db.refresh(g)
    invalidate_group_caches(group_id=g.group_id, org_id=g.org_id)
    return SupportGroupOut.model_validate(g, from_attributes=True)

@router.delete("/{group_id}", status_code=204)
def delete_group(group_id: str, db: Session = Depends(get_db)):
    g = db.get(SupportGroup, group_id)
    if not g:
        raise HTTPException(status_code=404, detail="Group not found")
    org_id = g.org_id
    db.delete(g); db.commit()
    invalidate_group_caches(group_id=group_id, org_id=org_id)
    return None

# ---------- group members ----------
@router.get("/{group_id}/members", response_model=List[GroupMemberOut])
def list_group_members(group_id: str, db: Session = Depends(get_db)):
    cached = RedisSupportService.get_group_members(group_id)
    if cached is not None:
        return cached
    rows = db.query(SupportGroupMember).filter(SupportGroupMember.group_id == group_id).all()
    out = [GroupMemberOut.model_validate(r, from_attributes=True).model_dump() for r in rows]
    RedisSupportService.cache_group_members(group_id, out)
    return out

@router.post("/{group_id}/members", response_model=GroupMemberOut, status_code=201)
def add_group_member(group_id: str, body: GroupMemberAdd, db: Session = Depends(get_db)):
    g = db.get(SupportGroup, group_id)
    if not g:
        raise HTTPException(status_code=404, detail="Group not found")

    # ensure FK in user_stub_tub (no undefined 'exists' anymore)
    ensure_user_in_user_stub_tub(db, body.user_id)

    existing = db.query(SupportGroupMember).filter_by(group_id=group_id, user_id=body.user_id).first()
    if existing:
        if body.role is not None:
            existing.role = body.role
        if body.proficiency is not None:
            existing.proficiency = body.proficiency
        existing.active = True
        db.commit(); db.refresh(existing)
        invalidate_group_caches(group_id=group_id, org_id=g.org_id)
        return GroupMemberOut.model_validate(existing, from_attributes=True)

    row = SupportGroupMember(
        group_id=group_id,
        user_id=body.user_id,
        role=body.role or GroupMemberRole.agent,
        proficiency=body.proficiency or ProficiencyLevel.l1,
        active=True,
    )
    db.add(row); db.commit(); db.refresh(row)
    invalidate_group_caches(group_id=group_id, org_id=g.org_id)
    return GroupMemberOut.model_validate(row, from_attributes=True)

@router.patch("/{group_id}/members/{user_id}", response_model=GroupMemberOut)
def update_group_member(group_id: str, user_id: str, body: GroupMemberUpdate, db: Session = Depends(get_db)):
    row = db.query(SupportGroupMember).filter_by(group_id=group_id, user_id=user_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Not found")
    if body.role is not None:
        row.role = body.role
    if body.proficiency is not None:
        row.proficiency = body.proficiency
    if body.active is not None:
        row.active = body.active
    db.commit(); db.refresh(row)
    g = db.get(SupportGroup, group_id)
    invalidate_group_caches(group_id=group_id, org_id=g.org_id if g else None)
    return GroupMemberOut.model_validate(row, from_attributes=True)

@router.delete("/{group_id}/members/{user_id}", status_code=204)
def remove_group_member(group_id: str, user_id: str, db: Session = Depends(get_db)):
    row = db.query(SupportGroupMember).filter_by(group_id=group_id, user_id=user_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(row); db.commit()
    g = db.get(SupportGroup, group_id)
    invalidate_group_caches(group_id=group_id, org_id=g.org_id if g else None)
    return None
