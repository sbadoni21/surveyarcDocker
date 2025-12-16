from sqlalchemy import (
    Column,
    String,
    DateTime,
    Enum,
    Index,
)
from sqlalchemy.sql import func
from app.db import Base
from app.models.rbac.permission import AssignmentScope


class PermissionDeny(Base):
    """
    Explicit deny rules.
    Deny ALWAYS overrides allow.
    """

    __tablename__ = "permission_denies"

    id = Column(String, primary_key=True)

    user_uid = Column(String, index=True, nullable=False)

    # permission code, e.g. "project.delete"
    permission_code = Column(String, nullable=False)

    # org / group / team / project
    scope = Column(Enum(AssignmentScope), nullable=False)

    # specific resource OR "*"
    resource_id = Column(String, nullable=False, default="*")

    reason = Column(String, nullable=True)

    created_at = Column(DateTime, server_default=func.now())

    __table_args__ = (
        Index(
            "ix_deny_user_scope_resource_perm",
            "user_uid",
            "scope",
            "resource_id",
            "permission_code",
        ),
    )
