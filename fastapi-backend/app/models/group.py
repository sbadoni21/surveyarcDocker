# app/models/group.py
from __future__ import annotations

from datetime import datetime
from typing import Optional, List

from sqlalchemy import (
    String,
    DateTime,
    JSON,
    Enum as SAEnum,
    ForeignKey,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base
import enum


class GroupStatus(str, enum.Enum):
    active = "active"
    archived = "archived"


class GroupUserRole(str, enum.Enum):
    owner = "owner"      # group owner
    lead = "lead"        # team lead
    member = "member"    # regular member
    viewer = "viewer"    # read-only


class Group(Base):
    """
    A logical team inside an organisation.
    Example: "North Region Team", "Client X – Support Pod"
    """

    __tablename__ = "groups"

    # string ID so you can use UUID or your own format
    id: Mapped[str] = mapped_column(String, primary_key=True, index=True)

    # the organisation this group belongs to
    org_id: Mapped[str] = mapped_column(
        String,
        ForeignKey("organisations.org_id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )

    # basic info
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)

    # owner of the group (user.uid)
    owner_uid: Mapped[Optional[str]] = mapped_column(
        String,
        ForeignKey("users.uid", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    status: Mapped[GroupStatus] = mapped_column(
        SAEnum(GroupStatus, name="group_status"),
        default=GroupStatus.active,
        nullable=False,
    )

    meta_data: Mapped[dict] = mapped_column(JSON, default=dict)

    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )

    # relationships
    users: Mapped[List["GroupUser"]] = relationship(
        "GroupUser",
        back_populates="group",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    __table_args__ = (
        # group name must be unique within an organisation
        UniqueConstraint("org_id", "name", name="uq_group_org_name"),
    )


class GroupUser(Base):
    """
    Link table: user <-> group with a role inside the group
    Backed by table: group_users
    """

    __tablename__ = "group_users"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    group_id: Mapped[str] = mapped_column(
        String,
        ForeignKey("groups.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )

    user_uid: Mapped[str] = mapped_column(
        String,
        ForeignKey("users.uid", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )

    role: Mapped[GroupUserRole] = mapped_column(
        SAEnum(GroupUserRole, name="group_user_role"),
        default=GroupUserRole.member,
        nullable=False,
    )

    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)

    added_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )

    # relationships
    group: Mapped["Group"] = relationship("Group", back_populates="users")
