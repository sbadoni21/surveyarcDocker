# app/routes/project.py
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any

from ..db import get_db
from ..models.project import Project
from ..schemas.project import ProjectCreate, ProjectUpdate, ProjectBase, ProjectGetBase,ProjectMember, Milestone, Attachment, StatusChange, TagPatch, SurveyPatch, SearchQuery, BulkAction
from ..services.redis_project_service import RedisProjectService
from datetime import datetime, timezone
from uuid import uuid4

router = APIRouter(prefix="/projects", tags=["Projects"])


def now_utc():
    return datetime.now(tz=timezone.utc)

def touch_project(db, project):
    project.last_activity = now_utc()
    project.updated_at = project.updated_at or now_utc()  # keep updated_at fresh too
    db.add(project)
    
def touch_and_cache(db: Session, project: Project):
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

@router.post("/", response_model=ProjectBase)
async def create_project(data: ProjectCreate, db: Session = Depends(get_db)):
    """Create a new project with Redis caching"""
    try:
        # Create project in database
        db_project = Project(**data.model_dump())
        db.add(db_project)
        db.commit()
        db.refresh(db_project)
        
        # Cache the project in Redis
        await RedisProjectService.cache_project(db_project)
        
        # Invalidate org projects cache since we added a new project
        await RedisProjectService.invalidate_org_projects_cache(data.org_id)
        
        # Add to recent activity
        await RedisProjectService.add_to_recent_activity(
            data.org_id, 
            data.project_id, 
            f"Project '{data.name}' created"
        )
        
        return db_project
        
    except Exception as e:
        print(f"[ProjectRoutes] Failed to create project: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to create project")


@router.get("/{org_id}", response_model=List[ProjectGetBase])
async def get_all_projects(
    org_id: str, 
    db: Session = Depends(get_db),
    use_cache: bool = Query(True, description="Whether to use Redis cache")
):
    """Get all projects for an organization with Redis caching"""
    try:
        # Try to get from cache first
        if use_cache:
            cached_projects = await RedisProjectService.get_cached_org_projects(org_id)
            if cached_projects:
                print(f"[ProjectRoutes] Returning {len(cached_projects)} projects from cache")
                return [ProjectGetBase(**project) for project in cached_projects]
        
        # If not in cache, get from database
        print(f"[ProjectRoutes] Getting projects from database for org {org_id}")
        projects = db.query(Project).filter(Project.org_id == org_id).all()
        
        # Cache the results
        if projects:
            await RedisProjectService.cache_org_projects(org_id, projects)
        
        return projects
        
    except Exception as e:
        print(f"[ProjectRoutes] Failed to get projects: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve projects")


@router.get("/{org_id}/{project_id}", response_model=ProjectGetBase)
async def get_project(
    org_id: str, 
    project_id: str, 
    db: Session = Depends(get_db),
    use_cache: bool = Query(True, description="Whether to use Redis cache")
):
    """Get a specific project with Redis caching"""
    try:
        # Try to get from cache first
        if use_cache:
            cached_project = await RedisProjectService.get_cached_project(org_id, project_id)
            if cached_project:
                print(f"[ProjectRoutes] Returning project {project_id} from cache")
                return ProjectGetBase(**cached_project)
        
        # If not in cache, get from database
        print(f"[ProjectRoutes] Getting project {project_id} from database")
        project = db.query(Project).filter(
            Project.project_id == project_id, 
            Project.org_id == org_id
        ).first()
        
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        
        # Cache the project
        await RedisProjectService.cache_project(project)
        
        return project
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"[ProjectRoutes] Failed to get project: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve project")


@router.patch("/{org_id}/{project_id}", response_model=ProjectBase)
async def update_project(
    org_id: str, 
    project_id: str, 
    data: ProjectUpdate, 
    db: Session = Depends(get_db)
):
    """Update a project with Redis cache invalidation"""
    try:
        # Get project from database
        project = db.query(Project).filter(
            Project.project_id == project_id, 
            Project.org_id == org_id
        ).first()
        
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        
        # Store old name for activity tracking
        old_name = project.name
        
        # Update project
        update_data = data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(project, key, value)
        
        db.commit()
        db.refresh(project)
        touch_project(db, project)

        # Invalidate and update cache
        await RedisProjectService.invalidate_project_cache(org_id, project_id)
        await RedisProjectService.cache_project(project)
        
        # Add to recent activity
        activity_msg = f"Project '{old_name}' updated"
        if 'name' in update_data:
            activity_msg = f"Project renamed from '{old_name}' to '{update_data['name']}'"
        
        await RedisProjectService.add_to_recent_activity(org_id, project_id, activity_msg)
        
        return project
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"[ProjectRoutes] Failed to update project: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to update project")


