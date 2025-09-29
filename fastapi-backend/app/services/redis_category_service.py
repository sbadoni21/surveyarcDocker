
# ============================================
# REDIS CACHE SERVICE - app/services/redis_category_service.py
# ============================================

import json
from typing import Any, List, Optional, Dict
from ..core.redis_client import redis_client

def _ser(obj: Any) -> str:
    return json.dumps(obj, default=str)

def _deser(blob: str) -> Any:
    return json.loads(blob)

class RedisCategoryService:
    # TTLs in seconds
    LIST_TTL = 300      # 5 minutes for lists
    ITEM_TTL = 600      # 10 minutes for individual items
    
    # Cache key patterns
    CATEGORIES_BY_ORG_KEY = "categories:org:{org_id}"
    CATEGORY_KEY = "category:{category_id}"
    CATEGORY_WITH_SUBS_KEY = "category:{category_id}:full"
    
    SUBCATEGORIES_BY_CATEGORY_KEY = "subcategories:category:{category_id}"
    SUBCATEGORIES_BY_ORG_KEY = "subcategories:org:{org_id}"
    SUBCATEGORY_KEY = "subcategory:{subcategory_id}"
    
    PRODUCTS_BY_ORG_KEY = "products:org:{org_id}"
    PRODUCT_KEY = "product:{product_id}"

    @classmethod
    def _set(cls, key: str, obj: Any, ttl: int = None) -> None:
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
        try:
            if not redis_client.ping() or not keys:
                return
            redis_client.client.delete(*keys)
        except Exception as e:
            print(f"Redis delete error for keys {keys}: {e}")

    # -------- Categories Cache --------
    @classmethod
    def cache_categories_by_org(cls, org_id: str, categories: List[Dict]) -> None:
        cls._set(cls.CATEGORIES_BY_ORG_KEY.format(org_id=org_id), categories, cls.LIST_TTL)

    @classmethod
    def get_categories_by_org(cls, org_id: str) -> Optional[List[Dict]]:
        return cls._get(cls.CATEGORIES_BY_ORG_KEY.format(org_id=org_id))

    @classmethod
    def cache_category(cls, category_id: str, category_data: Dict) -> None:
        cls._set(cls.CATEGORY_KEY.format(category_id=category_id), category_data, cls.ITEM_TTL)

    @classmethod
    def get_category(cls, category_id: str) -> Optional[Dict]:
        return cls._get(cls.CATEGORY_KEY.format(category_id=category_id))

    @classmethod
    def cache_category_with_subcategories(cls, category_id: str, data: Dict) -> None:
        cls._set(cls.CATEGORY_WITH_SUBS_KEY.format(category_id=category_id), data, cls.ITEM_TTL)

    @classmethod
    def get_category_with_subcategories(cls, category_id: str) -> Optional[Dict]:
        return cls._get(cls.CATEGORY_WITH_SUBS_KEY.format(category_id=category_id))

    # -------- Subcategories Cache --------
    @classmethod
    def cache_subcategories_by_category(cls, category_id: str, subcategories: List[Dict]) -> None:
        cls._set(cls.SUBCATEGORIES_BY_CATEGORY_KEY.format(category_id=category_id), subcategories, cls.LIST_TTL)

    @classmethod
    def get_subcategories_by_category(cls, category_id: str) -> Optional[List[Dict]]:
        return cls._get(cls.SUBCATEGORIES_BY_CATEGORY_KEY.format(category_id=category_id))

    @classmethod
    def cache_subcategories_by_org(cls, org_id: str, subcategories: List[Dict]) -> None:
        cls._set(cls.SUBCATEGORIES_BY_ORG_KEY.format(org_id=org_id), subcategories, cls.LIST_TTL)

    @classmethod
    def get_subcategories_by_org(cls, org_id: str) -> Optional[List[Dict]]:
        return cls._get(cls.SUBCATEGORIES_BY_ORG_KEY.format(org_id=org_id))

    @classmethod
    def cache_subcategory(cls, subcategory_id: str, subcategory_data: Dict) -> None:
        cls._set(cls.SUBCATEGORY_KEY.format(subcategory_id=subcategory_id), subcategory_data, cls.ITEM_TTL)

    @classmethod
    def get_subcategory(cls, subcategory_id: str) -> Optional[Dict]:
        return cls._get(cls.SUBCATEGORY_KEY.format(subcategory_id=subcategory_id))

    # -------- Products Cache --------
    @classmethod
    def cache_products_by_org(cls, org_id: str, products: List[Dict]) -> None:
        cls._set(cls.PRODUCTS_BY_ORG_KEY.format(org_id=org_id), products, cls.LIST_TTL)

    @classmethod
    def get_products_by_org(cls, org_id: str) -> Optional[List[Dict]]:
        return cls._get(cls.PRODUCTS_BY_ORG_KEY.format(org_id=org_id))

    @classmethod
    def cache_product(cls, product_id: str, product_data: Dict) -> None:
        cls._set(cls.PRODUCT_KEY.format(product_id=product_id), product_data, cls.ITEM_TTL)

    @classmethod
    def get_product(cls, product_id: str) -> Optional[Dict]:
        return cls._get(cls.PRODUCT_KEY.format(product_id=product_id))

    # -------- Cache Invalidation --------
    @classmethod
    def invalidate_category_caches(cls, category_id: str, org_id: str) -> None:
        cls._delete(
            cls.CATEGORY_KEY.format(category_id=category_id),
            cls.CATEGORY_WITH_SUBS_KEY.format(category_id=category_id),
            cls.CATEGORIES_BY_ORG_KEY.format(org_id=org_id),
            cls.SUBCATEGORIES_BY_CATEGORY_KEY.format(category_id=category_id),
            cls.SUBCATEGORIES_BY_ORG_KEY.format(org_id=org_id)
        )

    @classmethod
    def invalidate_subcategory_caches(cls, subcategory_id: str, category_id: str, org_id: str) -> None:
        cls._delete(
            cls.SUBCATEGORY_KEY.format(subcategory_id=subcategory_id),
            cls.SUBCATEGORIES_BY_CATEGORY_KEY.format(category_id=category_id),
            cls.SUBCATEGORIES_BY_ORG_KEY.format(org_id=org_id),
            cls.CATEGORY_WITH_SUBS_KEY.format(category_id=category_id),
            cls.CATEGORIES_BY_ORG_KEY.format(org_id=org_id)
        )

    @classmethod
    def invalidate_product_caches(cls, product_id: str, org_id: str) -> None:
        cls._delete(
            cls.PRODUCT_KEY.format(product_id=product_id),
            cls.PRODUCTS_BY_ORG_KEY.format(org_id=org_id)
        )

    @classmethod
    def invalidate_all_category_caches(cls, org_id: str) -> None:
        try:
            if not redis_client.ping():
                return
            patterns = [
                f"categories:org:{org_id}",
                f"subcategories:org:{org_id}",
                f"products:org:{org_id}",
            ]
            for pattern in patterns:
                keys = redis_client.client.keys(pattern)
                if keys:
                    redis_client.client.delete(*keys)
        except Exception as e:
            print(f"Error invalidating all category caches for org {org_id}: {e}")


# File continues in next artifact due to length...