# app/routes/rbac.py
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional

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

router = APIRouter(prefix="/rbac", tags=["RBAC"])


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
# 3. List User Roles (Fixed Query)
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
        # Build query
        query = db.query(UserRoleAssignment).filter(
            UserRoleAssignment.user_uid == user_uid
        )

        # Optionally filter by org
        if org_id:
            query = query.filter(
                UserRoleAssignment.resource_id == org_id
            )

        assignments = query.all()

        # Join with Role to get role names
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
# 4. Check Permission (NEW - for frontend checks)
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
    
    This endpoint allows the frontend to verify permissions
    before showing/hiding UI elements
    """
    try:
        print(user_id,permission_code,org_id,scope,resource_id,db,current_user)
        if current_user.uid != user_id:
            # Check if current user has admin permission
            admin_service = PermissionService(db)
            is_admin = await admin_service.has_permission(
                user_id=current_user.uid,
                permission_code="rbac.view_assignments",
                org_id=org_id,
                scope="org",
            )
            
            if not is_admin:
                raise HTTPException(
                    status_code=403,
                    detail="You can only check your own permissions"
                )

        service = PermissionService(db)
        
        allowed = await service.has_permission(
            user_uid=user_uid,
            permission_code=permission_code,
            org_id=org_id,
            scope=scope,
            resource_id=resource_id,
        )

        return {
            "allowed": allowed,
            "user_uid": user_uid,
            "permission_code": permission_code,
            "scope": scope,
            "resource_id": resource_id,
        }

    except HTTPException:
        raise
    except Exception as e:
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

        # Filter by org (include system roles)
        if org_id:
            query = query.filter(
                (Role.org_id == org_id) | (Role.org_id.is_(None))
            )

        # Filter by scope
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
# 6. Get User Effective Permissions (Debug/Admin)
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
    Get all effective permissions for a user (for debugging/admin UI)
    """
    try:
        service = PermissionService(db)
        
        permissions = await service._get_effective_permissions(
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