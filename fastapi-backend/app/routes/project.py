# app/routes/project.py
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
from uuid import uuid4
from pydantic import BaseModel

from ..core.redis_client import RedisClient
from ..db import get_db
from ..models.project import Project
from ..schemas.project import (
    ProjectCreate, ProjectUpdate, ProjectBase, ProjectGetBase,
    StatusChange, TagPatch, SurveyPatch,
    SearchQuery, BulkAction
)
from ..services.redis_project_service import RedisProjectService
from ..models.user import User
from ..dependencies.redis import get_redis_optional
from ..policies.auth import get_current_user
from app.dependencies.permissions import require_permission, AssignmentScope
from app.models.rbac.permission import Role, UserRoleAssignment, RoleScope
from app.services.permission_service import PermissionService
from app.services.redis_rbac_service import RedisRBACService


router = APIRouter(prefix="/projects", tags=["Projects"])


# =====================================================
# PYDANTIC MODELS
# =====================================================

class AddMemberRequest(BaseModel):
    """Unified request for adding members and granting access"""
    uid: str
    role: str = "contributor"
    status: str = "active"
    visible_in_team: bool = True  # Controls visibility in members list
    joined_at: Optional[datetime] = None


class BulkAddMembersRequest(BaseModel):
    """Request schema for bulk adding members to a project"""
    user_uids: List[str]
    role: str = "contributor"


class BulkAddMembersResponse(BaseModel):
    """Response schema for bulk add operation"""
    added: int
    skipped: int
    details: List[dict]


# =====================================================
# RBAC HELPER FUNCTIONS
# =====================================================

def _assign_project_role(
    db: Session,
    user_uid: str,
    project_id: str,
    role_name: str,
    org_id: str,
    auto_commit: bool = True,
) -> UserRoleAssignment:
    """
    Assign a user a role at the project scope.
    Creates the RBAC assignment that grants permissions.
    """
    
    # ✅ ADD THIS MAPPING - Maps frontend names to backend names
    ROLE_NAME_MAP = {
        "contributor": "project_contributor",
        "editor": "project_editor",
        "viewer": "project_viewer",
        "owner": "project_owner",
    }
    
    # Map the role name (supports both formats)
    mapped_role_name = ROLE_NAME_MAP.get(role_name, role_name)
    
    print(f"[_assign_project_role] Mapping '{role_name}' → '{mapped_role_name}'")
    
    # Get the role (use mapped name)
    role = db.query(Role).filter(
        Role.name == mapped_role_name,
        Role.scope == RoleScope.project
    ).first()
    
    if not role:
        # Fallback to org-scoped role if project role doesn't exist
        role = db.query(Role).filter(
            Role.name == mapped_role_name,
            Role.scope == RoleScope.org
        ).first()
    
    if not role:
        # ✅ Better error message
        raise HTTPException(
            status_code=400,
            detail=f"Role '{role_name}' (mapped to '{mapped_role_name}') not found. Available roles must be created via RBAC seed first. Run: python -m app.seeds.rbac_seed"
        )
    
    # ... rest of function unchanged
    
    # Check if assignment already exists
    existing = db.query(UserRoleAssignment).filter(
        UserRoleAssignment.user_uid == user_uid,
        UserRoleAssignment.scope == AssignmentScope.project,
        UserRoleAssignment.resource_id == project_id,
    ).first()
    
    if existing:
        # Update existing assignment
        existing.role_id = role.id
        if auto_commit:
            db.commit()
            db.refresh(existing)
            RedisRBACService.invalidate_user_roles(user_uid, org_id)
        else:
            db.flush()
        
        return existing
    
    # Create new assignment
    assignment = UserRoleAssignment(
        id=str(uuid4()),
        user_uid=user_uid,
        role_id=role.id,
        scope=AssignmentScope.project,
        resource_id=project_id,
        created_at=datetime.utcnow(),
    )
    
    db.add(assignment)
    if auto_commit:
        db.commit()
        db.refresh(assignment)
        RedisRBACService.invalidate_user_roles(user_uid, org_id)
    else:
        db.flush()
    
    return assignment

def _remove_project_role(
    db: Session,
    user_uid: str,
    project_id: str,
    org_id: str,
    auto_commit: bool = True,
) -> bool:
    """
    Remove a user's RBAC role assignment from a project.
    """
    deleted = db.query(UserRoleAssignment).filter(
        UserRoleAssignment.user_uid == user_uid,
        UserRoleAssignment.scope == AssignmentScope.project,
        UserRoleAssignment.resource_id == project_id,
    ).delete()
    
    if auto_commit:
        db.commit()
        if deleted:
            RedisRBACService.invalidate_user_roles(user_uid, org_id)
    else:
        db.flush()
    
    return deleted > 0


def _update_project_role(
    db: Session,
    user_uid: str,
    project_id: str,
    new_role_name: str,
    org_id: str,
    auto_commit: bool = True,
) -> UserRoleAssignment:
    """
    Update a user's role in a project (updates the RBAC assignment).
    """
    return _assign_project_role(
        db,
        user_uid,
        project_id,
        new_role_name,
        org_id,
        auto_commit=auto_commit,
    )


# =====================================================
# UTILITY HELPERS
# =====================================================

def now_utc() -> datetime:
    return datetime.now(tz=timezone.utc)


def touch_project(db: Session, project: Project):
    project.last_activity = now_utc()
    project.updated_at = project.updated_at or now_utc()
    db.add(project)


def touch_and_cache(db: Session, project: Project) -> Project:
    project.last_activity = now_utc()
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


def _ensure_project(db: Session, org_id: str, project_id: str) -> Project:
    p = db.query(Project).filter(
        Project.project_id == project_id, Project.org_id == org_id
    ).first()
    if not p:
        raise HTTPException(404, "Project not found")
    return p


def _project_has_visible_member(project: Project, user_uid: str) -> bool:
    return any((member or {}).get("uid") == user_uid for member in (project.members or []))


