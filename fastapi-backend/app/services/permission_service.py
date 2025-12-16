from typing import Optional, Dict, Set, List
from sqlalchemy.orm import Session
from enum import Enum
import asyncio
import json

from ..models.rbac.permission import (
    Role,
    Permission,
    RolePermission,
    UserRoleAssignment,
)
from ..core.redis_client import redis_client
from ..models.rbac.permission_deny import PermissionDeny


class PermissionDecision(Enum):
    ALLOW = "allow"
    DENY = "deny"
    ABSTAIN = "abstain"


class PermissionService:
    """
    Enterprise-grade Permission Resolver with Owner Override
    """

    CACHE_TTL = 900  # 15 minutes
    OWNER_ROLE_NAME = "owner"  # Name of the owner role

    def __init__(self, db: Session):
        self.db = db

    # ------------------------------
    # Public API
    # ------------------------------
    async def has_permission(
        self,
        user_uid: str,
        permission_code: str,
        *,
        org_id: Optional[str] = None,
        scope: Optional[str] = None,
        resource_id: Optional[str] = None,
    ) -> bool:
        """
        Final decision engine with owner override
        
        Owner role at org level grants access to everything in that org.
        """
        
        # Check if user is owner at org level - owners have all permissions
        if org_id and await self._is_owner(user_uid, org_id):
            return True

        permissions = await self._get_effective_permissions(
            user_uid=user_uid,
            org_id=org_id,
        )

        # Explicit deny always wins (except for owners, handled above)
        if self._is_explicitly_denied(
            permissions,
            permission_code,
            scope,
            resource_id,
        ):
            return False

        # Allowed?
        return self._is_allowed(
            permissions,
            permission_code,
            scope,
            resource_id,
        )

    async def _is_owner(self, user_uid: str, org_id: str) -> bool:
        """
        Check if user has owner role at org level
        
        This is cached separately for performance
        """
        cache_key = f"owner:{user_uid}:{org_id}"
        
        cached = await redis_client.get(cache_key)
        if cached is not None:
            return cached == "1"
        
        # Query for owner role assignment at org level
        owner_role = (
            self.db.query(Role)
            .filter(
                Role.name == self.OWNER_ROLE_NAME,
                Role.scope == "org",
            )
            .first()
        )
        
        if not owner_role:
            await redis_client.set(cache_key, "0", ex=self.CACHE_TTL)
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
        ) is not None
        
        await redis_client.set(
            cache_key, 
            "1" if has_owner else "0", 
            ex=self.CACHE_TTL
        )
        
        return has_owner

    # ------------------------------
    # Core Resolution
    # ------------------------------
    async def _get_effective_permissions(
        self,
        user_uid: str,
        org_id: Optional[str],
    ) -> Dict:
        cache_key = f"perm:{user_uid}:{org_id or 'global'}"

        cached = await redis_client.get(cache_key)
        if cached:
            return json.loads(cached)

        permissions = self._load_permissions_from_db(user_uid, org_id)

        await redis_client.set(
            cache_key,
            json.dumps(permissions),
            ex=self.CACHE_TTL,
        )

        return permissions

    def _load_permissions_from_db(
        self,
        user_uid: str,
        org_id: Optional[str],
    ) -> Dict:
        """
        Fetch all role assignments and expand to permissions
        """

        assignments = (
            self.db.query(UserRoleAssignment)
            .filter(UserRoleAssignment.user_uid == user_uid)
            .filter(
                (UserRoleAssignment.org_id == org_id)
                | (UserRoleAssignment.org_id.is_(None))
            )
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
            role_permissions = (
                self.db.query(Permission.code)
                .join(RolePermission)
                .filter(RolePermission.role_id == a.role_id)
                .all()
            )

            perm_codes = {p[0] for p in role_permissions}

            scope = a.scope
            target = a.resource_id or "*"

            effective.setdefault(scope, {})
            effective[scope].setdefault(target, set()).update(perm_codes)

        # Load explicit denies
        denies = (
            self.db.query(PermissionDeny)
            .filter(PermissionDeny.user_uid == user_uid)
            .all()
        )

        for d in denies:
            effective["denies"].setdefault(d.scope, {}).setdefault(
                d.resource_id or "*", set()
            ).add(d.permission_code)

        # Convert sets to lists for JSON
        return {
            scope: {k: list(v) for k, v in data.items()}
            for scope, data in effective.items()
        }

    # ------------------------------
    # Decision Helpers
    # ------------------------------
    def _is_allowed(
        self,
        perms: Dict,
        permission: str,
        scope: Optional[str],
        resource_id: Optional[str],
    ) -> bool:
        """
        Check scope + inherited scopes
        """

        scope_chain = self._get_scope_chain(scope)

        for sc in scope_chain:
            # exact resource
            if resource_id and permission in perms.get(sc, {}).get(resource_id, []):
                return True

            # wildcard resource
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

        # Exact deny
        if (
            scope in denies
            and resource_id in denies[scope]
            and permission in denies[scope][resource_id]
        ):
            return True

        # Wildcard deny
        if scope in denies and "*" in denies[scope]:
            if permission in denies[scope]["*"]:
                return True

        return False

    def _get_scope_chain(self, scope: Optional[str]) -> List[str]:
        """
        Determines inheritance chain
        """
        order = ["org", "group", "team", "project"]

        if not scope:
            return order

        idx = order.index(scope)
        return order[: idx + 1]