@router.delete("/{org_id}/{project_id}")
async def delete_project(org_id: str, project_id: str, db: Session = Depends(get_db)):
    """Delete a project with Redis cache cleanup"""
    try:
        # Get project from database
        project = db.query(Project).filter(
            Project.project_id == project_id, 
            Project.org_id == org_id
        ).first()
        
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        
        project_name = project.name
        
        # Delete from database
        db.delete(project)
        db.commit()
        
        # Clean up all related caches
        await RedisProjectService.invalidate_project_cache(org_id, project_id)
        await RedisProjectService.invalidate_org_projects_cache(org_id)
        
        # Add to recent activity
        await RedisProjectService.add_to_recent_activity(
            org_id, 
            project_id, 
            f"Project '{project_name}' deleted"
        )
        
        return {"detail": "Project deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"[ProjectRoutes] Failed to delete project: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to delete project")


# Additional Redis-specific endpoints

@router.get("/{org_id}/recent-activity")
async def get_recent_activity(
    org_id: str, 
    limit: int = Query(20, ge=1, le=100, description="Number of recent activities to return")
):
    """Get recent project activities from Redis"""
    try:
        activities = await RedisProjectService.get_recent_activity(org_id, limit)
        return {
            "org_id": org_id,
            "recent_activities": activities,
            "count": len(activities)
        }
        
    except Exception as e:
        print(f"[ProjectRoutes] Failed to get recent activity: {e}")
        return {
            "org_id": org_id,
            "recent_activities": [],
            "count": 0,
            "error": "Failed to retrieve recent activity"
        }


@router.get("/{org_id}/{project_id}/stats")
async def get_project_stats(org_id: str, project_id: str, db: Session = Depends(get_db)):
    """Get project statistics with Redis caching"""
    try:
        # Try to get from cache first
        cached_stats = await RedisProjectService.get_cached_project_stats(project_id)
        if cached_stats:
            return cached_stats
        
        # Calculate stats from database
        project = db.query(Project).filter(
            Project.project_id == project_id,
            Project.org_id == org_id
        ).first()
        
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        
        stats = {
            "project_id": project_id,
            "member_count": len(project.members) if project.members else 0,
            "survey_count": len(project.survey_ids) if project.survey_ids else 0,
            "progress_percent": project.progress_percent or 0,
            "milestone_count": len(project.milestones) if project.milestones else 0,
            "days_active": (datetime.now() - project.created_at).days if project.created_at else 0,
            "status": project.status,
            "priority": project.priority,
            "is_overdue": project.due_date and datetime.now() > project.due_date if project.due_date else False
        }
        
        # Cache the stats
        await RedisProjectService.cache_project_stats(project_id, stats)
        
        return stats
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"[ProjectRoutes] Failed to get project stats: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve project statistics")


@router.post("/{org_id}/cache/invalidate")
async def invalidate_org_cache(org_id: str):
    """Manually invalidate all project caches for an organization"""
    try:
        success = await RedisProjectService.invalidate_org_projects_cache(org_id)
        return {
            "success": success,
            "message": f"Cache invalidated for organization {org_id}" if success else "Failed to invalidate cache"
        }
        
    except Exception as e:
        print(f"[ProjectRoutes] Failed to invalidate cache: {e}")
        return {
            "success": False,
            "message": "Failed to invalidate cache",
            "error": str(e)
        }


@router.post("/{org_id}/{project_id}/cache/refresh")
async def refresh_project_cache(org_id: str, project_id: str, db: Session = Depends(get_db)):
    """Manually refresh cache for a specific project"""
    try:
        # Get fresh data from database
        project = db.query(Project).filter(
            Project.project_id == project_id,
            Project.org_id == org_id
        ).first()
        
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        
        # Invalidate old cache and set new cache
        await RedisProjectService.invalidate_project_cache(org_id, project_id)
        success = await RedisProjectService.cache_project(project)
        
        return {
            "success": success,
            "message": f"Cache refreshed for project {project_id}" if success else "Failed to refresh cache"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"[ProjectRoutes] Failed to refresh cache: {e}")
        return {
            "success": False,
            "message": "Failed to refresh cache",
            "error": str(e)
        }

