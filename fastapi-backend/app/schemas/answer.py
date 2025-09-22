from pydantic import BaseModel
from typing import Dict, Optional
from datetime import datetime

class AnswerBase(BaseModel):
    question_id: str
    project_id: str
    survey_id: str
    org_id: str
    response_id: str
    answer_config: Optional[Dict] = {}

class AnswerCreate(AnswerBase):
    pass

class AnswerResponse(AnswerBase):
    id: str
    answered_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True
