# app/schemas/participant_source.py
from pydantic import BaseModel, Field, HttpUrl
from typing import Optional, Dict, Any, List
from datetime import datetime
from enum import Enum


class SourceType(str, Enum):
    INTERNAL = "internal"
    EXTERNAL = "external"
    FILE = "file"


class VariableRequirement(str, Enum):
    REQUIRED = "required"
    UNIQUE = "unique"
    OPTIONAL = "optional"


class AuthenticationType(str, Enum):
    NO_AUTH = "no_authentication"
    BASIC = "basic"
    TOKEN = "token"
    CUSTOM = "custom"


# URL Variable Schemas
class URLVariable(BaseModel):
    var_name: str = Field(..., description="Variable name (e.g., trans_id, psid)")
    required: VariableRequirement = Field(default=VariableRequirement.OPTIONAL)
    authentication: AuthenticationType = Field(default=AuthenticationType.NO_AUTH)
    description: Optional[str] = None
    default_value: Optional[str] = None
    validation_regex: Optional[str] = None


class URLVariableCreate(URLVariable):
    pass


class URLVariableUpdate(BaseModel):
    var_name: Optional[str] = None
    required: Optional[VariableRequirement] = None
    authentication: Optional[AuthenticationType] = None
    description: Optional[str] = None
    default_value: Optional[str] = None
    validation_regex: Optional[str] = None


# Exit Page Schemas
class ExitPageCondition(BaseModel):
    condition: str = Field(..., description="e.g., 'terminated', 'qualified'")
    and_has_marker: Optional[str] = Field(None, description="Additional marker check")
    operator: str = Field(default="AND", description="Logical operator")


class ExitPageConfig(BaseModel):
    exit_type: str = Field(..., description="redirect, message, or api_call")
    redirect_url: Optional[str] = None
    message_title: Optional[str] = None
    message_body: Optional[str] = None
    url_params: Dict[str, str] = Field(default_factory=dict)
    conditions: List[ExitPageCondition] = Field(default_factory=list)


class CustomExitPageCreate(BaseModel):
    exit_name: str
    exit_type: str
    show_if: Dict[str, Any] = Field(default_factory=dict)
    redirect_url: Optional[str] = None
    redirect_method: str = "GET"
    message_title: Optional[str] = None
    message_body: Optional[str] = None
    url_params: Dict[str, str] = Field(default_factory=dict)
    priority: int = 0
    is_active: bool = True


class CustomExitPageResponse(CustomExitPageCreate):
    id: str
    source_id: str
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# Error Message Schemas
class UniqueIDErrorMessageCreate(BaseModel):
    error_type: str = Field(..., description="duplicate, invalid, or missing")
    title: str
    message: str
    button_text: str = "Close"
    action_type: str = "close"
    redirect_url: Optional[str] = None


class UniqueIDErrorMessageResponse(UniqueIDErrorMessageCreate):
    id: str
    source_id: str
    created_at: datetime

    class Config:
        from_attributes = True


# Main Participant Source Schemas
class ParticipantSourceBase(BaseModel):
    source_name: str
    source_type: SourceType = SourceType.EXTERNAL
    description: Optional[str] = None
    is_active: bool = True
    expected_completes: Optional[int] = None
    expected_incidence_rate: Optional[int] = Field(None, ge=0, le=100)


class ParticipantSourceCreate(ParticipantSourceBase):
    org_id: str
    survey_id: str
    url_variables: List[URLVariable] = Field(default_factory=list)
    exit_pages: Dict[str, ExitPageConfig] = Field(default_factory=dict)
    meta_data: Dict[str, Any] = Field(default_factory=dict)


class ParticipantSourceUpdate(BaseModel):
    source_name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None
    url_variables: Optional[List[URLVariable]] = None
    exit_pages: Optional[Dict[str, ExitPageConfig]] = None
    expected_completes: Optional[int] = None
    expected_incidence_rate: Optional[int] = None
    meta_data: Optional[Dict[str, Any]] = None


class ParticipantSourceResponse(ParticipantSourceBase):
    id: str
    org_id: str
    survey_id: str
    url_variables: List[Dict[str, Any]] = Field(default_factory=list)
    exit_pages: Dict[str, Any] = Field(default_factory=dict)
    current_completes: int
    total_clicks: int
    total_starts: int
    meta_data: Dict[str, Any]
    created_by: Optional[str]
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class ParticipantSourceList(BaseModel):
    items: List[ParticipantSourceResponse]
    total: int


class ParticipantSourceStats(BaseModel):
    source_id: str
    source_name: str
    total_clicks: int
    total_starts: int
    current_completes: int
    expected_completes: Optional[int]
    completion_rate: Optional[float]
    incidence_rate: Optional[float]


# Survey URL Generation
class GeneratedSurveyURL(BaseModel):
    source_id: str
    source_name: str
    survey_url: str
    required_params: List[str]
    optional_params: List[str]
    example_url: str