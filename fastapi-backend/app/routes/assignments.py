# app/routes/rbac.py or app/routes/assignments.py
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional
from pydantic import BaseModel
from uuid import uuid4  # Required for generating IDs
from app.services.redis_rbac_service import RedisRBACService

from app.db import get_db
from app.dependencies.permissions import require_permission
from app.policies.auth import get_current_user
from app.models.user import User
from app.models.rbac.permission import (
    AssignmentScope,
    UserRoleAssignment,
    Role,
    RoleScope,  # Required for role CRUD operations
    Permission,
    RolePermission,
)
from app.services.role_assignment_service import RoleAssignmentService
from app.services.permission_service import PermissionService
from app.services.user_permission_service import UserPermissionService


router = APIRouter(prefix="/rbac", tags=["RBAC"])


# =====================================================
# PYDANTIC MODELS
# =====================================================

class AssignRoleRequest(BaseModel):
    user_uid: str
    role_name: str
    scope: AssignmentScope
    resource_id: str
    org_id: Optional[str] = None
    is_creating_org: Optional[bool] = False


class RemoveRoleRequest(BaseModel):
    user_uid: str
    role_name: str
    scope: AssignmentScope
    resource_id: str


class CreateRoleRequest(BaseModel):
    name: str
    scope: str
    description: Optional[str] = None
    org_id: Optional[str] = None


class UpdateRoleRequest(BaseModel):
    name: Optional[str] = None
    scope: Optional[str] = None
    description: Optional[str] = None


class CreatePermissionRequest(BaseModel):
    code: str
    module: str
    description: Optional[str] = None


class UpdatePermissionRequest(BaseModel):
    code: Optional[str] = None
    module: Optional[str] = None
    description: Optional[str] = None


class AddPermissionToRoleRequest(BaseModel):
    permission_id: str


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
# ===============================
# BULK USER PERMISSION MODELS
# ===============================

class BulkGrantPermissionRequest(BaseModel):
    user_uid: str
    permission_codes: list[str]
    scope: str = "org"
    resource_id: str


class BulkDenyPermissionRequest(BaseModel):
    user_uid: str
    permission_codes: list[str]
    scope: str = "org"
    resource_id: str
    reason: Optional[str] = None


# =====================================================
# HELPER FUNCTIONS
# =====================================================

def check_rbac_management_permission(
    current_user: User,
    org_id: str,
    db: Session
) -> bool:
    """Check if user has permission to manage RBAC"""
    user_uid = current_user.uid if hasattr(current_user, 'uid') else current_user.get('uid')
    
    perm_service = PermissionService(db)
    has_perm = perm_service.has_permission(
        user_uid=user_uid,
        permission_code="rbac.manage_permissions",
        org_id=org_id,
        scope="org",
        resource_id=org_id,
    )
    
    if not has_perm:
        raise HTTPException(
            status_code=403,
            detail="You don't have permission to manage RBAC settings"
        )
    
    return True


# =====================================================
# ROLE ASSIGNMENT (Bootstrap Support)
# =====================================================

