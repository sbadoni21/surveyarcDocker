# app/schemas/tickets.py
from pydantic import BaseModel, Field
from pydantic import field_validator, model_validator
from typing import Optional, List, Dict, Any
from datetime import datetime
from ..models.tickets import TicketStatus, TicketPriority, TicketSeverity, TicketLinkType
from ..models.tickets import WorklogType  # your SQLAlchemy Enum


# ------------------------------ Shared ------------------------------

class TagOut(BaseModel):
    tag_id: str
    org_id: str
    name: str
    color: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    usage_count: int = 0
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class SLAProcessingData(BaseModel):
    """SLA processing data calculated by frontend"""
    first_response_due_at: Optional[str] = None
    resolution_due_at: Optional[str] = None
    sla_mode: Optional[str] = None  # "priority" or "severity"
    calendar_id: Optional[str] = None


class SupportGroupOut(BaseModel):
    group_id: str
    org_id: str
    name: str
    email: Optional[str] = None
    description: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


# -------- Assignment (updated to single team/agent) --------

class AssignmentMeta(BaseModel):
    """Single team and single agent per ticket."""
    is_group_selected: bool = False
    is_team_selected: bool = False
    is_agent_selected: bool = False

    group_id: Optional[str] = None
    team_id: Optional[str] = None
    agent_id: Optional[str] = None
    initiated_by: Optional[str] = None

    @model_validator(mode="after")
    def _agent_requires_team(self):
        if self.agent_id and not self.team_id:
            raise ValueError("agent_id provided but team_id is missing")
        return self


# ------------------------------- SLA --------------------------------

class SLABase(BaseModel):
    org_id: str
    name: str
    active: bool = True
    first_response_minutes: Optional[int] = None
    resolution_minutes: Optional[int] = None
    rules: Dict[str, Any] = Field(default_factory=dict)
    meta: Dict[str, Any] = Field(default_factory=dict)


class SLACreate(SLABase):
    sla_id: Optional[str] = None


class SLAUpdate(BaseModel):
    name: Optional[str] = None
    active: Optional[bool] = None
    first_response_minutes: Optional[int] = None
    resolution_minutes: Optional[int] = None
    rules: Optional[Dict[str, Any]] = None
    meta: Optional[Dict[str, Any]] = None


class SLAOut(SLABase):
    sla_id: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class TicketSLAStatusOut(BaseModel):
    ticket_id: str
    sla_id: Optional[str] = None
    first_response_due_at: Optional[datetime] = None
    resolution_due_at: Optional[datetime] = None
    breached_first_response: bool = False
    breached_resolution: bool = False
    paused: bool = False
    pause_reason: Optional[str] = None
    updated_at: Optional[datetime] = None
    meta: Dict[str, Any] = Field(default_factory=dict)

    model_config = {"from_attributes": True}


# ------------------------------ Ticket ------------------------------

class TicketBase(BaseModel):
    org_id: str
    project_id: Optional[str] = None
    subject: str
    description: Optional[str] = None
    status: TicketStatus = TicketStatus.new
    priority: TicketPriority = TicketPriority.normal
    severity: TicketSeverity = TicketSeverity.sev4

    requester_id: str

    # Single agent per ticket (use existing assignee_id)
    assignee_id: Optional[str] = None

    # Single team per ticket (NEW)
    team_id: Optional[str] = None

    # Group is optional, unchanged
    group_id: Optional[str] = None

    category: Optional[str] = None
    subcategory: Optional[str] = None
    product_id: Optional[str] = None
    sla_id: Optional[str] = None
    due_at: Optional[datetime] = None
    custom_fields: Dict[str, Any] = Field(default_factory=dict)
    meta: Dict[str, Any] = Field(default_factory=dict)

    # ---- DEPRECATED FIELDS (kept to accept old payloads; ignored) ----
    team_ids: List[str] = Field(default_factory=list, description="DEPRECATED: use team_id")
    agent_ids: List[str] = Field(default_factory=list, description="DEPRECATED: use assignee_id")

    category_id: Optional[str] = None
    subcategory_id: Optional[str] = None

    # Backward-compat coercion from lists (first item wins)
    @model_validator(mode="after")
    def _coerce_deprecated_lists(self):
        if (not self.team_id) and self.team_ids:
            self.team_id = self.team_ids[0]
        if (not self.assignee_id) and self.agent_ids:
            self.assignee_id = self.agent_ids[0]
        # If agent provided, ensure team present
        if self.assignee_id and not self.team_id:
            raise ValueError("assignee_id provided but team_id is missing")
        return self


class TicketCreate(TicketBase):
    ticket_id: Optional[str] = None  # client-supplied or server-generated
    tags: List[str] = Field(default_factory=list)  # tag_ids to attach initially
    assignment: Optional[AssignmentMeta] = None
    sla_processing: Optional[SLAProcessingData] = None

    @model_validator(mode="after")
    def _assignment_consistency(self):
        if self.assignment:
            # Prefer explicit top-level fields; fall back to assignment if missing
            if not self.team_id and self.assignment.team_id:
                self.team_id = self.assignment.team_id
            if not self.assignee_id and self.assignment.agent_id:
                self.assignee_id = self.assignment.agent_id
            if self.assignee_id and not self.team_id:
                raise ValueError("assignment.agent_id provided but team_id missing")
        return self


