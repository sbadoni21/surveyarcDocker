# app/services/redis_calendar_service.py
import json
from typing import Any, Dict, List, Optional
from ..core.redis_client import redis_client

def _ser(obj: Any) -> str:
    return json.dumps(obj, default=str)

def _deser(blob: str) -> Any:
    return json.loads(blob)

class RedisCalendarService:
    # TTLs
    LIST_TTL = 300       # 5m list by org/active
    ITEM_TTL = 600       # 10m single calendar
    CHILD_TTL = 600      # 10m hours/holidays

    # Keys
    CAL_KEY             = "bizcal:{calendar_id}"
    CAL_FULL_KEY        = "bizcal:{calendar_id}:full"            # with hours & holidays
    CAL_LIST_BY_ORG_KEY = "bizcal:org:{org_id}:active:{active}"  # list w/ filter
    CAL_HOURS_KEY       = "bizcal:{calendar_id}:hours"
    CAL_HOLIDAYS_KEY    = "bizcal:{calendar_id}:holidays"

    @classmethod
    def _ok(cls) -> bool:
        try:
            return bool(redis_client.ping())
        except Exception:
            return False

    @classmethod
    def _set(cls, key: str, obj: Any, ttl: int | None = None) -> None:
        if not cls._ok(): return
        blob = _ser(obj)
        try:
            if ttl:
                redis_client.client.setex(key, ttl, blob)
            else:
                redis_client.client.set(key, blob)
        except Exception as e:
            print(f"[RedisCalendarService] set error {key}: {e}")

    @classmethod
    def _get(cls, key: str) -> Optional[Any]:
        if not cls._ok(): return None
        try:
            blob = redis_client.client.get(key)
            if not blob: return None
            if isinstance(blob, bytes):
                blob = blob.decode("utf-8")
            return _deser(blob)
        except Exception as e:
            print(f"[RedisCalendarService] get error {key}: {e}")
            return None

    @classmethod
    def _del(cls, *keys: str) -> None:
        if not cls._ok(): return
        try:
            redis_client.client.delete(*keys)
        except Exception as e:
            print(f"[RedisCalendarService] delete error {keys}: {e}")

    # ---------- cache helpers ----------
    @classmethod
    def cache_calendar(cls, calendar_id: str, data: Dict) -> None:
        cls._set(cls.CAL_KEY.format(calendar_id=calendar_id), data, cls.ITEM_TTL)

    @classmethod
    def get_calendar(cls, calendar_id: str) -> Optional[Dict]:
        return cls._get(cls.CAL_KEY.format(calendar_id=calendar_id))

    @classmethod
    def cache_calendar_full(cls, calendar_id: str, data: Dict) -> None:
        cls._set(cls.CAL_FULL_KEY.format(calendar_id=calendar_id), data, cls.ITEM_TTL)

    @classmethod
    def get_calendar_full(cls, calendar_id: str) -> Optional[Dict]:
        return cls._get(cls.CAL_FULL_KEY.format(calendar_id=calendar_id))

    @classmethod
    def cache_list_by_org(cls, org_id: str, active: Optional[bool], rows: List[Dict]) -> None:
        cls._set(cls.CAL_LIST_BY_ORG_KEY.format(org_id=org_id, active=str(active)), rows, cls.LIST_TTL)

    @classmethod
    def get_list_by_org(cls, org_id: str, active: Optional[bool]) -> Optional[List[Dict]]:
        return cls._get(cls.CAL_LIST_BY_ORG_KEY.format(org_id=org_id, active=str(active)))

    @classmethod
    def cache_hours(cls, calendar_id: str, hours: List[Dict]) -> None:
        cls._set(cls.CAL_HOURS_KEY.format(calendar_id=calendar_id), hours, cls.CHILD_TTL)

    @classmethod
    def get_hours(cls, calendar_id: str) -> Optional[List[Dict]]:
        return cls._get(cls.CAL_HOURS_KEY.format(calendar_id=calendar_id))

    @classmethod
    def cache_holidays(cls, calendar_id: str, holidays: List[Dict]) -> None:
        cls._set(cls.CAL_HOLIDAYS_KEY.format(calendar_id=calendar_id), holidays, cls.CHILD_TTL)

    @classmethod
    def get_holidays(cls, calendar_id: str) -> Optional[List[Dict]]:
        return cls._get(cls.CAL_HOLIDAYS_KEY.format(calendar_id=calendar_id))

    # ---------- invalidation ----------
    @classmethod
    def invalidate_calendar(cls, calendar_id: str, org_id: Optional[str] = None) -> None:
        keys = [
            cls.CAL_KEY.format(calendar_id=calendar_id),
            cls.CAL_FULL_KEY.format(calendar_id=calendar_id),
            cls.CAL_HOURS_KEY.format(calendar_id=calendar_id),
            cls.CAL_HOLIDAYS_KEY.format(calendar_id=calendar_id),
        ]
        cls._del(*keys)
        # If org is known, nuke org lists (both active True/False/None)
        if org_id:
            for active in ("True", "False", "None"):
                cls._del(cls.CAL_LIST_BY_ORG_KEY.format(org_id=org_id, active=active))
