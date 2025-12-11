# app/schemas/responses.py
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from datetime import datetime
from .answer import AnswerIn

class ResponseBase(BaseModel):
    org_id: str
    survey_id: str
    respondent_id: str

    # 🔹 NEW: optional, only filled for panel traffic
    source_id: Optional[str] = None

    status: Optional[str] = "started"
    meta_data: Dict[str, Any] = Field(default_factory=dict)
    answers: List[AnswerIn] = Field(default_factory=list)  # inline payload


class ResponseCreate(ResponseBase):
    response_id: Optional[str] = None


class ResponseUpdate(BaseModel):
    status: Optional[str] = None
    completed_at: Optional[datetime] = None
    meta_data: Optional[Dict[str, Any]] = None
    answers: Optional[List[AnswerIn]] = None  # replace current answers if provided
    # 🔹 allow updating source_id if you really want (optional)
    source_id: Optional[str] = None


class ResponseOut(ResponseBase):
    response_id: str
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        orm_mode = True
