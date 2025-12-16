# app/routes/rbac.py
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from typing import Optional

from app.db import get_db
from app.dependencies.permissions import require_permission, can_view_user_permissions
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
import uuid

router = APIRouter(prefix="/rbac", tags=["RBAC"])


# =====================================================
# 1. Assign Role (FIXED: removed duplicate decorator)
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
def assign_role(  # Keep sync - no await calls in body
    data: AssignRoleRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Ensure scope is string value
    scope = data.scope.value if hasattr(data.scope, 'value') else data.scope

    role = (
        db.query(Role)
        .filter(
            Role.name == data.role_name,
            Role.scope == scope,
        )
        .first()
    )

    if not role:
        raise HTTPException(404, "Role not found")

    # Check if assignment already exists
    existing = (
        db.query(UserRoleAssignment)
        .filter(
            UserRoleAssignment.user_uid == data.user_uid,
            UserRoleAssignment.role_id == role.id,
            UserRoleAssignment.scope == scope,
            UserRoleAssignment.resource_id == data.resource_id,
        )
        .first()
    )

    if existing:
        return {"status": "already_assigned", "assignment_id": existing.id}

    assignment = UserRoleAssignment(
        id=str(uuid.uuid4()),
        user_uid=data.user_uid,
        role_id=role.id,
        scope=scope,
        resource_id=data.resource_id,
    )

    db.add(assignment)
    db.commit()
    db.refresh(assignment)

    return {"status": "assigned", "assignment_id": assignment.id}


# =====================================================
# 2. Remove Role (FIXED: scope handling)
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
async def remove_role(  # Keep async
    payload: RemoveRoleRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Remove a role from a user
    """
    try:
        service = RoleAssignmentService(db)
        
        # Ensure scope is string value
        scope = payload.scope.value if hasattr(payload.scope, 'value') else payload.scope

        service.remove_role(
            user_uid=payload.user_uid,
            role_name=payload.role_name,
            scope=scope,
            resource_id=payload.resource_id,
        )

        return {
            "status": "success",
            "message": "Role removed successfully"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =====================================================
# 3. List User Roles (FIXED: N+1 query, security)
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
async def list_user_roles(  # Keep async
    user_uid: str,
    org_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    List all role assignments for a user
    """
    try:
        # Security: Users can only view their own roles unless admin
        # (already enforced by dependency)

        # Build query with join to avoid N+1
        query = (
            db.query(UserRoleAssignment)
            .options(joinedload(UserRoleAssignment.role))
            .filter(UserRoleAssignment.user_uid == user_uid)
        )

        # Optionally filter by org
        if org_id:
            query = query.filter(
                UserRoleAssignment.resource_id == org_id
            )

        assignments = query.all()

        result = []
        for a in assignments:
            result.append({
                "id": a.id,
                "user_uid": a.user_uid,
                "role_id": a.role_id,
                "role_name": a.role.name if a.role else "unknown",
                "scope": a.scope,
                "resource_id": a.resource_id,
                "created_at": a.created_at.isoformat() if a.created_at else None,
            })

        return result

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =====================================================
# 4. Check Permission (FIXED: removed duplicate, added await)
# =====================================================
@router.get("/check-permission")
async def check_permission(  # Keep async
    user_id: str = Query(..., description="User ID to check permissions for"),
    permission_code: str = Query(..., description="Permission code to check"),
    org_id: Optional[str] = Query(None),
    scope: Optional[str] = Query("org"),
    resource_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    Check if a user has a permission.
    Used by frontend to enable / disable UI actions.
    """

    print("\n==================== [RBAC] CHECK PERMISSION ====================")
    print("[INPUT] user_id         :", user_id)
    print("[INPUT] permission_code :", permission_code)
    print("[INPUT] org_id          :", org_id)
    print("[INPUT] scope           :", scope)
    print("[INPUT] resource_id     :", resource_id)
    print("[AUTH] current_user.uid :", current_user.get("uid"))

    try:
        # -------------------------------------------------
        # SELF / ADMIN GUARD
        # -------------------------------------------------
        if current_user.get("uid") != user_id:
            print("[AUTH] Cross-user permission check")

            admin_service = PermissionService(db)

            # CRITICAL FIX: Added await
            is_admin = admin_service.has_permission(
                user_uid=current_user["uid"],
                permission_code="rbac.view_assignments",
                org_id=org_id,
                scope="org",
            )

            if not is_admin:
                raise HTTPException(
                    status_code=403,
                    detail="You can only check your own permissions",
                )

        # -------------------------------------------------
        # PERMISSION CHECK
        # -------------------------------------------------
        service = PermissionService(db)

        # CRITICAL FIX: Added await
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

    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# =====================================================
# 5. List Available Roles (FIXED: scope enum handling)
# =====================================================
@router.get("/roles")
async def list_roles(  # Keep async
    org_id: Optional[str] = Query(None),
    scope: Optional[str] = Query(None),
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
# 6. Get User Effective Permissions (FIXED: use specialized dependency)
# =====================================================
@router.get("/user/{user_uid}/permissions")
async def get_user_permissions(  # Keep async
    user_uid: str,
    org_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _: bool = Depends(can_view_user_permissions()),  # Use specialized dependency
):
    """
    Get all effective permissions for a user (for debugging/admin UI)
    """
    try:
        service = PermissionService(db)
        
        # CRITICAL FIX: Added await
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