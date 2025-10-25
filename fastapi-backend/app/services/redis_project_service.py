# app/services/redis_project_service.py
import json
import time
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta

from ..core.redis_client import redis_client
from ..schemas.project import ProjectGetBase, ProjectCreate, ProjectUpdate

# app/services/redis_project_service.py  (add near other KEYs)
FAVORITES_KEY = "projects:favorites:{user_id}"




# app/services/redis_project_service.py
@classmethod
def simple_rate_limit(cls, key: str, max_ops: int, window_s: int) -> bool:
    try:
        if not redis_client.ping(): return True
        now = int(time.time())
        bucket = f"rl:{key}:{now//window_s}"
        v = redis_client.client.incr(bucket)
        if v == 1:
            redis_client.client.expire(bucket, window_s)
        return v <= max_ops
    except:
        return True

class RedisProjectService:
    """Redis service layer for project operations"""
    
    # Cache TTL in seconds
    PROJECT_CACHE_TTL = 3600  # 1 hour
    PROJECTS_LIST_CACHE_TTL = 1800  # 30 minutes
    USER_PROJECTS_CACHE_TTL = 1800  # 30 minutes
    
    # Redis key patterns
    PROJECT_KEY = "project:{org_id}:{project_id}"
    PROJECTS_LIST_KEY = "projects:org:{org_id}"
    USER_PROJECTS_KEY = "projects:user:{user_id}"
    PROJECT_MEMBERS_KEY = "project:members:{project_id}"
    PROJECT_STATS_KEY = "project:stats:{project_id}"
    RECENT_ACTIVITY_KEY = "projects:recent_activity:{org_id}"
    
    @classmethod
    def _serialize_project(cls, project: Any) -> str:
        """Serialize project data for Redis storage"""
        if hasattr(project, 'model_dump'):
            # Pydantic model
            data = project.model_dump()
        elif hasattr(project, '__dict__'):
            # SQLAlchemy model
            data = {}
            for key, value in project.__dict__.items():
                if not key.startswith('_'):
                    if isinstance(value, datetime):
                        data[key] = value.isoformat()
                    else:
                        data[key] = value
        else:
            data = dict(project)
        
        # Handle datetime serialization
        def serialize_datetime(obj):
            if isinstance(obj, datetime):
                return obj.isoformat()
            raise TypeError(f"Object of type {type(obj)} is not JSON serializable")
        
        return json.dumps(data, default=serialize_datetime)
    
    @classmethod
    def _deserialize_project(cls, data: str) -> Dict[str, Any]:
        """Deserialize project data from Redis"""
        project_data = json.loads(data)
        
        # Convert ISO datetime strings back to datetime objects
        datetime_fields = ['created_at', 'updated_at', 'start_date', 'due_date', 'last_activity']
        for field in datetime_fields:
            if field in project_data and project_data[field]:
                try:
                    project_data[field] = datetime.fromisoformat(project_data[field].replace('Z', '+00:00'))
                except (ValueError, AttributeError):
                    pass
        
        return project_data
    
    @classmethod
    async def cache_project(cls, project: Any) -> bool:
        """Cache a single project"""
        try:
            if not redis_client.ping():
                return False
            
            # Determine org_id and project_id
            if hasattr(project, 'org_id'):
                org_id = project.org_id
                project_id = project.project_id
            else:
                org_id = project.get('org_id')
                project_id = project.get('project_id')
            
            key = cls.PROJECT_KEY.format(org_id=org_id, project_id=project_id)
            serialized_data = cls._serialize_project(project)
            
            # Cache the project
            redis_client.client.setex(key, cls.PROJECT_CACHE_TTL, serialized_data)
            
            # Update organization projects list cache
            await cls._update_org_projects_cache(org_id, project_id, 'add')
            
            print(f"[RedisProjectService] Cached project {project_id} for org {org_id}")
            return True
            
        except Exception as e:
            print(f"[RedisProjectService] Failed to cache project: {e}")
            return False
    
    @classmethod
    async def get_cached_project(cls, org_id: str, project_id: str) -> Optional[Dict[str, Any]]:
        """Get a cached project"""
        try:
            if not redis_client.ping():
                return None
            
            key = cls.PROJECT_KEY.format(org_id=org_id, project_id=project_id)
            cached_data = redis_client.client.get(key)
            
            if cached_data:
                print(f"[RedisProjectService] Cache hit for project {project_id}")
                return cls._deserialize_project(cached_data)
            
            print(f"[RedisProjectService] Cache miss for project {project_id}")
            return None
            
        except Exception as e:
            print(f"[RedisProjectService] Failed to get cached project: {e}")
            return None
    
    @classmethod
    async def cache_org_projects(cls, org_id: str, projects: List[Any]) -> bool:
        """Cache all projects for an organization"""
        try:
            if not redis_client.ping():
                return False
            
            # Cache individual projects
            for project in projects:
                await cls.cache_project(project)
            
            # Cache the list of project IDs
            project_ids = []
            for project in projects:
                if hasattr(project, 'project_id'):
                    project_ids.append(project.project_id)
                else:
                    project_ids.append(project.get('project_id'))
            
            list_key = cls.PROJECTS_LIST_KEY.format(org_id=org_id)
            redis_client.client.setex(list_key, cls.PROJECTS_LIST_CACHE_TTL, json.dumps(project_ids))
            
            print(f"[RedisProjectService] Cached {len(projects)} projects for org {org_id}")
            return True
            
        except Exception as e:
            print(f"[RedisProjectService] Failed to cache org projects: {e}")
            return False
    
    @classmethod
    async def get_cached_org_projects(cls, org_id: str) -> Optional[List[Dict[str, Any]]]:
        """Get all cached projects for an organization"""
        try:
            if not redis_client.ping():
                return None
            
            # Get list of project IDs
            list_key = cls.PROJECTS_LIST_KEY.format(org_id=org_id)
            cached_ids = redis_client.client.get(list_key)
            
            if not cached_ids:
                print(f"[RedisProjectService] No cached project list for org {org_id}")
                return None
            
            project_ids = json.loads(cached_ids)
            projects = []
            
            # Get each project
            for project_id in project_ids:
                project = await cls.get_cached_project(org_id, project_id)
                if project:
                    projects.append(project)
            
            print(f"[RedisProjectService] Retrieved {len(projects)} cached projects for org {org_id}")
            return projects if projects else None
            
        except Exception as e:
            print(f"[RedisProjectService] Failed to get cached org projects: {e}")
            return None
    @classmethod
    async def add_favorite(cls, user_id: str, project_id: str) -> bool:
        try:
            if not redis_client.ping():
                return False
            key = cls.FAVORITES_KEY.format(user_id=user_id)
            redis_client.client.sadd(key, project_id)
            # optional TTL to auto-expire favorites set (remove if you want permanent)
            redis_client.client.expire(key, 30 * 24 * 3600)
            return True
        except Exception as e:
            print("[RedisProjectService] add_favorite error:", e)
            return False

    @classmethod
    async def remove_favorite(cls, user_id: str, project_id: str) -> bool:
        try:
            if not redis_client.ping():
                return False
            key = cls.FAVORITES_KEY.format(user_id=user_id)
            redis_client.client.srem(key, project_id)
            return True
        except Exception as e:
            print("[RedisProjectService] remove_favorite error:", e)
            return False

    @classmethod
    async def get_favorites(cls, user_id: str) -> list[str]:
        try:
            if not redis_client.ping():
                return []
            key = cls.FAVORITES_KEY.format(user_id=user_id)
            raw = redis_client.client.smembers(key) or set()
            # smembers returns a set of bytes → decode to str
            out = []
            for v in raw:
                if isinstance(v, bytes):
                    try:
                        out.append(v.decode("utf-8"))
                    except Exception:
                        out.append(str(v))
                else:
                    out.append(str(v))
            return out
        except Exception as e:
            print("[RedisProjectService] get_favorites error:", e)
            return []
    @classmethod
    async def invalidate_project_cache(cls, org_id: str, project_id: str) -> bool:
        """Invalidate project cache"""
        try:
            if not redis_client.ping():
                return False
            
            # Remove individual project cache
            project_key = cls.PROJECT_KEY.format(org_id=org_id, project_id=project_id)
            redis_client.client.delete(project_key)
            
            # Update org projects list cache
            await cls._update_org_projects_cache(org_id, project_id, 'remove')
            
            # Invalidate related caches
            stats_key = cls.PROJECT_STATS_KEY.format(project_id=project_id)
            members_key = cls.PROJECT_MEMBERS_KEY.format(project_id=project_id)
            redis_client.client.delete(stats_key, members_key)
            
            print(f"[RedisProjectService] Invalidated cache for project {project_id}")
            return True
            
        except Exception as e:
            print(f"[RedisProjectService] Failed to invalidate project cache: {e}")
            return False
    
    @classmethod
    async def invalidate_org_projects_cache(cls, org_id: str) -> bool:
        """Invalidate all projects cache for an organization"""
        try:
            if not redis_client.ping():
                return False
            
            # Get all project IDs for this org
            list_key = cls.PROJECTS_LIST_KEY.format(org_id=org_id)
            cached_ids = redis_client.client.get(list_key)
            
            if cached_ids:
                project_ids = json.loads(cached_ids)
                # Delete individual project caches
                keys_to_delete = [cls.PROJECT_KEY.format(org_id=org_id, project_id=pid) for pid in project_ids]
                if keys_to_delete:
                    redis_client.client.delete(*keys_to_delete)
            
            # Delete the org projects list
            redis_client.client.delete(list_key)
            
            print(f"[RedisProjectService] Invalidated all project caches for org {org_id}")
            return True
            
        except Exception as e:
            print(f"[RedisProjectService] Failed to invalidate org projects cache: {e}")
            return False
    
    @classmethod
    async def _update_org_projects_cache(cls, org_id: str, project_id: str, operation: str) -> bool:
        """Update the organization's projects list cache"""
        try:
            list_key = cls.PROJECTS_LIST_KEY.format(org_id=org_id)
            cached_ids = redis_client.client.get(list_key)
            
            if cached_ids:
                project_ids = json.loads(cached_ids)
                
                if operation == 'add' and project_id not in project_ids:
                    project_ids.append(project_id)
                    redis_client.client.setex(list_key, cls.PROJECTS_LIST_CACHE_TTL, json.dumps(project_ids))
                elif operation == 'remove' and project_id in project_ids:
                    project_ids.remove(project_id)
                    if project_ids:
                        redis_client.client.setex(list_key, cls.PROJECTS_LIST_CACHE_TTL, json.dumps(project_ids))
                    else:
                        redis_client.client.delete(list_key)
            
            return True
        except Exception as e:
            print(f"[RedisProjectService] Failed to update org projects cache: {e}")
            return False
    
    @classmethod
    async def cache_project_stats(cls, project_id: str, stats: Dict[str, Any]) -> bool:
        """Cache project statistics"""
        try:
            if not redis_client.ping():
                return False
            
            key = cls.PROJECT_STATS_KEY.format(project_id=project_id)
            redis_client.client.setex(key, cls.PROJECT_CACHE_TTL, json.dumps(stats))
            
            print(f"[RedisProjectService] Cached stats for project {project_id}")
            return True
            
        except Exception as e:
            print(f"[RedisProjectService] Failed to cache project stats: {e}")
            return False
    
    @classmethod
    async def get_cached_project_stats(cls, project_id: str) -> Optional[Dict[str, Any]]:
        """Get cached project statistics"""
        try:
            if not redis_client.ping():
                return None
            
            key = cls.PROJECT_STATS_KEY.format(project_id=project_id)
            cached_data = redis_client.client.get(key)
            
            return json.loads(cached_data) if cached_data else None
            
        except Exception as e:
            print(f"[RedisProjectService] Failed to get cached project stats: {e}")
            return None
    
    @classmethod
    async def add_to_recent_activity(cls, org_id: str, project_id: str, activity: str) -> bool:
        """Add project activity to recent activity list"""
        try:
            if not redis_client.ping():
                return False
            
            key = cls.RECENT_ACTIVITY_KEY.format(org_id=org_id)
            activity_data = {
                'project_id': project_id,
                'activity': activity,
                'timestamp': datetime.now().isoformat()
            }
            
            # Add to list (keep only recent 50 activities)
            redis_client.client.lpush(key, json.dumps(activity_data))
            redis_client.client.ltrim(key, 0, 49)  # Keep only 50 recent activities
            redis_client.client.expire(key, 86400)  # Expire in 1 day
            
            return True
            
        except Exception as e:
            print(f"[RedisProjectService] Failed to add recent activity: {e}")
            return False
    
    @classmethod
    async def get_recent_activity(cls, org_id: str, limit: int = 20) -> List[Dict[str, Any]]:
        """Get recent project activities"""
        try:
            if not redis_client.ping():
                return []
            
            key = cls.RECENT_ACTIVITY_KEY.format(org_id=org_id)
            activities = redis_client.client.lrange(key, 0, limit - 1)
            
            return [json.loads(activity) for activity in activities]
            
        except Exception as e:
            print(f"[RedisProjectService] Failed to get recent activity: {e}")
            return []