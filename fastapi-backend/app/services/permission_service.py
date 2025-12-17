from typing import Optional, Dict, Set, List
from sqlalchemy.orm import Session
from enum import Enum
import json
from sqlalchemy import text

from app.models.rbac.permission import (
    Role,
    Permission,
    RolePermission,
    UserRoleAssignment,
)
from app.models.rbac.permission_deny import PermissionDeny
from app.core.redis_client import redis_client


class PermissionDecision(Enum):
    ALLOW = "allow"
    DENY = "deny"
    ABSTAIN = "abstain"


class PermissionService:
    """
    Enterprise-grade Permission Resolver
    (Schema-aligned with UserRoleAssignment)
    """

    CACHE_TTL = 900
    OWNER_ROLE_NAME = "owner"

    def __init__(self, db: Session):
        self.db = db

    # =====================================================
    # PUBLIC API
    # =====================================================
# app/services/permission_service.py
    def has_permission(
        self,
        user_uid: str,
        permission_code: str,
        org_id: Optional[str] = None,
        scope: str = "org",
        resource_id: Optional[str] = None,
    ) -> bool:
        """Check if user has permission"""
        
        print(f"\n{'='*60}")
        print(f"[PermissionService] DETAILED DEBUG:")
        print(f"  user_uid: {user_uid}")
        print(f"  permission_code: {permission_code}")
        print(f"  org_id: {org_id}")
        print(f"  scope: {scope}")
        print(f"  resource_id: {resource_id}")
        
        # ✅ FIXED: For org scope, resource_id IS the org_id
        if scope == "org" and org_id and not resource_id:
            resource_id = org_id
            print(f"  [FIX] Setting resource_id = org_id = {resource_id}")
        
        cache_key = f"perm:{user_uid}:{org_id}"
        print(f"  cache_key: {cache_key}")
        
        # ✅ Query user_role_assignments (no org_id column, use scope + resource_id)
        query = text("""
            SELECT DISTINCT p.code, ura.scope, ura.resource_id
            FROM user_role_assignments ura
            JOIN role_permissions rp ON ura.role_id = rp.role_id
            JOIN permissions p ON rp.permission_id = p.id
            WHERE ura.user_uid = :user_uid
            AND ura.scope = :scope
            AND ura.resource_id = :resource_id
        """)
        
        params = {
            "user_uid": user_uid,
            "scope": scope,
            "resource_id": resource_id or org_id  # Fallback to org_id
        }
        
        print(f"  SQL Query params: {params}")
        
        try:
            result = self.db.execute(query, params)
            permissions = result.fetchall()
            
            print(f"  Found {len(permissions)} permission assignments:")
            for perm in permissions:
                print(f"    - code: {perm[0]}, scope: {perm[1]}, resource: {perm[2]}")
            
            # Check for explicit denies first
            if self._check_deny(user_uid, permission_code, org_id, scope, resource_id):
                print(f"  ❌ PERMISSION EXPLICITLY DENIED")
                print(f"{'='*60}\n")
                return False
            
            # Check if the specific permission exists
            for perm_row in permissions:
                perm_code = perm_row[0]
                perm_scope = perm_row[1]
                perm_resource_id = perm_row[2]
                
                if perm_code == permission_code:
                    print(f"  ✅ Found matching permission: {perm_code}")
                    print(f"     Scope: {perm_scope}, Resource: {perm_resource_id}")
                    print(f"  ✅ PERMISSION GRANTED")
                    print(f"{'='*60}\n")
                    return True
            
            print(f"  ❌ PERMISSION DENIED - No matching permission found")
            print(f"  Available permissions: {[p[0] for p in permissions]}")
            print(f"{'='*60}\n")
            return False
            
        except Exception as e:
            print(f"  ❌ ERROR in permission check: {e}")
            import traceback
            traceback.print_exc()
            print(f"{'='*60}\n")
            return False
    
    def _check_deny(
        self,
        user_uid: str,
        permission_code: str,
        org_id: Optional[str],
        scope: str,
        resource_id: Optional[str]
    ) -> bool:
        """Check if permission is explicitly denied"""
        try:
            deny_query = text("""
                SELECT 1
                FROM permission_denies pd
                WHERE pd.user_uid = :user_uid
                AND pd.permission_code = :permission_code
                AND pd.scope = :scope
                AND pd.resource_id = :resource_id
                LIMIT 1
            """)
            
            deny_params = {
                "user_uid": user_uid,
                "permission_code": permission_code,
                "scope": scope,
                "resource_id": resource_id or org_id
            }
            
            deny_result = self.db.execute(deny_query, deny_params)
            return deny_result.fetchone() is not None
        except Exception as e:
            # If permission_denies table doesn't exist, just return False
            print(f"  [WARN] Could not check denies: {e}")
            return False
    # =====================================================
    # OWNER CHECK
    # =====================================================
    def _is_owner(self, user_uid: str, org_id: str) -> bool:
        cache_key = f"owner:{user_uid}:{org_id}"

        cached = redis_client.get(cache_key)
        if cached is not None:
            return cached == "1"

        owner_role = (
            self.db.query(Role)
            .filter(
                Role.name == self.OWNER_ROLE_NAME,
                Role.scope == "org",
            )
            .first()
        )

        if not owner_role:
            redis_client.set(cache_key, "0", ex=self.CACHE_TTL)
            return False

        has_owner = (
            self.db.query(UserRoleAssignment)
            .filter(
                UserRoleAssignment.user_uid == user_uid,
                UserRoleAssignment.role_id == owner_role.id,
                UserRoleAssignment.scope == "org",
                UserRoleAssignment.resource_id == org_id,
            )
            .first()
            is not None
        )

        redis_client.set(cache_key, "1" if has_owner else "0", ex=self.CACHE_TTL)
        return has_owner

    # =====================================================
    # PERMISSION RESOLUTION
    # =====================================================
    def _get_effective_permissions(
        self,
        user_uid: str,
        org_id: Optional[str],
    ) -> Dict:
        cache_key = f"perm:{user_uid}:{org_id or 'global'}"

        cached = redis_client.get(cache_key)
        if cached:
            return json.loads(cached)

        perms = self._load_permissions_from_db(user_uid)

        redis_client.set(cache_key, json.dumps(perms), ex=self.CACHE_TTL)
        return perms

    def _load_permissions_from_db(self, user_uid: str) -> Dict:
        """
        Expand role assignments → permissions
        """

        assignments = (
            self.db.query(UserRoleAssignment)
            .filter(UserRoleAssignment.user_uid == user_uid)
            .all()
        )

        effective: Dict[str, Dict[str, Set[str]]] = {
            "org": {},
            "group": {},
            "team": {},
            "project": {},
            "denies": {},
        }

        for a in assignments:
            role_perms = (
                self.db.query(Permission.code)
                .join(RolePermission, RolePermission.permission_id == Permission.id)
                .filter(RolePermission.role_id == a.role_id)
                .all()
            )

            perm_codes = {p[0] for p in role_perms}

            scope = a.scope.value
            target = a.resource_id or "*"

            effective.setdefault(scope, {})
            effective[scope].setdefault(target, set()).update(perm_codes)

        # Explicit denies
        denies = (
            self.db.query(PermissionDeny)
            .filter(PermissionDeny.user_uid == user_uid)
            .all()
        )

        for d in denies:
            effective["denies"].setdefault(d.scope, {}).setdefault(
                d.resource_id or "*", set()
            ).add(d.permission_code)

        # Convert sets → lists
        return {
            s: {k: list(v) for k, v in data.items()}
            for s, data in effective.items()
        }

    # =====================================================
    # DECISION HELPERS
    # =====================================================
    def _is_allowed(
        self,
        perms: Dict,
        permission: str,
        scope: Optional[str],
        resource_id: Optional[str],
    ) -> bool:
        for sc in self._get_scope_chain(scope):
            if resource_id and permission in perms.get(sc, {}).get(resource_id, []):
                return True
            if permission in perms.get(sc, {}).get("*", []):
                return True
        return False

    def _is_explicitly_denied(
        self,
        perms: Dict,
        permission: str,
        scope: Optional[str],
        resource_id: Optional[str],
    ) -> bool:
        denies = perms.get("denies", {})

        if scope in denies:
            if resource_id and permission in denies[scope].get(resource_id, []):
                return True
            if permission in denies[scope].get("*", []):
                return True

        return False

    def _get_scope_chain(self, scope: Optional[str]) -> List[str]:
        order = ["org", "group", "team", "project"]
        return order if not scope else order[: order.index(scope) + 1]