# ---------- Members ----------
@router.get("/{org_id}/{project_id}/members")
async def list_members(org_id: str, project_id: str, db: Session = Depends(get_db)):
    p = _ensure_project(db, org_id, project_id)
    return p.members or []

@router.post("/{org_id}/{project_id}/members")
async def add_member(org_id: str, project_id: str, member: ProjectMember, db: Session = Depends(get_db)):
    p = _ensure_project(db, org_id, project_id)
    members = p.members or []
    # replace if exists
    members = [m for m in members if m.get("uid") != member.uid]
    m = member.model_dump()
    m["joined_at"] = (member.joined_at or now_utc()).isoformat()
    members.append(m)
    p.members = members
    p = touch_and_cache(db, p)
    await RedisProjectService.invalidate_project_cache(org_id, project_id)
    await RedisProjectService.cache_project(p)
    await RedisProjectService.add_to_recent_activity(org_id, project_id, f"Member '{member.uid}' added")
    return {"ok": True, "members": p.members}

@router.patch("/{org_id}/{project_id}/members/{uid}")
async def update_member(org_id: str, project_id: str, uid: str, patch: Dict[str, Any], db: Session = Depends(get_db)):
    p = _ensure_project(db, org_id, project_id)
    members = p.members or []
    found = False
    for m in members:
        if m.get("uid") == uid:
            m.update({k: v for k, v in patch.items() if k in {"role","status"}})
            found = True
            break
    if not found:
        raise HTTPException(404, "Member not found")
    p.members = members
    p = touch_and_cache(db, p)
    await RedisProjectService.invalidate_project_cache(org_id, project_id)
    await RedisProjectService.cache_project(p)
    await RedisProjectService.add_to_recent_activity(org_id, project_id, f"Member '{uid}' updated")
    return {"ok": True, "members": p.members}

@router.delete("/{org_id}/{project_id}/members/{uid}")
async def remove_member(org_id: str, project_id: str, uid: str, db: Session = Depends(get_db)):
    p = _ensure_project(db, org_id, project_id)
    before = len(p.members or [])
    p.members = [m for m in (p.members or []) if m.get("uid") != uid]
    if len(p.members or []) == before:
        raise HTTPException(404, "Member not found")
    p = touch_and_cache(db, p)
    await RedisProjectService.invalidate_project_cache(org_id, project_id)
    await RedisProjectService.cache_project(p)
    await RedisProjectService.add_to_recent_activity(org_id, project_id, f"Member '{uid}' removed")
    return {"ok": True}

# ---------- Milestones ----------
@router.get("/{org_id}/{project_id}/milestones")
async def list_milestones(org_id: str, project_id: str, db: Session = Depends(get_db)):
    p = _ensure_project(db, org_id, project_id)
    return p.milestones or []

@router.post("/{org_id}/{project_id}/milestones")
async def add_milestone(org_id: str, project_id: str, data: Dict[str, Any], db: Session = Depends(get_db)):
    p = _ensure_project(db, org_id, project_id)
    ms = p.milestones or []
    mid = data.get("id") or str(uuid4())
    m = {
        "id": mid,
        "title": data.get("title", "Untitled"),
        "due": (data.get("due") or None),
        "done": bool(data.get("done", False)),
        "note": data.get("note", "")
    }
    ms.append(m)
    p.milestones = ms
    p = touch_and_cache(db, p)
    await RedisProjectService.invalidate_project_cache(org_id, project_id)
    await RedisProjectService.cache_project(p)
    await RedisProjectService.add_to_recent_activity(org_id, project_id, f"Milestone '{m['title']}' added")
    return m

@router.patch("/{org_id}/{project_id}/milestones/{mid}")
async def patch_milestone(org_id: str, project_id: str, mid: str, patch: Dict[str, Any], db: Session = Depends(get_db)):
    p = _ensure_project(db, org_id, project_id)
    ms = p.milestones or []
    found = False
    for m in ms:
        if m.get("id") == mid:
            m.update({k: v for k, v in patch.items() if k in {"title","due","done","note"}})
            found = True
            break
    if not found:
        raise HTTPException(404, "Milestone not found")
    p.milestones = ms
    p = touch_and_cache(db, p)
    await RedisProjectService.invalidate_project_cache(org_id, project_id)
    await RedisProjectService.cache_project(p)
    await RedisProjectService.add_to_recent_activity(org_id, project_id, f"Milestone '{mid}' updated")
    return {"ok": True}

