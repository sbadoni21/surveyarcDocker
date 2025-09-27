# app/schemas/sla.py
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from datetime import datetime
from enum import Enum


# ---------------- Enums ---------------- #

class SLADimension(str, Enum):
    first_response = "first_response"
    resolution = "resolution"
    update_cadence = "update_cadence"
    custom = "custom"


class SLAAggregation(str, Enum):
    per_ticket = "per_ticket"
    monthly_percent = "monthly_percent"
    rolling_30d_percent = "rolling_30d_percent"


class SLACreditUnit(str, Enum):
    percent_fee = "percent_fee"
    fixed_usd = "fixed_usd"
    service_days = "service_days"


class SLABreachGrade(str, Enum):
    minor = "minor"
    major = "major"
    critical = "critical"


class SLAScope(str, Enum):
    org = "org"
    group = "group"
    team = "team"
    product = "product"
    custom = "custom"


# ---------------- SLA Base ---------------- #

class SLABase(BaseModel):
    org_id: str
    name: str
    description: Optional[str] = None
    slug: Optional[str] = None
    active: bool = True

    # Optional default targets
    first_response_minutes: Optional[int] = None
    resolution_minutes: Optional[int] = None

    # Policy fields (flexible JSON)
    rules: Dict[str, Any] = Field(default_factory=dict)
    target_matrix: Dict[str, Any] = Field(default_factory=dict)
    pause_rules: Dict[str, Any] = Field(default_factory=dict)
    reminder_policy: Dict[str, Any] = Field(default_factory=dict)
    escalation_policy: Dict[str, Any] = Field(default_factory=dict)
    kpi_targets: Dict[str, Any] = Field(default_factory=dict)
    exclusions: Dict[str, Any] = Field(default_factory=dict)
    penalties: Dict[str, Any] = Field(default_factory=dict)

    # Aggregation & scope
    aggregation: SLAAggregation = SLAAggregation.monthly_percent
    scope: SLAScope = SLAScope.org
    scope_ids: Dict[str, Any] = Field(default_factory=dict)
    precedence: int = 100

    # Governance
    version: int = 1
    effective_from: Optional[datetime] = None
    effective_to: Optional[datetime] = None
    published_at: Optional[datetime] = None
    requires_contract_accept: bool = False
    audit_tags: Dict[str, Any] = Field(default_factory=dict)
    data_retention_days: Optional[int] = None

    # Ops
    grace_minutes: int = 0
    auto_close_after_days: Optional[int] = None

    meta: Dict[str, Any] = Field(default_factory=dict)


# ---------------- SLA Create/Update ---------------- #

class SLACreate(SLABase):
    sla_id: Optional[str] = None
    created_by: Optional[str] = None


class SLAUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    slug: Optional[str] = None
    active: Optional[bool] = None
    first_response_minutes: Optional[int] = None
    resolution_minutes: Optional[int] = None
    rules: Optional[Dict[str, Any]] = None
    target_matrix: Optional[Dict[str, Any]] = None
    pause_rules: Optional[Dict[str, Any]] = None
    reminder_policy: Optional[Dict[str, Any]] = None
    escalation_policy: Optional[Dict[str, Any]] = None
    kpi_targets: Optional[Dict[str, Any]] = None
    exclusions: Optional[Dict[str, Any]] = None
    penalties: Optional[Dict[str, Any]] = None
    aggregation: Optional[SLAAggregation] = None
    scope: Optional[SLAScope] = None
    scope_ids: Optional[Dict[str, Any]] = None
    precedence: Optional[int] = None
    version: Optional[int] = None
    effective_from: Optional[datetime] = None
    effective_to: Optional[datetime] = None
    published_at: Optional[datetime] = None
    requires_contract_accept: Optional[bool] = None
    audit_tags: Optional[Dict[str, Any]] = None
    data_retention_days: Optional[int] = None
    grace_minutes: Optional[int] = None
    auto_close_after_days: Optional[int] = None
    meta: Optional[Dict[str, Any]] = None
    updated_by: Optional[str] = None


# ---------------- SLA Out ---------------- #

class SLAOut(SLABase):
    sla_id: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    created_by: Optional[str] = None
    updated_by: Optional[str] = None

    model_config = {"from_attributes": True}


# ---------------- SLA Objective Schema ---------------- #

class SLAObjectiveBase(BaseModel):
    objective: SLADimension
    target_minutes: int
    match: Dict[str, Any] = Field(default_factory=dict)
    breach_grades: Dict[str, Any] = Field(default_factory=dict)
    active: bool = True
    meta: Dict[str, Any] = Field(default_factory=dict)


class SLAObjectiveCreate(SLAObjectiveBase):
    objective_id: Optional[str] = None
    sla_id: str


class SLAObjectiveUpdate(BaseModel):
    target_minutes: Optional[int] = None
    match: Optional[Dict[str, Any]] = None
    breach_grades: Optional[Dict[str, Any]] = None
    active: Optional[bool] = None
    meta: Optional[Dict[str, Any]] = None


class SLAObjectiveOut(SLAObjectiveBase):
    objective_id: str
    sla_id: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


# ---------------- SLA Credit Rule Schema ---------------- #

class SLACreditRuleBase(BaseModel):
    objective: SLADimension
    grade: SLABreachGrade
    credit_unit: SLACreditUnit
    credit_value: int
    cap_per_period: Optional[int] = None
    period_days: Optional[int] = None
    active: bool = True
    meta: Dict[str, Any] = Field(default_factory=dict)


class SLACreditRuleCreate(SLACreditRuleBase):
    rule_id: Optional[str] = None
    sla_id: str


class SLACreditRuleUpdate(BaseModel):
    grade: Optional[SLABreachGrade] = None
    credit_unit: Optional[SLACreditUnit] = None
    credit_value: Optional[int] = None
    cap_per_period: Optional[int] = None
    period_days: Optional[int] = None
    active: Optional[bool] = None
    meta: Optional[Dict[str, Any]] = None


class SLACreditRuleOut(SLACreditRuleBase):
    rule_id: str
    sla_id: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}
