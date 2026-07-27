from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from uuid import uuid4
from typing import Optional

from app.models.rbac.permission import (
    Role,
    UserRoleAssignment,
    RoleScope,
)
from app.core.redis_client import redis_client


class RoleAssignmentService:
    """
    Enterprise-grade role assignment manager with comprehensive cache handling
    """

    def __init__(self, db: Session):
        self.db = db

    # -------------------------
    # Public API
    # -------------------------

    def assign_role(
        self,
        *,
        user_uid: str,
        role_name: str,
        scope: RoleScope,
        resource_id: str,
        org_id: Optional[str] = None,
    ) -> UserRoleAssignment:
        """
        Assign a role to a user (idempotent)
        """

        role = self._get_role(role_name, scope, org_id)

        # Prevent duplicates
        existing = (
            self.db.query(UserRoleAssignment)
            .filter(
                UserRoleAssignment.user_uid == user_uid,
                UserRoleAssignment.role_id == role.id,
                UserRoleAssignment.scope == scope,
                UserRoleAssignment.resource_id == resource_id,
            )
            .first()
        )

        if existing:
            return existing

        assignment = UserRoleAssignment(
            id=str(uuid4()),
            user_uid=user_uid,
            role_id=role.id,
            scope=scope,
            resource_id=resource_id,
        )

        self.db.add(assignment)
        self.db.commit()

        # Invalidate caches
        self._invalidate_user_cache(user_uid, resource_id if scope == "org" else None)

        return assignment

    def remove_role(
        self,
        *,
        user_uid: str,
        role_name: str,
        scope: RoleScope,
        resource_id: str,
    ) -> None:
        """
        Remove a role assignment
        """

        role = (
            self.db.query(Role)
            .filter(
                Role.name == role_name,
                Role.scope == scope,
            )
            .first()
        )

        if not role:
            return

        self.db.query(UserRoleAssignment).filter(
            UserRoleAssignment.user_uid == user_uid,
            UserRoleAssignment.role_id == role.id,
            UserRoleAssignment.scope == scope,
            UserRoleAssignment.resource_id == resource_id,
        ).delete()

        self.db.commit()
        self._invalidate_user_cache(user_uid, resource_id if scope == "org" else None)

    # -------------------------
    # Internal helpers
    # -------------------------

    def _get_role(
        self,
        name: str,
        scope: RoleScope,
        org_id: Optional[str],
    ) -> Role:
        """
        Resolve system or org role
        """
        role = (
            self.db.query(Role)
            .filter(
                Role.name == name,
                Role.scope == scope,
                (Role.org_id == org_id) | (Role.org_id.is_(None)),
            )
            .order_by(Role.org_id.desc())  # org role overrides system role
            .first()
        )

        if not role:
            raise ValueError(f"Role not found: {name} ({scope})")

        return role

    def _invalidate_user_cache(self, user_uid: str, org_id: Optional[str] = None):
        """
        Remove all permission caches for user, including owner cache
        Uses SCAN for pattern matching to avoid blocking Redis
        """
        try:
            # Always invalidate global permission cache
            redis_client.delete(f"perm:{user_uid}:global")
            
            # Always invalidate user data cache (may contain role info)
            redis_client.delete(f"user:{user_uid}")
            
            if org_id:
                # Specific org caches
                redis_client.delete(f"perm:{user_uid}:{org_id}")
                redis_client.delete(f"owner:{user_uid}:{org_id}")
                redis_client.delete(f"org_users:{org_id}")
                
                print(f"[RoleAssignment] Invalidated caches for user {user_uid} in org {org_id}")
            else:
                # When org_id is unknown, use SCAN to clear all owner and perm caches
                # SCAN is non-blocking and production-safe
                
                # Clear owner cache pattern
                owner_count = self._scan_and_delete(f"owner:{user_uid}:*")
                
                # Clear permission cache pattern  
                perm_count = self._scan_and_delete(f"perm:{user_uid}:*")
                
                print(f"[RoleAssignment] Invalidated {owner_count} owner caches and {perm_count} permission caches for user {user_uid}")
                
        except Exception as e:
            print(f"[RoleAssignment] Cache invalidation error (non-fatal): {e}")

    def _scan_and_delete(self, pattern: str, count: int = 100) -> int:
        """
        Use SCAN to find and delete keys matching pattern
        Safe for production use (non-blocking)
        
        Args:
            pattern: Redis key pattern (e.g., "owner:user-123:*")
            count: Number of keys to scan per iteration
            
        Returns:
            Number of keys deleted
        """
        try:
            if not redis_client.ping():
                return 0
            
            deleted = 0
            cursor = 0
            
            while True:
                cursor, keys = redis_client.client.scan(
                    cursor=cursor,
                    match=pattern,
                    count=count
                )
                
                if keys:
                    # Delete in batches
                    deleted += redis_client.delete(*keys)
                
                # cursor returns to 0 when complete
                if cursor == 0:
                    break
            
            return deleted
                
        except Exception as e:
            print(f"[RoleAssignment] SCAN failed for pattern {pattern}: {e}")
            return 0