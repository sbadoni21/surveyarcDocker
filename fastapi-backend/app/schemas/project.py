from pydantic import BaseModel
from typing import List, Optional, Dict
from datetime import datetime

class Member(BaseModel):
    uid: str
    role: str
    status: str
    joined_at: Optional[datetime]

class ProjectBase(BaseModel):
    org_id: str
    name: str
    description: Optional[str] = ""
    owner_uid: str
    is_active: Optional[bool] = True
    members: Optional[List[Member]] = []
    start_date: Optional[datetime]
    due_date: Optional[datetime]
    milestones: Optional[List[Dict]] = []
    status: Optional[str] = "planning"
    progress_percent: Optional[float] = 0
    priority: Optional[str] = "medium"
    category: Optional[str] = ""
    tags: Optional[List[str]] = []
    attachments: Optional[List[Dict]] = []
    is_public: Optional[bool] = True
    notifications_enabled: Optional[bool] = True
    last_activity: Optional[datetime]
    survey_ids: Optional[List[str]] = []

class ProjectCreate(ProjectBase):
    project_id: str

class ProjectUpdate(BaseModel):
    name: Optional[str]= None
    description: Optional[str] = None
    status: Optional[str] = None
    progress_percent: Optional[float] = None
    members: Optional[List[Member]] = None
    survey_ids: Optional[List[str]] = None
    
class ProjectGetBase(BaseModel):
    project_id: str
    org_id: str
    name: str
    description: Optional[str] = ""
    owner_uid: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    is_active: Optional[bool] = True
    members: Optional[List[Member]] = []
    start_date: Optional[datetime]
    due_date: Optional[datetime]
    milestones: Optional[List[Dict]] = []
    status: Optional[str] = "planning"
    progress_percent: Optional[float] = 0
    priority: Optional[str] = "medium"
    category: Optional[str] = ""
    tags: Optional[List[str]] = []
    attachments: Optional[List[Dict]] = []
    is_public: Optional[bool] = False
    notifications_enabled: Optional[bool] = True
    last_activity: Optional[datetime]
    survey_ids: Optional[List[str]] = []