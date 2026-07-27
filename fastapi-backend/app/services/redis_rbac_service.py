import json
from typing import Any, Dict, List, Optional, Set
from datetime import datetime
from ..core.redis_client import redis_client


class RedisRBACService:
    """
    Smart caching layer for RBAC system with intelligent invalidation.
    
    Caches:
    - User role assignments
    - Role definitions
    - Permission definitions
    - Role-permission mappings
    - User permission checks (computed results)
    - Custom grants and denials
    """
    
    # ============================================================
    # CONFIG
    # ============================================================
    
    # TTLs
    ROLE_ASSIGNMENT_TTL = 1800      # 30 minutes
    ROLE_DEF_TTL = 3600             # 1 hour (roles change rarely)
    PERMISSION_DEF_TTL = 3600       # 1 hour (permissions change rarely)
    PERMISSION_CHECK_TTL = 300      # 5 minutes (permission checks)
    USER_GRANTS_TTL = 900           # 15 minutes
    USER_DENIALS_TTL = 900          # 15 minutes
    
    # Key patterns
    USER_ROLES_KEY = "rbac:user:{user_uid}:roles:{org_id}"
    USER_ALL_ROLES_KEY = "rbac:user:{user_uid}:all_roles"
    
    ROLE_DEF_KEY = "rbac:role:{role_id}"
    ROLES_BY_ORG_KEY = "rbac:org:{org_id}:roles"
    ROLES_LIST_KEY = "rbac:roles:list"
    
    PERMISSION_DEF_KEY = "rbac:permission:{permission_id}"
    PERMISSIONS_LIST_KEY = "rbac:permissions:list"
    
    ROLE_PERMISSIONS_KEY = "rbac:role:{role_id}:permissions"
    
    PERMISSION_CHECK_KEY = "rbac:check:{user_uid}:{permission_code}:{scope}:{resource_id}"
    
    USER_GRANTS_KEY = "rbac:user:{user_uid}:grants:{org_id}"
    USER_DENIALS_KEY = "rbac:user:{user_uid}:denials:{org_id}"
    
    USER_EFFECTIVE_PERMS_KEY = "rbac:user:{user_uid}:effective:{org_id}:{scope}:{resource_id}"

    # ============================================================
    # INTERNAL HELPERS
    # ============================================================

    @classmethod
    def _serialize(cls, obj: Any) -> str:
        """Serialize Python objects to JSON with datetime support"""
        def default(o):
            if isinstance(o, datetime):
                return o.isoformat()
            if hasattr(o, 'value'):  # Enum support
                return o.value
            raise TypeError(f"Not JSON serializable: {type(o)}")

        if hasattr(obj, "model_dump"):
            return json.dumps(obj.model_dump(), default=default)

        if hasattr(obj, "__dict__"):
            data = {
                k: (v.isoformat() if isinstance(v, datetime) else 
                    v.value if hasattr(v, 'value') else v)
                for k, v in obj.__dict__.items()
                if not k.startswith("_")
            }
            return json.dumps(data, default=default)

        return json.dumps(obj, default=default)

    @classmethod
    def _deserialize(cls, blob: bytes | str) -> Dict[str, Any]:
        """Deserialize JSON to dict with datetime parsing"""
        if isinstance(blob, (bytes, bytearray)):
            blob = blob.decode("utf-8", errors="ignore")

        data = json.loads(blob)

        # Parse datetime fields
        for k in ("created_at", "updated_at"):
            if data.get(k):
                try:
                    data[k] = datetime.fromisoformat(
                        str(data[k]).replace("Z", "+00:00")
                    )
                except Exception:
                    pass

        return data

    @classmethod
    def _ping(cls) -> bool:
        """Check Redis connection"""
        try:
            return redis_client.ping()
        except Exception:
            return False

    # ============================================================
    # USER ROLE ASSIGNMENTS CACHE
    # ============================================================

    @classmethod
    def cache_user_roles(cls, user_uid: str, org_id: str, assignments: List[Any]) -> bool:
        """Cache all role assignments for a user in an org"""
        try:
            if not cls._ping():
                return False

            key = cls.USER_ROLES_KEY.format(user_uid=user_uid, org_id=org_id)
            
            serialized = [cls._serialize(a) for a in assignments]
            redis_client.client.setex(
                key,
                cls.ROLE_ASSIGNMENT_TTL,
                json.dumps(serialized)
            )
            return True
        except Exception as e:
            print(f"[RedisRBACService] cache_user_roles failed: {e}")
            return False

    @classmethod
    def get_user_roles(cls, user_uid: str, org_id: str) -> Optional[List[Dict[str, Any]]]:
        """Get cached role assignments for a user in an org"""
        try:
            if not cls._ping():
                return None

            key = cls.USER_ROLES_KEY.format(user_uid=user_uid, org_id=org_id)
            blob = redis_client.client.get(key)
            
            if not blob:
                return None

            if isinstance(blob, (bytes, bytearray)):
                blob = blob.decode("utf-8", errors="ignore")
            
            assignments = json.loads(blob)
            return [json.loads(a) if isinstance(a, str) else a for a in assignments]
        except Exception as e:
            print(f"[RedisRBACService] get_user_roles failed: {e}")
            return None

    @classmethod
    def invalidate_user_roles(cls, user_uid: str, org_id: Optional[str] = None) -> None:
        """Invalidate user role cache"""
        try:
            if not cls._ping():
                return

            if org_id:
                # Invalidate specific org
                key = cls.USER_ROLES_KEY.format(user_uid=user_uid, org_id=org_id)
                redis_client.client.delete(key)
            else:
                # Invalidate all orgs for this user
                pattern = cls.USER_ROLES_KEY.format(user_uid=user_uid, org_id="*")
                keys = redis_client.client.keys(pattern)
                if keys:
                    redis_client.client.delete(*keys)
            
            # Also invalidate permission checks for this user
            cls._invalidate_user_permission_checks(user_uid)
            
        except Exception as e:
            print(f"[RedisRBACService] invalidate_user_roles failed: {e}")

    # ============================================================
    # ROLE DEFINITIONS CACHE
    # ============================================================

    @classmethod
    def cache_role(cls, role: Any) -> bool:
        """Cache a single role definition"""
        try:
            if not cls._ping():
                return False

            role_id = getattr(role, "id", None) or role.get("id")
            if not role_id:
                return False

            key = cls.ROLE_DEF_KEY.format(role_id=role_id)
            redis_client.client.setex(
                key,
                cls.ROLE_DEF_TTL,
                cls._serialize(role)
            )
            return True
        except Exception as e:
            print(f"[RedisRBACService] cache_role failed: {e}")
            return False

    @classmethod
    def get_role(cls, role_id: str) -> Optional[Dict[str, Any]]:
        """Get cached role definition"""
        try:
            if not cls._ping():
                return None

            key = cls.ROLE_DEF_KEY.format(role_id=role_id)
            blob = redis_client.client.get(key)
            return cls._deserialize(blob) if blob else None
        except Exception as e:
            print(f"[RedisRBACService] get_role failed: {e}")
            return None

    @classmethod
    def cache_roles_list(cls, org_id: Optional[str], roles: List[Any]) -> bool:
        """Cache list of roles for an org or globally"""
        try:
            if not cls._ping():
                return False

            # Cache individual roles
            for role in roles:
                cls.cache_role(role)

            # Cache role IDs list
            role_ids = [
                getattr(r, "id", None) or r.get("id")
                for r in roles
            ]
            
            key = cls.ROLES_BY_ORG_KEY.format(org_id=org_id) if org_id else cls.ROLES_LIST_KEY
            
            redis_client.client.setex(
                key,
                cls.ROLE_DEF_TTL,
                json.dumps(role_ids)
            )
            return True
        except Exception as e:
            print(f"[RedisRBACService] cache_roles_list failed: {e}")
            return False

    @classmethod
    def get_roles_list(cls, org_id: Optional[str] = None) -> Optional[List[Dict[str, Any]]]:
        """Get cached roles list"""
        try:
            if not cls._ping():
                return None

            key = cls.ROLES_BY_ORG_KEY.format(org_id=org_id) if org_id else cls.ROLES_LIST_KEY
            blob = redis_client.client.get(key)
            
            if not blob:
                return None

            if isinstance(blob, (bytes, bytearray)):
                blob = blob.decode("utf-8", errors="ignore")
            
            role_ids = json.loads(blob)
            
            # Fetch each role
            roles = []
            for role_id in role_ids:
                role = cls.get_role(role_id)
                if role:
                    roles.append(role)
            
            return roles if roles else None
        except Exception as e:
            print(f"[RedisRBACService] get_roles_list failed: {e}")
            return None

    @classmethod
    def invalidate_role(cls, role_id: str, org_id: Optional[str] = None) -> None:
        """Invalidate role cache and dependent caches"""
        try:
            if not cls._ping():
                return

            # Invalidate role definition
            key = cls.ROLE_DEF_KEY.format(role_id=role_id)
            redis_client.client.delete(key)
            
            # Invalidate role lists
            if org_id:
                list_key = cls.ROLES_BY_ORG_KEY.format(org_id=org_id)
                redis_client.client.delete(list_key)
            redis_client.client.delete(cls.ROLES_LIST_KEY)
            
            # Invalidate role permissions
            perm_key = cls.ROLE_PERMISSIONS_KEY.format(role_id=role_id)
            redis_client.client.delete(perm_key)
            
        except Exception as e:
            print(f"[RedisRBACService] invalidate_role failed: {e}")

    # ============================================================
    # PERMISSION DEFINITIONS CACHE
    # ============================================================

    @classmethod
    def cache_permission(cls, permission: Any) -> bool:
        """Cache a single permission definition"""
        try:
            if not cls._ping():
                return False

            perm_id = getattr(permission, "id", None) or permission.get("id")
            if not perm_id:
                return False

            key = cls.PERMISSION_DEF_KEY.format(permission_id=perm_id)
            redis_client.client.setex(
                key,
                cls.PERMISSION_DEF_TTL,
                cls._serialize(permission)
            )
            return True
        except Exception as e:
            print(f"[RedisRBACService] cache_permission failed: {e}")
            return False

    @classmethod
    def cache_permissions_list(cls, permissions: List[Any]) -> bool:
        """Cache list of all permissions"""
        try:
            if not cls._ping():
                return False

            # Cache individual permissions
            for perm in permissions:
                cls.cache_permission(perm)

            # Cache permission IDs list
            perm_ids = [
                getattr(p, "id", None) or p.get("id")
                for p in permissions
            ]
            
            redis_client.client.setex(
                cls.PERMISSIONS_LIST_KEY,
                cls.PERMISSION_DEF_TTL,
                json.dumps(perm_ids)
            )
            return True
        except Exception as e:
            print(f"[RedisRBACService] cache_permissions_list failed: {e}")
            return False

    @classmethod
    def get_permissions_list(cls) -> Optional[List[Dict[str, Any]]]:
        """Get cached permissions list"""
        try:
            if not cls._ping():
                return None

            blob = redis_client.client.get(cls.PERMISSIONS_LIST_KEY)
            if not blob:
                return None

            if isinstance(blob, (bytes, bytearray)):
                blob = blob.decode("utf-8", errors="ignore")
            
            perm_ids = json.loads(blob)
            
            # Fetch each permission
            permissions = []
            for perm_id in perm_ids:
                key = cls.PERMISSION_DEF_KEY.format(permission_id=perm_id)
                perm_blob = redis_client.client.get(key)
                if perm_blob:
                    permissions.append(cls._deserialize(perm_blob))
            
            return permissions if permissions else None
        except Exception as e:
            print(f"[RedisRBACService] get_permissions_list failed: {e}")
            return None

    # ============================================================
    # ROLE-PERMISSION MAPPINGS CACHE
    # ============================================================

    @classmethod
    def cache_role_permissions(cls, role_id: str, permissions: List[Any]) -> bool:
        """Cache permissions for a role"""
        try:
            if not cls._ping():
                return False

            perm_ids = [
                getattr(p, "id", None) or p.get("id")
                for p in permissions
            ]
            
            key = cls.ROLE_PERMISSIONS_KEY.format(role_id=role_id)
            redis_client.client.setex(
                key,
                cls.ROLE_DEF_TTL,
                json.dumps(perm_ids)
            )
            
            # Also cache individual permissions
            for perm in permissions:
                cls.cache_permission(perm)
            
            return True
        except Exception as e:
            print(f"[RedisRBACService] cache_role_permissions failed: {e}")
            return False

    @classmethod
    def get_role_permissions(cls, role_id: str) -> Optional[List[Dict[str, Any]]]:
        """Get cached permissions for a role"""
        try:
            if not cls._ping():
                return None

            key = cls.ROLE_PERMISSIONS_KEY.format(role_id=role_id)
            blob = redis_client.client.get(key)
            
            if not blob:
                return None

            if isinstance(blob, (bytes, bytearray)):
                blob = blob.decode("utf-8", errors="ignore")
            
            perm_ids = json.loads(blob)
            
            # Fetch each permission
            permissions = []
            for perm_id in perm_ids:
                perm_key = cls.PERMISSION_DEF_KEY.format(permission_id=perm_id)
                perm_blob = redis_client.client.get(perm_key)
                if perm_blob:
                    permissions.append(cls._deserialize(perm_blob))
            
            return permissions if permissions else None
        except Exception as e:
            print(f"[RedisRBACService] get_role_permissions failed: {e}")
            return None

    # ============================================================
    # PERMISSION CHECK CACHE (Computed Results)
    # ============================================================

    @classmethod
    def cache_permission_check(
        cls,
        user_uid: str,
        permission_code: str,
        scope: str,
        resource_id: str,
        allowed: bool
    ) -> bool:
        """Cache result of a permission check"""
        try:
            if not cls._ping():
                return False

            key = cls.PERMISSION_CHECK_KEY.format(
                user_uid=user_uid,
                permission_code=permission_code,
                scope=scope,
                resource_id=resource_id
            )
            
            redis_client.client.setex(
                key,
                cls.PERMISSION_CHECK_TTL,
                json.dumps({"allowed": allowed})
            )
            return True
        except Exception as e:
            print(f"[RedisRBACService] cache_permission_check failed: {e}")
            return False

    @classmethod
    def get_permission_check(
        cls,
        user_uid: str,
        permission_code: str,
        scope: str,
        resource_id: str
    ) -> Optional[bool]:
        """Get cached permission check result"""
        try:
            if not cls._ping():
                return None

            key = cls.PERMISSION_CHECK_KEY.format(
                user_uid=user_uid,
                permission_code=permission_code,
                scope=scope,
                resource_id=resource_id
            )
            
            blob = redis_client.client.get(key)
            if not blob:
                return None

            if isinstance(blob, (bytes, bytearray)):
                blob = blob.decode("utf-8", errors="ignore")
            
            data = json.loads(blob)
            return data.get("allowed")
        except Exception as e:
            print(f"[RedisRBACService] get_permission_check failed: {e}")
            return None

    @classmethod
    def _invalidate_user_permission_checks(cls, user_uid: str) -> None:
        """Invalidate all permission checks for a user"""
        try:
            if not cls._ping():
                return

            pattern = cls.PERMISSION_CHECK_KEY.format(
                user_uid=user_uid,
                permission_code="*",
                scope="*",
                resource_id="*"
            )
            keys = redis_client.client.keys(pattern)
            if keys:
                redis_client.client.delete(*keys)
        except Exception as e:
            print(f"[RedisRBACService] _invalidate_user_permission_checks failed: {e}")

    # ============================================================
    # CUSTOM GRANTS & DENIALS CACHE
    # ============================================================

    @classmethod
    def cache_user_grants(cls, user_uid: str, org_id: str, grants: List[Any]) -> bool:
        """Cache custom grants for a user"""
        try:
            if not cls._ping():
                return False

            key = cls.USER_GRANTS_KEY.format(user_uid=user_uid, org_id=org_id)
            serialized = [cls._serialize(g) for g in grants]
            
            redis_client.client.setex(
                key,
                cls.USER_GRANTS_TTL,
                json.dumps(serialized)
            )
            return True
        except Exception as e:
            print(f"[RedisRBACService] cache_user_grants failed: {e}")
            return False

    @classmethod
    def get_user_grants(cls, user_uid: str, org_id: str) -> Optional[List[Dict[str, Any]]]:
        """Get cached custom grants"""
        try:
            if not cls._ping():
                return None

            key = cls.USER_GRANTS_KEY.format(user_uid=user_uid, org_id=org_id)
            blob = redis_client.client.get(key)
            
            if not blob:
                return None

            if isinstance(blob, (bytes, bytearray)):
                blob = blob.decode("utf-8", errors="ignore")
            
            grants = json.loads(blob)
            return [json.loads(g) if isinstance(g, str) else g for g in grants]
        except Exception as e:
            print(f"[RedisRBACService] get_user_grants failed: {e}")
            return None

    @classmethod
    def cache_user_denials(cls, user_uid: str, org_id: str, denials: List[Any]) -> bool:
        """Cache denials for a user"""
        try:
            if not cls._ping():
                return False

            key = cls.USER_DENIALS_KEY.format(user_uid=user_uid, org_id=org_id)
            serialized = [cls._serialize(d) for d in denials]
            
            redis_client.client.setex(
                key,
                cls.USER_DENIALS_TTL,
                json.dumps(serialized)
            )
            return True
        except Exception as e:
            print(f"[RedisRBACService] cache_user_denials failed: {e}")
            return False

    @classmethod
    def get_user_denials(cls, user_uid: str, org_id: str) -> Optional[List[Dict[str, Any]]]:
        """Get cached denials"""
        try:
            if not cls._ping():
                return None

            key = cls.USER_DENIALS_KEY.format(user_uid=user_uid, org_id=org_id)
            blob = redis_client.client.get(key)
            
            if not blob:
                return None

            if isinstance(blob, (bytes, bytearray)):
                blob = blob.decode("utf-8", errors="ignore")
            
            denials = json.loads(blob)
            return [json.loads(d) if isinstance(d, str) else d for d in denials]
        except Exception as e:
            print(f"[RedisRBACService] get_user_denials failed: {e}")
            return None

    @classmethod
    def invalidate_user_custom_perms(cls, user_uid: str, org_id: Optional[str] = None) -> None:
        """Invalidate custom grants and denials for a user"""
        try:
            if not cls._ping():
                return

            if org_id:
                grants_key = cls.USER_GRANTS_KEY.format(user_uid=user_uid, org_id=org_id)
                denials_key = cls.USER_DENIALS_KEY.format(user_uid=user_uid, org_id=org_id)
                redis_client.client.delete(grants_key, denials_key)
            else:
                # Invalidate all orgs
                grants_pattern = cls.USER_GRANTS_KEY.format(user_uid=user_uid, org_id="*")
                denials_pattern = cls.USER_DENIALS_KEY.format(user_uid=user_uid, org_id="*")
                
                grants_keys = redis_client.client.keys(grants_pattern)
                denials_keys = redis_client.client.keys(denials_pattern)
                
                all_keys = (grants_keys or []) + (denials_keys or [])
                if all_keys:
                    redis_client.client.delete(*all_keys)
            
            # Also invalidate permission checks
            cls._invalidate_user_permission_checks(user_uid)
            
        except Exception as e:
            print(f"[RedisRBACService] invalidate_user_custom_perms failed: {e}")

    # ============================================================
    # EFFECTIVE PERMISSIONS CACHE
    # ============================================================

    @classmethod
    def cache_effective_permissions(
        cls,
        user_uid: str,
        org_id: str,
        scope: Optional[str],
        resource_id: Optional[str],
        permissions: Dict[str, Any]
    ) -> bool:
        """Cache computed effective permissions"""
        try:
            if not cls._ping():
                return False

            key = cls.USER_EFFECTIVE_PERMS_KEY.format(
                user_uid=user_uid,
                org_id=org_id,
                scope=scope or "all",
                resource_id=resource_id or "all"
            )
            
            redis_client.client.setex(
                key,
                cls.PERMISSION_CHECK_TTL,
                json.dumps(permissions)
            )
            return True
        except Exception as e:
            print(f"[RedisRBACService] cache_effective_permissions failed: {e}")
            return False

    @classmethod
    def get_effective_permissions(
        cls,
        user_uid: str,
        org_id: str,
        scope: Optional[str],
        resource_id: Optional[str]
    ) -> Optional[Dict[str, Any]]:
        """Get cached effective permissions"""
        try:
            if not cls._ping():
                return None

            key = cls.USER_EFFECTIVE_PERMS_KEY.format(
                user_uid=user_uid,
                org_id=org_id,
                scope=scope or "all",
                resource_id=resource_id or "all"
            )
            
            blob = redis_client.client.get(key)
            if not blob:
                return None

            if isinstance(blob, (bytes, bytearray)):
                blob = blob.decode("utf-8", errors="ignore")
            
            return json.loads(blob)
        except Exception as e:
            print(f"[RedisRBACService] get_effective_permissions failed: {e}")
            return None

    # ============================================================
    # BULK INVALIDATION UTILITIES
    # ============================================================

    @classmethod
    def invalidate_all_for_user(cls, user_uid: str) -> None:
        """Nuclear option: invalidate everything for a user"""
        try:
            if not cls._ping():
                return

            cls.invalidate_user_roles(user_uid)
            cls.invalidate_user_custom_perms(user_uid)
            cls._invalidate_user_permission_checks(user_uid)
            
            # Invalidate effective permissions
            pattern = cls.USER_EFFECTIVE_PERMS_KEY.format(
                user_uid=user_uid,
                org_id="*",
                scope="*",
                resource_id="*"
            )
            keys = redis_client.client.keys(pattern)
            if keys:
                redis_client.client.delete(*keys)
                
        except Exception as e:
            print(f"[RedisRBACService] invalidate_all_for_user failed: {e}")

    @classmethod
    def invalidate_all_for_org(cls, org_id: str) -> None:
        """Invalidate all RBAC caches for an organization"""
        try:
            if not cls._ping():
                return

            # Invalidate org-specific role lists
            org_roles_key = cls.ROLES_BY_ORG_KEY.format(org_id=org_id)
            redis_client.client.delete(org_roles_key)
            
            # Invalidate user roles for this org
            pattern = cls.USER_ROLES_KEY.format(user_uid="*", org_id=org_id)
            keys = redis_client.client.keys(pattern)
            if keys:
                redis_client.client.delete(*keys)
            
        except Exception as e:
            print(f"[RedisRBACService] invalidate_all_for_org failed: {e}")