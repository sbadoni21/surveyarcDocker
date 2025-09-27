# app/routers/support_teams.py - Complete implementation with Redis and Calendar integration

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, selectinload
from sqlalchemy import select
from typing import List, Optional, Dict, Any
import uuid

from ..db import get_db
from ..models.support import SupportTeam, SupportTeamMember, SupportGroup, UserStub
from ..models.sla import BusinessCalendar
from ..schemas.support import (
    SupportTeamCreate, SupportTeamUpdate, SupportTeamOut,
    TeamMemberAdd, TeamMemberOut, GroupMemberUpdate
)
from ..services.redis_support_service import RedisSupportService

router = APIRouter(prefix="/support-teams", tags=["Support Teams"])

# New schemas for calendar integration
from pydantic import BaseModel, Field

class TeamCalendarAssignment(BaseModel):
    calendar_id: Optional[str] = Field(None, description="Calendar ID to assign (null to remove)")

class SupportTeamWithCalendar(BaseModel):
    team_id: str
    org_id: str
    group_id: str
    name: str
    description: Optional[str] = None
    email: Optional[str] = None
    target_proficiency: str
    routing_weight: int
    default_sla_id: Optional[str] = None
    calendar_id: Optional[str] = None
    meta: Dict[str, Any] = Field(default_factory=dict)
    active: bool
    created_at: str
    updated_at: str
    calendar: Optional[Dict[str, Any]] = None

# Helper function to get calendar data
async def get_calendar_summary(db: Session, calendar_id: str) -> Optional[Dict[str, Any]]:
    """Get calendar summary data"""
    if not calendar_id:
        return None
    
    try:
        calendar = db.execute(
            select(BusinessCalendar)
            .options(selectinload(BusinessCalendar.hours), selectinload(BusinessCalendar.holidays))
            .where(BusinessCalendar.calendar_id == calendar_id)
        ).scalar_one_or_none()
        
        if calendar:
            return {
                "calendar_id": calendar.calendar_id,
                "name": calendar.name,
                "timezone": calendar.timezone,
                "active": calendar.active,
                "hours_count": len(calendar.hours) if calendar.hours else 0,
                "holidays_count": len(calendar.holidays) if calendar.holidays else 0,
                "created_at": calendar.created_at.isoformat(),
                "updated_at": calendar.updated_at.isoformat()
            }
        return None
    except Exception as e:
        print(f"Error fetching calendar summary: {e}")
        return None

async def get_calendar_full(db: Session, calendar_id: str) -> Optional[Dict[str, Any]]:
    """Get full calendar data including hours and holidays"""
    if not calendar_id:
        return None
    
    try:
        calendar = db.execute(
            select(BusinessCalendar)
            .options(selectinload(BusinessCalendar.hours), selectinload(BusinessCalendar.holidays))
            .where(BusinessCalendar.calendar_id == calendar_id)
        ).scalar_one_or_none()
        
        if calendar:
            return {
                "calendar_id": calendar.calendar_id,
                "name": calendar.name,
                "timezone": calendar.timezone,
                "active": calendar.active,
                "meta": calendar.meta,
                "created_at": calendar.created_at.isoformat(),
                "updated_at": calendar.updated_at.isoformat(),
                "hours": [
                    {
                        "id": h.id,
                        "weekday": h.weekday,
                        "start_min": h.start_min,
                        "end_min": h.end_min
                    }
                    for h in calendar.hours
                ] if calendar.hours else [],
                "holidays": [
                    {
                        "id": h.id,
                        "date_iso": h.date_iso,
                        "name": h.name
                    }
                    for h in calendar.holidays
                ] if calendar.holidays else []
            }
        return None
    except Exception as e:
        print(f"Error fetching full calendar data: {e}")
        return None

