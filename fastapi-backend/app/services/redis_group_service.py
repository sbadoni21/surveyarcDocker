# app/services/redis_group_service.py
import json
from typing import Any, Dict, List, Optional
from ..core.redis_client import redis_client

class RedisGroupService:
    GROUP_TTL = 600
    MEMBERS_TTL = 600
    LIST_TTL = 300

    GROUP_KEY = "sg:{group_id}"
    ORG_LIST_KEY = "sglist:{org_id}"
    MEMBERS_KEY = "sgmembers:{group_id}"

    @classmethod
    def _ping(cls): 
        try: return redis_client.ping()
        except Exception: return False

    @classmethod
    def cache_group(cls, group: Dict[str, Any]) -> None:
        if not cls._ping(): return
        gid = group.get("group_id")
        if not gid: return
        redis_client.client.setex(cls.GROUP_KEY.format(group_id=gid), cls.GROUP_TTL, json.dumps(group))

    @classmethod
    def get_group(cls, group_id: str) -> Optional[Dict[str, Any]]:
        if not cls._ping(): return None
        blob = redis_client.client.get(cls.GROUP_KEY.format(group_id=group_id))
        return json.loads(blob) if blob else None

    @classmethod
    def cache_org_list(cls, org_id: str, groups: List[Dict[str, Any]]) -> None:
        if not cls._ping(): return
        redis_client.client.setex(cls.ORG_LIST_KEY.format(org_id=org_id), cls.LIST_TTL, json.dumps(groups))

    @classmethod
    def get_org_list(cls, org_id: str) -> Optional[List[Dict[str, Any]]]:
        if not cls._ping(): return None
        blob = redis_client.client.get(cls.ORG_LIST_KEY.format(org_id=org_id))
        return json.loads(blob) if blob else None

    @classmethod
    def cache_members(cls, group_id: str, members: List[Dict[str, Any]]) -> None:
        if not cls._ping(): return
        redis_client.client.setex(cls.MEMBERS_KEY.format(group_id=group_id), cls.MEMBERS_TTL, json.dumps(members))

    @classmethod
    def get_members(cls, group_id: str) -> Optional[List[Dict[str, Any]]]:
        if not cls._ping(): return None
        blob = redis_client.client.get(cls.MEMBERS_KEY.format(group_id=group_id))
        return json.loads(blob) if blob else None

    @classmethod
    def invalidate_group(cls, group_id: str) -> None:
        if not cls._ping(): return
        redis_client.client.delete(cls.GROUP_KEY.format(group_id=group_id))
        redis_client.client.delete(cls.MEMBERS_KEY.format(group_id=group_id))

    @classmethod
    def invalidate_org(cls, org_id: str) -> None:
        if not cls._ping(): return
        redis_client.client.delete(cls.ORG_LIST_KEY.format(org_id=org_id))
