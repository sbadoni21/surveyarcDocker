# app/services/redis_contact_service.py
import json
from typing import Any, Dict, List, Optional
from ..core.redis_client import redis_client


def _ser(obj: Any) -> str:
    """Safe JSON serializer with datetime support."""
    return json.dumps(obj, default=str)


def _deser(blob: str) -> Any:
    return json.loads(blob)


class RedisContactService:
    # TTLs
    CONTACT_TTL = 600        # 10 minutes for single contact
    CONTACT_LIST_TTL = 300   # 5 minutes for list/org-level collections
    LIST_TTL = 600           # 10 minutes for single contact list

    # Key patterns
    CONTACT_KEY          = "contact:{contact_id}"
    CONTACT_FULL_KEY     = "contact:{contact_id}:full"
    ORG_CONTACTS_KEY     = "contacts:org:{org_id}"
    LIST_CONTACTS_KEY    = "contacts:list:{list_id}"

    LIST_KEY             = "clist:{list_id}"
    ORG_LISTS_KEY        = "clist:org:{org_id}"

    @classmethod
    def _ok(cls) -> bool:
        try:
            return bool(redis_client.ping())
        except Exception:
            return False

    @classmethod
    def _set(cls, key: str, obj: Any, ttl: Optional[int] = None) -> None:
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
        if not cls._ok() or not keys:
            return
        try:
            redis_client.client.delete(*keys)
        except Exception as e:
            print(f"[RedisContactService] delete error {keys}: {e}")

    # --------- contact cache helpers ---------

    @classmethod
    def cache_contact(cls, contact_id: str, data: Dict) -> None:
        """Store a slim contact (without heavy relations)."""
        cls._set(cls.CONTACT_KEY.format(contact_id=contact_id), data, cls.CONTACT_TTL)

    @classmethod
    def get_contact(cls, contact_id: str) -> Optional[Dict]:
        return cls._get(cls.CONTACT_KEY.format(contact_id=contact_id))

    @classmethod
    def cache_contact_full(cls, contact_id: str, data: Dict) -> None:
        """Store a full contact (with emails, phones, socials, lists)."""
        cls._set(cls.CONTACT_FULL_KEY.format(contact_id=contact_id), data, cls.CONTACT_TTL)

    @classmethod
    def get_contact_full(cls, contact_id: str) -> Optional[Dict]:
        return cls._get(cls.CONTACT_FULL_KEY.format(contact_id=contact_id))

    @classmethod
    def cache_contacts_by_org(cls, org_id: str, rows: List[Dict]) -> None:
        cls._set(cls.ORG_CONTACTS_KEY.format(org_id=org_id), rows, cls.CONTACT_LIST_TTL)

    @classmethod
    def get_contacts_by_org(cls, org_id: str) -> Optional[List[Dict]]:
        return cls._get(cls.ORG_CONTACTS_KEY.format(org_id=org_id))

    @classmethod
    def cache_contacts_by_list(cls, list_id: str, rows: List[Dict]) -> None:
        cls._set(cls.LIST_CONTACTS_KEY.format(list_id=list_id), rows, cls.CONTACT_LIST_TTL)

    @classmethod
    def get_contacts_by_list(cls, list_id: str) -> Optional[List[Dict]]:
        return cls._get(cls.LIST_CONTACTS_KEY.format(list_id=list_id))

    # --------- list cache helpers ---------

    @classmethod
    def cache_list(cls, list_id: str, data: Dict) -> None:
        cls._set(cls.LIST_KEY.format(list_id=list_id), data, cls.LIST_TTL)

    @classmethod
    def get_list(cls, list_id: str) -> Optional[Dict]:
        return cls._get(cls.LIST_KEY.format(list_id=list_id))

    @classmethod
    def cache_list_full(cls, list_id: str, data: Dict) -> None:
        """Alias to cache full list with contacts, etc."""
        cls.cache_list(list_id, data)

    @classmethod
    def get_list_full(cls, list_id: str) -> Optional[Dict]:
        return cls.get_list(list_id)

    @classmethod
    def cache_lists_by_org(cls, org_id: str, rows: List[Dict]) -> None:
        cls._set(cls.ORG_LISTS_KEY.format(org_id=org_id), rows, cls.LIST_TTL)

    @classmethod
    def get_lists_by_org(cls, org_id: str) -> Optional[List[Dict]]:
        return cls._get(cls.ORG_LISTS_KEY.format(org_id=org_id))

    # --------- invalidation helpers ---------

    @classmethod
    def invalidate_contact(cls, contact_id: str, org_id: Optional[str] = None) -> None:
        """Invalidate a single contact + org-level contact list cache."""
        keys = [
            cls.CONTACT_KEY.format(contact_id=contact_id),
            cls.CONTACT_FULL_KEY.format(contact_id=contact_id),
        ]
        cls._del(*keys)
        if org_id:
            cls.invalidate_org_contacts(org_id)

    @classmethod
    def invalidate_org_contacts(cls, org_id: str) -> None:
        """Invalidate the org-level contacts collection."""
        cls._del(cls.ORG_CONTACTS_KEY.format(org_id=org_id))

    @classmethod
    def invalidate_list(cls, list_id: str, org_id: Optional[str] = None) -> None:
        """Invalidate a single list + its contact collection + org lists cache."""
        keys = [
            cls.LIST_KEY.format(list_id=list_id),
            cls.LIST_CONTACTS_KEY.format(list_id=list_id),
        ]
        cls._del(*keys)
        if org_id:
            cls.invalidate_org_lists(org_id)
            cls.invalidate_org_contacts(org_id)

    @classmethod
    def invalidate_org_lists(cls, org_id: str) -> None:
        cls._del(cls.ORG_LISTS_KEY.format(org_id=org_id))

    @classmethod
    def invalidate_org(cls, org_id: str) -> None:
        """Convenience: nuke both contacts + lists collections for an org."""
        cls.invalidate_org_contacts(org_id)
        cls.invalidate_org_lists(org_id)
