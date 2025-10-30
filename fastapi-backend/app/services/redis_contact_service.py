# app/services/redis_contact_service.py

import json
from typing import Any, Dict, List, Optional
from ..core.redis_client import redis_client


def _ser(obj: Any) -> str:
    """Serialize objects to JSON."""
    return json.dumps(obj, default=str)


def _deser(blob: str) -> Any:
    """Deserialize JSON to python."""
    return json.loads(blob)


class RedisContactService:
    # TTL durations in seconds
    LIST_TTL = 300           # 5m list by org
    ITEM_TTL = 600           # 10m single contact

    # Key templates
    CONTACT_KEY             = "contact:{contact_id}"
    CONTACT_FULL_KEY        = "contact:{contact_id}:full"     # includes phones/emails/socials
    CONTACT_LIST_BY_ORG_KEY = "contact:org:{org_id}"          # list of contacts
    CONTACT_LIST_FILTER_KEY = "contact:org:{org_id}:{status}" # list filtered by status

    @classmethod
    def _ok(cls) -> bool:
        """Check Redis connection."""
        try:
            return bool(redis_client.ping())
        except Exception:
            return False

    @classmethod
    def _set(cls, key: str, obj: Any, ttl: Optional[int] = None) -> None:
        """Internal setter with TTL."""
        if not cls._ok(): 
            return

        blob = _ser(obj)
        try:
            if ttl:
                redis_client.client.setex(key, ttl, blob)
            else:
                redis_client.client.set(key, blob)
        except Exception as e:
            print(f"[RedisContactService] set error {key}: {e}")

    @classmethod
    def _get(cls, key: str) -> Optional[Any]:
        """Internal getter."""
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
            print(f"[RedisContactService] get error {key}: {e}")
            return None

    @classmethod
    def _del(cls, *keys: str) -> None:
        """Delete cached keys."""
        if not cls._ok(): 
            return
        try:
            redis_client.client.delete(*keys)
        except Exception as e:
            print(f"[RedisContactService] delete error {keys}: {e}")

    # -------------------------------------------------------
    #  Contact caching
    # -------------------------------------------------------
    @classmethod
    def cache_contact(cls, contact_id: str, data: Dict) -> None:
        """Cache a lightweight contact."""
        cls._set(
            cls.CONTACT_KEY.format(contact_id=contact_id),
            data,
            cls.ITEM_TTL
        )

    @classmethod
    def get_contact(cls, contact_id: str) -> Optional[Dict]:
        """Get cached lightweight contact."""
        return cls._get(cls.CONTACT_KEY.format(contact_id=contact_id))

    @classmethod
    def cache_contact_full(cls, contact_id: str, data: Dict) -> None:
        """Cache full contact including phones/emails/socials."""
        cls._set(
            cls.CONTACT_FULL_KEY.format(contact_id=contact_id),
            data,
            cls.ITEM_TTL
        )

    @classmethod
    def get_contact_full(cls, contact_id: str) -> Optional[Dict]:
        """Get cached full contact."""
        return cls._get(cls.CONTACT_FULL_KEY.format(contact_id=contact_id))

    # -------------------------------------------------------
    #  List caching (per org + optional status filter)
    # -------------------------------------------------------
    @classmethod
    def cache_list_by_org(cls, org_id: str, rows: List[Dict]) -> None:
        """Save contacts list per org."""
        cls._set(
            cls.CONTACT_LIST_BY_ORG_KEY.format(org_id=org_id),
            rows,
            cls.LIST_TTL
        )

    @classmethod
    def get_list_by_org(cls, org_id: str) -> Optional[List[Dict]]:
        """Fetch org contacts list."""
        return cls._get(cls.CONTACT_LIST_BY_ORG_KEY.format(org_id=org_id))

    @classmethod
    def cache_list_by_org_status(cls, org_id: str, status: str, rows: List[Dict]) -> None:
        """Save contacts list for an org filtered by status."""
        key = cls.CONTACT_LIST_FILTER_KEY.format(org_id=org_id, status=status)
        cls._set(key, rows, cls.LIST_TTL)

    @classmethod
    def get_list_by_org_status(cls, org_id: str, status: str) -> Optional[List[Dict]]:
        """Get contacts list for org filtered by status."""
        key = cls.CONTACT_LIST_FILTER_KEY.format(org_id=org_id, status=status)
        return cls._get(key)

    # -------------------------------------------------------
    #  Invalidation
    # -------------------------------------------------------
    @classmethod
    def invalidate_contact(cls, contact_id: str, org_id: Optional[str] = None) -> None:
        """Delete cached contact data."""
        keys = [
            cls.CONTACT_KEY.format(contact_id=contact_id),
            cls.CONTACT_FULL_KEY.format(contact_id=contact_id),
        ]
        cls._del(*keys)

        # If org is known invalidate org-related lists
        if org_id:
            cls._del(cls.CONTACT_LIST_BY_ORG_KEY.format(org_id=org_id))

            # Clear all known status filters
            for status in ("active", "inactive", "unsubscribed", "deleted", "None"):
                cls._del(
                    cls.CONTACT_LIST_FILTER_KEY.format(org_id=org_id, status=status)
                )
