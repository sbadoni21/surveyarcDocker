from pydantic import BaseModel
from typing import Optional, Dict, List
from datetime import datetime

class QuestionBase(BaseModel):
    org_id: str
    project_id: str
    survey_id: str
    type: str
    label: str
    required: Optional[bool] = True
    description: Optional[str] = ""
    config: Optional[Dict] = {}
    logic: Optional[List[Dict]] = []

class QuestionCreate(QuestionBase):
    question_id: Optional[str] = None

class QuestionUpdate(BaseModel):
    type: Optional[str] = None
    label: Optional[str] = None
    required: Optional[bool] = None
    description: Optional[str] = None
    config: Optional[Dict] = None
    logic: Optional[List[Dict]] = None

class QuestionOut(QuestionBase):
    question_id: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    class Config:
        orm_mode = True
        # ✅ include in responses
class BulkQuestionsRequest(BaseModel):
    question_ids: List[str]
