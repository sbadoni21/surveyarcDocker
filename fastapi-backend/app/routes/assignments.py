# app/routes/rbac.py
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional
from pydantic import BaseModel

from app.db import get_db
from app.dependencies.permissions import require_permission
from app.policies.auth import get_current_user
from app.models.user import User
from app.models.rbac.permission import (
    AssignmentScope,
    AssignRoleRequest,
    RemoveRoleRequest,
    UserRoleAssignment,
    Role,
)
from app.services.role_assignment_service import RoleAssignmentService
from app.services.permission_service import PermissionService
from app.services.user_permission_service import UserPermissionService

router = APIRouter(prefix="/rbac", tags=["RBAC"])


# =====================================================
# PYDANTIC MODELS FOR USER PERMISSIONS
# =====================================================

class GrantPermissionRequest(BaseModel):
    user_uid: str
    permission_code: str
    scope: str = "org"
    resource_id: str


class RevokePermissionRequest(BaseModel):
    user_uid: str
    permission_code: str
    scope: str = "org"
    resource_id: str


class DenyPermissionRequest(BaseModel):
    user_uid: str
    permission_code: str
    scope: str = "org"
    resource_id: str
    reason: Optional[str] = None


class RemoveDenialRequest(BaseModel):
    user_uid: str
    permission_code: str
    scope: str = "org"
    resource_id: str


