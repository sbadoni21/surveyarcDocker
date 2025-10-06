from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from datetime import datetime
from ..models.support import ProficiencyLevel, GroupMemberRole, RoutingTarget



class GroupMemberAdd(BaseModel):
    user_id: str
    role: GroupMemberRole = GroupMemberRole.agent
    proficiency: ProficiencyLevel = ProficiencyLevel.l1

class GroupMemberUpdate(BaseModel):
    role: Optional[GroupMemberRole] = None
    proficiency: Optional[ProficiencyLevel] = None
    active: Optional[bool] = None

class GroupMemberOut(BaseModel):
    group_id: str
    user_id: str
    role: GroupMemberRole
    proficiency: ProficiencyLevel
    active: bool = True
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    model_config = {"from_attributes": True}
class SupportTeamCreate(BaseModel):
    team_id: Optional[str] = None
    org_id: str
    group_id: str
    name: str
    description: Optional[str] = None
    email: Optional[str] = None
    target_proficiency: ProficiencyLevel = ProficiencyLevel.l1
    routing_weight: int = 1
    default_sla_id: Optional[str] = None
    calendar_id: Optional[str] = Field(None, description="Business calendar ID for this team")
    meta: Dict[str, Any] = Field(default_factory=dict)
class SupportTeamUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    email: Optional[str] = None
    target_proficiency: Optional[ProficiencyLevel] = None
    routing_weight: Optional[int] = None
    default_sla_id: Optional[str] = None
    calendar_id: Optional[str] = Field(None, description="Business calendar ID for this team")
    meta: Optional[Dict[str, Any]] = None
    active: Optional[bool] = None
class SupportGroupCreate(BaseModel):
    group_id: Optional[str] = None  # Optional - will be auto-generated if not provided
    org_id: str
    name: str
    email: Optional[str] = None
    description: Optional[str] = None

class SupportGroupUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    description: Optional[str] = None

# Keep your existing SupportGroupOut as is
class SupportGroupOut(BaseModel):
    group_id: str  # Required for output
    org_id: str
    name: str
    email: Optional[str] = None
    description: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    model_config = {"from_attributes": True}
    calendar_id: Optional[str] = None

    
class SupportTeamOut(BaseModel):
    team_id: str
    org_id: str
    group_id: str
    name: str
    description: Optional[str] = None
    email: Optional[str] = None
    target_proficiency: ProficiencyLevel
    routing_weight: int
    default_sla_id: Optional[str] = None
    calendar_id: Optional[str] = None
    meta: Dict[str, Any] = Field(default_factory=dict)
    active: bool = True
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    
    # Optional: Include calendar details when expanded
    calendar: Optional[Dict[str, Any]] = Field(None, description="Calendar details if requested")
    
    model_config = {"from_attributes": True}
class TeamMemberAdd(BaseModel):
    user_id: str
    role: GroupMemberRole = GroupMemberRole.agent
    proficiency: ProficiencyLevel = ProficiencyLevel.l1
    weekly_capacity_minutes: Optional[int] = None

class TeamMemberOut(BaseModel):
    team_id: str
    user_id: str
    role: GroupMemberRole
    proficiency: ProficiencyLevel
    active: bool = True
    weekly_capacity_minutes: Optional[int] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    model_config = {"from_attributes": True}

class RoutingPolicyCreate(BaseModel):
    policy_id: Optional[str] = None
    org_id: str
    group_id: Optional[str] = None
    team_id: Optional[str] = None
    name: str
    active: bool = True
    target: RoutingTarget = RoutingTarget.team
    rules: Dict[str, Any] = Field(default_factory=dict)
    meta: Dict[str, Any] = Field(default_factory=dict)

class RoutingPolicyUpdate(BaseModel):
    group_id: Optional[str] = None
    team_id: Optional[str] = None
    name: Optional[str] = None
    active: Optional[bool] = None
    target: Optional[RoutingTarget] = None
    rules: Optional[Dict[str, Any]] = None
    meta: Optional[Dict[str, Any]] = None

class RoutingPolicyOut(BaseModel):
    policy_id: str
    org_id: str
    group_id: Optional[str] = None
    team_id: Optional[str] = None
    name: str
    active: bool
    target: RoutingTarget
    rules: Dict[str, Any]
    meta: Dict[str, Any]
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    model_config = {"from_attributes": True}
# New schemas for calendar operations
class TeamCalendarAssignment(BaseModel):
    calendar_id: Optional[str] = Field(None, description="Calendar ID to assign (null to unassign)")

class TeamWithCalendarOut(SupportTeamOut):
    calendar: Optional[Dict[str, Any]] = Field(None, description="Full calendar details including hours and holidays")
class BulkCalendarAssignment(BaseModel):
    assignments: List[Dict[str, str]] = Field(
        ..., 
        description="List of {team_id: calendar_id} assignments"
    )