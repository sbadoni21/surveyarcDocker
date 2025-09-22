from pydantic import BaseModel
from typing import Optional, Dict
from datetime import datetime

class ResponseBase(BaseModel):
    org_id: str
    survey_id: str
    respondent_id: str
    status: Optional[str] = "started"
    meta_data: Optional[Dict] = {}

class ResponseCreate(ResponseBase):
    response_id: str

class ResponseUpdate(BaseModel):
    status: Optional[str]
    completed_at: Optional[datetime]
    meta_data: Optional[Dict]
