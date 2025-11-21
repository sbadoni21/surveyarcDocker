# app/schemas/tickets.py
from pydantic import BaseModel, Field
from pydantic import field_validator, model_validator
from typing import Optional, List, Dict, Any
from datetime import datetime
from ..models.tickets import (
    TicketStatus, TicketPriority, TicketSeverity, TicketLinkType,
    WorklogType, SLAPauseReason, TicketPlatform
)


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


# ------------------------------- SLA Pause/Resume --------------------------------

class SLAPauseRequest(BaseModel):
    """Request to pause an SLA timer"""
    dimension: str = Field(..., description="first_response or resolution")
    reason: SLAPauseReason = Field(default=SLAPauseReason.agent_paused)
    reason_note: Optional[str] = Field(None, description="Additional context")


class SLAResumeRequest(BaseModel):
    """Request to resume an SLA timer"""
    dimension: str = Field(..., description="first_response or resolution")





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

    # Primary assignee (main person responsible)
    assignee_id: Optional[str] = None

    # Single team per ticket
    team_id: Optional[str] = None

    # Single additional agent per ticket (besides assignee)
    agent_id: Optional[str] = None

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
    agent_ids: List[str] = Field(default_factory=list, description="DEPRECATED: use agent_id")
    # ▶ ADD: new classification fields
    feature_id: Optional[str] = None
    impact_id: Optional[str] = None

    # ▶ ADD: RCA is usually set later, but keep nullable on create
    rca_id: Optional[str] = None
    rca_note: Optional[str] = None
    rca_set_by: Optional[str] = None
    rca_set_at: Optional[datetime] = None

    category_id: Optional[str] = None
    subcategory_id: Optional[str] = None

    # Backward-compat coercion from lists (first item wins)
    @model_validator(mode="after")
    def _coerce_deprecated_lists(self):
        # Coerce team_ids to team_id
        if (not self.team_id) and self.team_ids:
            self.team_id = self.team_ids[0]
        
        # Coerce agent_ids to agent_id
        if (not self.agent_id) and self.agent_ids:
            self.agent_id = self.agent_ids[0]
        
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
            if not self.agent_id and self.assignment.agent_id:
                self.agent_id = self.assignment.agent_id
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
    agent_id: Optional[str] = None

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
    agent_ids: Optional[List[str]] = Field(default=None, description="DEPRECATED: use agent_id")
    feature_id: Optional[str] = None
    impact_id: Optional[str] = None
    rca_id: Optional[str] = None
    rca_note: Optional[str] = None
    rca_set_by: Optional[str] = None
    rca_set_at: Optional[datetime] = None

    category_id: Optional[str] = None
    subcategory_id: Optional[str] = None

    assignment: Optional[AssignmentMeta] = None

    @model_validator(mode="after")
    def _normalize_and_validate(self):
        # Coerce deprecated lists
        if (not self.team_id) and self.team_ids:
            self.team_id = self.team_ids[0] if self.team_ids else None
        if (not self.agent_id) and self.agent_ids:
            self.agent_id = self.agent_ids[0] if self.agent_ids else None

        # Pull from assignment if provided
        if self.assignment:
            if not self.team_id and self.assignment.team_id:
                self.team_id = self.assignment.team_id
            if not self.agent_id and self.assignment.agent_id:
                self.agent_id = self.assignment.agent_id

        return self



class RootCauseSet(BaseModel):
    rca_id: str
    rca_note: Optional[str] = None
    confirmed_by: str
    confirmed_at: Optional[datetime] = None

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

# In app/schemas/tickets.py

class SLAPauseHistoryOut(BaseModel):
    """Response model for pause history"""
    pause_id: str
    ticket_id: str
    dimension: str
    action: str  # "pause" or "resume"
    action_at: datetime
    actor_id: str
    reason: Optional[SLAPauseReason] = None
    reason_note: Optional[str] = None
    pause_duration_minutes: Optional[int] = None
    due_date_extension_minutes: Optional[int] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class SLAPauseWindowOut(BaseModel):
    """Legacy pause window format"""
    id: int
    ticket_id: str
    dimension: str
    reason: str
    started_at: datetime
    ended_at: Optional[datetime] = None
    meta: Dict[str, Any] = Field(default_factory=dict)

    model_config = {"from_attributes": True}


class TicketSLAStatusOut(BaseModel):
    ticket_id: str
    sla_id: Optional[str] = None
    
    # First Response
    first_response_due_at: Optional[datetime] = None
    first_response_started_at: Optional[datetime] = None
    first_response_completed_at: Optional[datetime] = None
    first_response_paused: bool = False
    first_response_paused_at: Optional[datetime] = None
    elapsed_first_response_minutes: int = 0
    total_paused_first_response_minutes: int = 0
    breached_first_response: bool = False
    last_resume_first_response: Optional[datetime] = None
    
    # Resolution
    resolution_due_at: Optional[datetime] = None
    resolution_started_at: Optional[datetime] = None
    resolution_completed_at: Optional[datetime] = None
    resolution_paused: bool = False
    resolution_paused_at: Optional[datetime] = None
    elapsed_resolution_minutes: int = 0
    total_paused_resolution_minutes: int = 0
    breached_resolution: bool = False
    last_resume_resolution: Optional[datetime] = None
    
    # Legacy fields
    paused: bool = False
    pause_reason: Optional[str] = None
    
    # Calendar
    calendar_id: Optional[str] = None
    
    # Additional data for full picture
    pause_history: List[SLAPauseHistoryOut] = Field(default_factory=list)
    
    # Metadata
    meta: Dict[str, Any] = Field(default_factory=dict)
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class TicketEventOut(BaseModel):
    """Ticket event for audit trail"""
    event_id: str
    ticket_id: str
    actor_id: str
    event_type: str
    from_value: Dict[str, Any]
    to_value: Dict[str, Any]
    meta: Dict[str, Any]
    created_at: datetime

    model_config = {"from_attributes": True}


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

    # Deprecated fields
    team_ids: List[str] = Field(default_factory=list)
    agent_ids: List[str] = Field(default_factory=list)
    
    # Taxonomies
    feature_id: Optional[str] = None
    impact_id: Optional[str] = None
    rca_id: Optional[str] = None
    rca_note: Optional[str] = None
    rca_set_by: Optional[str] = None
    rca_set_at: Optional[datetime] = None
    category_id: Optional[str] = None
    subcategory_id: Optional[str] = None

    # Relations
    tags: List[TagOut] = Field(default_factory=list)
    sla_status: Optional[TicketSLAStatusOut] = None
    
    # ✨ NEW: Include SLA-related events for complete audit trail
    sla_events: List[TicketEventOut] = Field(default_factory=list)

    model_config = {"from_attributes": True}

    @model_validator(mode="after")
    def filter_sla_events(self):
        """Extract only SLA-related events from all events"""
        if hasattr(self, '_all_events'):
            self.sla_events = [
                e for e in self._all_events 
                if e.event_type in ('sla_paused', 'sla_resumed', 'sla_assigned', 'sla_breached')
            ]
        return self