# --------- list teams by org/group ----------
@router.get("/", response_model=List[Dict[str, Any]])
def list_teams(
    org_id: Optional[str] = Query(None), 
    group_id: Optional[str] = Query(None),
    include_calendar: bool = Query(False, description="Include calendar information"),
    db: Session = Depends(get_db)
):
    if not org_id and not group_id:
        raise HTTPException(400, "Either org_id or group_id must be provided")
    
    # Try to get from cache first
    cache_key = f"group:{group_id}" if group_id else f"org:{org_id}"
    cached = RedisSupportService.get_teams_by_key(cache_key, include_calendar)
    if cached is not None:
        return cached
    
    # Build query
    if group_id:
        query = select(SupportTeam).where(
            SupportTeam.group_id == group_id,
            SupportTeam.active == True
        )
    else:
        query = select(SupportTeam).where(
            SupportTeam.org_id == org_id,
            SupportTeam.active == True
        )
    
    teams = db.execute(query).scalars().all()
    
    result = []
    for team in teams:
        team_dict = SupportTeamOut.model_validate(team, from_attributes=True).model_dump()
        
        # Add calendar info if requested
        if include_calendar and team.calendar_id:
            calendar_data =  get_calendar_summary(db, team.calendar_id)
            if calendar_data:
                team_dict["calendar"] = calendar_data
        
        result.append(team_dict)
    
    # Cache the result
    RedisSupportService.cache_teams_by_key(cache_key, result, include_calendar)
    
    return result

# --------- get single team ----------
@router.get("/{team_id}", response_model=Dict[str, Any])
def get_team(
    team_id: str, 
    include_calendar: bool = Query(True, description="Include calendar information"),
    db: Session = Depends(get_db)
):
    # Try cache first
    cached = RedisSupportService.get_team(team_id, include_calendar)
    if cached:
        return cached
        
    team = db.get(SupportTeam, team_id)
    if not team or not team.active:
        raise HTTPException(404, "Team not found")
    
    team_dict = SupportTeamOut.model_validate(team, from_attributes=True).model_dump()
    
    # Add calendar info if requested
    if include_calendar and team.calendar_id:
        calendar_data =  get_calendar_summary(db, team.calendar_id)
        if calendar_data:
            team_dict["calendar"] = calendar_data
    
    # Cache the result
    RedisSupportService.cache_team(team_id, team_dict, include_calendar)
    
    return team_dict

# --------- create team ----------
@router.post("/", response_model=SupportTeamOut, status_code=201)
def create_team(payload: SupportTeamCreate, db: Session = Depends(get_db)):
    # Verify the group exists
    group = db.get(SupportGroup, payload.group_id)
    if not group:
        raise HTTPException(404, "Group not found")
    
    # Verify calendar exists if provided
    if payload.calendar_id:
        calendar = db.get(BusinessCalendar, payload.calendar_id)
        if not calendar:
            raise HTTPException(404, "Calendar not found")
        
        # Verify calendar belongs to same org
        if calendar.org_id != payload.org_id:
            raise HTTPException(400, "Calendar must belong to the same organization")
    
    team_id = payload.team_id or f"team_{uuid.uuid4().hex[:10]}"
    
    team = SupportTeam(
        team_id=team_id,
        org_id=payload.org_id,
        group_id=payload.group_id,
        name=payload.name,
        description=payload.description,
        email=payload.email,
        target_proficiency=payload.target_proficiency,
        routing_weight=payload.routing_weight,
        default_sla_id=payload.default_sla_id,
        calendar_id=payload.calendar_id,
        meta=payload.meta,
        active=True
    )
    
    db.add(team)
    db.commit()
    db.refresh(team)
    
    # Invalidate caches
    RedisSupportService.invalidate_team_caches(team_id, payload.group_id, payload.org_id)
    
    return SupportTeamOut.model_validate(team, from_attributes=True)

# --------- update team ----------
@router.patch("/{team_id}", response_model=SupportTeamOut)
def update_team(team_id: str, payload: SupportTeamUpdate, db: Session = Depends(get_db)):
    team = db.get(SupportTeam, team_id)
    if not team or not team.active:
        raise HTTPException(404, "Team not found")
    
    # Verify calendar exists if being updated
    if hasattr(payload, 'calendar_id') and payload.calendar_id is not None:
        if payload.calendar_id:  # If not None and not empty
            calendar = db.get(BusinessCalendar, payload.calendar_id)
            if not calendar:
                raise HTTPException(404, "Calendar not found")
            
            # Verify calendar belongs to same org
            if calendar.org_id != team.org_id:
                raise HTTPException(400, "Calendar must belong to the same organization")
    
    # Update only provided fields
    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(team, field, value)
    
    db.commit()
    db.refresh(team)
    
    # Invalidate caches
    RedisSupportService.invalidate_team_caches(team_id, team.group_id, team.org_id)
    
    return SupportTeamOut.model_validate(team, from_attributes=True)

