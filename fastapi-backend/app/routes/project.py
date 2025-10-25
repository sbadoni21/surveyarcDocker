# app/routes/project.py
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
from uuid import uuid4

from ..db import get_db
from ..models.project import Project
from ..schemas.project import (
    ProjectCreate, ProjectUpdate, ProjectBase, ProjectGetBase,
    ProjectMember, StatusChange, TagPatch, SurveyPatch,
    SearchQuery, BulkAction
)
from ..services.redis_project_service import RedisProjectService

router = APIRouter(prefix="/projects", tags=["Projects"])


# ----------------- helpers -----------------
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


# ----------------- CRUD -----------------
@router.post("/", response_model=ProjectBase)
async def create_project(data: ProjectCreate, db: Session = Depends(get_db)):
    """Create a new project with activity + initial milestone + cache."""
    try:
        db_project = Project(**data.model_dump())
        db.add(db_project)
        db.commit()
        db.refresh(db_project)

        # Seed milestone + activity
        db_project = _append_system_milestone(
            db, db_project,
            title="Project created",
            note=f"Created with status '{db_project.status or 'planning'}'."
        )
        await _log_activity(data.org_id, data.project_id, f"Project '{data.name}' created")

        # Cache + invalidate org list
        await _refresh_project_cache(data.org_id, db_project)
        await RedisProjectService.invalidate_org_projects_cache(data.org_id)

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
    """Get all projects for an organization (cached)."""
    try:
        if use_cache:
            cached = await RedisProjectService.get_cached_org_projects(org_id)
            if cached:
                return [ProjectGetBase(**p) for p in cached]

        projects = db.query(Project).filter(Project.org_id == org_id).all()
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
    """Get one project (cached)."""
    try:
        if use_cache:
            cached = await RedisProjectService.get_cached_project(org_id, project_id)
            if cached:
                return ProjectGetBase(**cached)

        project = _ensure_project(db, org_id, project_id)
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
            "status": project.status,  # status dedicated endpoint exists, but track if PATCH uses it
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
        # If status changed via PATCH (even though dedicated endpoint exists)
        if "status" in update_data and before["status"] != project.status:
            changes.append(f"status {before['status']} → {project.status}")
            # Add a milestone for status change
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


@router.delete("/{org_id}/{project_id}")
async def delete_project(org_id: str, project_id: str, db: Session = Depends(get_db)):
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


# ----------------- Redis add-ons -----------------
@router.get("/{org_id}/recent-activity")
async def get_recent_activity(
    org_id: str,
    limit: int = Query(20, ge=1, le=100, description="Number of recent activities to return")
):
    """Recent project activities from Redis."""
    try:
        activities = await RedisProjectService.get_recent_activity(org_id, limit)
        return {"org_id": org_id, "recent_activities": activities, "count": len(activities)}
    except Exception as e:
        print(f"[ProjectRoutes] Failed to get recent activity: {e}")
        return {"org_id": org_id, "recent_activities": [], "count": 0, "error": "Failed to retrieve recent activity"}


@router.get("/{org_id}/{project_id}/stats")
async def get_project_stats(org_id: str, project_id: str, db: Session = Depends(get_db)):
    """Compute and cache basic stats."""
    try:
        cached = await RedisProjectService.get_cached_project_stats(project_id)
        if cached:
            return cached

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


# ----------------- Members -----------------
@router.get("/{org_id}/{project_id}/members")
async def list_members(org_id: str, project_id: str, db: Session = Depends(get_db)):
    p = _ensure_project(db, org_id, project_id)
    return p.members or []


@router.post("/{org_id}/{project_id}/members")
async def add_member(org_id: str, project_id: str, member: ProjectMember, db: Session = Depends(get_db)):
    p = _ensure_project(db, org_id, project_id)
    members = p.members or []
    members = [m for m in members if m.get("uid") != member.uid]  # replace if exists
    m = member.model_dump()
    m["joined_at"] = (member.joined_at or now_utc()).isoformat()
    members.append(m)
    p.members = members

    p = _append_system_milestone(db, p, title=f"Member added: {member.uid}", note=f"Role: {m.get('role', 'contributor')}")
    await _refresh_project_cache(org_id, p)
    await _log_activity(org_id, project_id, f"Member '{member.uid}' added")
    return {"ok": True, "members": p.members}
