# ============================================
# FASTAPI ROUTES - app/routers/ticket_taxonomies.py
# ============================================

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import select
from typing import List, Optional
import uuid

from ..db import get_db
from ..models.ticket_taxonomies import TicketFeature, TicketImpactArea, TicketRootCauseType
from ..schemas.ticket_taxonomies import (
    FeatureCreate, FeatureUpdate, FeatureOut,
    ImpactAreaCreate, ImpactAreaUpdate, ImpactAreaOut,
    RootCauseCreate, RootCauseUpdate, RootCauseOut
)
from ..services.redis_taxonomy_service import RedisTaxonomyService

router = APIRouter(prefix="/ticket-taxonomies", tags=["Ticket Taxonomies"])

# ---------- Features ----------
@router.get("/features", response_model=List[FeatureOut])
def list_features(org_id: str = Query(...), product_id: Optional[str] = Query(None),
                  include_inactive: bool = Query(False), db: Session = Depends(get_db)):
    if not include_inactive:
        if product_id:
            cached = RedisTaxonomyService.get_features_by_product(product_id)
            if cached: return cached
        else:
            cached = RedisTaxonomyService.get_features_by_org(org_id)
            if cached: return cached

    q = select(TicketFeature).where(TicketFeature.org_id == org_id)
    if not include_inactive:
        q = q.where(TicketFeature.active == True)
    if product_id:
        q = q.where(TicketFeature.product_id == product_id)
    q = q.order_by(TicketFeature.display_order, TicketFeature.name)
    rows = db.execute(q).scalars().all()
    out = [FeatureOut.model_validate(r, from_attributes=True).model_dump() for r in rows]

    if not include_inactive:
        if product_id:
            RedisTaxonomyService.cache_features_by_product(product_id, out)
        else:
            RedisTaxonomyService.cache_features_by_org(org_id, out)
    return out

@router.get("/features/{feature_id}", response_model=FeatureOut)
def get_feature(feature_id: str, db: Session = Depends(get_db)):
    cached = RedisTaxonomyService.get_feature(feature_id)
    if cached: return cached
    row = db.get(TicketFeature, feature_id)
    if not row: raise HTTPException(404, "Feature not found")
    out = FeatureOut.model_validate(row, from_attributes=True).model_dump()
    RedisTaxonomyService.cache_feature(feature_id, out)
    return out

@router.post("/features", response_model=FeatureOut, status_code=201)
def create_feature(payload: FeatureCreate, db: Session = Depends(get_db)):
    feature_id = payload.feature_id or f"feat_{uuid.uuid4().hex[:10]}"
    row = TicketFeature(
        feature_id=feature_id,
        org_id=payload.org_id,
        product_id=payload.product_id,
        name=payload.name,
        code=payload.code,
        description=payload.description,
        display_order=payload.display_order,
        meta=payload.meta,
        active=True
    )
    db.add(row); db.commit(); db.refresh(row)
    RedisTaxonomyService.invalidate_feature_caches(feature_id, payload.org_id, payload.product_id)
    return FeatureOut.model_validate(row, from_attributes=True)

@router.patch("/features/{feature_id}", response_model=FeatureOut)
def update_feature(feature_id: str, payload: FeatureUpdate, db: Session = Depends(get_db)):
    row = db.get(TicketFeature, feature_id)
    if not row: raise HTTPException(404, "Feature not found")
    data = payload.model_dump(exclude_unset=True)
    for k, v in data.items(): setattr(row, k, v)
    db.commit(); db.refresh(row)
    RedisTaxonomyService.invalidate_feature_caches(feature_id, row.org_id, row.product_id)
    return FeatureOut.model_validate(row, from_attributes=True)

@router.delete("/features/{feature_id}", status_code=204)
def delete_feature(feature_id: str, db: Session = Depends(get_db)):
    row = db.get(TicketFeature, feature_id)
    if not row: raise HTTPException(404, "Feature not found")
    row.active = False; db.commit()
    RedisTaxonomyService.invalidate_feature_caches(feature_id, row.org_id, row.product_id)
    return None


# ---------- Impact Areas ----------
@router.get("/impacts", response_model=List[ImpactAreaOut])
def list_impacts(org_id: str = Query(...), include_inactive: bool = Query(False),
                 db: Session = Depends(get_db)):
    if not include_inactive:
        cached = RedisTaxonomyService.get_impacts_by_org(org_id)
        if cached: return cached
    q = select(TicketImpactArea).where(TicketImpactArea.org_id == org_id)
    if not include_inactive:
        q = q.where(TicketImpactArea.active == True)
    q = q.order_by(TicketImpactArea.display_order, TicketImpactArea.name)
    rows = db.execute(q).scalars().all()
    out = [ImpactAreaOut.model_validate(r, from_attributes=True).model_dump() for r in rows]
    if not include_inactive:
        RedisTaxonomyService.cache_impacts_by_org(org_id, out)
    return out

@router.get("/impacts/{impact_id}", response_model=ImpactAreaOut)
def get_impact(impact_id: str, db: Session = Depends(get_db)):
    cached = RedisTaxonomyService.get_impact(impact_id)
    if cached: return cached
    row = db.get(TicketImpactArea, impact_id)
    if not row: raise HTTPException(404, "Impact area not found")
    out = ImpactAreaOut.model_validate(row, from_attributes=True).model_dump()
    RedisTaxonomyService.cache_impact(impact_id, out)
    return out

