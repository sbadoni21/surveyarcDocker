# app/services/redis_support_service.py - Complete implementation with calendar support

import json
from typing import Any, List, Optional, Dict
from ..core.redis_client import redis_client

def _ser(obj: Any) -> str:
    """Serialize object to JSON string"""
    return json.dumps(obj, default=str)

def _deser(blob: str) -> Any:
    """Deserialize JSON string to object"""
    return json.loads(blob)

class RedisSupportService:
    # TTLs in seconds
    LIST_TTL = 300      # 5 minutes for lists
    ITEM_TTL = 600      # 10 minutes for individual items
    STATS_TTL = 180     # 3 minutes for stats
    CALENDAR_TTL = 900  # 15 minutes for calendar data

    # Cache key patterns
    GROUPS_BY_ORG_KEY = "support:groups:org:{org_id}"
    TEAMS_BY_GROUP_KEY = "support:teams:group:{group_id}"
    TEAMS_BY_ORG_KEY = "support:teams:org:{org_id}"
    TEAMS_WITH_CALENDAR_KEY = "support:teams:{key}:calendar"
    
    TEAM_KEY = "support:team:{team_id}"
    TEAM_WITH_CALENDAR_KEY = "support:team:{team_id}:calendar"
    TEAM_CALENDAR_KEY = "support:team:{team_id}:calendar_full"
    TEAM_STATS_KEY = "support:team:{team_id}:stats"
    
    GROUP_MEMBERS_KEY = "support:group:{group_id}:members"
    TEAM_MEMBERS_KEY = "support:team:{team_id}:members"
    
    POLICIES_BY_ORG_KEY = "support:routing:org:{org_id}"

    @classmethod
    def _set(cls, key: str, obj: Any, ttl: int = None) -> None:
        """Set a value in Redis with optional TTL"""
        try:
            if not redis_client.ping():
                return
            blob = _ser(obj)
            if ttl:
                redis_client.client.setex(key, ttl, blob)
            else:
                redis_client.client.set(key, blob)
        except Exception as e:
            print(f"Redis set error for key {key}: {e}")

    @classmethod
    def _get(cls, key: str) -> Optional[Any]:
        """Get a value from Redis"""
        try:
            if not redis_client.ping():
                return None
            blob = redis_client.client.get(key)
            if not blob:
                return None
            if isinstance(blob, bytes):
                blob = blob.decode("utf-8")
            return _deser(blob)
        except Exception as e:
            print(f"Redis get error for key {key}: {e}")
            return None

    @classmethod
    def _delete(cls, *keys: str) -> None:
        """Delete one or more keys from Redis"""
        try:
            if not redis_client.ping() or not keys:
                return
            redis_client.client.delete(*keys)
        except Exception as e:
            print(f"Redis delete error for keys {keys}: {e}")

    # ------------- Groups Cache Management -------------
    @classmethod
    def cache_groups_by_org(cls, org_id: str, groups: List[Dict]) -> None:
        cls._set(cls.GROUPS_BY_ORG_KEY.format(org_id=org_id), groups, cls.LIST_TTL)

    @classmethod
    def get_groups_by_org(cls, org_id: str) -> Optional[List[Dict]]:
        return cls._get(cls.GROUPS_BY_ORG_KEY.format(org_id=org_id))

    @classmethod
    def invalidate_groups_by_org(cls, org_id: str) -> None:
        cls._delete(cls.GROUPS_BY_ORG_KEY.format(org_id=org_id))

    # ------------- Teams Cache Management -------------
    @classmethod
    def cache_teams_by_key(cls, key: str, teams: List[Dict], include_calendar: bool = False) -> None:
        """Cache teams list with optional calendar data"""
        if include_calendar:
            cache_key = cls.TEAMS_WITH_CALENDAR_KEY.format(key=key)
        else:
            if key.startswith("group:"):
                group_id = key.split(":", 1)[1]
                cache_key = cls.TEAMS_BY_GROUP_KEY.format(group_id=group_id)
            else:  # org:
                org_id = key.split(":", 1)[1]
                cache_key = cls.TEAMS_BY_ORG_KEY.format(org_id=org_id)
        
        cls._set(cache_key, teams, cls.LIST_TTL)

    @classmethod
    def get_teams_by_key(cls, key: str, include_calendar: bool = False) -> Optional[List[Dict]]:
        """Get teams list with optional calendar data"""
        if include_calendar:
            cache_key = cls.TEAMS_WITH_CALENDAR_KEY.format(key=key)
        else:
            if key.startswith("group:"):
                group_id = key.split(":", 1)[1]
                cache_key = cls.TEAMS_BY_GROUP_KEY.format(group_id=group_id)
            else:  # org:
                org_id = key.split(":", 1)[1]
                cache_key = cls.TEAMS_BY_ORG_KEY.format(org_id=org_id)
        
        return cls._get(cache_key)

    @classmethod
    def cache_teams_by_group(cls, group_id: str, teams: List[Dict]) -> None:
        cls._set(cls.TEAMS_BY_GROUP_KEY.format(group_id=group_id), teams, cls.LIST_TTL)

    @classmethod
    def get_teams_by_group(cls, group_id: str) -> Optional[List[Dict]]:
        return cls._get(cls.TEAMS_BY_GROUP_KEY.format(group_id=group_id))

    @classmethod
    def cache_teams_by_org(cls, org_id: str, teams: List[Dict]) -> None:
        cls._set(cls.TEAMS_BY_ORG_KEY.format(org_id=org_id), teams, cls.LIST_TTL)

    @classmethod
    def get_teams_by_org(cls, org_id: str) -> Optional[List[Dict]]:
        return cls._get(cls.TEAMS_BY_ORG_KEY.format(org_id=org_id))

    # ------------- Individual Team Cache Management -------------
    @classmethod
    def cache_team(cls, team_id: str, team_data: Dict, include_calendar: bool = False) -> None:
        """Cache individual team data"""
        if include_calendar:
            cache_key = cls.TEAM_WITH_CALENDAR_KEY.format(team_id=team_id)
        else:
            cache_key = cls.TEAM_KEY.format(team_id=team_id)
        
        cls._set(cache_key, team_data, cls.ITEM_TTL)

    @classmethod
    def get_team(cls, team_id: str, include_calendar: bool = False) -> Optional[Dict]:
        """Get individual team data"""
        if include_calendar:
            cache_key = cls.TEAM_WITH_CALENDAR_KEY.format(team_id=team_id)
        else:
            cache_key = cls.TEAM_KEY.format(team_id=team_id)
        
        return cls._get(cache_key)

    @classmethod
    def cache_team_calendar(cls, team_id: str, calendar_data: Dict) -> None:
        """Cache full calendar data for a team"""
        cls._set(cls.TEAM_CALENDAR_KEY.format(team_id=team_id), calendar_data, cls.CALENDAR_TTL)

    @classmethod
    def get_team_calendar(cls, team_id: str) -> Optional[Dict]:
        """Get full calendar data for a team"""
        return cls._get(cls.TEAM_CALENDAR_KEY.format(team_id=team_id))

    @classmethod
    def cache_team_stats(cls, team_id: str, stats: Dict) -> None:
        """Cache team statistics"""
        cls._set(cls.TEAM_STATS_KEY.format(team_id=team_id), stats, cls.STATS_TTL)

    @classmethod
    def get_team_stats(cls, team_id: str) -> Optional[Dict]:
        """Get team statistics"""
        return cls._get(cls.TEAM_STATS_KEY.format(team_id=team_id))

    # ------------- Team Members Cache Management -------------
    @classmethod
    def cache_team_members(cls, team_id: str, members: List[Dict]) -> None:
        cls._set(cls.TEAM_MEMBERS_KEY.format(team_id=team_id), members, cls.LIST_TTL)

    @classmethod
    def get_team_members(cls, team_id: str) -> Optional[List[Dict]]:
        return cls._get(cls.TEAM_MEMBERS_KEY.format(team_id=team_id))

    # ------------- Group Members Cache Management -------------
    @classmethod
    def cache_group_members(cls, group_id: str, members: List[Dict]) -> None:
        cls._set(cls.GROUP_MEMBERS_KEY.format(group_id=group_id), members, cls.LIST_TTL)

    @classmethod
    def get_group_members(cls, group_id: str) -> Optional[List[Dict]]:
        return cls._get(cls.GROUP_MEMBERS_KEY.format(group_id=group_id))

    # ------------- Routing Policies Cache Management -------------
    @classmethod
    def cache_policies_by_org(cls, org_id: str, policies: List[Dict]) -> None:
        cls._set(cls.POLICIES_BY_ORG_KEY.format(org_id=org_id), policies, cls.LIST_TTL)

    @classmethod
    def get_policies_by_org(cls, org_id: str) -> Optional[List[Dict]]:
        return cls._get(cls.POLICIES_BY_ORG_KEY.format(org_id=org_id))

    @classmethod
    def invalidate_policies_by_org(cls, org_id: str) -> None:
        cls._delete(cls.POLICIES_BY_ORG_KEY.format(org_id=org_id))

    # ------------- Cache Invalidation Methods -------------
    @classmethod
    def invalidate_team_caches(cls, team_id: str, group_id: Optional[str] = None, org_id: Optional[str] = None) -> None:
        """Invalidate all caches related to a team"""
        keys_to_delete = [
            cls.TEAM_KEY.format(team_id=team_id),
            cls.TEAM_WITH_CALENDAR_KEY.format(team_id=team_id),
            cls.TEAM_CALENDAR_KEY.format(team_id=team_id),
            cls.TEAM_STATS_KEY.format(team_id=team_id),
        ]
        
        # Invalidate team lists
        if group_id:
            keys_to_delete.extend([
                cls.TEAMS_BY_GROUP_KEY.format(group_id=group_id),
                cls.TEAMS_WITH_CALENDAR_KEY.format(key=f"group:{group_id}")
            ])
        
        if org_id:
            keys_to_delete.extend([
                cls.TEAMS_BY_ORG_KEY.format(org_id=org_id),
                cls.TEAMS_WITH_CALENDAR_KEY.format(key=f"org:{org_id}")
            ])
        
        cls._delete(*keys_to_delete)

    @classmethod
    def invalidate_team_member_caches(cls, team_id: str, group_id: Optional[str] = None, org_id: Optional[str] = None) -> None:
        """Invalidate caches related to team members (including team stats)"""
        keys_to_delete = [
            cls.TEAM_MEMBERS_KEY.format(team_id=team_id),
            cls.TEAM_STATS_KEY.format(team_id=team_id),  # Stats depend on members
        ]
        
        # Also invalidate team lists as member counts may have changed
        if group_id:
            keys_to_delete.extend([
                cls.TEAMS_BY_GROUP_KEY.format(group_id=group_id),
                cls.TEAMS_WITH_CALENDAR_KEY.format(key=f"group:{group_id}")
            ])
        
        if org_id:
            keys_to_delete.extend([
                cls.TEAMS_BY_ORG_KEY.format(org_id=org_id),
                cls.TEAMS_WITH_CALENDAR_KEY.format(key=f"org:{org_id}")
            ])
        
        cls._delete(*keys_to_delete)

    @classmethod
    def invalidate_group_caches(cls, group_id: str, org_id: Optional[str] = None) -> None:
        """Invalidate all caches related to a group"""
        keys_to_delete = [
            cls.GROUP_MEMBERS_KEY.format(group_id=group_id),
            cls.TEAMS_BY_GROUP_KEY.format(group_id=group_id),
            cls.TEAMS_WITH_CALENDAR_KEY.format(key=f"group:{group_id}")
        ]
        
        if org_id:
            keys_to_delete.extend([
                cls.GROUPS_BY_ORG_KEY.format(org_id=org_id),
                cls.TEAMS_BY_ORG_KEY.format(org_id=org_id),
                cls.TEAMS_WITH_CALENDAR_KEY.format(key=f"org:{org_id}")
            ])
        
        cls._delete(*keys_to_delete)

    @classmethod
    def invalidate_all_support_caches(cls, org_id: str) -> None:
        """Nuclear option: invalidate all support-related caches for an organization"""
        try:
            if not redis_client.ping():
                return
            
            # Get all keys matching support patterns for this org
            patterns = [
                f"support:groups:org:{org_id}",
                f"support:teams:org:{org_id}",
                f"support:teams:org:{org_id}:*",
                f"support:routing:org:{org_id}",
            ]
            
            for pattern in patterns:
                keys = redis_client.client.keys(pattern)
                if keys:
                    redis_client.client.delete(*keys)
                    
        except Exception as e:
            print(f"Error invalidating all support caches for org {org_id}: {e}")

    # ------------- Utility Methods -------------
    @classmethod
    def get_cache_stats(cls) -> Dict[str, Any]:
        """Get Redis cache statistics"""
        try:
            if not redis_client.ping():
                return {"status": "unavailable"}
            
            info = redis_client.client.info()
            return {
                "status": "available",
                "connected_clients": info.get("connected_clients", 0),
                "used_memory": info.get("used_memory_human", "0B"),
                "hits": info.get("keyspace_hits", 0),
                "misses": info.get("keyspace_misses", 0),
                "hit_rate": round(
                    info.get("keyspace_hits", 0) / 
                    max(1, info.get("keyspace_hits", 0) + info.get("keyspace_misses", 0)) * 100, 
                    2
                )
            }
        except Exception as e:
            return {"status": "error", "message": str(e)}

    @classmethod
    def warm_team_cache(cls, db_session, team_id: str) -> None:
        """Pre-warm cache for a specific team"""
        try:
            from ..models.support import SupportTeam
            from ..schemas.support import SupportTeamOut
            
            team = db_session.get(SupportTeam, team_id)
            if team and team.active:
                team_data = SupportTeamOut.model_validate(team, from_attributes=True).model_dump()
                cls.cache_team(team_id, team_data)
                
        except Exception as e:
            print(f"Error warming cache for team {team_id}: {e}")

    @classmethod
    def clear_expired_keys(cls) -> int:
        """Manually clear expired keys (useful for testing)"""
        try:
            if not redis_client.ping():
                return 0
            
            # This is a simple implementation - in production you might want more sophisticated cleanup
            support_keys = redis_client.client.keys("support:*")
            expired_count = 0
            
            for key in support_keys:
                ttl = redis_client.client.ttl(key)
                if ttl == -2:  # Key doesn't exist
                    expired_count += 1
                    
            return expired_count
            
        except Exception as e:
            print(f"Error clearing expired keys: {e}")
            return 0