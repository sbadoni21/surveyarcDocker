# app/schemas/sla.py
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from datetime import datetime

class SLABase(BaseModel):
    org_id: str
    name: str
    active: bool = True
    first_response_minutes: Optional[int] = None
    resolution_minutes: Optional[int] = None
    calendar_id: Optional[str] = None
    rules: Dict[str, Any] = Field(default_factory=dict)
    meta: Dict[str, Any] = Field(default_factory=dict)

class SLACreate(SLABase):
    sla_id: Optional[str] = None

class SLAUpdate(BaseModel):
    name: Optional[str] = None
    active: Optional[bool] = None
    first_response_minutes: Optional[int] = None
    resolution_minutes: Optional[int] = None
    calendar_id: Optional[str] = None
    rules: Optional[Dict[str, Any]] = None
    meta: Optional[Dict[str, Any]] = None

class SLAOut(SLABase):
    sla_id: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}
