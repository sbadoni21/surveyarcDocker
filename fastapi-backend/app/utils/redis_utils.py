# app/utils/redis_utils.py
import json
import time
from typing import Dict, List, Any, Optional
from datetime import datetime, timedelta

from ..core.redis_client import redis_client


class RedisHealthCheck:
    """Redis health check and monitoring utilities"""
    
    @staticmethod
    def is_redis_available() -> bool:
        """Check if Redis is available and responding"""
        try:
            return redis_client.ping()
        except Exception as e:
            print(f"[RedisHealthCheck] Redis not available: {e}")
            return False
    
    @staticmethod
    def get_redis_info() -> Dict[str, Any]:
        """Get detailed Redis information"""
        try:
            if not redis_client.ping():
                return {"status": "disconnected", "error": "Redis not responding"}
            
            info = redis_client.client.info()
            return {
                "status": "connected",
                "redis_version": info.get("redis_version", "unknown"),
                "connected_clients": info.get("connected_clients", 0),
                "used_memory_human": info.get("used_memory_human", "unknown"),
                "total_commands_processed": info.get("total_commands_processed", 0),
                "keyspace_hits": info.get("keyspace_hits", 0),
                "keyspace_misses": info.get("keyspace_misses", 0),
                "hit_ratio": round(
                    (info.get("keyspace_hits", 0) / max(
                        info.get("keyspace_hits", 0) + info.get("keyspace_misses", 0), 1
                    )) * 100, 2
                ),
                "uptime_in_seconds": info.get("uptime_in_seconds", 0),
                "server_time": datetime.now().isoformat()
            }
        except Exception as e:
            return {"status": "error", "error": str(e)}
    
    @staticmethod
    def get_cache_statistics(pattern: str = "project:*") -> Dict[str, Any]:
        """Get cache statistics for project-related keys"""
        try:
            if not redis_client.ping():
                return {"error": "Redis not available"}
            
            keys = redis_client.client.keys(pattern)
            total_keys = len(keys)
            
            # Sample some keys to get size estimates
            sample_size = min(10, total_keys)
            total_size = 0
            
            for key in keys[:sample_size]:
                try:
                    size = redis_client.client.memory_usage(key)
                    if size:
                        total_size += size
                except:
                    pass
            
            avg_key_size = total_size / max(sample_size, 1)
            estimated_total_size = avg_key_size * total_keys
            
            return {
                "pattern": pattern,
                "total_keys": total_keys,
                "estimated_total_size_bytes": int(estimated_total_size),
                "estimated_total_size_human": f"{estimated_total_size / 1024:.2f} KB",
                "average_key_size_bytes": int(avg_key_size),
                "sample_size": sample_size,
                "timestamp": datetime.now().isoformat()
            }
        except Exception as e:
            return {"error": str(e)}


class RedisProjectAnalytics:
    """Analytics and insights based on Redis cached data"""
    
    ANALYTICS_KEY = "analytics:projects:{org_id}"
    ANALYTICS_TTL = 7200  # 2 hours
    
    @classmethod
    async def update_project_analytics(cls, org_id: str, project_data: Dict[str, Any]) -> bool:
        """Update project analytics in Redis"""
        try:
            if not redis_client.ping():
                return False
            
            key = cls.ANALYTICS_KEY.format(org_id=org_id)
            
            # Get existing analytics or create new
            existing_data = redis_client.client.get(key)
            analytics = json.loads(existing_data) if existing_data else {
                "org_id": org_id,
                "total_projects": 0,
                "active_projects": 0,
                "completed_projects": 0,
                "total_members": 0,
                "average_progress": 0,
                "status_distribution": {},
                "priority_distribution": {},
                "last_updated": datetime.now().isoformat()
            }
            
            # Update analytics based on project data
            status = project_data.get('status', 'unknown')
            priority = project_data.get('priority', 'unknown')
            progress = project_data.get('progress_percent', 0)
            members_count = len(project_data.get('members', []))
            
            # Update counters
            analytics['total_projects'] = analytics.get('total_projects', 0) + 1
            
            if status == 'active':
                analytics['active_projects'] = analytics.get('active_projects', 0) + 1
            elif status == 'completed':
                analytics['completed_projects'] = analytics.get('completed_projects', 0) + 1
            
            analytics['total_members'] = analytics.get('total_members', 0) + members_count
            
            # Update distributions
            status_dist = analytics.get('status_distribution', {})
            status_dist[status] = status_dist.get(status, 0) + 1
            analytics['status_distribution'] = status_dist
            
            priority_dist = analytics.get('priority_distribution', {})
            priority_dist[priority] = priority_dist.get(priority, 0) + 1
            analytics['priority_distribution'] = priority_dist
            
            # Calculate average progress
            current_total = analytics.get('total_projects', 1)
            current_avg = analytics.get('average_progress', 0)
            analytics['average_progress'] = ((current_avg * (current_total - 1)) + progress) / current_total
            
            analytics['last_updated'] = datetime.now().isoformat()
            
            # Cache updated analytics
            redis_client.client.setex(key, cls.ANALYTICS_TTL, json.dumps(analytics))
            
            return True
            
        except Exception as e:
            print(f"[RedisProjectAnalytics] Failed to update analytics: {e}")
            return False
    
    @classmethod
    async def get_project_analytics(cls, org_id: str) -> Optional[Dict[str, Any]]:
        """Get project analytics from Redis"""
        try:
            if not redis_client.ping():
                return None
            
            key = cls.ANALYTICS_KEY.format(org_id=org_id)
            cached_data = redis_client.client.get(key)
            
            if cached_data:
                return json.loads(cached_data)
            
            return None
            
        except Exception as e:
            print(f"[RedisProjectAnalytics] Failed to get analytics: {e}")
            return None


