from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from datetime import datetime




# ============================================================================
# REQUEST/RESPONSE MODELS
# ============================================================================

class CreateTemplateRequest(BaseModel):
    name: str
    description: Optional[str] = None
    subject_template: str
    org_id:Optional[str] = None
    description_template: Optional[str] = None
    default_priority: Optional[str] = "normal"
    default_severity: Optional[str] = "sev4"
    default_status: Optional[str] = "new"
    default_assignee_id: Optional[str] = None
    default_team_id: Optional[str] = None
    default_group_id: Optional[str] = None
    default_category_id: Optional[str] = None
    default_subcategory_id: Optional[str] = None
    default_feature_id: Optional[str] = None
    default_impact_id: Optional[str] = None
    default_sla_id: Optional[str] = None
    default_tag_ids: List[str] = Field(default_factory=list)
    allowed_variables: List[str] = Field(default_factory=list)
    validation_rules: Dict[str, Any] = Field(default_factory=dict)
    default_custom_fields: Dict[str, Any] = Field(default_factory=dict)
    meta: Dict[str, Any] = Field(default_factory=dict)
    is_active: bool = True
    


class UpdateTemplateRequest(BaseModel):
    name: Optional[str] = None
    org_id:Optional[str] = None

    description: Optional[str] = None
    subject_template: Optional[str] = None
    description_template: Optional[str] = None
    default_priority: Optional[str] = None
    default_severity: Optional[str] = None
    default_status: Optional[str] = None
    default_assignee_id: Optional[str] = None
    default_team_id: Optional[str] = None
    default_group_id: Optional[str] = None
    default_category_id: Optional[str] = None
    default_subcategory_id: Optional[str] = None
    default_feature_id: Optional[str] = None
    default_impact_id: Optional[str] = None
    default_sla_id: Optional[str] = None
    default_tag_ids: Optional[List[str]] = None
    allowed_variables: Optional[List[str]] = None
    validation_rules: Optional[Dict[str, Any]] = None
    default_custom_fields: Optional[Dict[str, Any]] = None
    meta: Optional[Dict[str, Any]] = None
    is_active: Optional[bool] = None


class CreateTicketFromTemplateRequest(BaseModel):
    requester_id: str
    variables: Dict[str, Any] = Field(default_factory=dict)
    overrides: Dict[str, Any] = Field(default_factory=dict)


class RegenerateApiKeyRequest(BaseModel):
    template_id: str


class TemplateResponse(BaseModel):
    template_id: str
    name: str
    description: Optional[str]
    is_active: bool
    usage_count: int
    last_used_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime


class TemplateDetailResponse(TemplateResponse):
    api_key: str
    org_id:Optional[str] = None
    subject_template: str
    description_template: Optional[str]
    default_priority: str
    default_severity: str
    default_status: str
    default_assignee_id: Optional[str]
    default_team_id: Optional[str]
    default_group_id: Optional[str]
    default_category_id: Optional[str]
    default_subcategory_id: Optional[str]
    default_feature_id: Optional[str]
    default_impact_id: Optional[str]
    default_sla_id: Optional[str]
    default_tag_ids: List[str]
    allowed_variables: List[str]
    validation_rules: Dict[str, Any]
    default_custom_fields: Dict[str, Any]
    meta: Dict[str, Any]
    created_by: str

