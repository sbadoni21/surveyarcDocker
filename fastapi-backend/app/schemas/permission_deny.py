from pydantic import BaseModel
from typing import Optional
from app.models.rbac.permission import AssignmentScope


class CreatePermissionDenyRequest(BaseModel):
    user_uid: str
    permission_code: str
    scope: AssignmentScope
    resource_id: str = "*"
    reason: Optional[str] = None


class RemovePermissionDenyRequest(BaseModel):
    user_uid: str
    permission_code: str
    scope: AssignmentScope
    resource_id: str = "*"