# =====================================================
# 1. Assign Role
# =====================================================
@router.post(
    "/assign-role",
    dependencies=[
        Depends(
            require_permission(
                "rbac.assign_role",
                scope=AssignmentScope.org,
            )
        )
    ],
)
def assign_role(
    payload: AssignRoleRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Assign a role to a user at a given scope/resource
    """
    try:
        service = RoleAssignmentService(db)

        assignment = service.assign_role(
            user_uid=payload.user_uid,
            role_name=payload.role_name,
            scope=payload.scope,
            resource_id=payload.resource_id,
            org_id=payload.org_id,
        )

        return {
            "status": "success",
            "assignment_id": assignment.id,
            "role_id": assignment.role_id,
            "user_uid": assignment.user_uid,
            "scope": assignment.scope,
            "resource_id": assignment.resource_id,
        }

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")


# =====================================================
# 2. Remove Role
# =====================================================
@router.post(
    "/remove-role",
    dependencies=[
        Depends(
            require_permission(
                "rbac.remove_role",
                scope=AssignmentScope.org,
            )
        )
    ],
)
def remove_role(
    payload: RemoveRoleRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Remove a role from a user
    """
    try:
        service = RoleAssignmentService(db)

        service.remove_role(
            user_uid=payload.user_uid,
            role_name=payload.role_name,
            scope=payload.scope,
            resource_id=payload.resource_id,
        )

        return {
            "status": "success",
            "message": "Role removed successfully"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =====================================================
# 3. List User Roles
# =====================================================
@router.get(
    "/user/{user_uid}",
    dependencies=[
        Depends(
            require_permission(
                "rbac.view_assignments",
                scope=AssignmentScope.org,
            )
        )
    ],
)
def list_user_roles(
    user_uid: str,
    org_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """
    List all role assignments for a user
    """
    try:
        query = db.query(UserRoleAssignment).filter(
            UserRoleAssignment.user_uid == user_uid
        )

        if org_id:
            query = query.filter(
                UserRoleAssignment.resource_id == org_id
            )

        assignments = query.all()

        result = []
        for a in assignments:
            role = db.query(Role).filter(Role.id == a.role_id).first()
            
            result.append({
                "id": a.id,
                "user_uid": a.user_uid,
                "role_id": a.role_id,
                "role_name": role.name if role else "unknown",
                "scope": a.scope,
                "resource_id": a.resource_id,
                "created_at": a.created_at.isoformat() if a.created_at else None,
            })

        return result

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =====================================================
# 4. Check Permission
# =====================================================
@router.get("/check-permission")
async def check_permission(
    user_id: str = Query(...),
    permission_code: str = Query(...),
    org_id: Optional[str] = Query(None),
    scope: Optional[str] = Query("org"),
    resource_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Check if a user has a specific permission
    """
    
    print("\n==================== [RBAC] CHECK PERMISSION ====================")
    print("[INPUT] user_id         :", user_id)
    print("[INPUT] permission_code :", permission_code)
    print("[INPUT] org_id          :", org_id)
    print("[INPUT] scope           :", scope)
    print("[INPUT] resource_id     :", resource_id)
    
    # Handle both dict and object for current_user
    requester_uid = current_user.uid if hasattr(current_user, 'uid') else current_user.get('uid')
    print("\n[AUTH] current_user.uid :", requester_uid)

    try:
        if requester_uid != user_id:
            print("[AUTH] Checking admin permission for cross-user access")
            
            admin_service = PermissionService(db)
            
            is_admin = admin_service.has_permission(
                user_uid=current_user.uid,
                permission_code="rbac.view_assignments",
                org_id=org_id,
                scope="org",
            )
            
            print("[AUTH] Is admin allowed :", is_admin)
            
            if not is_admin:
                print("[DENY] User is not allowed to check other user's permissions")
                raise HTTPException(
                    status_code=403,
                    detail="You can only check your own permissions"
                )

        print("\n[RBAC] Running PermissionService.has_permission()")
        
        service = PermissionService(db)
        
        allowed = service.has_permission(
            user_uid=user_id,
            permission_code=permission_code,
            org_id=org_id,
            scope=scope,
            resource_id=resource_id,
        )

        print("[RBAC] Permission decision :", allowed)
        print("===============================================================\n")

        return {
            "allowed": allowed,
            "user_uid": user_id,
            "permission_code": permission_code,
            "scope": scope,
            "resource_id": resource_id,
        }

    except HTTPException as e:
        print("[ERROR] HTTPException :", e.status_code, e.detail)
        print("===============================================================\n")
        raise
    
    except Exception as e:
        print("[ERROR] Unexpected exception :", str(e))
        import traceback
        traceback.print_exc()
        print("===============================================================\n")
        raise HTTPException(status_code=500, detail=str(e))


# =====================================================
# 5. List Available Roles
# =====================================================
@router.get("/roles")
def list_roles(
    org_id: Optional[str] = Query(None),
    scope: Optional[AssignmentScope] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    List available roles for assignment
    """
    try:
        query = db.query(Role)

        if org_id:
            query = query.filter(
                (Role.org_id == org_id) | (Role.org_id.is_(None))
            )

        if scope:
            query = query.filter(Role.scope == scope)

        roles = query.all()

        return [
            {
                "id": r.id,
                "name": r.name,
                "scope": r.scope,
                "org_id": r.org_id,
                "is_system": r.is_system,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in roles
        ]

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =====================================================
# 6. Get User Effective Permissions (Legacy)
# =====================================================
@router.get(
    "/user/{user_uid}/permissions",
    dependencies=[
        Depends(
            require_permission(
                "rbac.view_assignments",
                scope=AssignmentScope.org,
            )
        )
    ],
)
async def get_user_permissions(
    user_uid: str,
    org_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """
    Get all effective permissions for a user (legacy endpoint)
    Use /user-permissions/user/{uid}/effective for detailed breakdown
    """
    try:
        service = PermissionService(db)
        
        permissions = service._get_effective_permissions(
            user_uid=user_uid,
            org_id=org_id,
        )

        return {
            "user_uid": user_uid,
            "org_id": org_id,
            "permissions": permissions,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =====================================================
# =====================================================
# USER PERMISSIONS CRUD - NEW SECTION
# =====================================================
# =====================================================


# =====================================================
# 7. Get Effective Permissions (with breakdown)
# =====================================================
@router.get("/user-permissions/user/{user_uid}/effective")
async def get_effective_permissions(
    user_uid: str,
    org_id: str = Query(...),
    scope: Optional[str] = Query(None),
    resource_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get all effective permissions for a user with detailed breakdown
    Shows: role permissions + custom grants - denials
    
    Requires: rbac.view_assignments OR self-access
    """
    
    requester_uid = current_user.uid if hasattr(current_user, 'uid') else current_user.get('uid')
    
    if requester_uid != user_uid:
        perm_service = PermissionService(db)
        
        is_admin = perm_service.has_permission(
            user_uid=requester_uid,
            permission_code="rbac.view_assignments",
            org_id=org_id,
            scope="org",
            resource_id=org_id,
        )
        
        if not is_admin:
            raise HTTPException(
                status_code=403,
                detail="You can only view your own permissions or need rbac.view_assignments"
            )
    
    try:
        service = UserPermissionService(db)
        result = service.get_effective_permissions(
            user_uid=user_uid,
            org_id=org_id,
            scope=scope,
            resource_id=resource_id,
        )
        
        return result
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =====================================================
# 8. Grant Custom Permission
# =====================================================
@router.post(
    "/user-permissions/grant",
    dependencies=[
        Depends(
            require_permission(
                "rbac.manage_permissions",
                scope=AssignmentScope.org,
            )
        )
    ],
)
async def grant_permission(
    data: GrantPermissionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Grant a custom permission to a specific user
    This grants a permission outside of role assignments
    
    Requires: rbac.manage_permissions
    """
    
    try:
        granted_by = current_user.uid if hasattr(current_user, 'uid') else current_user.get('uid')
        
        service = UserPermissionService(db)
        result = service.grant_permission(
            user_uid=data.user_uid,
            permission_code=data.permission_code,
            scope=data.scope,
            resource_id=data.resource_id,
            granted_by=granted_by,
        )
        
        return result
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =====================================================
# 9. Revoke Custom Permission
# =====================================================
@router.post(
    "/user-permissions/revoke",
    dependencies=[
        Depends(
            require_permission(
                "rbac.manage_permissions",
                scope=AssignmentScope.org,
            )
        )
    ],
)
async def revoke_permission(
    data: RevokePermissionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Revoke a custom permission from a user
    This removes a direct permission grant
    
    Requires: rbac.manage_permissions
    """
    
    try:
        service = UserPermissionService(db)
        result = service.revoke_permission(
            user_uid=data.user_uid,
            permission_code=data.permission_code,
            scope=data.scope,
            resource_id=data.resource_id,
        )
        
        return result
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =====================================================
# 10. Deny Permission
# =====================================================
@router.post(
    "/user-permissions/deny",
    dependencies=[
        Depends(
            require_permission(
                "rbac.manage_permissions",
                scope=AssignmentScope.org,
            )
        )
    ],
)
async def deny_permission(
    data: DenyPermissionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Explicitly deny a permission for a user
    Denials override all grants (from roles and custom)
    
    Requires: rbac.manage_permissions
    """
    
    try:
        denied_by = current_user.uid if hasattr(current_user, 'uid') else current_user.get('uid')
        
        service = UserPermissionService(db)
        result = service.deny_permission(
            user_uid=data.user_uid,
            permission_code=data.permission_code,
            scope=data.scope,
            resource_id=data.resource_id,
            denied_by=denied_by,
            reason=data.reason,
        )
        
        return result
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =====================================================
# 11. Remove Denial
# =====================================================
@router.post(
    "/user-permissions/remove-denial",
    dependencies=[
        Depends(
            require_permission(
                "rbac.manage_permissions",
                scope=AssignmentScope.org,
            )
        )
    ],
)
async def remove_denial(
    data: RemoveDenialRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Remove a permission denial
    
    Requires: rbac.manage_permissions
    """
    
    try:
        service = UserPermissionService(db)
        result = service.remove_denial(
            user_uid=data.user_uid,
            permission_code=data.permission_code,
            scope=data.scope,
            resource_id=data.resource_id,
        )
        
        return result
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =====================================================
# 12. List Custom Grants
# =====================================================
@router.get("/user-permissions/user/{user_uid}/custom-grants")
async def list_custom_grants(
    user_uid: str,
    org_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    List all custom permission grants for a user
    
    Requires: rbac.view_assignments OR self-access
    """
    
    requester_uid = current_user.uid if hasattr(current_user, 'uid') else current_user.get('uid')
    
    if requester_uid != user_uid:
        perm_service = PermissionService(db)
        
        is_admin = perm_service.has_permission(
            user_uid=requester_uid,
            permission_code="rbac.view_assignments",
            org_id=org_id,
            scope="org",
            resource_id=org_id,
        )
        
        if not is_admin:
            raise HTTPException(
                status_code=403,
                detail="You can only view your own permissions or need rbac.view_assignments"
            )
    
    try:
        service = UserPermissionService(db)
        grants = service.list_custom_grants(user_uid=user_uid, org_id=org_id)
        
        return {
            "user_uid": user_uid,
            "org_id": org_id,
            "custom_grants": grants,
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =====================================================
# 13. List Denials
# =====================================================
@router.get("/user-permissions/user/{user_uid}/denials")
async def list_denials(
    user_uid: str,
    org_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    List all permission denials for a user
    
    Requires: rbac.view_assignments OR self-access
    """
    
    requester_uid = current_user.uid if hasattr(current_user, 'uid') else current_user.get('uid')
    
    if requester_uid != user_uid:
        perm_service = PermissionService(db)
        
        is_admin = perm_service.has_permission(
            user_uid=requester_uid,
            permission_code="rbac.view_assignments",
            org_id=org_id,
            scope="org",
            resource_id=org_id,
        )
        
        if not is_admin:
            raise HTTPException(
                status_code=403,
                detail="You can only view your own permissions or need rbac.view_assignments"
            )
    
    try:
        service = UserPermissionService(db)
        denials = service.list_denials(user_uid=user_uid, org_id=org_id)
        
        return {
            "user_uid": user_uid,
            "org_id": org_id,
            "denials": denials,
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))