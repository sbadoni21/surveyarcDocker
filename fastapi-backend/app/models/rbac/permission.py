import enum
from sqlalchemy import Column, String, Text,ForeignKey,  Boolean, DateTime, Enum,Index
from app.db import Base
from sqlalchemy.sql import func
from pydantic import BaseModel
from typing import Optional

class Permission(Base):
    __tablename__ = "permissions"

    id = Column(String, primary_key=True)  
    code = Column(String, unique=True, index=True, nullable=False)
    module = Column(String, index=True, nullable=False)  # support, project, billing
    description = Column(Text, nullable=True)

    def __repr__(self):
        return f"<Permission {self.code}>"


class RolePermission(Base):
    __tablename__ = "role_permissions"

    role_id = Column(
        String,
        ForeignKey("roles.id", ondelete="CASCADE"),
        primary_key=True,
    )

    permission_id = Column(
        String,
        ForeignKey("permissions.id", ondelete="CASCADE"),
        primary_key=True,
    )


class RoleScope(str, enum.Enum):
    org     = "org"
    group   = "group"
    team    = "team"
    project = "project"

class Role(Base):
    __tablename__ = "roles"

    id = Column(String, primary_key=True)
    org_id = Column(String, nullable=True, index=True)  # NULL = system role

    name = Column(String, nullable=False)
    scope = Column(Enum(RoleScope), nullable=False)

    is_system = Column(Boolean, default=False)

    created_at = Column(DateTime, server_default=func.now())

    def __repr__(self):
        return f"<Role {self.name} ({self.scope})>"


class AssignmentScope(str, enum.Enum):
    org     = "org"
    group   = "group"
    team    = "team"
    project = "project"

class UserRoleAssignment(Base):
    __tablename__ = "user_role_assignments"

    id = Column(String, primary_key=True)

    user_uid = Column(String, index=True, nullable=False)
    role_id = Column(String, nullable=False)

    scope = Column(Enum(AssignmentScope), nullable=False)
    resource_id = Column(String, nullable=False)

    created_at = Column(DateTime, server_default=func.now())

    __table_args__ = (
        Index("ix_user_scope_resource", "user_uid", "scope", "resource_id"),
    )
    
    
class AssignRoleRequest(BaseModel):
    user_uid: str
    role_name: str
    scope: AssignmentScope
    resource_id: str
    org_id: Optional[str] = None


class RemoveRoleRequest(BaseModel):
    user_uid: str
    role_name: str
    scope: AssignmentScope
    resource_id: str
