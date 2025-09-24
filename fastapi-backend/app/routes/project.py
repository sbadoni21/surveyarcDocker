# app/routes/project.py
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any

from ..db import get_db
from ..models.project import Project
from ..schemas.project import ProjectCreate, ProjectUpdate, ProjectBase, ProjectGetBase
from ..services.redis_project_service import RedisProjectService


router = APIRouter(prefix="/projects", tags=["Projects"])


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