@router.delete("/{org_id}/{project_id}/milestones/{mid}")
async def delete_milestone(org_id: str, project_id: str, mid: str, db: Session = Depends(get_db)):
    p = _ensure_project(db, org_id, project_id)
    before = len(p.milestones or [])
    p.milestones = [m for m in (p.milestones or []) if m.get("id") != mid]
    if len(p.milestones or []) == before:
        raise HTTPException(404, "Milestone not found")
    p = touch_and_cache(db, p)
    await RedisProjectService.invalidate_project_cache(org_id, project_id)
    await RedisProjectService.cache_project(p)
    await RedisProjectService.add_to_recent_activity(org_id, project_id, f"Milestone '{mid}' deleted")
    return {"ok": True}

# ---------- Tags ----------
@router.patch("/{org_id}/{project_id}/tags")
async def patch_tags(org_id: str, project_id: str, body: TagPatch, db: Session = Depends(get_db)):
    p = _ensure_project(db, org_id, project_id)
    tags = set(p.tags or [])
    for t in body.add: tags.add(t)
    for t in body.remove: tags.discard(t)
    p.tags = list(tags)
    p = touch_and_cache(db, p)
    await RedisProjectService.invalidate_project_cache(org_id, project_id)
    await RedisProjectService.cache_project(p)
    return {"ok": True, "tags": p.tags}

# ---------- Attachments ----------
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
    await RedisProjectService.invalidate_project_cache(org_id, project_id)
    await RedisProjectService.cache_project(p)
    await RedisProjectService.add_to_recent_activity(org_id, project_id, f"Attachment '{att['name']}' added")
    return att

@router.delete("/{org_id}/{project_id}/attachments/{aid}")
async def remove_attachment(org_id: str, project_id: str, aid: str, db: Session = Depends(get_db)):
    p = _ensure_project(db, org_id, project_id)
    before = len(p.attachments or [])
    p.attachments = [a for a in (p.attachments or []) if a.get("id") != aid]
    if len(p.attachments or []) == before:
        raise HTTPException(404, "Attachment not found")
    p = touch_and_cache(db, p)
    await RedisProjectService.invalidate_project_cache(org_id, project_id)
    await RedisProjectService.cache_project(p)
    await RedisProjectService.add_to_recent_activity(org_id, project_id, f"Attachment '{aid}' removed")
    return {"ok": True}

# ---------- Survey links ----------
@router.patch("/{org_id}/{project_id}/surveys")
async def patch_surveys(org_id: str, project_id: str, body: SurveyPatch, db: Session = Depends(get_db)):
    p = _ensure_project(db, org_id, project_id)
    s = set(p.survey_ids or [])
    for x in body.add: s.add(x)
    for x in body.remove: s.discard(x)
    p.survey_ids = list(s)
    p = touch_and_cache(db, p)
    await RedisProjectService.invalidate_project_cache(org_id, project_id)
    await RedisProjectService.cache_project(p)
    return {"ok": True, "survey_ids": p.survey_ids}

# ---------- Status transitions ----------
VALID_STATUSES = {"planning", "in_progress", "on_hold", "completed", "cancelled"}

ALLOWED = {
    "planning": {"in_progress", "cancelled"},
    "in_progress": {"on_hold", "completed", "cancelled"},
    "on_hold": {"in_progress", "cancelled"},
    "completed": set(),
    "cancelled": set(),
}

# UI aliases → canonical
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



from fastapi import Query

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

    await RedisProjectService.invalidate_project_cache(org_id, project_id)
    await RedisProjectService.cache_project(p)
    await RedisProjectService.add_to_recent_activity(
        org_id, project_id, f"Status {cur} → {nxt}" + (f" ({reason})" if reason else "")
    )
    return {"ok": True, "status": p.status, "previous": cur}

# ---------- Search & pagination ----------
from sqlalchemy import and_, or_
from sqlalchemy import func as safunc
from sqlalchemy.dialects.postgresql import array

