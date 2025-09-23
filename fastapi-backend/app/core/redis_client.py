import redis
import json
import os
from typing import Any, Optional, Union
from dotenv import load_dotenv

load_dotenv()

class RedisClient:
    def __init__(self):
        self.client = redis.Redis(
            host=os.getenv("REDIS_HOST", "localhost"),
            port=int(os.getenv("REDIS_PORT", 6379)),
            db=int(os.getenv("REDIS_DB", 0)),
            username=os.getenv("REDIS_USERNAME"),
            password=os.getenv("REDIS_PASSWORD"),
            decode_responses=True,
            ssl=False,  # Adjust based on your Redis setup
            socket_connect_timeout=5,
            socket_timeout=5
        )
    
    def ping(self) -> bool:
        """Test Redis connection"""
        try:
            return self.client.ping()
        except Exception:
            return False
    
    # Cache methods for survey data
    def cache_survey(self, survey_id: int, survey_data: dict, expire: int = 3600):
        """Cache survey data (1 hour default expiry)"""
        key = f"survey:{survey_id}"
        self.client.setex(key, expire, json.dumps(survey_data))
    
    def get_cached_survey(self, survey_id: int) -> Optional[dict]:
        """Get cached survey data"""
        key = f"survey:{survey_id}"
        cached = self.client.get(key)
        return json.loads(cached) if cached else None
    
    def cache_survey_responses(self, survey_id: int, responses: list, expire: int = 1800):
        """Cache survey responses (30 min default expiry)"""
        key = f"survey_responses:{survey_id}"
        self.client.setex(key, expire, json.dumps(responses))
    
    def get_cached_survey_responses(self, survey_id: int) -> Optional[list]:
        """Get cached survey responses"""
        key = f"survey_responses:{survey_id}"
        cached = self.client.get(key)
        return json.loads(cached) if cached else None
    
    # User session management
    def cache_user_session(self, user_id: int, session_data: dict, expire: int = 7200):
        """Cache user session (2 hours default)"""
        key = f"user_session:{user_id}"
        self.client.setex(key, expire, json.dumps(session_data))
    
    def get_user_session(self, user_id: int) -> Optional[dict]:
        """Get user session data"""
        key = f"user_session:{user_id}"
        cached = self.client.get(key)
        return json.loads(cached) if cached else None
    
    def invalidate_user_session(self, user_id: int):
        """Remove user session"""
        key = f"user_session:{user_id}"
        self.client.delete(key)
    
    # Analytics and metrics caching
    def cache_survey_metrics(self, survey_id: int, metrics: dict, expire: int = 900):
        """Cache survey metrics (15 min default)"""
        key = f"survey_metrics:{survey_id}"
        self.client.setex(key, expire, json.dumps(metrics))
    
    def get_cached_survey_metrics(self, survey_id: int) -> Optional[dict]:
        """Get cached survey metrics"""
        key = f"survey_metrics:{survey_id}"
        cached = self.client.get(key)
        return json.loads(cached) if cached else None
    
    # Rate limiting for survey submissions
    def check_rate_limit(self, identifier: str, limit: int = 10, window: int = 60) -> bool:
        """Check if identifier is within rate limit"""
        key = f"rate_limit:{identifier}"
        current = self.client.get(key)
        
        if current is None:
            self.client.setex(key, window, 1)
            return True
        elif int(current) < limit:
            self.client.incr(key)
            return True
        else:
            return False
    
    # Generic cache methods
    def set(self, key: str, value: Any, expire: Optional[int] = None):
        """Set a key-value pair with optional expiry"""
        if expire:
            self.client.setex(key, expire, json.dumps(value) if isinstance(value, (dict, list)) else str(value))
        else:
            self.client.set(key, json.dumps(value) if isinstance(value, (dict, list)) else str(value))
    
    def get(self, key: str) -> Any:
        """Get value by key"""
        value = self.client.get(key)
        if value:
            try:
                return json.loads(value)
            except json.JSONDecodeError:
                return value
        return None
    
    def delete(self, key: str) -> bool:
        """Delete a key"""
        return bool(self.client.delete(key))
    
    def exists(self, key: str) -> bool:
        """Check if key exists"""
        return bool(self.client.exists(key))
    
    def clear_pattern(self, pattern: str):
        """Delete all keys matching pattern"""
        keys = self.client.keys(pattern)
        if keys:
            self.client.delete(*keys)
    
    # Organisation-specific cache methods
    def cache_organisation(self, org_id: str, org_data: dict, expire: int = 3600):
        """Cache organisation data (1 hour default expiry)"""
        key = f"org:{org_id}"
        self.client.setex(key, expire, json.dumps(org_data))
    
    def get_cached_organisation(self, org_id: str) -> Optional[dict]:
        """Get cached organisation data"""
        key = f"org:{org_id}"
        cached = self.client.get(key)
        return json.loads(cached) if cached else None
    
    def cache_organisation_settings(self, org_id: str, settings: dict, expire: int = 7200):
        """Cache organisation theme settings (2 hours default)"""
        key = f"org_settings:{org_id}"
        self.client.setex(key, expire, json.dumps(settings))
    
    def get_cached_organisation_settings(self, org_id: str) -> Optional[dict]:
        """Get cached organisation settings"""
        key = f"org_settings:{org_id}"
        cached = self.client.get(key)
        return json.loads(cached) if cached else None
    
    def cache_owner_organisations(self, owner_uid: str, orgs: list, expire: int = 1800):
        """Cache organisations owned by a user (30 min default)"""
        key = f"owner_orgs:{owner_uid}"
        self.client.setex(key, expire, json.dumps(orgs))
    
    def get_cached_owner_organisations(self, owner_uid: str) -> Optional[list]:
        """Get cached organisations for owner"""
        key = f"owner_orgs:{owner_uid}"
        cached = self.client.get(key)
        return json.loads(cached) if cached else None
    
    def invalidate_organisation_caches(self, org_id: str, owner_uid: str = None):
        """Invalidate all caches related to an organisation"""
        # Delete organisation cache
        self.delete(f"org:{org_id}")
        self.delete(f"org_settings:{org_id}")
        
        # Clear pattern-based caches
        self.clear_pattern(f"org_*:{org_id}")
        
        # Invalidate owner's organisation list if provided
        if owner_uid:
            self.clear_pattern(f"owner_orgs:{owner_uid}*")
    
    def cache_organisation_members(self, org_id: str, members: list, expire: int = 1800):
        """Cache organisation team members (30 min default)"""
        key = f"org_members:{org_id}"
        self.client.setex(key, expire, json.dumps(members))
    
    def get_cached_organisation_members(self, org_id: str) -> Optional[list]:
        """Get cached organisation members"""
        key = f"org_members:{org_id}"
        cached = self.client.get(key)
        return json.loads(cached) if cached else None

# Global Redis client instance
redis_client = RedisClient()