def _append_system_milestone(
    db: Session,
    project: Project,
    title: str,
    note: Optional[str] = None,
    due: Optional[str] = None,
    done: bool = False
) -> Project:
    """Add a system milestone to the project (and persist)."""
    ms = project.milestones or []
    ms.append({
        "id": str(uuid4()),
        "title": title,
        "due": due,
        "done": bool(done),
        "note": note or "",
        "system": True,
        "created_at": now_utc().isoformat(),
        "created_by": "system",
    })
    project.milestones = ms
    return touch_and_cache(db, project)


async def _log_activity(org_id: str, project_id: str, message: str):
    """Record a human-friendly activity line in Redis."""
    await RedisProjectService.add_to_recent_activity(org_id, project_id, message)


async def _refresh_project_cache(org_id: str, project: Project):
    await RedisProjectService.invalidate_project_cache(org_id, project.project_id)
    await RedisProjectService.cache_project(project)


# =====================================================
# PROJECT CRUD
# =====================================================

@router.post(
    "/",
    response_model=ProjectGetBase,
    dependencies=[
        Depends(
            require_permission(
                "project.create",
                scope=AssignmentScope.org,
            )
        )
    ],
)
async def create_project(
    data: ProjectCreate, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new project with auto-assignment of creator as owner."""
    creator_uid = current_user.uid if hasattr(current_user, "uid") else current_user.get("uid")

    try:
        payload = data.model_dump()
        payload["project_id"] = payload.get("project_id") or f"proj_{uuid4().hex[:8]}"
        payload["owner_uid"] = payload.get("owner_uid") or creator_uid
        payload["last_activity"] = payload.get("last_activity") or now_utc()
        payload["start_date"] = payload.get("start_date") or now_utc()

        db_project = Project(**payload)
        initial_milestones = list(db_project.milestones or [])
        initial_milestones.append({
            "id": str(uuid4()),
            "title": "Project created",
            "due": None,
            "done": False,
            "note": f"Created with status '{db_project.status or 'planning'}'.",
            "system": True,
            "created_at": now_utc().isoformat(),
            "created_by": "system",
        })
        db_project.milestones = initial_milestones
        db.add(db_project)

        # Auto-assign creator as project owner
        if creator_uid:
            creator = db.query(User).filter(User.uid == creator_uid).first()
            if not creator:
                raise HTTPException(status_code=400, detail="Creator user not found")

            _assign_project_role(
                db=db,
                user_uid=creator_uid,
                project_id=db_project.project_id,
                role_name="project_owner",
                org_id=db_project.org_id,
                auto_commit=False,
            )

            db_project.members = [{
                "uid": creator_uid,
                "email": creator.email,
                "role": "owner",
                "status": "active",
                "joined_at": now_utc().isoformat(),
            }]

        db.commit()
        db.refresh(db_project)

        if creator_uid:
            RedisRBACService.invalidate_user_roles(creator_uid, db_project.org_id)

        try:
            await _log_activity(db_project.org_id, db_project.project_id, f"Project '{db_project.name}' created")
            await _refresh_project_cache(db_project.org_id, db_project)
            await RedisProjectService.invalidate_org_projects_cache(db_project.org_id)
        except Exception as cache_error:
            print(f"[create_project] Post-commit sync failed: {cache_error}")

        return db_project

    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        print(f"[ProjectRoutes] Failed to create project: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to create project")


@router.get("/{org_id}", response_model=List[ProjectGetBase])
async def get_all_projects(
    org_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    use_cache: bool = Query(True, description="Whether to use Redis cache")
):
    """Get all projects for an organization (filtered by user access)."""
    try:
        user_uid = current_user.uid if hasattr(current_user, 'uid') else current_user.get('uid')
        perm_service = PermissionService(db)
        
        # Check if user has org-wide project.read permission
        has_org_read = perm_service.has_permission(
            user_uid=user_uid,
            permission_code="project.read",
            org_id=org_id,
            scope="org",
            resource_id=org_id,
        )
        
        if has_org_read:
            # User can see all projects in org
            if use_cache:
                cached = await RedisProjectService.get_cached_org_projects(org_id)
                if cached is not None:
                    print(f"[API] Returning {len(cached)} projects from cache for org {org_id}")
                    return [ProjectGetBase(**p) for p in cached]

            print(f"[API] Cache miss for org {org_id}, fetching from DB")
            projects = db.query(Project).filter(Project.org_id == org_id).all()
            if projects:
                await RedisProjectService.cache_org_projects(org_id, projects)
            return projects
        
        # Get only projects user has specific access to
        print(f"[API] Filtering projects by user access for {user_uid}")
        
        project_assignments = db.query(UserRoleAssignment).filter(
            UserRoleAssignment.user_uid == user_uid,
            UserRoleAssignment.scope == AssignmentScope.project,
        ).all()
        
        accessible_project_ids = {a.resource_id for a in project_assignments}
        org_projects = db.query(Project).filter(Project.org_id == org_id).all()

        return [
            project for project in org_projects
            if project.project_id in accessible_project_ids
            or _project_has_visible_member(project, user_uid)
        ]

    except Exception as e:
        print(f"[ProjectRoutes] Failed to get projects: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve projects")


@router.get(
    "/{org_id}/{project_id}",
    response_model=ProjectGetBase,
    dependencies=[
        Depends(
            require_permission(
                "project.read",
                scope=AssignmentScope.project,
                resource_param="project_id",
            )
        )
    ],
)
async def get_project_by_id(
    org_id: str,
    project_id: str,
    db: Session = Depends(get_db),
    use_cache: bool = Query(True, description="Whether to use Redis cache")
):
    """Get a single project by ID."""
    try:
        if use_cache:
            cached = await RedisProjectService.get_cached_project(org_id, project_id)
            if cached is not None:
                print(f"[API] Returning project from cache: {project_id}")
                return ProjectGetBase(**cached)

        print(f"[API] Cache miss for project {project_id}, fetching from DB")
        project = _ensure_project(db, org_id, project_id)
        
        if project:
            await RedisProjectService.cache_project(project)
        
        return project

    except HTTPException:
        raise
    except Exception as e:
        print(f"[ProjectRoutes] Failed to get project: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve project")


@router.patch(
    "/{org_id}/{project_id}",
    response_model=ProjectGetBase,
    dependencies=[
        Depends(
            require_permission(
                "project.update",
                scope=AssignmentScope.project,
                resource_param="project_id",
            )
        )
    ],
)
async def update_project(
    org_id: str,
    project_id: str,
    data: ProjectUpdate,
    db: Session = Depends(get_db)
):
    """Update project and log meaningful changes."""
    try:
        project = _ensure_project(db, org_id, project_id)

        before = {
            "name": project.name,
            "description": project.description,
            "start_date": project.start_date,
            "due_date": project.due_date,
            "priority": project.priority,
            "category": project.category,
            "is_active": project.is_active,
            "status": project.status,
        }

        update_data = data.model_dump(exclude_unset=True)
        for k, v in update_data.items():
            setattr(project, k, v)

        db.commit()
        db.refresh(project)
        touch_project(db, project)

        await RedisProjectService.invalidate_project_cache(org_id, project_id)
        await RedisProjectService.cache_project(project)

        # Detect & log notable changes
        changes: list[str] = []
        if "name" in update_data and before["name"] != project.name:
            changes.append(f"name '{before['name']}' → '{project.name}'")
        if "due_date" in update_data and before["due_date"] != project.due_date:
            changes.append("due date updated")
        if "start_date" in update_data and before["start_date"] != project.start_date:
            changes.append("start date updated")
        if "priority" in update_data and before["priority"] != project.priority:
            changes.append(f"priority → {project.priority}")
        if "category" in update_data and before["category"] != project.category:
            changes.append(f"category → {project.category}")
        if "is_active" in update_data and before["is_active"] != project.is_active:
            changes.append("archived" if not project.is_active else "unarchived")
        if "status" in update_data and before["status"] != project.status:
            changes.append(f"status {before['status']} → {project.status}")
            project = _append_system_milestone(
                db, project,
                title=f"Status changed to '{project.status}'",
                note=f"Previous: '{before['status']}'"
            )
            await _refresh_project_cache(org_id, project)

        if changes:
            msg = f"Project updated: {', '.join(changes)}"
            await _log_activity(org_id, project_id, msg)

        return project

    except HTTPException:
        raise
    except Exception as e:
        print(f"[ProjectRoutes] Failed to update project: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to update project")


@router.delete(
    "/{org_id}/{project_id}",
    dependencies=[
        Depends(
            require_permission(
                "project.delete",
                scope=AssignmentScope.project,
                resource_param="project_id",
            )
        )
    ],
)
async def delete_project(
    org_id: str, 
    project_id: str, 
    db: Session = Depends(get_db),
):
    """Delete a project + cleanup caches + activity."""
    try:
        project = _ensure_project(db, org_id, project_id)
        project_name = project.name

        db.delete(project)
        db.commit()

        await RedisProjectService.invalidate_project_cache(org_id, project_id)
        await RedisProjectService.invalidate_org_projects_cache(org_id)

        await _log_activity(org_id, project_id, f"Project '{project_name}' deleted")
        return {"detail": "Project deleted successfully"}

    except HTTPException:
        raise
    except Exception as e:
        print(f"[ProjectRoutes] Failed to delete project: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to delete project")


# =====================================================
# UNIFIED MEMBER & ACCESS MANAGEMENT
# =====================================================

@router.get("/{org_id}/{project_id}/members")
async def list_members(
    org_id: str,
    project_id: str,
    db: Session = Depends(get_db),
    dependencies=[
        Depends(
            require_permission(
                "project.member.read",
                scope=AssignmentScope.project,
                resource_param="project_id",
            )
        )
    ],
):
    """Get visible project members list."""
    p = _ensure_project(db, org_id, project_id)
    return p.members or []


@router.post("/{org_id}/{project_id}/members")
async def add_member(
    org_id: str,
    project_id: str,
    payload: AddMemberRequest,
    db: Session = Depends(get_db),
    dependencies=[
        Depends(
            require_permission(
                "project.member.update",
                scope=AssignmentScope.project,
                resource_param="project_id",
            )
        )
    ],
):
    """
    Unified endpoint to add member and/or grant access.
    
    - Always creates RBAC permission assignment
    - Optionally adds to visible members list (visible_in_team flag)
    - Handles both team membership and access-only scenarios
    """
    project = _ensure_project(db, org_id, project_id)
    
    # Verify user exists
    user = db.query(User).filter(User.uid == payload.uid).first()
    if not user:
        raise HTTPException(404, f"User '{payload.uid}' not found")
    
    try:
        # STEP 1: Always assign RBAC role (grants permissions)
        assignment = _assign_project_role(
            db=db,
            user_uid=payload.uid,
            project_id=project_id,
            role_name=payload.role,
            org_id=org_id
        )
        
        # STEP 2: Optionally manage visible membership
        action = "access_granted"
        member_data = None
        
        if payload.visible_in_team:
            members = project.members or []
            existing = next((m for m in members if m.get("uid") == payload.uid), None)
            
            member_data = {
                "uid": payload.uid,
                "email": user.email,
                "role": payload.role,
                "status": payload.status,
                "joined_at": (payload.joined_at or now_utc()).isoformat(),
            }
            
            if existing:
                # Update existing member
                members = [member_data if m.get("uid") == payload.uid else m for m in members]
                action = "member_updated"
            else:
                # Add new member
                members.append(member_data)
                action = "member_added"
            
            project.members = members
            db.commit()
            db.refresh(project)
            
            # Add milestone for visible members
            project = _append_system_milestone(
                db, project,
                title=f"Member {action}: {payload.uid}",
                note=f"Role: {payload.role}"
            )
        
        # STEP 3: Cache & activity logging
        await _refresh_project_cache(org_id, project)
        
        log_message = (
            f"Member '{payload.uid}' {action} with role '{payload.role}'"
            if payload.visible_in_team
            else f"Access granted to '{payload.uid}' with role '{payload.role}' (not visible in team)"
        )
        await _log_activity(org_id, project_id, log_message)
        
        return {
            "ok": True,
            "action": action,
            "user_uid": payload.uid,
            "role": payload.role,
            "visible_in_team": payload.visible_in_team,
            "assignment_id": assignment.id,
            "member_data": member_data,
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"[add_member] Error: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to add member: {str(e)}"
        )


@router.patch("/{org_id}/{project_id}/members/{uid}")
async def update_member(
    org_id: str,
    project_id: str,
    uid: str,
    patch: Dict[str, Any],
    db: Session = Depends(get_db),
    dependencies=[
        Depends(
            require_permission(
                "project.member.update",
                scope=AssignmentScope.project,
                resource_param="project_id",
            )
        )
    ],
):
    """
    Update member details and/or role.
    
    - Updates visible member data if present
    - Updates RBAC role if role changed
    """
    project = _ensure_project(db, org_id, project_id)
    members = project.members or []
    
    # Find member in visible list
    member = next((m for m in members if m.get("uid") == uid), None)
    
    # Check if user has RBAC access even if not visible
    rbac_assignment = db.query(UserRoleAssignment).filter(
        UserRoleAssignment.user_uid == uid,
        UserRoleAssignment.scope == AssignmentScope.project,
        UserRoleAssignment.resource_id == project_id,
    ).first()
    
    if not member and not rbac_assignment:
        raise HTTPException(404, "User not found in project (neither visible member nor has access)")
    
    old_role = member.get("role") if member else None
    new_role = patch.get("role")
    
    try:
        actions = []
        
        # Update RBAC role if changed
        if new_role and new_role != old_role:
            _update_project_role(
                db=db,
                user_uid=uid,
                project_id=project_id,
                new_role_name=new_role,
                org_id=org_id
            )
            actions.append(f"role_changed_{old_role}_to_{new_role}")
        
        # Update visible member data if exists
        if member:
            for k, v in patch.items():
                if k in {"role", "status"}:
                    member[k] = v
            
            project.members = members
            db.commit()
            db.refresh(project)
            actions.append("member_data_updated")
            
            project = _append_system_milestone(
                db, project,
                title=f"Member updated: {uid}",
                note=f"Changes: {patch}"
            )
        
        # Cache & logging
        await _refresh_project_cache(org_id, project)
        
        if new_role and new_role != old_role:
            await _log_activity(
                org_id, 
                project_id, 
                f"Member '{uid}' role changed: {old_role} → {new_role}"
            )
        else:
            await _log_activity(org_id, project_id, f"Member '{uid}' updated")
        
        return {
            "ok": True,
            "user_uid": uid,
            "actions": actions,
            "updated_member": member,
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"[update_member] Error: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to update member: {str(e)}"
        )


@router.delete("/{org_id}/{project_id}/members/{uid}")
async def remove_member(
    org_id: str,
    project_id: str,
    uid: str,
    remove_from_team: bool = Query(True, description="Remove from visible members list"),
    revoke_permissions: bool = Query(True, description="Revoke RBAC permissions"),
    db: Session = Depends(get_db),
    dependencies=[
        Depends(
            require_permission(
                "project.member.update",
                scope=AssignmentScope.project,
                resource_param="project_id",
            )
        )
    ],
):
    """
    Unified endpoint to remove member and/or revoke access.
    
    Options:
    - remove_from_team=true, revoke_permissions=true: Full removal (default)
    - remove_from_team=true, revoke_permissions=false: Hide from team but keep access
    - remove_from_team=false, revoke_permissions=true: Keep visible but remove permissions
    """
    project = _ensure_project(db, org_id, project_id)
    
    actions = []
    
    try:
        # STEP 1: Optionally remove from visible members list
        if remove_from_team:
            before = len(project.members or [])
            project.members = [m for m in (project.members or []) if m.get("uid") != uid]
            
            if len(project.members or []) < before:
                db.commit()
                db.refresh(project)
                actions.append("removed_from_team")
                
                project = _append_system_milestone(
                    db, project,
                    title=f"Member removed: {uid}"
                )
            else:
                if not revoke_permissions:
                    raise HTTPException(404, "Member not found in team")
        
        # STEP 2: Optionally revoke RBAC permissions
        if revoke_permissions:
            removed = _remove_project_role(
                db=db,
                user_uid=uid,
                project_id=project_id,
                org_id=org_id
            )
            
            if removed:
                actions.append("permissions_revoked")
            else:
                if not remove_from_team:
                    raise HTTPException(404, "User does not have RBAC access to this project")
        
        if not actions:
            raise HTTPException(404, "No action taken - user not found")
        
        # STEP 3: Cache & activity logging
        await _refresh_project_cache(org_id, project)
        
        action_desc = " and ".join(actions)
        await _log_activity(org_id, project_id, f"User '{uid}' {action_desc}")
        
        return {
            "ok": True,
            "user_uid": uid,
            "actions": actions,
            "message": f"Successfully {action_desc}"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"[remove_member] Error: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to remove member: {str(e)}"
        )


@router.post("/{org_id}/{project_id}/members/bulk", response_model=BulkAddMembersResponse)
async def bulk_add_members(
    org_id: str,
    project_id: str,
    payload: BulkAddMembersRequest,
    visible_in_team: bool = Query(True, description="Add to visible members list"),
    db: Session = Depends(get_db),
    redis: RedisClient = Depends(get_redis_optional),
    current_user: dict = Depends(get_current_user),
    dependencies=[
        Depends(
            require_permission(
                "project.member.update",
                scope=AssignmentScope.project,
                resource_param="project_id",
            )
        )
    ],
):
    """
    Bulk add members with unified logic.
    Controls visibility via visible_in_team query parameter.
    """
    project = _ensure_project(db, org_id, project_id)
    
    existing_members = {m.get("uid") for m in (project.members or [])}
    
    added = 0
    skipped = 0
    details = []
    new_members = list(project.members or [])
    
    for uid in payload.user_uids:
        if visible_in_team and uid in existing_members:
            skipped += 1
            details.append({
                "uid": uid,
                "status": "skipped",
                "reason": "already_member"
            })
            continue
        
        user = db.query(User).filter(User.uid == uid).first()
        if not user:
            skipped += 1
            details.append({
                "uid": uid,
                "status": "skipped",
                "reason": "user_not_found"
            })
            continue
        
        try:
            # Always assign RBAC role
            _assign_project_role(
                db=db,
                user_uid=uid,
                project_id=project_id,
                role_name=payload.role,
                org_id=org_id
            )
            
            # Optionally add to visible list
            if visible_in_team:
                new_members.append({
                    "uid": uid,
                    "email": user.email,
                    "role": payload.role,
                    "status": "active",
                    "joined_at": now_utc().isoformat()
                })
            
            added += 1
            details.append({
                "uid": uid,
                "status": "added",
                "role": payload.role,
                "visible": visible_in_team
            })
            
        except Exception as e:
            skipped += 1
            details.append({
                "uid": uid,
                "status": "error",
                "reason": str(e)
            })
    
    if added > 0:
        if visible_in_team:
            project.members = new_members
        
        project.updated_at = now_utc()
        db.commit()
        db.refresh(project)
        
        visibility_note = "to team" if visible_in_team else "with access only"
        project = _append_system_milestone(
            db, project,
            title=f"Bulk add: {added} members {visibility_note}",
            note=f"Role: {payload.role}"
        )
        
        await _refresh_project_cache(org_id, project)
        await _log_activity(
            org_id, 
            project_id, 
            f"Bulk added {added} members with role '{payload.role}' ({visibility_note})"
        )
    
    return BulkAddMembersResponse(
        added=added,
        skipped=skipped,
        details=details
    )


# =====================================================
# ACCESS INFORMATION ENDPOINTS
# =====================================================

@router.get("/{org_id}/{project_id}/access")
async def get_project_access_list(
    org_id: str,
    project_id: str,
    db: Session = Depends(get_db),
    dependencies=[
        Depends(
            require_permission(
                "project.member.read",
                scope=AssignmentScope.project,
                resource_param="project_id",
            )
        )
    ],
):
    """
    Get all users who have access to this project and their roles.
    Shows both project members and RBAC assignments.
    """
    project = _ensure_project(db, org_id, project_id)
    
    # Get RBAC assignments for this project
    assignments = db.query(UserRoleAssignment).join(
        Role, UserRoleAssignment.role_id == Role.id
    ).filter(
        UserRoleAssignment.scope == AssignmentScope.project,
        UserRoleAssignment.resource_id == project_id,
    ).all()
    
    access_list = []
    for assignment in assignments:
        role = db.query(Role).filter(Role.id == assignment.role_id).first()
        user = db.query(User).filter(User.uid == assignment.user_uid).first()
        
        # Find corresponding member entry
        member = next(
            (m for m in (project.members or []) if m.get("uid") == assignment.user_uid),
            None
        )
        
        access_list.append({
            "user_uid": assignment.user_uid,
            "email": user.email if user else "unknown",
            "display_name": user.display_name if user else "Unknown User",
            "role": role.name if role else "unknown",
            "assigned_at": assignment.created_at.isoformat() if assignment.created_at else None,
            "visible_in_team": member is not None,
            "member_info": member,
        })
    
    return {
        "project_id": project_id,
        "project_name": project.name,
        "access_count": len(access_list),
        "access_list": access_list,
    }


@router.get("/user/{user_uid}/accessible")
async def get_user_accessible_projects(
    user_uid: str,
    org_id: str = Query(...),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    Get all projects a user has access to in an organization.
    Based on RBAC project-level role assignments.
    """
    requester_uid = current_user.get("uid")
    
    # Users can view their own accessible projects
    # Or admins can view anyone's
    if requester_uid != user_uid:
        perm_service = PermissionService(db)
        is_admin = perm_service.has_permission(
            user_uid=requester_uid,
            permission_code="rbac.view_assignments",
            org_id=org_id,
            scope="org",
            resource_id=org_id,
        )
        if not is_admin:
            raise HTTPException(403, "You can only view your own accessible projects")
    
    # Get project-scoped assignments for this user
    assignments = db.query(UserRoleAssignment).filter(
        UserRoleAssignment.user_uid == user_uid,
        UserRoleAssignment.scope == AssignmentScope.project,
    ).all()
    
    project_ids = [a.resource_id for a in assignments]
    
    # Get the actual projects
    projects = db.query(Project).filter(
        Project.org_id == org_id,
        Project.project_id.in_(project_ids)
    ).all() if project_ids else []
    
    return {
        "user_uid": user_uid,
        "org_id": org_id,
        "accessible_project_count": len(projects),
        "projects": projects,
    }


# =====================================================
# PROGRESS TRACKING
# =====================================================

@router.post("/{org_id}/{project_id}/progress/recompute")
async def recompute_progress(
    org_id: str,
    project_id: str,
    db: Session = Depends(get_db),
    dependencies=[
        Depends(
            require_permission(
                "project.update",
                scope=AssignmentScope.project,
                resource_param="project_id",
            )
        )
    ],
):
    """
    Recompute and persist project.progress_percent.
    Current heuristic: % of milestones marked done.
    """
    try:
        p = _ensure_project(db, org_id, project_id)

        ms = p.milestones or []
        if ms:
            done = sum(1 for m in ms if bool(m.get("done")))
            progress = int(round((done / len(ms)) * 100))
        else:
            progress = 0

        progress = max(0, min(progress, 100))

        p.progress_percent = progress
        p = touch_and_cache(db, p)

        await _refresh_project_cache(org_id, p)
        await _log_activity(org_id, project_id, f"Progress recomputed → {progress}%")
        await RedisProjectService.invalidate_project_stats_cache(project_id)

        return {"ok": True, "progress_percent": progress}
    except HTTPException:
        raise
    except Exception as e:
        print(f"[ProjectRoutes] Failed to recompute progress: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to recompute progress")


# =====================================================
# MILESTONES
# =====================================================

@router.get("/{org_id}/{project_id}/milestones")
async def list_milestones(org_id: str, project_id: str, db: Session = Depends(get_db)):
    p = _ensure_project(db, org_id, project_id)
    return p.milestones or []


@router.post("/{org_id}/{project_id}/milestones")
async def add_milestone(org_id: str, project_id: str, data: Dict[str, Any], db: Session = Depends(get_db)):
    p = _ensure_project(db, org_id, project_id)
    mid = data.get("id") or str(uuid4())
    m = {
        "id": mid,
        "title": data.get("title", "Untitled"),
        "due": data.get("due") or None,
        "done": bool(data.get("done", False)),
        "note": data.get("note", "")
    }
    p.milestones = (p.milestones or []) + [m]
    p = touch_and_cache(db, p)

    await _refresh_project_cache(org_id, p)
    await _log_activity(org_id, project_id, f"Milestone '{m['title']}' added")
    return m


@router.patch("/{org_id}/{project_id}/milestones/{mid}")
async def patch_milestone(org_id: str, project_id: str, mid: str, patch: Dict[str, Any], db: Session = Depends(get_db)):
    p = _ensure_project(db, org_id, project_id)
    ms = p.milestones or []
    found = False
    for m in ms:
        if m.get("id") == mid:
            m.update({k: v for k, v in patch.items() if k in {"title", "due", "done", "note"}})
            found = True
            break
    if not found:
        raise HTTPException(404, "Milestone not found")
    p.milestones = ms
    p = touch_and_cache(db, p)

    await _refresh_project_cache(org_id, p)
    await _log_activity(org_id, project_id, f"Milestone '{mid}' updated")
    return {"ok": True}


@router.delete("/{org_id}/{project_id}/milestones/{mid}")
async def delete_milestone(org_id: str, project_id: str, mid: str, db: Session = Depends(get_db)):
    p = _ensure_project(db, org_id, project_id)
    before = len(p.milestones or [])
    p.milestones = [m for m in (p.milestones or []) if m.get("id") != mid]
    if len(p.milestones or []) == before:
        raise HTTPException(404, "Milestone not found")
    p = touch_and_cache(db, p)

    await _refresh_project_cache(org_id, p)
    await _log_activity(org_id, project_id, f"Milestone '{mid}' deleted")
    return {"ok": True}


# =====================================================
# TAGS
# =====================================================

@router.patch("/{org_id}/{project_id}/tags")
async def patch_tags(org_id: str, project_id: str, body: TagPatch, db: Session = Depends(get_db)):
    p = _ensure_project(db, org_id, project_id)
    tags_before = set(p.tags or [])
    tags = set(tags_before)
    for t in body.add: tags.add(t)
    for t in body.remove: tags.discard(t)
    p.tags = list(tags)
    p = touch_and_cache(db, p)

    await _refresh_project_cache(org_id, p)
    added = sorted(list(set(p.tags) - tags_before))
    removed = sorted(list(tags_before - set(p.tags)))
    msg_bits = []
    if added: msg_bits.append(f"+{added}")
    if removed: msg_bits.append(f"-{removed}")
    await _log_activity(org_id, project_id, f"Tags updated {' '.join(msg_bits) if msg_bits else '(no change)'}")
    return {"ok": True, "tags": p.tags}


# =====================================================
# ATTACHMENTS
# =====================================================

@router.get("/{org_id}/{project_id}/attachments")
async def list_attachments(org_id: str, project_id: str, db: Session = Depends(get_db)):
    p = _ensure_project(db, org_id, project_id)
    return p.attachments or []


@router.post("/{org_id}/{project_id}/attachments")
async def add_attachment(org_id: str, project_id: str, data: Dict[str, Any], db: Session = Depends(get_db)):
    p = _ensure_project(db, org_id, project_id)
    att = {
        "id": data.get("id") or str(uuid4()),
        "name": data.get("name"),
        "url": data.get("url"),
        "size": data.get("size"),
        "uploaded_at": (data.get("uploaded_at") or now_utc().isoformat()),
        "meta": data.get("meta") or {}
    }
    p.attachments = (p.attachments or []) + [att]
    p = touch_and_cache(db, p)

    await _refresh_project_cache(org_id, p)
    await _log_activity(org_id, project_id, f"Attachment '{att['name']}' added")
    return att


@router.delete("/{org_id}/{project_id}/attachments/{aid}")
async def remove_attachment(org_id: str, project_id: str, aid: str, db: Session = Depends(get_db)):
    p = _ensure_project(db, org_id, project_id)
    before = len(p.attachments or [])
    p.attachments = [a for a in (p.attachments or []) if a.get("id") != aid]
    if len(p.attachments or []) == before:
        raise HTTPException(404, "Attachment not found")
    p = touch_and_cache(db, p)

    await _refresh_project_cache(org_id, p)
    await _log_activity(org_id, project_id, f"Attachment '{aid}' removed")
    return {"ok": True}


# =====================================================
# SURVEYS
# =====================================================

@router.patch("/{org_id}/{project_id}/surveys")
async def patch_surveys(org_id: str, project_id: str, body: SurveyPatch, db: Session = Depends(get_db)):
    p = _ensure_project(db, org_id, project_id)
    s_before = set(p.survey_ids or [])
    s = set(s_before)
    for x in body.add: s.add(x)
    for x in body.remove: s.discard(x)
    p.survey_ids = list(s)
    p = touch_and_cache(db, p)

    await _refresh_project_cache(org_id, p)
    added = sorted(list(set(p.survey_ids) - s_before))
    removed = sorted(list(s_before - set(p.survey_ids)))
    msg_bits = []
    if added: msg_bits.append(f"+{added}")
    if removed: msg_bits.append(f"-{removed}")
    await _log_activity(org_id, project_id, f"Survey links updated {' '.join(msg_bits) if msg_bits else '(no change)'}")
    return {"ok": True, "survey_ids": p.survey_ids}


# =====================================================
# STATUS TRANSITIONS
# =====================================================

VALID_STATUSES = {"planning", "in_progress", "on_hold", "completed", "cancelled"}
ALLOWED = {
    "planning": {"in_progress", "cancelled"},
    "in_progress": {"on_hold", "completed", "cancelled"},
    "on_hold": {"in_progress", "cancelled"},
    "completed": set(),
    "cancelled": set(),
}
ALIASES = { "active": "in_progress", "hold": "on_hold", "done": "completed" }


@router.get("/{org_id}/{project_id}/status/allowed")
async def get_allowed(org_id: str, project_id: str, db: Session = Depends(get_db)):
    p = _ensure_project(db, org_id, project_id)
    cur = p.status or "planning"
    return {
        "current": cur,
        "allowed_next": sorted(list(ALLOWED.get(cur, set()))),
        "valid_statuses": sorted(list(VALID_STATUSES)),
    }


@router.post("/{org_id}/{project_id}/status")
async def set_status(
    org_id: str,
    project_id: str,
    body: StatusChange,
    db: Session = Depends(get_db),
    force: bool = Query(False)
):
    p = _ensure_project(db, org_id, project_id)
    cur = p.status or "planning"
    nxt = ALIASES.get(body.status, body.status)

    if nxt not in VALID_STATUSES:
        raise HTTPException(
            422,
            detail={
                "error": "invalid_status",
                "message": f"Unknown status '{nxt}'",
                "requested": nxt,
                "allowed_values": sorted(list(VALID_STATUSES)),
            },
        )

    illegal = nxt not in ALLOWED.get(cur, set()) and nxt != cur
    if illegal and not force:
        raise HTTPException(
            409,
            detail={
                "error": "illegal_transition",
                "message": f"Illegal transition {cur} → {nxt}",
                "current": cur,
                "requested": nxt,
                "allowed_next": sorted(list(ALLOWED.get(cur, set()))),
            },
        )

    reason = getattr(body, "reason", None)
    if illegal and force:
        reason = (reason or "") + " [forced]"

    p.status = nxt
    p = touch_and_cache(db, p)

    await _refresh_project_cache(org_id, p)
    note = f"Reason: {reason}" if reason else None
    p = _append_system_milestone(db, p, title=f"Status changed to '{nxt}'", note=note)
    await _refresh_project_cache(org_id, p)

    await _log_activity(org_id, project_id, f"Status {cur} → {nxt}" + (f" ({reason})" if reason else ""))
    return {"ok": True, "status": p.status, "previous": cur}


# =====================================================
# SEARCH & PAGINATION
# =====================================================

from sqlalchemy import or_
from sqlalchemy import func as safunc


@router.post("/{org_id}/search")
async def search_projects(org_id: str, q: SearchQuery, db: Session = Depends(get_db)):
    qry = db.query(Project).filter(Project.org_id == org_id)
    if q.status: qry = qry.filter(Project.status == q.status)
    if q.priority: qry = qry.filter(Project.priority == q.priority)
    if q.is_active is not None: qry = qry.filter(Project.is_active == q.is_active)
    if q.tag:
        qry = qry.filter(safunc.any_(Project.tags) == q.tag)

    if q.q:
        like = f"%{q.q}%"
        qry = qry.filter(or_(Project.name.ilike(like), Project.description.ilike(like)))

    if q.created_from: qry = qry.filter(Project.created_at >= q.created_from)
    if q.created_to:   qry = qry.filter(Project.created_at < q.created_to)

    col, _, direction = (q.order_by or "updated_at:desc").partition(":")
    colobj = getattr(Project, col, Project.updated_at)
    qry = qry.order_by(colobj.desc() if (direction or "desc").lower() == "desc" else colobj.asc())

    total = qry.count()
    rows = qry.offset(q.offset).limit(min(q.limit, 200)).all()
    return {"total": total, "count": len(rows), "items": rows}


# =====================================================
# TIMELINE
# =====================================================

@router.get("/{org_id}/{project_id}/timeline")
async def project_timeline(org_id: str, project_id: str, db: Session = Depends(get_db)):
    p = _ensure_project(db, org_id, project_id)
    activities = await RedisProjectService.get_recent_activity(org_id, limit=50)
    acts = [a for a in activities if a.get("project_id") == project_id]
    miles = (p.milestones or [])
    return {"milestones": miles, "activities": acts}


# =====================================================
# BULK ACTIONS
# =====================================================

@router.post("/{org_id}/bulk")
async def bulk_actions(org_id: str, body: BulkAction, db: Session = Depends(get_db)):
    updated = []
    for pid in body.project_ids:
        p = db.query(Project).filter(Project.org_id == org_id, Project.project_id == pid).first()
        if not p:
            continue

        did_change = False
        if body.op == "archive":
            if p.is_active:
                p.is_active = False
                did_change = True
                _ = _append_system_milestone(db, p, title="Archived", note="Project archived via bulk action")
                await _log_activity(org_id, pid, "Project archived (bulk)")
        elif body.op == "unarchive":
            if not p.is_active:
                p.is_active = True
                did_change = True
                _ = _append_system_milestone(db, p, title="Unarchived", note="Project unarchived via bulk action")
                await _log_activity(org_id, pid, "Project unarchived (bulk)")
        elif body.op == "delete":
            db.delete(p); db.commit()
            await RedisProjectService.invalidate_project_cache(org_id, pid)
            await _log_activity(org_id, pid, "Project deleted (bulk)")
            continue
        elif body.op == "set_priority" and body.value:
            if p.priority != body.value:
                p.priority = body.value
                did_change = True
                _ = _append_system_milestone(db, p, title=f"Priority set to '{body.value}'", note="Bulk action")
                await _log_activity(org_id, pid, f"Priority → {body.value} (bulk)")
        elif body.op == "set_status" and body.value:
            if p.status != body.value:
                old = p.status
                p.status = body.value
                did_change = True
                _ = _append_system_milestone(db, p, title=f"Status changed to '{body.value}'", note=f"Previous: '{old}' (bulk)")
                await _log_activity(org_id, pid, f"Status {old} → {body.value} (bulk)")

        if did_change:
            db.add(p); db.commit(); db.refresh(p)
            await _refresh_project_cache(org_id, p)
            updated.append(pid)

    await RedisProjectService.invalidate_org_projects_cache(org_id)
    return {"ok": True, "updated": updated}


# =====================================================
# FAVORITES
# =====================================================

@router.post("/{org_id}/favorites/{user_id}/{project_id}")
async def favorite_add(org_id: str, user_id: str, project_id: str, db: Session = Depends(get_db)):
    _ensure_project(db, org_id, project_id)
    ok = await RedisProjectService.add_favorite(user_id, project_id)
    if ok:
        await _log_activity(org_id, project_id, f"Favorited by user '{user_id}'")
    return {"ok": ok}


@router.delete("/{org_id}/favorites/{user_id}/{project_id}")
async def favorite_remove(org_id: str, user_id: str, project_id: str, db: Session = Depends(get_db)):
    _ensure_project(db, org_id, project_id)
    ok = await RedisProjectService.remove_favorite(user_id, project_id)
    if ok:
        await _log_activity(org_id, project_id, f"Favorite removed by user '{user_id}'")
    return {"ok": ok}


@router.get("/{org_id}/favorites/{user_id}")
async def favorite_list(org_id: str, user_id: str, db: Session = Depends(get_db)):
    ids = await RedisProjectService.get_favorites(user_id)
    items = []
    for pid in ids:
        cached = await RedisProjectService.get_cached_project(org_id, pid)
        if cached is not None:
            items.append(cached)
            continue
        p = db.query(Project).filter(Project.org_id == org_id, Project.project_id == pid).first()
        if p:
            items.append(p)
    return {"count": len(items), "items": items}


# =====================================================
# REDIS CACHE MANAGEMENT
# =====================================================

@router.get("/{org_id}/recent-activity")
async def get_recent_activity(
    org_id: str,
    limit: int = Query(20, ge=1, le=100, description="Number of recent activities to return"),
    dependencies=[
        Depends(
            require_permission(
                "project.read",
                scope=AssignmentScope.org,  # Changed to org scope
            )
        )
    ],
):
    """Recent project activities from Redis."""
    try:
        activities = await RedisProjectService.get_recent_activity(org_id, limit)
        return {"org_id": org_id, "recent_activities": activities, "count": len(activities)}
    except Exception as e:
        print(f"[ProjectRoutes] Failed to get recent activity: {e}")
        return {"org_id": org_id, "recent_activities": [], "count": 0, "error": "Failed to retrieve recent activity"}


@router.get("/{org_id}/{project_id}/stats")
async def get_project_stats(
    org_id: str,
    project_id: str,
    db: Session = Depends(get_db),
    dependencies=[
        Depends(
            require_permission(
                "project.read",
                scope=AssignmentScope.project,
                resource_param="project_id",
            )
        )
    ],
):
    """Compute and cache basic stats."""
    try:
        cached = await RedisProjectService.get_cached_project_stats(project_id)
        if cached is not None:
            print(f"[API] Returning stats from cache for project {project_id}")
            return cached

        print(f"[API] Cache miss for stats, computing for project {project_id}")
        project = _ensure_project(db, org_id, project_id)
        stats = {
            "project_id": project_id,
            "member_count": len(project.members) if project.members else 0,
            "survey_count": len(project.survey_ids) if project.survey_ids else 0,
            "progress_percent": project.progress_percent or 0,
            "milestone_count": len(project.milestones) if project.milestones else 0,
            "days_active": (datetime.now() - project.created_at).days if project.created_at else 0,
            "status": project.status,
            "priority": project.priority,
            "is_overdue": bool(project.due_date and datetime.now() > project.due_date),
        }

        await RedisProjectService.cache_project_stats(project_id, stats)
        return stats

    except HTTPException:
        raise
    except Exception as e:
        print(f"[ProjectRoutes] Failed to get project stats: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve project statistics")


@router.post("/{org_id}/cache/invalidate")
async def invalidate_org_cache(org_id: str):
    """Invalidate all project list caches for an org."""
    try:
        success = await RedisProjectService.invalidate_org_projects_cache(org_id)
        return {"success": success, "message": f"Cache invalidated for organization {org_id}" if success else "Failed to invalidate cache"}
    except Exception as e:
        print(f"[ProjectRoutes] Failed to invalidate cache: {e}")
        return {"success": False, "message": "Failed to invalidate cache", "error": str(e)}


@router.post("/{org_id}/{project_id}/cache/refresh")
async def refresh_project_cache(org_id: str, project_id: str, db: Session = Depends(get_db)):
    """Refresh a single project's cache."""
    try:
        project = _ensure_project(db, org_id, project_id)
        await RedisProjectService.invalidate_project_cache(org_id, project_id)
        success = await RedisProjectService.cache_project(project)
        return {"success": success, "message": f"Cache refreshed for project {project_id}" if success else "Failed to refresh cache"}
    except HTTPException:
        raise
    except Exception as e:
        print(f"[ProjectRoutes] Failed to refresh cache: {e}")
        return {"success": False, "message": "Failed to refresh cache", "error": str(e)}
