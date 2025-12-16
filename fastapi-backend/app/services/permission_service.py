from typing import Optional, Dict, Set, List
from sqlalchemy.orm import Session
from enum import Enum
import json

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
    def has_permission(
        self,
        user_uid: str,
        permission_code: str,
        *,
        org_id: Optional[str] = None,
        scope: Optional[str] = None,
        resource_id: Optional[str] = None,
    ) -> bool:

        # 🔥 OWNER OVERRIDE (org scope only)
        if org_id and self._is_owner(user_uid, org_id):
            return True

        perms = self._get_effective_permissions(
            user_uid=user_uid,
            org_id=org_id,
        )

        # ❌ Explicit deny wins
        if self._is_explicitly_denied(perms, permission_code, scope, resource_id):
            return False

        # ✅ Allow?
        return self._is_allowed(perms, permission_code, scope, resource_id)

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
