import json
from typing import Any, Dict, List, Optional
from datetime import datetime
from ..core.redis_client import redis_client

def _ser(obj: Any) -> str:
    def default(o):
        if isinstance(o, datetime): return o.isoformat()
        if hasattr(o, "__dict__"):
            return json.dumps({k:v for k,v in o.__dict__.items() if not k.startswith("_")}, default=default)
        return json.dumps(o, default=default)
    if hasattr(obj, "model_dump"): return json.dumps(obj.model_dump(), default=default)
    return default(obj)

def _deser(s: str): return json.loads(s)

class RedisContactsService:
    TTL = 300
    @staticmethod
    def cache_contacts_for_org(org_id: str, rows: List[Dict]): 
        try:
            if not redis_client.ping(): return
            redis_client.client.setex(f"contacts:{org_id}", RedisContactsService.TTL, _ser(rows))
        except Exception: pass

    @staticmethod
    def get_contacts_for_org(org_id: str) -> Optional[List[Dict]]:
        try:
            if not redis_client.ping(): return None
            blob = redis_client.client.get(f"contacts:{org_id}")
            return _deser(blob) if blob else None
        except Exception: return None

    @staticmethod
    def invalidate_contacts(org_id: str):
        try:
            if not redis_client.ping(): return
            redis_client.client.delete(f"contacts:{org_id}")
        except Exception: pass

    @staticmethod
    def cache_lists(org_id: str, rows: List[Dict]):
        try:
            if not redis_client.ping(): return
            redis_client.client.setex(f"lists:{org_id}", RedisContactsService.TTL, _ser(rows))
        except Exception: pass

    @staticmethod
    def get_lists(org_id: str) -> Optional[List[Dict]]:
        try:
            if not redis_client.ping(): return None
            blob = redis_client.client.get(f"lists:{org_id}")
            return _deser(blob) if blob else None
        except Exception: return None

    @staticmethod
    def invalidate_lists(org_id: str):
        try:
            if not redis_client.ping(): return
            redis_client.client.delete(f"lists:{org_id}")
        except Exception: pass
