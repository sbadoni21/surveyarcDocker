# ============================================
# SCHEMAS - app/schemas/ticket_taxonomies.py
# ============================================

from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from datetime import datetime

# ---------- Feature ----------
class FeatureBase(BaseModel):
    name: str
    code: Optional[str] = None
    description: Optional[str] = None
    product_id: Optional[str] = None
    display_order: int = 0
    meta: Dict[str, Any] = Field(default_factory=dict)

class FeatureCreate(FeatureBase):
    feature_id: Optional[str] = None
    org_id: str

class FeatureUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    description: Optional[str] = None
    product_id: Optional[str] = None
    active: Optional[bool] = None
    display_order: Optional[int] = None
    meta: Optional[Dict[str, Any]] = None

class FeatureOut(FeatureBase):
    feature_id: str
    org_id: str
    active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ---------- Impact Area ----------
class ImpactAreaBase(BaseModel):
    name: str
    code: Optional[str] = None
    description: Optional[str] = None
    parent_id: Optional[str] = None
    owner_group_id: Optional[str] = None
    owner_team_id: Optional[str] = None
    display_order: int = 0
    meta: Dict[str, Any] = Field(default_factory=dict)

class ImpactAreaCreate(ImpactAreaBase):
    impact_id: Optional[str] = None
    org_id: str

class ImpactAreaUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    description: Optional[str] = None
    parent_id: Optional[str] = None
    owner_group_id: Optional[str] = None
    owner_team_id: Optional[str] = None
    active: Optional[bool] = None
    display_order: Optional[int] = None
    meta: Optional[Dict[str, Any]] = None

class ImpactAreaOut(ImpactAreaBase):
    impact_id: str
    org_id: str
    active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ---------- Root Cause Type ----------
class RootCauseBase(BaseModel):
    name: str
    code: Optional[str] = None
    description: Optional[str] = None
    parent_id: Optional[str] = None
    category: Optional[str] = None
    display_order: int = 0
    meta: Dict[str, Any] = Field(default_factory=dict)

class RootCauseCreate(RootCauseBase):
    rca_id: Optional[str] = None
    org_id: str

class RootCauseUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    description: Optional[str] = None
    parent_id: Optional[str] = None
    category: Optional[str] = None
    active: Optional[bool] = None
    display_order: Optional[int] = None
    meta: Optional[Dict[str, Any]] = None

class RootCauseOut(RootCauseBase):
    rca_id: str
    org_id: str
    active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
