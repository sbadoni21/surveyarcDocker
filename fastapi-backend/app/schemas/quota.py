# app/schemas/quota.py
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from uuid import UUID
from datetime import datetime


# ---------- CREATE PAYLOAD TYPES ----------

class QuotaCellCreate(BaseModel):
    label: str
    cap: int = Field(..., ge=0)
    condition: Dict[str, Any] = Field(default_factory=dict)
    is_enabled: bool = True
    target_option_id: Optional[str] = None


class QuotaCreate(BaseModel):
    # NOTE: frontend sends camelCase (orgId, surveyId, questionId, etc.)
    org_id: str = Field(..., alias="orgId")
    survey_id: str = Field(..., alias="surveyId")
    question_id: Optional[str] = Field(None, alias="questionId")

    name: str
    description: Optional[str] = ""

    is_enabled: Optional[bool] = Field(True, alias="isEnabled")
    quota_type: Optional[str] = Field("hard", alias="quotaType")
    stop_condition: Optional[str] = Field("greater", alias="stopCondition")
    when_met: Optional[str] = Field("close_survey", alias="whenMet")

    action_payload: Optional[Dict[str, Any]] = Field(default_factory=dict, alias="actionPayload")
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict)

    cells: List[QuotaCellCreate] = Field(default_factory=list)

    class Config:
        allow_population_by_field_name = True
        populate_by_name = True


# Update has same shape as create (full replacement)
class QuotaUpdate(QuotaCreate):
    pass


# ---------- RESPONSE TYPES ----------

class QuotaCell(BaseModel):
    id: UUID
    quota_id: UUID
    label: str
    cap: int
    count: int
    condition: Dict[str, Any]
    is_enabled: bool
    target_option_id: Optional[str]
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        orm_mode = True


class Quota(BaseModel):
    id: UUID
    org_id: str
    survey_id: str
    question_id: Optional[str]

    name: str
    description: Optional[str]
    is_enabled: bool
    quota_type: str
    stop_condition: str
    when_met: str

    action_payload: Optional[Dict[str, Any]]
    metadata: Optional[Dict[str, Any]]

    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        orm_mode = True


class QuotaWithCells(Quota):
    cells: List[QuotaCell]


# ---------- EVALUATE / INCREMENT ----------

class QuotaEvaluateRequest(BaseModel):
    respondent_id: Optional[UUID]
    facts: Dict[str, Any] = Field(default_factory=dict)


class QuotaEvaluateResult(BaseModel):
    matched_cells: List[UUID]
    blocked: bool
    reason: Optional[str]
    action: Optional[str]
    action_payload: Optional[Dict[str, Any]]


class QuotaIncrementRequest(BaseModel):
    respondent_id: Optional[UUID]
    matched_cell_id: UUID
    reason: str = "complete"
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict)