class TicketUpdate(BaseModel):
    subject: Optional[str] = None
    description: Optional[str] = None
    status: Optional[TicketStatus] = None
    priority: Optional[TicketPriority] = None
    severity: Optional[TicketSeverity] = None

    # Single agent/team updates
    assignee_id: Optional[str] = None
    team_id: Optional[str] = None

    group_id: Optional[str] = None
    category: Optional[str] = None
    subcategory: Optional[str] = None
    product_id: Optional[str] = None
    sla_id: Optional[str] = None
    due_at: Optional[datetime] = None
    custom_fields: Optional[Dict[str, Any]] = None
    meta: Optional[Dict[str, Any]] = None
    tags: Optional[List[str]] = None  # full replace set if provided

    # DEPRECATED: incoming old clients might still send these
    team_ids: Optional[List[str]] = Field(default=None, description="DEPRECATED: use team_id")
    agent_ids: Optional[List[str]] = Field(default=None, description="DEPRECATED: use assignee_id")

    category_id: Optional[str] = None
    subcategory_id: Optional[str] = None

    assignment: Optional[AssignmentMeta] = None

    @model_validator(mode="after")
    def _normalize_and_validate(self):
        # Coerce deprecated lists
        if (not self.team_id) and self.team_ids:
            self.team_id = self.team_ids[0]
        if (not self.assignee_id) and self.agent_ids:
            self.assignee_id = self.agent_ids[0]

        # Pull from assignment if provided
        if self.assignment:
            if not self.team_id and self.assignment.team_id:
                self.team_id = self.assignment.team_id
            if not self.assignee_id and self.assignment.agent_id:
                self.assignee_id = self.assignment.agent_id

        # Validate dependency: agent needs team
        if self.assignee_id and not self.team_id:
            raise ValueError("assignee_id provided but team_id is missing")
        return self


class TicketOut(TicketBase):
    ticket_id: str
    number: Optional[int] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    first_response_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None
    closed_at: Optional[datetime] = None
    last_activity_at: Optional[datetime] = None
    last_public_comment_at: Optional[datetime] = None
    reply_count: int = 0
    follower_count: int = 0
    attachment_count: int = 0
    comment_count: int = 0

    # counts related to teams/agents removed (single only now)
    team_ids: Optional[List[str]] = None  # will always be [] in output; kept for compatibility
    agent_ids: Optional[List[str]] = None

    category_id: Optional[str] = None
    subcategory_id: Optional[str] = None

    tags: List[TagOut] = Field(default_factory=list)
    sla_status: Optional[TicketSLAStatusOut] = None

    model_config = {"from_attributes": True}


# ----------------------------- Comments -----------------------------

class CommentBase(BaseModel):
    ticket_id: str
    author_id: str
    body: str
    is_internal: bool = False


class CommentCreate(CommentBase):
    comment_id: Optional[str] = None


class CommentUpdate(BaseModel):
    body: Optional[str] = None
    is_internal: Optional[bool] = None


class CommentOut(CommentBase):
    comment_id: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


# ---------------------------- Attachments ----------------------------

class AttachmentBase(BaseModel):
    ticket_id: str
    comment_id: Optional[str] = None
    filename: str
    content_type: Optional[str] = None
    size_bytes: Optional[int] = None
    storage_key: str
    url: Optional[str] = None
    checksum: Optional[str] = None
    uploaded_by: str


class AttachmentCreate(AttachmentBase):
    attachment_id: Optional[str] = None


class AttachmentOut(AttachmentBase):
    attachment_id: str
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


# ----------------------------- Watchers -----------------------------

class WatcherCreate(BaseModel):
    watcher_id: Optional[str] = None
    ticket_id: str
    user_id: str


class WatcherOut(BaseModel):
    watcher_id: str
    ticket_id: str
    user_id: str
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


# ------------------------------ Events ------------------------------

class EventCreate(BaseModel):
    event_id: Optional[str] = None
    ticket_id: str
    actor_id: str
    event_type: str
    from_value: Dict[str, Any] = Field(default_factory=dict)
    to_value: Dict[str, Any] = Field(default_factory=dict)
    meta: Dict[str, Any] = Field(default_factory=dict)


class EventOut(BaseModel):
    event_id: str
    ticket_id: str
    actor_id: str
    event_type: str
    from_value: Dict[str, Any]
    to_value: Dict[str, Any]
    meta: Dict[str, Any]
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


# ------------------------------- Tags -------------------------------

class TagCreate(BaseModel):
    tag_id: Optional[str] = None
    org_id: str
    name: str
    color: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    usage_count: int = 0
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class TagUpdate(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None


# ---------------------------- Ticket Links --------------------------

class TicketLinkCreate(BaseModel):
    link_id: Optional[str] = None
    source_ticket_id: str
    target_ticket_id: str
    link_type: TicketLinkType


class TicketLinkOut(TicketLinkCreate):
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


# ----------------------------- Collaborators -----------------------------

class CollaboratorCreate(BaseModel):
    ticket_id: str
    user_id: str
    role: str = "contributor"  # "contributor" | "reviewer" | "observer"


class CollaboratorOut(BaseModel):
    collab_id: str
    ticket_id: str
    user_id: str
    role: str
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


# ----------------------------- Support Groups -----------------------------

class SupportGroupCreate(BaseModel):
    group_id: Optional[str] = None
    org_id: str
    name: str
    email: Optional[str] = None
    description: Optional[str] = None


class SupportGroupUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    description: Optional[str] = None


class GroupMemberAdd(BaseModel):
    user_id: str


class GroupMemberOut(BaseModel):
    group_id: str
    user_id: str


# ----------------------------- Worklogs -----------------------------

class WorklogCreate(BaseModel):
    user_id: str
    minutes: int
    kind: WorklogType
    note: Optional[str] = None


class WorklogOut(BaseModel):
    worklog_id: str
    ticket_id: str
    user_id: str
    minutes: int
    kind: WorklogType
    note: Optional[str] = None
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}