@router.post("/assign-role")
def assign_role(
    payload: AssignRoleRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    requester_uid = (
        current_user.uid
        if hasattr(current_user, "uid")
        else current_user.get("uid")
    )

    # Bootstrap mode (org creation)
    if payload.is_creating_org:
        if payload.role_name != "owner":
            raise HTTPException(400, "Bootstrap mode only allows 'owner' role")
        if payload.user_uid != requester_uid:
            raise HTTPException(403, "Bootstrap allows assigning role only to self")
        if payload.scope != AssignmentScope.org:
            raise HTTPException(400, "Bootstrap supports only org scope")
    else:
        perm_service = PermissionService(db)
        allowed = perm_service.has_permission(
            user_uid=requester_uid,
            permission_code="rbac.assign_role",
            org_id=payload.org_id,
            scope="org",
            resource_id=payload.resource_id,
        )
        if not allowed:
            raise HTTPException(403, "Missing permission: rbac.assign_role")

    service = RoleAssignmentService(db)
    assignment = service.assign_role(
        user_uid=payload.user.trigger_uid if hasattr(payload, "trigger_uid") else payload.user_uid,
        role_name=payload.role_name,
        scope=payload.scope,
        resource_id=payload.resource_id,
        org_id=payload.org_id,
    )

    RedisRBACService.invalidate_user_roles(payload.user_uid, payload.org_id)
    RedisRBACService.invalidate_all_for_org(payload.resource_id)

    return {
        "status": "success",
        "assignment_id": assignment.id,
        "role_id": assignment.role_id,
        "user_uid": assignment.user_uid,
        "scope": assignment.scope.value,
        "resource_id": assignment.resource_id,
    }


@router.post("/remove-role")
def remove_role(
    payload: RemoveRoleRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    requester_uid = (
        current_user.uid
        if hasattr(current_user, "uid")
        else current_user.get("uid")
    )

    perm_service = PermissionService(db)
    allowed = perm_service.has_permission(
        user_uid=requester_uid,
        permission_code="rbac.assign_role",
        org_id=payload.resource_id,
        scope="org",
        resource_id=payload.resource_id,
    )

    if not allowed:
        raise HTTPException(403, "Missing permission: rbac.assign_role")

    service = RoleAssignmentService(db)
    service.remove_role(
        user_uid=payload.user_uid,
        role_name=payload.role_name,
        scope=payload.scope,
        resource_id=payload.resource_id,
    )

    RedisRBACService.invalidate_user_roles(payload.user_uid, payload.resource_id)
    RedisRBACService.invalidate_all_for_org(payload.resource_id)

    return {
        "status": "success",
        "message": "Role removed successfully",
    }


# =====================================================
# ROLE CRUD (Management)
# =====================================================

@router.get("/roles")
async def list_roles(
    org_id: str = Query(...),
    user: str = Query(...),
    scope: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        check_rbac_management_permission(current_user, org_id, db)

        # 🔹 Try cache first
        cached = RedisRBACService.get_roles_list(org_id)
        if cached:
            if scope:
                return [r for r in cached if r.get("scope") == scope]
            return cached

        query = db.query(Role).filter(
            (Role.org_id == org_id) | (Role.org_id.is_(None))
        )

        if scope:
            query = query.filter(Role.scope == RoleScope(scope))

        roles = query.all()

        RedisRBACService.cache_roles_list(org_id, roles)

        return [
            {
                "id": r.id,
                "name": r.name,
                "scope": r.scope.value,
                "description": getattr(r, "description", None),
                "org_id": r.org_id,
                "is_system": r.is_system,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in roles
        ]

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/roles")
async def create_role(
    data: CreateRoleRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        check_rbac_management_permission(current_user, data.org_id or "", db)

        existing = db.query(Role).filter(
            Role.name == data.name,
            Role.scope == RoleScope(data.scope),
            Role.org_id == data.org_id,
        ).first()

        if existing:
            raise HTTPException(
                status_code=400,
                detail=f"Role '{data.name}' already exists with scope '{data.scope}'",
            )

        role = Role(
            id=str(uuid4()),
            name=data.name,
            scope=RoleScope(data.scope),
            org_id=data.org_id,
            is_system=False,
        )

        if hasattr(role, "description"):
            role.description = data.description

        db.add(role)
        db.commit()
        db.refresh(role)

        # 🔹 Cache
        RedisRBACService.cache_role(role)
        RedisRBACService.invalidate_all_for_org(data.org_id)

        return {
            "id": role.id,
            "name": role.name,
            "scope": role.scope.value,
            "description": getattr(role, "description", None),
            "org_id": role.org_id,
            "is_system": role.is_system,
            "created_at": role.created_at.isoformat() if role.created_at else None,
        }

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/roles/{role_id}")
async def update_role(
    role_id: str,
    data: UpdateRoleRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        role = db.query(Role).filter(Role.id == role_id).first()

        if not role:
            raise HTTPException(404, "Role not found")

        if role.is_system:
            raise HTTPException(403, "Cannot modify system roles")

        check_rbac_management_permission(current_user, role.org_id or "", db)

        if data.name is not None:
            role.name = data.name

        if data.scope is not None:
            role.scope = RoleScope(data.scope)

        if data.description is not None and hasattr(role, "description"):
            role.description = data.description

        db.commit()
        db.refresh(role)

        # 🔹 Cache
        RedisRBACService.invalidate_role(role_id, role.org_id)
        RedisRBACService.cache_role(role)

        return {
            "id": role.id,
            "name": role.name,
            "scope": role.scope.value,
            "description": getattr(role, "description", None),
            "org_id": role.org_id,
            "is_system": role.is_system,
        }

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/permissions/roles/batch")
async def get_all_role_permissions(
    user: str = Query(...),
    org_id: str = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get permissions for all roles in one call"""
    try:
        check_rbac_management_permission(current_user, org_id, db)

        # Get all roles for the org
        roles = db.query(Role).filter(
            (Role.org_id == org_id) | (Role.org_id.is_(None))
        ).all()

        # Build result with permissions for each role
        result = {}
        for role in roles:
            # Check cache first
            cached = RedisRBACService.get_role_permissions(role.id)
            if cached:
                result[role.id] = cached
                continue

            # Query permissions for this role
            permissions = (
                db.query(Permission)
                .join(RolePermission, RolePermission.permission_id == Permission.id)
                .filter(RolePermission.role_id == role.id)
                .all()
            )

            perm_list = [
                {
                    "id": p.id,
                    "code": p.code,
                    "module": p.module,
                    "description": p.description,
                }
                for p in permissions
            ]

            # Cache for next time
            RedisRBACService.cache_role_permissions(role.id, perm_list)
            result[role.id] = perm_list

        return result

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
@router.delete("/roles/{role_id}")
async def delete_role(
    role_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        role = db.query(Role).filter(Role.id == role_id).first()

        if not role:
            raise HTTPException(404, "Role not found")

        if role.is_system:
            raise HTTPException(403, "Cannot delete system roles")

        check_rbac_management_permission(current_user, role.org_id or "", db)

        db.delete(role)
        db.commit()

        # 🔹 Cache cleanup
        RedisRBACService.invalidate_role(role_id, role.org_id)
        RedisRBACService.invalidate_all_for_org(role.org_id)

        return {
            "status": "success",
            "message": "Role deleted",
        }

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


# =====================================================
# PERMISSION CRUD
# =====================================================

@router.get("/permissions")
async def list_permissions(
    user: str = Query(...),
    orgId: str = Query(...),
    module: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        check_rbac_management_permission(current_user, orgId, db)

        # 🔹 Try cache first
        cached = RedisRBACService.get_permissions_list()
        if cached:
            if module:
                return [p for p in cached if p.get("module") == module]
            return cached

        query = db.query(Permission)

        if module:
            query = query.filter(Permission.module == module)

        permissions = query.order_by(
            Permission.module,
            Permission.code
        ).all()

        # 🔹 Cache
        RedisRBACService.cache_permissions_list(permissions)

        return [
            {
                "id": p.id,
                "code": p.code,
                "module": p.module,
                "description": p.description,
            }
            for p in permissions
        ]

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/permissions")
async def create_permission(
    data: CreatePermissionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        existing = db.query(Permission).filter(
            Permission.code == data.code
        ).first()

        if existing:
            raise HTTPException(400, f"Permission '{data.code}' already exists")

        permission = Permission(
            id=str(uuid4()),
            code=data.code,
            module=data.module,
            description=data.description,
        )

        db.add(permission)
        db.commit()
        db.refresh(permission)

        # ✅ Cache & invalidate
        RedisRBACService.cache_permission(permission)
        RedisRBACService.invalidate_all_for_org("*")

        return {
            "id": permission.id,
            "code": permission.code,
            "module": permission.module,
            "description": permission.description,
        }

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/permissions/{permission_id}")
async def update_permission(
    permission_id: str,
    data: UpdatePermissionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        permission = db.query(Permission).filter(
            Permission.id == permission_id
        ).first()

        if not permission:
            raise HTTPException(404, "Permission not found")

        if data.code is not None:
            permission.code = data.code
        if data.module is not None:
            permission.module = data.module
        if data.description is not None:
            permission.description = data.description

        db.commit()
        db.refresh(permission)

        RedisRBACService.cache_permission(permission)
        RedisRBACService.invalidate_all_for_org("*")

        return {
            "id": permission.id,
            "code": permission.code,
            "module": permission.module,
            "description": permission.description,
        }

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/permissions/{permission_id}")
async def delete_permission(
    permission_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        permission = db.query(Permission).filter(
            Permission.id == permission_id
        ).first()

        if not permission:
            raise HTTPException(404, "Permission not found")

        db.delete(permission)
        db.commit()

        # ✅ Clean all dependent caches
        RedisRBACService.invalidate_all_for_org("*")

        return {
            "status": "success",
            "message": "Permission deleted",
        }

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


# =====================================================
# ROLE-PERMISSION MAPPINGS
# =====================================================

@router.get("/permissions/roles/{role_id}/permissions")
async def get_role_permissions(
    role_id: str,
    user: str = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        # 🔹 Check cache first
        cached = RedisRBACService.get_role_permissions(role_id)
        if cached:
            return cached

        role = db.query(Role).filter(Role.id == role_id).first()
        if not role:
            raise HTTPException(status_code=404, detail="Role not found")

        permissions = (
            db.query(Permission)
            .join(RolePermission, RolePermission.permission_id == Permission.id)
            .filter(RolePermission.role_id == role_id)
            .all()
        )

        # 🔹 Cache role-permissions
        RedisRBACService.cache_role_permissions(role_id, permissions)

        return [
            {
                "id": p.id,
                "code": p.code,
                "module": p.module,
                "description": p.description,
            }
            for p in permissions
        ]

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/permissions/roles/{role_id}/permissions")
async def add_permission_to_role(
    role_id: str,
    data: AddPermissionToRoleRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        role = db.query(Role).filter(Role.id == role_id).first()
        if not role:
            raise HTTPException(404, "Role not found")

        if role.is_system:
            raise HTTPException(403, "Cannot modify system role permissions")

        if role.org_id:
            check_rbac_management_permission(current_user, role.org_id, db)

        permission = db.query(Permission).filter(
            Permission.id == data.permission_id
        ).first()

        if not permission:
            raise HTTPException(404, "Permission not found")

        existing = db.query(RolePermission).filter(
            RolePermission.role_id == role_id,
            RolePermission.permission_id == data.permission_id,
        ).first()

        if existing:
            return {
                "status": "already_exists",
                "message": "Permission already assigned",
            }

        mapping = RolePermission(
            role_id=role_id,
            permission_id=data.permission_id,
        )

        db.add(mapping)
        db.commit()

        # 🔹 Invalidate caches
        RedisRBACService.invalidate_role(role_id, role.org_id)

        return {
            "status": "success",
            "message": "Permission added to role",
            "role_id": role_id,
            "permission_id": data.permission_id,
        }

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/permissions/roles/{role_id}/permissions/{permission_id}")
async def remove_permission_from_role(
    role_id: str,
    permission_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        role = db.query(Role).filter(Role.id == role_id).first()
        if not role:
            raise HTTPException(404, "Role not found")

        if role.is_system:
            raise HTTPException(403, "Cannot modify system role permissions")

        if role.org_id:
            check_rbac_management_permission(current_user, role.org_id, db)

        mapping = db.query(RolePermission).filter(
            RolePermission.role_id == role_id,
            RolePermission.permission_id == permission_id,
        ).first()

        if not mapping:
            raise HTTPException(404, "Permission not assigned to this role")

        db.delete(mapping)
        db.commit()

        # 🔹 Invalidate caches
        RedisRBACService.invalidate_role(role_id, role.org_id)

        return {
            "status": "success",
            "message": "Permission removed from role",
        }

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

# =====================================================
# OTHER RBAC ENDPOINTS
# =====================================================

@router.get("/user/{user_uid}")
def list_user_roles(
    user_uid: str,
    org_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all role assignments for a user"""
    try:
        # 🔹 Permission check (view assignments)
        requester_uid = current_user.uid if hasattr(current_user, "uid") else current_user.get("uid")
        if requester_uid != user_uid:
            perm_service = PermissionService(db)
            allowed = perm_service.has_permission(
                user_uid=requester_uid,
                permission_code="rbac.view_assignments",
                org_id=org_id,
                scope="org",
                resource_id=org_id,
            )
            if not allowed:
                raise HTTPException(403, "Access denied")

        # 🔹 Redis cache (org-scoped)
        if org_id:
            cached = RedisRBACService.get_user_roles(user_uid, org_id)
            if cached:
                return cached

        query = db.query(UserRoleAssignment).filter(
            UserRoleAssignment.user_uid == user_uid
        )

        if org_id:
            query = query.filter(UserRoleAssignment.resource_id == org_id)

        assignments = query.all()

        result = []
        for a in assignments:
            role = db.query(Role).filter(Role.id == a.role_id).first()
            result.append({
                "id": a.id,
                "user_uid": a.user_uid,
                "role_id": a.role_id,
                "role_name": role.name if role else "unknown",
                "scope": a.scope.value,
                "resource_id": a.resource_id,
                "created_at": a.created_at.isoformat() if a.created_at else None,
            })

        # 🔹 Cache result
        if org_id:
            RedisRBACService.cache_user_roles(user_uid, org_id, result)

        return result

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

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
    """Check if a user has a specific permission"""

    requester_uid = current_user.uid if hasattr(current_user, "uid") else current_user.get("uid")

    try:
        # 🔹 Authorization: self or admin
        if requester_uid != user_id:
            admin_service = PermissionService(db)
            is_admin = admin_service.has_permission(
                user_uid=requester_uid,
                permission_code="rbac.view_assignments",
                org_id=org_id,
                scope="org",
                resource_id=org_id,
            )
            if not is_admin:
                raise HTTPException(403, "You can only check your own permissions")

        # 🔹 Redis cache lookup
        cached = RedisRBACService.get_permission_check(
            user_uid=user_id,
            permission_code=permission_code,
            scope=scope,
            resource_id=resource_id or "none",
        )
        if cached is not None:
            return {
                "allowed": cached,
                "user_uid": user_id,
                "permission_code": permission_code,
                "scope": scope,
                "resource_id": resource_id,
                "cached": True,
            }

        # 🔹 DB check
        service = PermissionService(db)
        allowed = service.has_permission(
            user_uid=user_id,
            permission_code=permission_code,
            org_id=org_id,
            scope=scope,
            resource_id=resource_id,
        )

        # 🔹 Cache result
        RedisRBACService.cache_permission_check(
            user_uid=user_id,
            permission_code=permission_code,
            scope=scope,
            resource_id=resource_id or "none",
            allowed=allowed,
        )

        return {
            "allowed": allowed,
            "user_uid": user_id,
            "permission_code": permission_code,
            "scope": scope,
            "resource_id": resource_id,
            "cached": False,
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =====================================================
# USER PERMISSIONS CRUD
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
    """Get all effective permissions for a user"""

    requester_uid = current_user.uid if hasattr(current_user, "uid") else current_user.get("uid")

    # 🔒 Access control
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
            raise HTTPException(status_code=403, detail="Access denied")

    try:
        # ⚡ Redis cache lookup
        cached = RedisRBACService.get_effective_permissions(
            user_uid=user_uid,
            org_id=org_id,
            scope=scope,
            resource_id=resource_id,
        )
        if cached is not None:
            return cached

        # 🧠 DB computation
        service = UserPermissionService(db)
        permissions = service.get_effective_permissions(
            user_uid=user_uid,
            org_id=org_id,
            scope=scope,
            resource_id=resource_id,
        )

        # 💾 Cache result
        RedisRBACService.cache_effective_permissions(
            user_uid=user_uid,
            org_id=org_id,
            scope=scope,
            resource_id=resource_id,
            permissions=permissions,
        )

        return permissions

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/user-permissions/grant")
async def grant_permission(
    data: GrantPermissionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Grant a custom permission to a user"""

    try:
        granted_by = current_user.uid if hasattr(current_user, "uid") else current_user.get("uid")

        service = UserPermissionService(db)
        result = service.grant_permission(
            user_uid=data.user_uid,
            permission_code=data.permission_code,
            scope=data.scope,
            resource_id=data.resource_id,
            granted_by=granted_by,
        )

        # 🧹 Cache invalidation
        RedisRBACService.invalidate_user_custom_perms(
            user_uid=data.user_uid,
            org_id=data.resource_id,
        )
        RedisRBACService.invalidate_user_roles(data.user_uid)

        return result

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/user-permissions/revoke")
async def revoke_permission(
    data: RevokePermissionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Revoke a custom permission"""

    try:
        service = UserPermissionService(db)
        result = service.revoke_permission(
            user_uid=data.user_uid,
            permission_code=data.permission_code,
            scope=data.scope,
            resource_id=data.resource_id,
        )

        # 🧹 Cache invalidation
        RedisRBACService.invalidate_user_custom_perms(
            user_uid=data.user_uid,
            org_id=data.resource_id,
        )
        RedisRBACService.invalidate_user_roles(data.user_uid)

        return result

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/user-permissions/deny")
async def deny_permission(
    data: DenyPermissionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Deny a permission"""

    try:
        denied_by = (
            current_user.uid
            if hasattr(current_user, "uid")
            else current_user.get("uid")
        )

        service = UserPermissionService(db)
        result = service.deny_permission(
            user_uid=data.user_uid,
            permission_code=data.permission_code,
            scope=data.scope,
            resource_id=data.resource_id,
            denied_by=denied_by,
            reason=data.reason,
        )

        try:
                RedisRBACService.invalidate_user_custom_perms(
                    user_uid=data.user_uid,
                    org_id=data.resource_id,
                )
                RedisRBACService.invalidate_user_roles(data.user_uid)
        except Exception as e:
                print("[WARN] Redis invalidation failed:", e)

        return result

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/user-permissions/remove-denial")
async def remove_denial(
    data: RemoveDenialRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Remove a denial"""

    try:
        service = UserPermissionService(db)
        result = service.remove_denial(
            user_uid=data.user_uid,
            permission_code=data.permission_code,
            scope=data.scope,
            resource_id=data.resource_id,
        )

        # 🧹 Cache invalidation
        RedisRBACService.invalidate_user_custom_perms(
            user_uid=data.user_uid,
            org_id=data.resource_id,
        )
        RedisRBACService.invalidate_user_roles(data.user_uid)

        return result

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/user-permissions/user/{user_uid}/custom-grants")
async def list_custom_grants(
    user_uid: str,
    org_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List custom grants"""

    requester_uid = (
        current_user.uid
        if hasattr(current_user, "uid")
        else current_user.get("uid")
    )

    # 🔒 Access control
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
            raise HTTPException(status_code=403, detail="Access denied")

    try:
        # ⚡ Redis cache
        cached = RedisRBACService.get_user_grants(
            user_uid=user_uid,
            org_id=org_id,
        )
        if cached is not None:
            return {
                "user_uid": user_uid,
                "org_id": org_id,
                "custom_grants": cached,
            }

        # 🧠 DB fallback
        service = UserPermissionService(db)
        grants = service.list_custom_grants(
            user_uid=user_uid,
            org_id=org_id,
        )

        # 💾 Cache
        RedisRBACService.cache_user_grants(
            user_uid=user_uid,
            org_id=org_id,
            grants=grants,
        )

        return {
            "user_uid": user_uid,
            "org_id": org_id,
            "custom_grants": grants,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
@router.get("/user-permissions/user/{user_uid}/denials")
async def list_denials(
    user_uid: str,
    org_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List denials"""

    requester_uid = (
        current_user.uid
        if hasattr(current_user, "uid")
        else current_user.get("uid")
    )

    # 🔒 Access control
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
            raise HTTPException(status_code=403, detail="Access denied")

    try:
        # ⚡ Redis cache
        cached = RedisRBACService.get_user_denials(
            user_uid=user_uid,
            org_id=org_id,
        )
        if cached is not None:
            return {
                "user_uid": user_uid,
                "org_id": org_id,
                "denials": cached,
            }

        # 🧠 DB fallback
        service = UserPermissionService(db)
        denials = service.list_denials(
            user_uid=user_uid,
            org_id=org_id,
        )

        # 💾 Cache
        RedisRBACService.cache_user_denials(
            user_uid=user_uid,
            org_id=org_id,
            denials=denials,
        )

        return {
            "user_uid": user_uid,
            "org_id": org_id,
            "denials": denials,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class BulkAddPermissionsToRoleRequest(BaseModel):
    permission_ids: list[str]

@router.post("/permissions/roles/{role_id}/permissions/bulk")
async def bulk_add_permissions_to_role(
    role_id: str,
    data: BulkAddPermissionsToRoleRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Add multiple permissions to a role in one call"""
    try:
        role = db.query(Role).filter(Role.id == role_id).first()
        if not role:
            raise HTTPException(404, "Role not found")

        if role.is_system:
            raise HTTPException(403, "Cannot modify system role permissions")

        if role.org_id:
            check_rbac_management_permission(current_user, role.org_id, db)

        # Validate all permissions exist
        permissions = db.query(Permission).filter(
            Permission.id.in_(data.permission_ids)
        ).all()

        if len(permissions) != len(data.permission_ids):
            raise HTTPException(404, "One or more permissions not found")

        # Get existing mappings to avoid duplicates
        existing_mappings = db.query(RolePermission).filter(
            RolePermission.role_id == role_id,
            RolePermission.permission_id.in_(data.permission_ids)
        ).all()
        
        existing_perm_ids = {m.permission_id for m in existing_mappings}

        # Add only new mappings
        new_mappings = []
        for perm_id in data.permission_ids:
            if perm_id not in existing_perm_ids:
                new_mappings.append(
                    RolePermission(
                        role_id=role_id,
                        permission_id=perm_id,
                    )
                )

        if new_mappings:
            db.bulk_save_objects(new_mappings)
            db.commit()

        # Invalidate caches
        RedisRBACService.invalidate_role(role_id, role.org_id)
        RedisRBACService.invalidate_all_for_org(role.org_id)

        return {
            "status": "success",
            "message": f"Added {len(new_mappings)} new permissions to role",
            "role_id": role_id,
            "added_count": len(new_mappings),
            "skipped_count": len(existing_perm_ids),
            "total_requested": len(data.permission_ids),
        }

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
@router.post("/user-permissions/grant/bulk")
async def bulk_grant_permissions(
    data: BulkGrantPermissionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    granted_by = current_user.uid if hasattr(current_user, "uid") else current_user.get("uid")

    try:
        service = UserPermissionService(db)

        result = service.bulk_grant_permissions(
            user_uid=data.user_uid,
            permission_codes=data.permission_codes,
            scope=data.scope,
            resource_id=data.resource_id,
            granted_by=granted_by,
        )

        # 🔄 Cache invalidation (ONCE)
        RedisRBACService.invalidate_user_custom_perms(
            user_uid=data.user_uid,
            org_id=data.resource_id,
        )
        RedisRBACService.invalidate_user_roles(data.user_uid)

        return {
            "status": "success",
            "granted": result["granted"],
            "skipped": result["skipped"],
            "total": len(data.permission_codes),
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/user-permissions/deny/bulk")
async def bulk_deny_permissions(
    data: BulkDenyPermissionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    denied_by = current_user.uid if hasattr(current_user, "uid") else current_user.get("uid")

    try:
        service = UserPermissionService(db)

        result = service.bulk_deny_permissions(
            user_uid=data.user_uid,
            permission_codes=data.permission_codes,
            scope=data.scope,
            resource_id=data.resource_id,
            denied_by=denied_by,
            reason=data.reason,
        )

        RedisRBACService.invalidate_user_custom_perms(
            user_uid=data.user_uid,
            org_id=data.resource_id,
        )
        RedisRBACService.invalidate_user_roles(data.user_uid)

        return {
            "status": "success",
            "denied": result["denied"],
            "skipped": result["skipped"],
            "total": len(data.permission_codes),
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
