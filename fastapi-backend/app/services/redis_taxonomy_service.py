# ============================================
# REDIS CACHE SERVICE - app/services/redis_taxonomy_service.py
# ============================================

import json
from typing import Any, List, Optional, Dict
from ..core.redis_client import redis_client

def _ser(obj: Any) -> str:
    return json.dumps(obj, default=str)

def _deser(blob: str) -> Any:
    return json.loads(blob)

class RedisTaxonomyService:
    LIST_TTL = 300
    ITEM_TTL = 600

    # Keys
    FEATURES_BY_ORG_KEY = "features:org:{org_id}"
    FEATURES_BY_PRODUCT_KEY = "features:product:{product_id}"
    FEATURE_KEY = "feature:{feature_id}"

    IMPACTS_BY_ORG_KEY = "impacts:org:{org_id}"
    IMPACT_KEY = "impact:{impact_id}"

    RCA_BY_ORG_KEY = "rca:org:{org_id}"
    RCA_KEY = "rca:{rca_id}"

    # Set/Get helpers
    @classmethod
    def _set(cls, key: str, obj: Any, ttl: int | None = None) -> None:
        try:
            if not redis_client.ping(): return
            blob = _ser(obj)
            redis_client.client.setex(key, ttl, blob) if ttl else redis_client.client.set(key, blob)
        except Exception as e:
            print(f"Redis set error {key}: {e}")

    @classmethod
    def _get(cls, key: str) -> Optional[Any]:
        try:
            if not redis_client.ping(): return None
            blob = redis_client.client.get(key)
            if not blob: return None
            if isinstance(blob, bytes): blob = blob.decode("utf-8")
            return _deser(blob)
        except Exception as e:
            print(f"Redis get error {key}: {e}")
            return None

    @classmethod
    def _delete(cls, *keys: str) -> None:
        try:
            if not redis_client.ping() or not keys: return
            redis_client.client.delete(*keys)
        except Exception as e:
            print(f"Redis delete error {keys}: {e}")

    # Features
    @classmethod
    def cache_features_by_org(cls, org_id: str, items: List[Dict]) -> None:
        cls._set(cls.FEATURES_BY_ORG_KEY.format(org_id=org_id), items, cls.LIST_TTL)

    @classmethod
    def get_features_by_org(cls, org_id: str) -> Optional[List[Dict]]:
        return cls._get(cls.FEATURES_BY_ORG_KEY.format(org_id=org_id))

    @classmethod
    def cache_features_by_product(cls, product_id: str, items: List[Dict]) -> None:
        cls._set(cls.FEATURES_BY_PRODUCT_KEY.format(product_id=product_id), items, cls.LIST_TTL)

    @classmethod
    def get_features_by_product(cls, product_id: str) -> Optional[List[Dict]]:
        return cls._get(cls.FEATURES_BY_PRODUCT_KEY.format(product_id=product_id))

    @classmethod
    def cache_feature(cls, feature_id: str, data: Dict) -> None:
        cls._set(cls.FEATURE_KEY.format(feature_id=feature_id), data, cls.ITEM_TTL)

    @classmethod
    def get_feature(cls, feature_id: str) -> Optional[Dict]:
        return cls._get(cls.FEATURE_KEY.format(feature_id=feature_id))

    # Impacts
    @classmethod
    def cache_impacts_by_org(cls, org_id: str, items: List[Dict]) -> None:
        cls._set(cls.IMPACTS_BY_ORG_KEY.format(org_id=org_id), items, cls.LIST_TTL)

    @classmethod
    def get_impacts_by_org(cls, org_id: str) -> Optional[List[Dict]]:
        return cls._get(cls.IMPACTS_BY_ORG_KEY.format(org_id=org_id))

    @classmethod
    def cache_impact(cls, impact_id: str, data: Dict) -> None:
        cls._set(cls.IMPACT_KEY.format(impact_id=impact_id), data, cls.ITEM_TTL)

    @classmethod
    def get_impact(cls, impact_id: str) -> Optional[Dict]:
        return cls._get(cls.IMPACT_KEY.format(impact_id=impact_id))

    # RCA
    @classmethod
    def cache_rca_by_org(cls, org_id: str, items: List[Dict]) -> None:
        cls._set(cls.RCA_BY_ORG_KEY.format(org_id=org_id), items, cls.LIST_TTL)

    @classmethod
    def get_rca_by_org(cls, org_id: str) -> Optional[List[Dict]]:
        return cls._get(cls.RCA_BY_ORG_KEY.format(org_id=org_id))

    @classmethod
    def cache_rca(cls, rca_id: str, data: Dict) -> None:
        cls._set(cls.RCA_KEY.format(rca_id=rca_id), data, cls.ITEM_TTL)

    @classmethod
    def get_rca(cls, rca_id: str) -> Optional[Dict]:
        return cls._get(cls.RCA_KEY.format(rca_id=rca_id))

    # Invalidate helpers
    @classmethod
    def invalidate_feature_caches(cls, feature_id: str, org_id: str, product_id: str | None) -> None:
        keys = [
            cls.FEATURE_KEY.format(feature_id=feature_id),
            cls.FEATURES_BY_ORG_KEY.format(org_id=org_id),
        ]
        if product_id:
            keys.append(cls.FEATURES_BY_PRODUCT_KEY.format(product_id=product_id))
        cls._delete(*keys)

    @classmethod
    def invalidate_impact_caches(cls, impact_id: str, org_id: str) -> None:
        cls._delete(
            cls.IMPACT_KEY.format(impact_id=impact_id),
            cls.IMPACTS_BY_ORG_KEY.format(org_id=org_id),
        )

    @classmethod
    def invalidate_rca_caches(cls, rca_id: str, org_id: str) -> None:
        cls._delete(
            cls.RCA_KEY.format(rca_id=rca_id),
            cls.RCA_BY_ORG_KEY.format(org_id=org_id),
        )
