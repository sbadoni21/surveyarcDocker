# app/services/permission_management_service.py

from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from uuid import uuid4
from typing import Optional, List, Dict
from fastapi import HTTPException

from app.models.rbac.permission import (
    Permission,
    Role,
    RolePermission,
    RoleScope,
)
from app.core.redis_client import redis_client


class PermissionManagementService:
    """
    Service for managing permissions (CRUD operations)
    """

    def __init__(self, db: Session):
        self.db = db

    # =====================================================
    # PERMISSION CRUD
    # =====================================================

    def create_permission(
        self,
        *,
        code: str,
        module: str,
        description: Optional[str] = None,
    ) -> Permission:
        """
        Create a new permission
        """
        # Check if permission already exists
        existing = (
            self.db.query(Permission)
            .filter(Permission.code == code)
            .first()
        )

        if existing:
            raise HTTPException(
                status_code=400,
                detail=f"Permission with code '{code}' already exists"
            )

        permission = Permission(
            id=str(uuid4()),
            code=code,
            module=module,
            description=description,
        )

        self.db.add(permission)
        self.db.commit()
        self.db.refresh(permission)

        # Invalidate all permission caches since new permission is available
        self._invalidate_all_caches()

        return permission

    def list_permissions(
        self,
        *,
        module: Optional[str] = None,
        search: Optional[str] = None,
    ) -> List[Permission]:
        """
        List all permissions with optional filtering
        """
        query = self.db.query(Permission)

        if module:
            query = query.filter(Permission.module == module)

        if search:
            query = query.filter(
                Permission.code.ilike(f"%{search}%")
                | Permission.description.ilike(f"%{search}%")
            )

        return query.order_by(Permission.module, Permission.code).all()

    def get_permissions_by_module(self) -> Dict[str, List[Permission]]:
        """
        Group permissions by module
        """
        permissions = self.db.query(Permission).order_by(Permission.module).all()

        grouped: Dict[str, List[Permission]] = {}
        for perm in permissions:
            if perm.module not in grouped:
                grouped[perm.module] = []
            grouped[perm.module].append(perm)

        return grouped

    def get_permission(self, permission_id: str) -> Optional[Permission]:
        """
        Get a single permission by ID
        """
        return (
            self.db.query(Permission)
            .filter(Permission.id == permission_id)
            .first()
        )

    def update_permission(
        self,
        *,
        permission_id: str,
        code: Optional[str] = None,
        module: Optional[str] = None,
        description: Optional[str] = None,
    ) -> Permission:
        """
        Update an existing permission
        """
        permission = self.get_permission(permission_id)

        if not permission:
            raise HTTPException(
                status_code=404,
                detail=f"Permission with ID '{permission_id}' not found"
            )

        # Check for code conflicts if updating code
        if code and code != permission.code:
            existing = (
                self.db.query(Permission)
                .filter(Permission.code == code)
                .first()
            )
            if existing:
                raise HTTPException(
                    status_code=400,
                    detail=f"Permission with code '{code}' already exists"
                )
            permission.code = code

        if module is not None:
            permission.module = module

        if description is not None:
            permission.description = description

        self.db.commit()
        self.db.refresh(permission)

        # Invalidate caches
        self._invalidate_all_caches()

        return permission

    def delete_permission(self, permission_id: str) -> bool:
        """
        Delete a permission (will cascade to role_permissions)
        """
        permission = self.get_permission(permission_id)

        if not permission:
            raise HTTPException(
                status_code=404,
                detail=f"Permission with ID '{permission_id}' not found"
            )

        # Check if permission is used in any roles
        usage_count = (
            self.db.query(RolePermission)
            .filter(RolePermission.permission_id == permission_id)
            .count()
        )

        if usage_count > 0:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot delete permission: it is used in {usage_count} role(s)"
            )

        self.db.delete(permission)
        self.db.commit()

        # Invalidate caches
        self._invalidate_all_caches()

        return True

    # =====================================================
    # ROLE-PERMISSION MANAGEMENT
    # =====================================================

    def add_permission_to_role(
        self,
        *,
        role_id: str,
        permission_id: str,
    ) -> RolePermission:
        """
        Add a permission to a role
        """
        # Verify role exists
        role = self.db.query(Role).filter(Role.id == role_id).first()
        if not role:
            raise HTTPException(
                status_code=404,
                detail=f"Role with ID '{role_id}' not found"
            )

        # Verify permission exists
        permission = self.get_permission(permission_id)
        if not permission:
            raise HTTPException(
                status_code=404,
                detail=f"Permission with ID '{permission_id}' not found"
            )

        # Check if already assigned
        existing = (
            self.db.query(RolePermission)
            .filter(
                RolePermission.role_id == role_id,
                RolePermission.permission_id == permission_id,
            )
            .first()
        )

        if existing:
            return existing

        role_permission = RolePermission(
            role_id=role_id,
            permission_id=permission_id,
        )

        self.db.add(role_permission)
        self.db.commit()

        # Invalidate caches
        self._invalidate_all_caches()

        return role_permission

    def remove_permission_from_role(
        self,
        *,
        role_id: str,
        permission_id: str,
    ) -> bool:
        """
        Remove a permission from a role
        """
        deleted = (
            self.db.query(RolePermission)
            .filter(
                RolePermission.role_id == role_id,
                RolePermission.permission_id == permission_id,
            )
            .delete()
        )

        self.db.commit()

        if deleted:
            # Invalidate caches
            self._invalidate_all_caches()

        return deleted > 0

    def get_role_permissions(self, role_id: str) -> List[Permission]:
        """
        Get all permissions for a role
        """
        permissions = (
            self.db.query(Permission)
            .join(RolePermission, RolePermission.permission_id == Permission.id)
            .filter(RolePermission.role_id == role_id)
            .order_by(Permission.module, Permission.code)
            .all()
        )

        return permissions

    # =====================================================
    # CACHE MANAGEMENT
    # =====================================================

    def _invalidate_all_caches(self):
        """
        Invalidate all permission caches
        
        In production, you'd want to use Redis SCAN with pattern matching
        For now, we just note that caches will expire naturally
        """
        # Note: Redis doesn't support efficient wildcard delete without SCAN
        # Options:
        # 1. Use SCAN with pattern "perm:*" and delete matches (best for production)
        # 2. Use a version number in cache keys (increment on changes)
        # 3. Let TTL expire naturally (current approach)
        
        # For immediate effect, we could track active users and delete their caches
        # This would require maintaining a set of active user_ids
        pass