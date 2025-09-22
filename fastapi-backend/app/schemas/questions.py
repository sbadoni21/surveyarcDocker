from pydantic import BaseModel
from typing import List, Optional, Dict
from datetime import datetime

class QuestionBase(BaseModel):
    org_id: str
    survey_id: str
    project_id: Optional[str] = None
    type: str
    label: str
    description: Optional[str] = ""
    required: Optional[bool] = True
    config: Optional[Dict] = {}
    logic: Optional[List[Dict]] = []

class QuestionCreate(QuestionBase):
    question_id: str

class QuestionUpdate(BaseModel):
    label: Optional[str]
    description: Optional[str]
    required: Optional[bool]
    config: Optional[Dict]
    logic: Optional[List[Dict]]
