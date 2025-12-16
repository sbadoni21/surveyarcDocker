from typing import Optional, Callable
from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db import get_db
from app.services.permission_service import PermissionService
from app.policies.auth import get_current_user  # your auth dependency
from app.models.user import User
from app.models.rbac.permission import AssignmentScope


# =====================================================
# Core permission dependency factory
# =====================================================

def require_permission(
    permission_code: str,
    *,
    scope: AssignmentScope,
    resource_param: Optional[str] = None,
    org_param: str = "org_id",
) -> Callable:
    """
    FastAPI dependency for RBAC enforcement

    Example:
    Depends(require_permission(
        "support.group.update",
        scope=AssignmentScope.group,
        resource_param="group_id"
    ))
    """

    async def _permission_guard(
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
        **kwargs,
    ):
        # -------------------------------------
        # Resolve org + resource
        # -------------------------------------
        org_id = kwargs.get(org_param)

        resource_id = None
        if resource_param:
            resource_id = kwargs.get(resource_param)

        if scope != AssignmentScope.org and not resource_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Missing resource identifier for scope '{scope}'",
            )

        # -------------------------------------
        # Permission check
        # -------------------------------------
        perm_service = PermissionService(db)

        allowed = await perm_service.has_permission(
            user_uid=current_user.uid,
            permission_code=permission_code,
            org_id=org_id,
            scope=scope.value,
            resource_id=resource_id,
        )

        if not allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to perform this action",
            )

        return True  # explicitly allow

    return _permission_guard