# --------- calendar management ----------
@router.post("/{team_id}/calendar", response_model=SupportTeamOut)
def assign_calendar(
    team_id: str, 
    assignment: TeamCalendarAssignment, 
    db: Session = Depends(get_db)
):
    """Assign or remove a calendar from a team"""
    team = db.get(SupportTeam, team_id)
    if not team or not team.active:
        raise HTTPException(404, "Team not found")
    
    if assignment.calendar_id:
        # Verify calendar exists and belongs to same org
        calendar = db.get(BusinessCalendar, assignment.calendar_id)
        if not calendar:
            raise HTTPException(404, "Calendar not found")
        
        if calendar.org_id != team.org_id:
            raise HTTPException(400, "Calendar must belong to the same organization")
    
    team.calendar_id = assignment.calendar_id
    db.commit()
    db.refresh(team)
    
    # Invalidate caches
    RedisSupportService.invalidate_team_caches(team_id, team.group_id, team.org_id)
    
    return SupportTeamOut.model_validate(team, from_attributes=True)

@router.delete("/{team_id}/calendar", response_model=SupportTeamOut)
def remove_calendar(team_id: str, db: Session = Depends(get_db)):
    """Remove calendar assignment from a team"""
    team = db.get(SupportTeam, team_id)
    if not team or not team.active:
        raise HTTPException(404, "Team not found")
    
    team.calendar_id = None
    db.commit()
    db.refresh(team)
    
    # Invalidate caches
    RedisSupportService.invalidate_team_caches(team_id, team.group_id, team.org_id)
    
    return SupportTeamOut.model_validate(team, from_attributes=True)

@router.get("/{team_id}/calendar")
def get_team_calendar(team_id: str, db: Session = Depends(get_db)):
    """Get full calendar information for a team"""
    team = db.get(SupportTeam, team_id)
    if not team or not team.active:
        raise HTTPException(404, "Team not found")
    
    if not team.calendar_id:
        raise HTTPException(404, "No calendar assigned to this team")
    
    # Try cache first
    cached_calendar = RedisSupportService.get_team_calendar(team_id)
    if cached_calendar:
        return cached_calendar
    
    calendar_data =  get_calendar_full(db, team.calendar_id)
    if not calendar_data:
        raise HTTPException(404, "Assigned calendar not found")
    
    # Cache the result
    RedisSupportService.cache_team_calendar(team_id, calendar_data)
    
    return calendar_data

# --------- delete team ----------
@router.delete("/{team_id}", status_code=204)
def delete_team(team_id: str, db: Session = Depends(get_db)):
    team = db.get(SupportTeam, team_id)
    if not team:
        raise HTTPException(404, "Team not found")
    
    # Soft delete
    team.active = False
    db.commit()
    
    # Invalidate caches
    RedisSupportService.invalidate_team_caches(team_id, team.group_id, team.org_id)
    
    return None

# --------- team members ----------
@router.get("/{team_id}/members", response_model=List[TeamMemberOut])
def list_team_members(team_id: str, db: Session = Depends(get_db)):
    # Verify team exists
    team = db.get(SupportTeam, team_id)
    if not team or not team.active:
        raise HTTPException(404, "Team not found")
    
    cached = RedisSupportService.get_team_members(team_id)
    if cached is not None:
        return cached
    
    rows = db.query(SupportTeamMember).filter(
        SupportTeamMember.team_id == team_id,
        SupportTeamMember.active == True
    ).all()
    
    out = [TeamMemberOut.model_validate(r, from_attributes=True).model_dump() for r in rows]
    RedisSupportService.cache_team_members(team_id, out)
    return out

def ensure_user_stub(db: Session, user_id: str):
    if not db.get(UserStub, user_id):
        db.add(UserStub(user_id=user_id))
        db.commit()

