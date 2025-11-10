import json
from typing import Any, Dict, List, Optional
from ..core.redis_client import redis_client


def _ser(obj: Any) -> str:
    return json.dumps(obj, default=str)


def _deser(blob: str) -> Any:
    return json.loads(blob)


class RedisThemeService:
    # TTLs
    LIST_TTL = 300       # 5m list by org/active
    ITEM_TTL = 600       # 10m single theme

    # Keys
    THEME_KEY           = "theme:{theme_id}"
    THEME_LIST_BY_ORG   = "theme:org:{org_id}:active:{active}"

    @classmethod
    def _ok(cls) -> bool:
        try:
            return bool(redis_client.ping())
        except Exception:
            return False

    @classmethod
    def _set(cls, key: str, obj: Any, ttl: int | None = None) -> None:
        if not cls._ok(): 
            return
        blob = _ser(obj)
        try:
            if ttl:
                redis_client.client.setex(key, ttl, blob)
            else:
                redis_client.client.set(key, blob)
        except Exception as e:
            print(f"[RedisThemeService] set error {key}: {e}")

    @classmethod
    def _get(cls, key: str) -> Optional[Any]:
        if not cls._ok():
            return None
        try:
            blob = redis_client.client.get(key)
            if not blob:
                return None
            if isinstance(blob, bytes):
                blob = blob.decode("utf-8")
            return _deser(blob)
        except Exception as e:
            print(f"[RedisThemeService] get error {key}: {e}")
            return None

    @classmethod
    def _del(cls, *keys: str) -> None:
        if not cls._ok():
            return
        try:
            redis_client.client.delete(*keys)
        except Exception as e:
            print(f"[RedisThemeService] delete error {keys}: {e}")

    # ---------- cache helpers ----------
    @classmethod
    def cache_theme(cls, theme_id: str, data: Dict) -> None:
        cls._set(cls.THEME_KEY.format(theme_id=theme_id), data, cls.ITEM_TTL)

    @classmethod
    def get_theme(cls, theme_id: str) -> Optional[Dict]:
        return cls._get(cls.THEME_KEY.format(theme_id=theme_id))

    @classmethod
    def cache_list_by_org(cls, org_id: str, active: Optional[bool], rows: List[Dict]) -> None:
        cls._set(
            cls.THEME_LIST_BY_ORG.format(org_id=org_id, active=str(active)),
            rows,
            cls.LIST_TTL,
        )

    @classmethod
    def get_list_by_org(cls, org_id: str, active: Optional[bool]) -> Optional[List[Dict]]:
        return cls._get(cls.THEME_LIST_BY_ORG.format(org_id=org_id, active=str(active)))

    # ---------- invalidation ----------
    @classmethod
    def invalidate_theme(cls, theme_id: str, org_id: Optional[str] = None) -> None:
        # Delete single theme entry
        cls._del(cls.THEME_KEY.format(theme_id=theme_id))

        # If org provided → delete org list (for active True, False, None)
        if org_id:
            for active in ("True", "False", "None"):
                cls._del(
                    cls.THEME_LIST_BY_ORG.format(org_id=org_id, active=active)
                )
