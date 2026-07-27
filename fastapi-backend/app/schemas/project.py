from pydantic import BaseModel,Field, field_validator
from typing import Optional, List, Literal, Dict, Any
from datetime import datetime, date, time

Role = Literal["owner", "admin", "manager", "contributor", "viewer","editor"]
MemberStatus = Literal["active", "invited", "removed", "left"]

class Member(BaseModel):
    uid: str
    role: str
    status: str
    joined_at: Optional[datetime] = None

class ProjectBase(BaseModel):
    org_id: str
    name: str
    description: Optional[str] = ""
    owner_uid: str
    is_active: Optional[bool] = True
    members: List[Member] = Field(default_factory=list)
    start_date: Optional[datetime] = None
    due_date: Optional[datetime] = None
    milestones: List[Dict] = Field(default_factory=list)
    status: Optional[str] = "planning"
    progress_percent: Optional[float] = 0
    priority: Optional[str] = "medium"
    category: Optional[str] = ""
    tags: List[str] = Field(default_factory=list)
    attachments: List[Dict] = Field(default_factory=list)
    is_public: Optional[bool] = True
    notifications_enabled: Optional[bool] = True
    last_activity: Optional[datetime] = None
    survey_ids: List[str] = Field(default_factory=list)

    @field_validator("start_date", "due_date", "last_activity", mode="before")
    @classmethod
    def normalize_date_fields(cls, value):
        if value in (None, ""):
            return None
        if isinstance(value, datetime):
            return value
        if isinstance(value, date):
            return datetime.combine(value, time.min)
        if isinstance(value, str) and len(value) == 10:
            try:
                parsed = date.fromisoformat(value)
                return datetime.combine(parsed, time.min)
            except ValueError:
                return value
        return value

class ProjectCreate(ProjectBase):
    project_id: Optional[str] = None
    owner_uid: Optional[str] = None

class ProjectUpdate(BaseModel):
    name: Optional[str]= None
    description: Optional[str] = None
    category: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    progress_percent: Optional[float] = None
    start_date: Optional[datetime] = None
    due_date: Optional[datetime] = None
    tags: Optional[List[str]] = None
    is_public: Optional[bool] = None
    notifications_enabled: Optional[bool] = None
    is_active: Optional[bool] = None
    members: Optional[List[Member]] = None
    survey_ids: Optional[List[str]] = None

    @field_validator("start_date", "due_date", mode="before")
    @classmethod
    def normalize_update_date_fields(cls, value):
        if value in (None, ""):
            return None
        if isinstance(value, datetime):
            return value
        if isinstance(value, date):
            return datetime.combine(value, time.min)
        if isinstance(value, str) and len(value) == 10:
            try:
                parsed = date.fromisoformat(value)
                return datetime.combine(parsed, time.min)
            except ValueError:
                return value
        return value
    
class ProjectGetBase(BaseModel):
    project_id: str
    org_id: str
    name: str
    description: Optional[str] = ""
    owner_uid: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    is_active: Optional[bool] = True
    members: List[Member] = Field(default_factory=list)
    start_date: Optional[datetime] = None
    due_date: Optional[datetime] = None
    milestones: List[Dict] = Field(default_factory=list)
    status: Optional[str] = "planning"
    progress_percent: Optional[float] = 0
    priority: Optional[str] = "medium"
    category: Optional[str] = ""
    tags: List[str] = Field(default_factory=list)
    attachments: List[Dict] = Field(default_factory=list)
    is_public: Optional[bool] = False
    notifications_enabled: Optional[bool] = True
    last_activity: Optional[datetime] = None
    survey_ids: List[str] = Field(default_factory=list)
    
class ProjectMember(BaseModel):
    uid: str
    role: Role = "contributor"
    status: MemberStatus = "active"
    joined_at: Optional[datetime] = None

class Milestone(BaseModel):
    id: str
    title: str
    due: Optional[datetime] = None
    done: bool = False
    note: str = ""

class Attachment(BaseModel):
    id: str
    name: str
    url: str
    size: Optional[int] = None
    uploaded_at: Optional[datetime] = None
    meta: Dict[str, Any] = Field(default_factory=dict)

class StatusChange(BaseModel):
    status: Literal["planning","in_progress","on_hold","completed","cancelled"]
    reason: Optional[str] = None

class TagPatch(BaseModel):
    add: List[str] = Field(default_factory=list)
    remove: List[str] = Field(default_factory=list)

class SurveyPatch(BaseModel):
    add: List[str] = Field(default_factory=list)
    remove: List[str] = Field(default_factory=list)

class SearchQuery(BaseModel):
    q: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    tag: Optional[str] = None
    is_active: Optional[bool] = None
    created_from: Optional[datetime] = None
    created_to: Optional[datetime] = None
    order_by: Optional[str] = "updated_at:desc"  # e.g., "created_at:asc"
    limit: int = 50
    offset: int = 0

class BulkAction(BaseModel):
    project_ids: List[str]
    op: Literal["archive","unarchive","delete","set_priority","set_status"]
    value: Optional[str] = None  # used by set_priority/set_status
