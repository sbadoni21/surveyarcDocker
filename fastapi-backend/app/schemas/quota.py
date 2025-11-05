# app/quota.py
from pydantic import BaseModel, Field
from typing import Optional, List, Any
from uuid import UUID
from datetime import datetime

class QuotaCellCreate(BaseModel):
    label: str
    cap: int = Field(ge=0)
    condition: dict
    is_enabled: bool = True

class QuotaCreate(BaseModel):
    org_id: UUID
    survey_id: UUID
    name: str
    description: Optional[str] = None
    is_enabled: bool = True
    stop_condition: str = "greater"
    when_met: str = "close_survey"
    action_payload: Optional[dict] = None
    cells: List[QuotaCellCreate] = []

class QuotaCell(BaseModel):
    id: UUID
    quota_id: UUID
    label: str
    cap: int
    count: int
    condition: dict
    is_enabled: bool
    created_at: datetime
    updated_at: Optional[datetime]

class Quota(BaseModel):
    id: UUID
    org_id: UUID
    survey_id: UUID
    name: str
    description: Optional[str]
    is_enabled: bool
    stop_condition: str
    when_met: str
    action_payload: Optional[dict]
    created_at: datetime
    updated_at: Optional[datetime]

class QuotaWithCells(Quota):
    cells: List[QuotaCell]

class QuotaEvaluateRequest(BaseModel):
    respondent_id: Optional[UUID]
    facts: dict

class QuotaEvaluateResult(BaseModel):
    matched_cells: List[UUID]
    blocked: bool
    reason: Optional[str]
    action: Optional[str]
    action_payload: Optional[dict]

class QuotaIncrementRequest(BaseModel):
    respondent_id: Optional[UUID]
    matched_cell_id: UUID
    reason: str = "complete"
    metadata: Optional[dict] = {}
