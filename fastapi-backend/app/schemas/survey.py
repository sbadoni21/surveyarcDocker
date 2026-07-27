from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, ConfigDict


class SurveyBase(BaseModel):
    org_id: str
    project_id: str
    name: str
    created_by: str
    updated_by: Optional[str] = None
    theme_id: Optional[str] = None
    time: Optional[str] = None
    settings: Dict[str, Any] = Field(default_factory=lambda: {"anonymous": False})
    question_order: List[str] = Field(default_factory=list)
    meta_data: Dict[str, Any] = Field(default_factory=dict)

    blocks: List[Dict[str, Any]] = Field(default_factory=list)
    block_order: List[str] = Field(default_factory=list)

class SurveyCreate(SurveyBase):
    survey_id: Optional[str] = None
    status: Optional[str] = "draft"

class SurveyUpdate(BaseModel):
    name: Optional[str] = None
    updated_by: Optional[str] = None
    time: Optional[str] = None
    settings: Optional[Dict[str, Any]] = None
    question_order: Optional[List[str]] = None
    meta_data: Optional[Dict[str, Any]] = None
    status: Optional[str] = None
    theme_id: Optional[str]  = None

    # 🔹 NEW: allow updating these
    blocks: Optional[List[Dict[str, Any]]] = None
    block_order: Optional[List[str]] = None

class SurveyOut(SurveyBase):
    survey_id: str
    slug: str
    version: int
    status: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    theme_id: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)