class RedisBatchOperations:
    """Batch operations for Redis to improve performance"""
    
    @staticmethod
    async def batch_cache_projects(projects_data: List[Dict[str, Any]]) -> Dict[str, bool]:
        """Cache multiple projects in a single pipeline operation"""
        try:
            if not redis_client.ping():
                return {}
            
            pipe = redis_client.client.pipeline()
            results = {}
            
            for project in projects_data:
                org_id = project.get('org_id')
                project_id = project.get('project_id')
                
                if org_id and project_id:
                    key = f"project:{org_id}:{project_id}"
                    
                    # Serialize project data
                    def serialize_datetime(obj):
                        if isinstance(obj, datetime):
                            return obj.isoformat()
                        raise TypeError(f"Object of type {type(obj)} is not JSON serializable")
                    
                    serialized_data = json.dumps(project, default=serialize_datetime)
                    pipe.setex(key, 3600, serialized_data)  # 1 hour TTL
                    results[project_id] = True
                else:
                    results[project.get('project_id', 'unknown')] = False
            
            # Execute pipeline
            pipe.execute()
            print(f"[RedisBatchOperations] Batch cached {len(projects_data)} projects")
            
            return results
            
        except Exception as e:
            print(f"[RedisBatchOperations] Batch cache operation failed: {e}")
            return {project.get('project_id', 'unknown'): False for project in projects_data}
    
    @staticmethod
    async def batch_invalidate_projects(org_id: str, project_ids: List[str]) -> bool:
        """Invalidate multiple project caches in a single operation"""
        try:
            if not redis_client.ping() or not project_ids:
                return False
            
            pipe = redis_client.client.pipeline()
            
            # Add all keys to pipeline for deletion
            keys_to_delete = [f"project:{org_id}:{pid}" for pid in project_ids]
            pipe.delete(*keys_to_delete)
            
            # Also delete related caches
            for project_id in project_ids:
                stats_key = f"project:stats:{project_id}"
                members_key = f"project:members:{project_id}"
                pipe.delete(stats_key, members_key)
            
            # Execute pipeline
            pipe.execute()
            print(f"[RedisBatchOperations] Batch invalidated {len(project_ids)} projects")
            
            return True
            
        except Exception as e:
            print(f"[RedisBatchOperations] Batch invalidate operation failed: {e}")
            return False


class RedisKeyManager:
    """Manage Redis keys and cleanup operations"""
    
    @staticmethod
    def get_all_project_keys(pattern: str = "project:*") -> List[str]:
        """Get all project-related Redis keys"""
        try:
            if not redis_client.ping():
                return []
            
            return [key.decode() if isinstance(key, bytes) else key for key in redis_client.client.keys(pattern)]
            
        except Exception as e:
            print(f"[RedisKeyManager] Failed to get keys: {e}")
            return []
    
    @staticmethod
    def cleanup_expired_keys(dry_run: bool = True) -> Dict[str, Any]:
        """Clean up expired or orphaned keys"""
        try:
            if not redis_client.ping():
                return {"error": "Redis not available"}
            
            project_keys = RedisKeyManager.get_all_project_keys()
            expired_keys = []
            
            for key in project_keys:
                ttl = redis_client.client.ttl(key)
                if ttl == -1:  # No expiration set
                    expired_keys.append(key)
            
            if not dry_run and expired_keys:
                # Set TTL for keys without expiration
                pipe = redis_client.client.pipeline()
                for key in expired_keys:
                    pipe.expire(key, 3600)  # Set 1 hour TTL
                pipe.execute()
            
            return {
                "total_keys": len(project_keys),
                "keys_without_ttl": len(expired_keys),
                "action": "would set TTL" if dry_run else "set TTL",
                "dry_run": dry_run
            }
            
        except Exception as e:
            return {"error": str(e)}


# Utility functions for route integration
async def ensure_redis_available(operation_name: str = "Redis operation") -> bool:
    """Ensure Redis is available for operations"""
    if not RedisHealthCheck.is_redis_available():
        print(f"[RedisUtils] {operation_name} skipped - Redis not available")
        return False
    return True


async def safe_redis_operation(operation_func, *args, **kwargs):
    """Safely execute Redis operations with error handling"""
    try:
        if not await ensure_redis_available(operation_func.__name__):
            return None
        
        return await operation_func(*args, **kwargs)
    
    except Exception as e:
        print(f"[RedisUtils] Safe operation failed for {operation_func.__name__}: {e}")
        return None