# ----------------- Progress recompute -----------------
@router.post("/{org_id}/{project_id}/progress/recompute")
async def recompute_progress(org_id: str, project_id: str, db: Session = Depends(get_db)):
    """
    Recompute and persist project.progress_percent.
    Current heuristic: % of milestones marked done.
    Extend this if you also compute from tasks, surveys, etc.
    """
    try:
        p = _ensure_project(db, org_id, project_id)

        # --- compute ---
        ms = p.milestones or []
        if ms:
            done = sum(1 for m in ms if bool(m.get("done")))
            progress = int(round((done / len(ms)) * 100))
        else:
            progress = 0

        # clamp 0..100 just in case
        progress = max(0, min(progress, 100))

        # --- persist ---
        p.progress_percent = progress
        p = touch_and_cache(db, p)

        # cache + activity
        await _refresh_project_cache(org_id, p)
        await _log_activity(org_id, project_id, f"Progress recomputed → {progress}%")

        # also invalidate cached stats if you use them
        await RedisProjectService.invalidate_project_stats_cache(project_id)

        return {"ok": True, "progress_percent": progress}
    except HTTPException:
        raise
    except Exception as e:
        print(f"[ProjectRoutes] Failed to recompute progress: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to recompute progress")


@router.patch("/{org_id}/{project_id}/members/{uid}")
async def update_member(org_id: str, project_id: str, uid: str, patch: Dict[str, Any], db: Session = Depends(get_db)):
    p = _ensure_project(db, org_id, project_id)
    members = p.members or []
    found = False
    for m in members:
        if m.get("uid") == uid:
            m.update({k: v for k, v in patch.items() if k in {"role", "status"}})
            found = True
            break
    if not found:
        raise HTTPException(404, "Member not found")

    p.members = members
    p = _append_system_milestone(db, p, title=f"Member updated: {uid}", note=f"Patch: { {k:v for k,v in patch.items() if k in {'role','status'}} }")
    await _refresh_project_cache(org_id, p)
    await _log_activity(org_id, project_id, f"Member '{uid}' updated")
    return {"ok": True, "members": p.members}


@router.delete("/{org_id}/{project_id}/members/{uid}")
async def remove_member(org_id: str, project_id: str, uid: str, db: Session = Depends(get_db)):
    p = _ensure_project(db, org_id, project_id)
    before = len(p.members or [])
    p.members = [m for m in (p.members or []) if m.get("uid") != uid]
    if len(p.members or []) == before:
        raise HTTPException(404, "Member not found")

    p = _append_system_milestone(db, p, title=f"Member removed: {uid}")
    await _refresh_project_cache(org_id, p)
    await _log_activity(org_id, project_id, f"Member '{uid}' removed")
    return {"ok": True}


# ----------------- Milestones (manual) -----------------
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


# ----------------- Tags -----------------
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


# ----------------- Attachments -----------------
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


# ----------------- Surveys -----------------
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


# ----------------- Status transitions -----------------
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


# ----------------- Search & pagination -----------------
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


# ----------------- Timeline (milestones + recent activity) -----------------
@router.get("/{org_id}/{project_id}/timeline")
async def project_timeline(org_id: str, project_id: str, db: Session = Depends(get_db)):
    p = _ensure_project(db, org_id, project_id)
    activities = await RedisProjectService.get_recent_activity(org_id, limit=50)
    acts = [a for a in activities if a.get("project_id") == project_id]
    miles = (p.milestones or [])
    return {"milestones": miles, "activities": acts}


# ----------------- Bulk actions -----------------
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


# ----------------- Favorites -----------------
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
        if cached:
            items.append(cached)
            continue
        p = db.query(Project).filter(Project.org_id == org_id, Project.project_id == pid).first()
        if p:
            items.append(p)
    return {"count": len(items), "items": items}
