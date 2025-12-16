# app/routes/rbac_permissions.py

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional, List
from pydantic import BaseModel

from app.db import get_db
from app.dependencies.permissions import require_permission
from app.policies.auth import get_current_user
from app.models.user import User
from app.models.rbac.permission import AssignmentScope, Permission
from app.services.permission_management_service import PermissionManagementService

router = APIRouter(prefix="/rbac/permissions", tags=["RBAC Permissions"])


# =====================================================
# Pydantic Models
# =====================================================

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


class PermissionResponse(BaseModel):
    id: str
    code: str
    module: str
    description: Optional[str]

    class Config:
        from_attributes = True


# =====================================================
# PERMISSION CRUD ENDPOINTS
# =====================================================

@router.post(
    "",
    dependencies=[
        Depends(
            require_permission(
                "rbac.manage_permissions",
                scope=AssignmentScope.org,
            )
        )
    ],
    response_model=PermissionResponse,
)
async def create_permission(
    data: CreatePermissionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Create a new permission
    Requires: rbac.manage_permissions
    """
    try:
        service = PermissionManagementService(db)
        permission = service.create_permission(
            code=data.code,
            module=data.module,
            description=data.description,
        )

        return PermissionResponse.from_orm(permission)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get(
    "",
    dependencies=[
        Depends(
            require_permission(
                "rbac.view_permissions",
                scope=AssignmentScope.org,
            )
        )
    ],
    response_model=List[PermissionResponse],
)
async def list_permissions(
    module: Optional[str] = Query(None, description="Filter by module"),
    search: Optional[str] = Query(None, description="Search in code or description"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    List all permissions with optional filtering
    Requires: rbac.view_permissions
    """
    try:
        service = PermissionManagementService(db)
        permissions = service.list_permissions(
            module=module,
            search=search,
        )

        return [PermissionResponse.from_orm(p) for p in permissions]

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get(
    "/by-module",
    dependencies=[
        Depends(
            require_permission(
                "rbac.view_permissions",
                scope=AssignmentScope.org,
            )
        )
    ],
)
async def get_permissions_by_module(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get permissions grouped by module
    Requires: rbac.view_permissions
    """
    try:
        service = PermissionManagementService(db)
        grouped = service.get_permissions_by_module()

        result = {}
        for module, perms in grouped.items():
            result[module] = [PermissionResponse.from_orm(p) for p in perms]

        return result

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get(
    "/{permission_id}",
    dependencies=[
        Depends(
            require_permission(
                "rbac.view_permissions",
                scope=AssignmentScope.org,
            )
        )
    ],
    response_model=PermissionResponse,
)
async def get_permission(
    permission_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get a single permission by ID
    Requires: rbac.view_permissions
    """
    try:
        service = PermissionManagementService(db)
        permission = service.get_permission(permission_id)

        if not permission:
            raise HTTPException(status_code=404, detail="Permission not found")

        return PermissionResponse.from_orm(permission)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put(
    "/{permission_id}",
    dependencies=[
        Depends(
            require_permission(
                "rbac.manage_permissions",
                scope=AssignmentScope.org,
            )
        )
    ],
    response_model=PermissionResponse,
)
async def update_permission(
    permission_id: str,
    data: UpdatePermissionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Update an existing permission
    Requires: rbac.manage_permissions
    """
    try:
        service = PermissionManagementService(db)
        permission = service.update_permission(
            permission_id=permission_id,
            code=data.code,
            module=data.module,
            description=data.description,
        )

        return PermissionResponse.from_orm(permission)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete(
    "/{permission_id}",
    dependencies=[
        Depends(
            require_permission(
                "rbac.manage_permissions",
                scope=AssignmentScope.org,
            )
        )
    ],
)
async def delete_permission(
    permission_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Delete a permission
    Requires: rbac.manage_permissions
    """
    try:
        service = PermissionManagementService(db)
        success = service.delete_permission(permission_id)

        return {
            "status": "success",
            "message": "Permission deleted successfully"
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =====================================================
# ROLE-PERMISSION MANAGEMENT ENDPOINTS
# =====================================================

@router.post(
    "/roles/{role_id}/permissions",
    dependencies=[
        Depends(
            require_permission(
                "rbac.manage_permissions",
                scope=AssignmentScope.org,
            )
        )
    ],
)
async def add_permission_to_role(
    role_id: str,
    data: AddPermissionToRoleRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Add a permission to a role
    Requires: rbac.manage_permissions
    """
    try:
        service = PermissionManagementService(db)
        role_permission = service.add_permission_to_role(
            role_id=role_id,
            permission_id=data.permission_id,
        )

        return {
            "status": "success",
            "message": "Permission added to role"
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete(
    "/roles/{role_id}/permissions/{permission_id}",
    dependencies=[
        Depends(
            require_permission(
                "rbac.manage_permissions",
                scope=AssignmentScope.org,
            )
        )
    ],
)
async def remove_permission_from_role(
    role_id: str,
    permission_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Remove a permission from a role
    Requires: rbac.manage_permissions
    """
    try:
        service = PermissionManagementService(db)
        success = service.remove_permission_from_role(
            role_id=role_id,
            permission_id=permission_id,
        )

        if not success:
            raise HTTPException(
                status_code=404,
                detail="Permission not found in role"
            )

        return {
            "status": "success",
            "message": "Permission removed from role"
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get(
    "/roles/{role_id}/permissions",
    dependencies=[
        Depends(
            require_permission(
                "rbac.view_permissions",
                scope=AssignmentScope.org,
            )
        )
    ],
    response_model=List[PermissionResponse],
)
async def get_role_permissions(
    role_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get all permissions for a role
    Requires: rbac.view_permissions
    """
    try:
        service = PermissionManagementService(db)
        permissions = service.get_role_permissions(role_id)

        return [PermissionResponse.from_orm(p) for p in permissions]

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))