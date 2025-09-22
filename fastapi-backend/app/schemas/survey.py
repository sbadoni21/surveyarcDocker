from pydantic import BaseModel
from typing import Optional, List, Dict

class SurveyBase(BaseModel):
    org_id: str
    project_id: str
    name: str
    created_by: str
    updated_by: str
    time: Optional[str] = None
    settings: Optional[Dict] = {"anonymous": False}
    question_order: Optional[List[str]] = []
    meta_data: Optional[Dict] = {}

class SurveyCreate(SurveyBase):
    survey_id: Optional[str] = None  # optional, can be generated

class SurveyUpdate(BaseModel):
    name: Optional[str]
    updated_by: Optional[str]
    time: Optional[str]
    settings: Optional[Dict]
    question_order: Optional[List[str]]
    meta_data: Optional[Dict]
    status: Optional[str]
