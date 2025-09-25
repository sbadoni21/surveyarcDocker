from pydantic import BaseModel
from typing import Optional, Dict, Any, List
from datetime import datetime
from .answer import AnswerIn



class ResponseBase(BaseModel):
    org_id: str
    survey_id: str
    respondent_id: str
    status: Optional[str] = "started"
    meta_data: Optional[Dict] = {}
    answers: Optional[List[AnswerIn]] = []  # inline payload

class ResponseCreate(ResponseBase):
    response_id: Optional[str] = None

class ResponseUpdate(BaseModel):
    status: Optional[str] = None
    completed_at: Optional[datetime] = None
    meta_data: Optional[Dict] = None
    answers: Optional[List[AnswerIn]] = None  # replace current answers if provided

class ResponseOut(ResponseBase):
    response_id: str
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    # server may aggregate relational answers back to this field
    class Config:
        orm_mode = True
