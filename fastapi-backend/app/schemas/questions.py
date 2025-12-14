from pydantic import BaseModel, Field
from typing import Optional, Dict, List, Any
from datetime import datetime

class QuestionTranslation(BaseModel):
    label: Optional[str] = None
    description: Optional[str] = None
    config: Optional[Dict[str, Any]] = None


class QuestionBase(BaseModel):
    org_id: str
    project_id: Optional[str] = None
    survey_id: str
    type: str
    label: str
    serial_label: Optional[str] = None   # ✅ NEW
    required: Optional[bool] = True
    description: Optional[str] = ""
    config: Dict[str, Any] = Field(default_factory=dict)
    logic: List[Dict[str, Any]] = Field(default_factory=list)
    translations: Dict[str, QuestionTranslation] = Field(default_factory=dict)


class QuestionCreate(QuestionBase):
    question_id: Optional[str] = None


class QuestionUpdate(BaseModel):
    type: Optional[str] = None
    label: Optional[str] = None
    serial_label: Optional[str] = None 
    required: Optional[bool] = None
    description: Optional[str] = None
    config: Optional[Dict[str, Any]] = None
    logic: Optional[List[Dict[str, Any]]] = None
    translations: Optional[Dict[str, Dict[str, Any]]] = None


class QuestionOut(QuestionBase):
    question_id: str
    created_at: Optional[datetime]
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class BulkQuestionsRequest(BaseModel):
    question_ids: List[str]
    locale: Optional[str] = None


class InitializeTranslationRequest(BaseModel):
    survey_id: str
    locale: str


class InitializeTranslationResponse(BaseModel):
    success: bool
    locale: str
    questions_updated: int
    message: str
class ResyncTranslationResponse(BaseModel):
    success: bool
    survey_id: str
    locales: List[str]
    questions_updated: int