@router.post("/{org_id}/search")
async def search_projects(org_id: str, q: SearchQuery, db: Session = Depends(get_db)):
    qry = db.query(Project).filter(Project.org_id == org_id)
    if q.status: qry = qry.filter(Project.status == q.status)
    if q.priority: qry = qry.filter(Project.priority == q.priority)
    if q.is_active is not None: qry = qry.filter(Project.is_active == q.is_active)
    if q.tag:
        # tags is ARRAY(String) → use ANY
        qry = qry.filter(safunc.any_(Project.tags) == q.tag)  # works as tags @> ARRAY[q.tag] in spirit

    if q.q:
        like = f"%{q.q}%"
        qry = qry.filter(or_(Project.name.ilike(like), Project.description.ilike(like)))

    if q.created_from: qry = qry.filter(Project.created_at >= q.created_from)
    if q.created_to:   qry = qry.filter(Project.created_at < q.created_to)

    # order_by
    col, _, direction = (q.order_by or "updated_at:desc").partition(":")
    colobj = getattr(Project, col, Project.updated_at)
    if (direction or "desc").lower() == "desc":
        qry = qry.order_by(colobj.desc())
    else:
        qry = qry.order_by(colobj.asc())

    total = qry.count()
    rows = qry.offset(q.offset).limit(min(q.limit, 200)).all()
    return {"total": total, "count": len(rows), "items": rows}

# ---------- Timeline (milestones + recent activity) ----------
@router.get("/{org_id}/{project_id}/timeline")
async def project_timeline(org_id: str, project_id: str, db: Session = Depends(get_db)):
    p = _ensure_project(db, org_id, project_id)
    activities = await RedisProjectService.get_recent_activity(org_id, limit=50)
    # filter only this project
    acts = [a for a in activities if a.get("project_id") == project_id]
    miles = (p.milestones or [])
    return {
        "milestones": miles,
        "activities": acts
    }

# ---------- Bulk actions ----------
@router.post("/{org_id}/bulk")
async def bulk_actions(org_id: str, body: BulkAction, db: Session = Depends(get_db)):
    updated = []
    for pid in body.project_ids:
        p = db.query(Project).filter(Project.org_id==org_id, Project.project_id==pid).first()
        if not p: continue
        if body.op == "archive":
            p.is_active = False
        elif body.op == "unarchive":
            p.is_active = True
        elif body.op == "delete":
            db.delete(p); db.commit()
            await RedisProjectService.invalidate_project_cache(org_id, pid)
            continue
        elif body.op == "set_priority" and body.value:
            p.priority = body.value
        elif body.op == "set_status" and body.value:
            p.status = body.value
        db.add(p); db.commit(); db.refresh(p)
        await RedisProjectService.invalidate_project_cache(org_id, pid)
        await RedisProjectService.cache_project(p)
        updated.append(pid)
    # org list cache likely stale
    await RedisProjectService.invalidate_org_projects_cache(org_id)
    return {"ok": True, "updated": updated}

# app/routes/project_extras.py  (append)
@router.post("/{org_id}/favorites/{user_id}/{project_id}")
async def favorite_add(org_id: str, user_id: str, project_id: str, db: Session = Depends(get_db)):
    # optional: verify project exists in org
    _ensure_project(db, org_id, project_id)
    ok = await RedisProjectService.add_favorite(user_id, project_id)
    return {"ok": ok}

@router.delete("/{org_id}/favorites/{user_id}/{project_id}")
async def favorite_remove(org_id: str, user_id: str, project_id: str, db: Session = Depends(get_db)):
    _ensure_project(db, org_id, project_id)
    ok = await RedisProjectService.remove_favorite(user_id, project_id)
    return {"ok": ok}

@router.get("/{org_id}/favorites/{user_id}")
async def favorite_list(org_id: str, user_id: str, db: Session = Depends(get_db)):
    ids = await RedisProjectService.get_favorites(user_id)
    # return lightweight cards (hydrate from cache/DB)
    items = []
    for pid in ids:
        cached = await RedisProjectService.get_cached_project(org_id, pid)
        if cached:
            items.append(cached); continue
        p = db.query(Project).filter(Project.org_id==org_id, Project.project_id==pid).first()
        if p: items.append(p)
    return {"count": len(items), "items": items}
