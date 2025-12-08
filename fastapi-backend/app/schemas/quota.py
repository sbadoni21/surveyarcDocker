# app/schemas/quota.py
from pydantic import BaseModel, Field
from typing import Optional, List
from uuid import UUID
from datetime import datetime

class QuotaCellCreate(BaseModel):
    label: str
    cap: int = Field(..., ge=0)
    condition: dict = Field(default_factory=dict)
    is_enabled: bool = True
    target_option_id: Optional[str] = None

class QuotaCreate(BaseModel):
    org_id: str
    survey_id: str
    question_id: Optional[str] = None
    name: str
    description: Optional[str] = ""
    is_enabled: Optional[bool] = True
    quota_type: Optional[str] = "hard"
    stop_condition: Optional[str] = "greater"
    when_met: Optional[str] = "close_survey"
    action_payload: Optional[dict] = Field(default_factory=dict)
    metadata: Optional[dict] = Field(default_factory=dict)
    cells: List[QuotaCellCreate] = Field(default_factory=list)

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
    org_id: str
    survey_id: str
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
    facts: dict = Field(default_factory=dict)

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
    metadata: Optional[dict] = Field(default_factory=dict)
