# app/dependencies/permissions.py
from typing import Optional, Callable, Any
from fastapi import Depends, HTTPException, status, Query, Request
from sqlalchemy.orm import Session

from app.db import get_db
from app.services.permission_service import PermissionService
from app.policies.auth import get_current_user
from app.models.user import User
from app.models.rbac.permission import AssignmentScope


# =====================================================
# Core permission dependency factory with Request
# =====================================================

def require_permission(
    permission_code: str,
    *,
    scope: AssignmentScope,
    resource_param: Optional[str] = None,
    org_param: str = "org_id",
    allow_self: bool = False,  # Allow users to access their own resources
) -> Callable:
    """
    FastAPI dependency for RBAC enforcement

    Args:
        permission_code: The permission to check (e.g., "rbac.view_assignments")
        scope: The scope level (org, group, etc.)
        resource_param: Path parameter name for resource_id (e.g., "group_id")
        org_param: Query parameter name for org_id (default: "org_id")
        allow_self: If True, allow users to access their own user_uid resources

    Example:
        Depends(require_permission(
            "support.group.update",
            scope=AssignmentScope.group,
            resource_param="group_id"
        ))
    """

    async def _permission_guard(
        request: Request,  # Access to full request
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
        org_id: Optional[str] = Query(None),
    ):
        """
        Inner guard function that FastAPI will call
        """
        
        # Get user_uid from current_user (handle both dict and object)
        user_uid = current_user.uid if hasattr(current_user, 'uid') else current_user.get('uid')
        
        # -------------------------------------
        # Extract resource_id from path params
        # -------------------------------------
        resource_id = None
        
        if resource_param:
            # Get resource_id from path parameters
            resource_id = request.path_params.get(resource_param)
            
            if not resource_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Missing path parameter: {resource_param}",
                )
        
        # Special case: allow users to access their own resources
        if allow_self and resource_param == "user_uid":
            target_user_uid = request.path_params.get("user_uid")
            if target_user_uid == user_uid:
                # User is accessing their own resource
                return True
        
        # -------------------------------------
        # Validate scope requirements
        # -------------------------------------
        if scope != AssignmentScope.org and not resource_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Missing resource identifier for scope '{scope.value}'",
            )

        # -------------------------------------
        # Permission check
        # -------------------------------------
        perm_service = PermissionService(db)

        try:
            allowed =  perm_service.has_permission(
                user_uid=user_uid,
                permission_code=permission_code,
                org_id=org_id,
                scope=scope.value,
                resource_id=resource_id,
            )

            if not allowed:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"You do not have permission: {permission_code}",
                )

            return True

        except HTTPException:
            raise
        except Exception as e:
            print(f"[RBAC] Permission check error: {e}")
            import traceback
            traceback.print_exc()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Permission check failed: {str(e)}",
            )

    return _permission_guard


# =====================================================
# Specialized dependency for viewing user permissions
# =====================================================

def can_view_user_permissions() -> Callable:
    """
    Special dependency for /user/{user_uid}/permissions endpoint
    Allows:
    1. Users to view their own permissions
    2. Admins with rbac.view_assignments to view anyone's permissions
    """
    async def _view_permissions_guard(
        request: Request,
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
        org_id: Optional[str] = Query(None),
    ):
        # Get user_uid from current_user
        requester_uid = current_user.uid if hasattr(current_user, 'uid') else current_user.get('uid')
        
        # Get target user_uid from path
        target_user_uid = request.path_params.get("user_uid")
        
        if not target_user_uid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Missing user_uid in path",
            )
        
        # Allow users to view their own permissions
        if requester_uid == target_user_uid:
            print(f"[RBAC] User {requester_uid} viewing their own permissions")
            return True
        
        # Check if user has admin permission
        perm_service = PermissionService(db)
        
        try:
            is_admin =  perm_service.has_permission(
                user_uid=requester_uid,
                permission_code="rbac.view_assignments",
                org_id=org_id,
                scope=AssignmentScope.org.value,
                resource_id=None,
            )
            
            if not is_admin:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You can only view your own permissions or need rbac.view_assignments permission",
                )
            
            print(f"[RBAC] Admin {requester_uid} viewing {target_user_uid}'s permissions")
            return True
            
        except HTTPException:
            raise
        except Exception as e:
            print(f"[RBAC] Permission check error: {e}")
            import traceback
            traceback.print_exc()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Permission check failed: {str(e)}",
            )

    return _view_permissions_guard


# =====================================================
# Alternative: Resource-specific dependency factories
# =====================================================

def require_group_permission(permission_code: str) -> Callable:
    """
    Specialized dependency for group-scoped permissions
    """
    async def _group_permission_guard(
        request: Request,
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
        org_id: Optional[str] = Query(None),
    ):
        group_id = request.path_params.get("group_id")
        
        if not group_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Missing group_id in path",
            )
        
        user_uid = current_user.uid if hasattr(current_user, 'uid') else current_user.get('uid')
        perm_service = PermissionService(db)
        
        allowed =  perm_service.has_permission(
            user_uid=user_uid,
            permission_code=permission_code,
            org_id=org_id,
            scope=AssignmentScope.group.value,
            resource_id=group_id,
        )

        if not allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"You do not have permission: {permission_code}",
            )

        return True

    return _group_permission_guard


def require_org_permission(permission_code: str) -> Callable:
    """
    Specialized dependency for org-scoped permissions
    """
    async def _org_permission_guard(
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
        org_id: Optional[str] = Query(None),
    ):
        user_uid = current_user.uid if hasattr(current_user, 'uid') else current_user.get('uid')
        perm_service = PermissionService(db)
        
        allowed =  perm_service.has_permission(
            user_uid=user_uid,
            permission_code=permission_code,
            org_id=org_id,
            scope=AssignmentScope.org.value,
            resource_id=None,
        )

        if not allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"You do not have permission: {permission_code}",
            )

        return True

    return _org_permission_guard