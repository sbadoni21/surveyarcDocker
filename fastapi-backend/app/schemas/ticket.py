from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

class TicketComment(BaseModel):
    uid: str
    comment: str
    created_at: Optional[datetime] = None

class TicketBase(BaseModel):
    org_id: str
    survey_id: str
    question_id: str
    subject: str
    description: Optional[str] = None
    created_by: str
    status: Optional[str] = "open"
    priority: Optional[str] = "medium"
    assigned_to: Optional[str] = None
    comments: List[TicketComment] = Field(default_factory=list)

class TicketCreate(TicketBase):
    ticket_id: Optional[str] = None

class TicketUpdate(BaseModel):
    subject: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    assigned_to: Optional[str] = None
    comments: Optional[List[TicketComment]] = None

class TicketOut(TicketBase):
    ticket_id: str
    created_at: datetime
    updated_at: datetime
