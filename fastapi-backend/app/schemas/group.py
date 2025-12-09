# app/schemas/group.py
from __future__ import annotations

from typing import List, Optional
from datetime import datetime

from pydantic import BaseModel, Field, ConfigDict

from ..models.group import GroupStatus, GroupUserRole
GroupRole = GroupUserRole



# ========== GROUP ==========

class GroupBase(BaseModel):
    org_id: str
    name: str = Field(..., max_length=255)
    description: Optional[str] = Field(None, max_length=1000)
    status: GroupStatus = GroupStatus.active
    meta_data: dict = Field(default_factory=dict)

    model_config = ConfigDict(from_attributes=True)


class GroupCreate(GroupBase):
    """
    For creating a group from the API.
    org_id will usually be taken from the current org context.
    """
    owner_uid: Optional[str] = None


class GroupUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[GroupStatus] = None
    owner_uid: Optional[str] = None
    meta_data: Optional[dict] = None

    model_config = ConfigDict(from_attributes=True)


class GroupOut(BaseModel):
    id: str
    org_id: str
    name: str
    description: Optional[str]
    owner_uid: Optional[str]
    status: GroupStatus
    meta_data: dict
    created_at: Optional[datetime]
    updated_at: Optional[datetime]

    model_config = ConfigDict(from_attributes=True)


# ========== GROUP USER (MEMBER) ==========

class GroupUserBase(BaseModel):
    group_id: str
    user_uid: str
    role: GroupRole = GroupRole.member

    model_config = ConfigDict(from_attributes=True)


class GroupUserCreate(GroupUserBase):
    pass


class GroupUserUpdate(BaseModel):
    role: Optional[GroupRole] = None
    is_active: Optional[bool] = None

    model_config = ConfigDict(from_attributes=True)


class GroupUserOut(BaseModel):
    id: int
    group_id: str
    user_uid: str
    role: GroupRole
    is_active: bool
    added_at: Optional[datetime]
    updated_at: Optional[datetime]

    model_config = ConfigDict(from_attributes=True)


# Optional: Group with users embedded
class GroupWithUsersOut(GroupOut):
    users: List[GroupUserOut] = []

class BulkGroupUserCreate(BaseModel):
    user_uids: List[str]
    role: Optional[GroupRole] = None   # optional; same logic as single-add

    model_config = ConfigDict(from_attributes=True)


class BulkGroupUserRemove(BaseModel):
    user_uids: List[str]

    model_config = ConfigDict(from_attributes=True)