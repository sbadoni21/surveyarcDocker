# app/dependencies/permissions.py
from typing import Optional, Callable, Any
from fastapi import Depends, HTTPException, status, Request
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
    allow_self: bool = False,
) -> Callable:
    """
    FastAPI dependency for RBAC enforcement
    """

    async def _permission_guard(
        request: Request,
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ):
        """Inner guard function that FastAPI will call"""
        
        # Get user_uid from current_user
        user_uid = current_user.uid if hasattr(current_user, 'uid') else current_user.get('uid')
        
        # Get org_id from path params or query params
        org_id = (
            request.path_params.get("org_id")
            or request.query_params.get("org_id")
            or getattr(current_user, "org_id", None)
            or (current_user.get("org_id") if isinstance(current_user, dict) else None)
        )
        
        # Extract resource_id from path params if specified
        resource_id = None
        if resource_param:
            resource_id = request.path_params.get(resource_param)
            if not resource_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Missing path parameter: {resource_param}",
                )
        
        # ✅ NEW: For org scope, resource_id should be org_id
        if scope == AssignmentScope.org and not resource_id:
            resource_id = org_id
        
        # Special case: allow users to access their own resources
        if allow_self and resource_param == "user_uid":
            target_user_uid = request.path_params.get("user_uid")
            if target_user_uid == user_uid:
                print(f"[RBAC] Allowing self-access")
                return True
        
        # ✅ IMPROVED: Validate scope requirements
        if scope != AssignmentScope.org and not resource_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Missing resource identifier for scope '{scope.value}'",
            )
        
        # ✅ NEW: Validate org_id is present when needed
        if not org_id and scope != AssignmentScope.org:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Missing org_id in request",
            )

        # Permission check
        perm_service = PermissionService(db)

        try:
            allowed = perm_service.has_permission(
                user_uid=user_uid,
                permission_code=permission_code,
                org_id=org_id,
                scope=scope.value,
                resource_id=resource_id,
            )
            
            print(f"[RBAC] Permission check:")
            print(f"  user: {user_uid}")
            print(f"  permission: {permission_code}")
            print(f"  scope: {scope.value}")
            print(f"  org_id: {org_id}")
            print(f"  resource_id: {resource_id}")
            print(f"  result: {allowed}")

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
# ✅ NEW: Convenience wrapper for org-level permissions
# =====================================================

def require_org_level_permission(permission_code: str) -> Callable:
    """
    Shorthand for org-scoped permissions (like project.create, user.create, etc.)
    No resource_param needed - uses org_id from path/query
    """
    return require_permission(
        permission_code=permission_code,
        scope=AssignmentScope.org,
        resource_param=None,
    )


# =====================================================
# ✅ NEW: Convenience wrapper for project permissions
# =====================================================

def require_project_permission(permission_code: str) -> Callable:
    """
    Shorthand for project-scoped permissions
    Automatically extracts project_id from path params
    """
    return require_permission(
        permission_code=permission_code,
        scope=AssignmentScope.project,
        resource_param="project_id",
    )


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
    ):
        # Get user_uid from current_user
        requester_uid = current_user.uid if hasattr(current_user, 'uid') else current_user.get('uid')
        
        # Get org_id from request
        org_id = (
            request.path_params.get("org_id")
            or request.query_params.get("org_id")
            or getattr(current_user, "org_id", None)
            or (current_user.get("org_id") if isinstance(current_user, dict) else None)
        )
        
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
            is_admin = perm_service.has_permission(
                user_uid=requester_uid,
                permission_code="rbac.view_assignments",
                org_id=org_id,
                scope=AssignmentScope.org.value,
                resource_id=org_id,  # ✅ FIXED: Pass org_id as resource_id for org scope
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
    ):
        group_id = request.path_params.get("group_id")
        
        # Get org_id from request
        org_id = (
            request.path_params.get("org_id")
            or request.query_params.get("org_id")
            or getattr(current_user, "org_id", None)
            or (current_user.get("org_id") if isinstance(current_user, dict) else None)
        )
        
        if not group_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Missing group_id in path",
            )
        
        user_uid = current_user.uid if hasattr(current_user, 'uid') else current_user.get('uid')
        perm_service = PermissionService(db)
        
        allowed = perm_service.has_permission(
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
        request: Request,
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ):
        # Get org_id from request
        org_id = (
            request.path_params.get("org_id")
            or request.query_params.get("org_id")
            or getattr(current_user, "org_id", None)
            or (current_user.get("org_id") if isinstance(current_user, dict) else None)
        )
        
        if not org_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Missing org_id in request",
            )
        
        user_uid = current_user.uid if hasattr(current_user, 'uid') else current_user.get('uid')
        perm_service = PermissionService(db)
        
        allowed = perm_service.has_permission(
            user_uid=user_uid,
            permission_code=permission_code,
            org_id=org_id,
            scope=AssignmentScope.org.value,
            resource_id=org_id,  # ✅ FIXED: Pass org_id as resource_id for org scope
        )

        if not allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"You do not have permission: {permission_code}",
            )

        return True

    return _org_permission_guard


# =====================================================
# ✅ NEW: Check if user can access specific resource
# =====================================================

async def check_resource_access(
    user_uid: str,
    resource_type: str,  # "project", "group", "team"
    resource_id: str,
    org_id: str,
    db: Session,
) -> bool:
    """
    Helper function to check if user has ANY access to a resource
    Useful for filtering lists by user access
    """
    perm_service = PermissionService(db)
    
    # Check for read permission on the resource
    permission_code = f"{resource_type}.read"
    
    # Try resource-scoped permission first
    has_resource_access = perm_service.has_permission(
        user_uid=user_uid,
        permission_code=permission_code,
        org_id=org_id,
        scope=resource_type,
        resource_id=resource_id,
    )
    
    if has_resource_access:
        return True
    
    # Try org-level permission as fallback
    has_org_access = perm_service.has_permission(
        user_uid=user_uid,
        permission_code=permission_code,
        org_id=org_id,
        scope="org",
        resource_id=org_id,
    )
    
    return has_org_access