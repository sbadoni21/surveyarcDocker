from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel

class SurveyBase(BaseModel):
    org_id: str
    project_id: str
    name: str = None
    created_by: str = None
    updated_by: str = None
    theme_id: str = None
    time: Optional[str] = None
    settings: Optional[Dict[str, Any]] = {"anonymous": False}
    question_order: Optional[List[str]] =  None
    meta_data: Optional[Dict[str, Any]] = None

    # 🔹 NEW (make them optional in base so Out can inherit)
    blocks: Optional[List[Dict[str, Any]]] = None
    block_order: Optional[List[str]] = None

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
    theme_id: Optional[str]  = None


    class Config:
        orm_mode = True
    blocks: List[Dict[str, Any]] = None
    block_order: List[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