@router.post("/impacts", response_model=ImpactAreaOut, status_code=201)
def create_impact(payload: ImpactAreaCreate, db: Session = Depends(get_db)):
    impact_id = payload.impact_id or f"impact_{uuid.uuid4().hex[:10]}"
    row = TicketImpactArea(
        impact_id=impact_id,
        org_id=payload.org_id,
        parent_id=payload.parent_id,
        name=payload.name,
        code=payload.code,
        description=payload.description,
        owner_group_id=payload.owner_group_id,
        owner_team_id=payload.owner_team_id,
        display_order=payload.display_order,
        meta=payload.meta,
        active=True
    )
    db.add(row); db.commit(); db.refresh(row)
    RedisTaxonomyService.invalidate_impact_caches(impact_id, payload.org_id)
    return ImpactAreaOut.model_validate(row, from_attributes=True)

@router.patch("/impacts/{impact_id}", response_model=ImpactAreaOut)
def update_impact(impact_id: str, payload: ImpactAreaUpdate, db: Session = Depends(get_db)):
    row = db.get(TicketImpactArea, impact_id)
    if not row: raise HTTPException(404, "Impact area not found")
    data = payload.model_dump(exclude_unset=True)
    for k, v in data.items(): setattr(row, k, v)
    db.commit(); db.refresh(row)
    RedisTaxonomyService.invalidate_impact_caches(impact_id, row.org_id)
    return ImpactAreaOut.model_validate(row, from_attributes=True)

@router.delete("/impacts/{impact_id}", status_code=204)
def delete_impact(impact_id: str, db: Session = Depends(get_db)):
    row = db.get(TicketImpactArea, impact_id)
    if not row: raise HTTPException(404, "Impact area not found")
    row.active = False; db.commit()
    RedisTaxonomyService.invalidate_impact_caches(impact_id, row.org_id)
    return None


# ---------- Root Cause Types ----------
@router.get("/root-causes", response_model=List[RootCauseOut])
def list_root_causes(org_id: str = Query(...), include_inactive: bool = Query(False),
                     db: Session = Depends(get_db)):
    if not include_inactive:
        cached = RedisTaxonomyService.get_rca_by_org(org_id)
        if cached: return cached
    q = select(TicketRootCauseType).where(TicketRootCauseType.org_id == org_id)
    if not include_inactive:
        q = q.where(TicketRootCauseType.active == True)
    q = q.order_by(TicketRootCauseType.display_order, TicketRootCauseType.name)
    rows = db.execute(q).scalars().all()
    out = [RootCauseOut.model_validate(r, from_attributes=True).model_dump() for r in rows]
    if not include_inactive:
        RedisTaxonomyService.cache_rca_by_org(org_id, out)
    return out

@router.get("/root-causes/{rca_id}", response_model=RootCauseOut)
def get_root_cause(rca_id: str, db: Session = Depends(get_db)):
    cached = RedisTaxonomyService.get_rca(rca_id)
    if cached: return cached
    row = db.get(TicketRootCauseType, rca_id)
    if not row: raise HTTPException(404, "Root cause not found")
    out = RootCauseOut.model_validate(row, from_attributes=True).model_dump()
    RedisTaxonomyService.cache_rca(rca_id, out)
    return out

@router.post("/root-causes", response_model=RootCauseOut, status_code=201)
def create_root_cause(payload: RootCauseCreate, db: Session = Depends(get_db)):
    rca_id = payload.rca_id or f"rca_{uuid.uuid4().hex[:10]}"
    row = TicketRootCauseType(
        rca_id=rca_id,
        org_id=payload.org_id,
        parent_id=payload.parent_id,
        name=payload.name,
        code=payload.code,
        description=payload.description,
        category=payload.category,
        display_order=payload.display_order,
        meta=payload.meta,
        active=True
    )
    db.add(row); db.commit(); db.refresh(row)
    RedisTaxonomyService.invalidate_rca_caches(rca_id, payload.org_id)
    return RootCauseOut.model_validate(row, from_attributes=True)

@router.patch("/root-causes/{rca_id}", response_model=RootCauseOut)
def update_root_cause(rca_id: str, payload: RootCauseUpdate, db: Session = Depends(get_db)):
    row = db.get(TicketRootCauseType, rca_id)
    if not row: raise HTTPException(404, "Root cause not found")
    data = payload.model_dump(exclude_unset=True)
    for k, v in data.items(): setattr(row, k, v)
    db.commit(); db.refresh(row)
    RedisTaxonomyService.invalidate_rca_caches(rca_id, row.org_id)
    return RootCauseOut.model_validate(row, from_attributes=True)

@router.delete("/root-causes/{rca_id}", status_code=204)
def delete_root_cause(rca_id: str, db: Session = Depends(get_db)):
    row = db.get(TicketRootCauseType, rca_id)
    if not row: raise HTTPException(404, "Root cause not found")
    row.active = False; db.commit()
    RedisTaxonomyService.invalidate_rca_caches(rca_id, row.org_id)
    return None