@router.post("/{team_id}/members", response_model=TeamMemberOut, status_code=201)
def add_team_member(team_id: str, body: TeamMemberAdd, db: Session = Depends(get_db)):
    ensure_user_stub(db, body.user_id)
    team = db.get(SupportTeam, team_id)
    if not team or not team.active:
        raise HTTPException(404, "Team not found")

    # Check if member already exists
    existing = db.query(SupportTeamMember).filter_by(
        team_id=team_id, 
        user_id=body.user_id
    ).first()
    
    if existing:
        # Update existing member
        existing.role = body.role
        existing.proficiency = body.proficiency
        existing.weekly_capacity_minutes = body.weekly_capacity_minutes
        existing.active = True
        db.commit()
        db.refresh(existing)
        
        # Invalidate caches
        RedisSupportService.invalidate_team_member_caches(team_id, team.group_id, team.org_id)
        
        return existing
    
    # Create new member
    member = SupportTeamMember(
        team_id=team_id,
        user_id=body.user_id,
        role=body.role,
        proficiency=body.proficiency,
        weekly_capacity_minutes=body.weekly_capacity_minutes,
        active=True
    )
    
    db.add(member)
    db.commit()
    db.refresh(member)
    
    # Invalidate caches
    RedisSupportService.invalidate_team_member_caches(team_id, team.group_id, team.org_id)
    
    return member

@router.patch("/{team_id}/members/{user_id}", response_model=TeamMemberOut)
def update_team_member(
    team_id: str, 
    user_id: str, 
    body: GroupMemberUpdate, 
    db: Session = Depends(get_db)
):
    member = db.query(SupportTeamMember).filter_by(
        team_id=team_id, 
        user_id=user_id
    ).first()
    
    if not member:
        raise HTTPException(404, "Team member not found")
    
    # Update provided fields
    if body.role is not None:
        member.role = body.role
    if body.proficiency is not None:
        member.proficiency = body.proficiency
    if body.active is not None:
        member.active = body.active
    
    db.commit()
    db.refresh(member)
    
    # Get team for cache invalidation
    team = db.get(SupportTeam, team_id)
    if team:
        RedisSupportService.invalidate_team_member_caches(team_id, team.group_id, team.org_id)
    
    return member

@router.delete("/{team_id}/members/{user_id}", status_code=204)
def remove_team_member(team_id: str, user_id: str, db: Session = Depends(get_db)):
    member = db.query(SupportTeamMember).filter_by(
        team_id=team_id, 
        user_id=user_id
    ).first()
    
    if not member:
        raise HTTPException(404, "Team member not found")
    
    db.delete(member)
    db.commit()
    
    # Get team for cache invalidation
    team = db.get(SupportTeam, team_id)
    if team:
        RedisSupportService.invalidate_team_member_caches(team_id, team.group_id, team.org_id)
    
    return None

# --------- utility endpoints ----------
@router.get("/{team_id}/stats")
def get_team_stats(team_id: str, db: Session = Depends(get_db)):
    """Get team statistics like member count, capacity, etc."""
    team = db.get(SupportTeam, team_id)
    if not team or not team.active:
        raise HTTPException(404, "Team not found")
    
    # Try cache first
    cached_stats = RedisSupportService.get_team_stats(team_id)
    if cached_stats:
        return cached_stats
    
    # Get active members
    members = db.query(SupportTeamMember).filter(
        SupportTeamMember.team_id == team_id,
        SupportTeamMember.active == True
    ).all()
    
    total_capacity = sum(
        m.weekly_capacity_minutes or 0 for m in members
    )
    
    proficiency_breakdown = {}
    role_breakdown = {}
    
    for member in members:
        # Count by proficiency
        prof = member.proficiency.value
        proficiency_breakdown[prof] = proficiency_breakdown.get(prof, 0) + 1
        
        # Count by role
        role = member.role.value
        role_breakdown[role] = role_breakdown.get(role, 0) + 1
    
    stats = {
        "team_id": team_id,
        "team_name": team.name,
        "total_members": len(members),
        "total_weekly_capacity_minutes": total_capacity,
        "target_proficiency": team.target_proficiency.value,
        "routing_weight": team.routing_weight,
        "proficiency_breakdown": proficiency_breakdown,
        "role_breakdown": role_breakdown,
        "calendar_id": team.calendar_id,
        "active": team.active
    }
    
    # Cache the stats
    RedisSupportService.cache_team_stats(team_id, stats)
    
    return stats