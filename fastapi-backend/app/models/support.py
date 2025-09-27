from sqlalchemy import (
    String, Boolean, DateTime, Text, Integer, ForeignKey, Enum, Index
)
from sqlalchemy.orm import relationship, Mapped, mapped_column
from sqlalchemy.sql import func
from sqlalchemy.dialects.postgresql import JSONB
import enum

from ..db import Base

# -------------------- Enums --------------------

class GroupMemberRole(str, enum.Enum):
    agent = "agent"
    lead = "lead"
    viewer = "viewer"

class ProficiencyLevel(str, enum.Enum):
    l1 = "l1"
    l2 = "l2"
    l3 = "l3"
    specialist = "specialist"

class RoutingTarget(str, enum.Enum):
    group = "group"
    team  = "team"

# -------------------- Core: SupportGroup --------------------

class SupportGroup(Base):
    __tablename__ = "support_groups"

    group_id: Mapped[str] = mapped_column(String, primary_key=True, index=True)
    org_id:   Mapped[str] = mapped_column(String, index=True, nullable=False)

    name:        Mapped[str] = mapped_column(String, nullable=False)
    email:       Mapped[str | None] = mapped_column(String, nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # relationships (string names avoid import cycles)
    members = relationship("SupportGroupMember", back_populates="group", cascade="all, delete-orphan")
    teams   = relationship("SupportTeam", back_populates="group", cascade="all, delete-orphan")
    tickets = relationship("Ticket", back_populates="group")  # Ticket lives in tickets.py

# Optional: tiny user stub if you don’t have a users model bound to this DB
class UserStub(Base):
    __tablename__ = "user_stub"
    user_id: Mapped[str] = mapped_column(String, primary_key=True, index=True)
class UserStubTub(Base):
    __tablename__ = "user_stub_tub"
    user_id: Mapped[str] = mapped_column(String, primary_key=True, index=True)

# -------------------- Membership at group level --------------------

class SupportGroupMember(Base):
    __tablename__ = "support_group_members"

    group_id: Mapped[str] = mapped_column(
        String, ForeignKey("support_groups.group_id", ondelete="CASCADE"),
        primary_key=True, index=True
    )
    user_id: Mapped[str] = mapped_column(
        String, ForeignKey("user_stub_tub.user_id", ondelete="CASCADE"),
        primary_key=True, index=True
    )

    role: Mapped[GroupMemberRole] = mapped_column(Enum(GroupMemberRole), default=GroupMemberRole.agent, nullable=False)
    proficiency: Mapped[ProficiencyLevel] = mapped_column(Enum(ProficiencyLevel), default=ProficiencyLevel.l1, nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    group = relationship("SupportGroup", back_populates="members")

    __table_args__ = (
        Index("ix_support_group_members_group", "group_id"),
        Index("ix_support_group_members_user", "user_id"),
    )

# -------------------- Teams (queues inside a group) --------------------

class SupportTeam(Base):
    __tablename__ = "support_teams"
    calendar_id:        Mapped[str | None] = mapped_column(String, nullable=True, index=True)


    team_id:  Mapped[str] = mapped_column(String, primary_key=True, index=True)
    org_id:   Mapped[str] = mapped_column(String, index=True, nullable=False)
    group_id: Mapped[str] = mapped_column(String, ForeignKey("support_groups.group_id", ondelete="CASCADE"), index=True, nullable=False)

    name:        Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    email:       Mapped[str | None] = mapped_column(String, nullable=True)

    target_proficiency: Mapped[ProficiencyLevel] = mapped_column(Enum(ProficiencyLevel), default=ProficiencyLevel.l1, nullable=False)
    routing_weight:     Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    default_sla_id:     Mapped[str | None] = mapped_column(String, nullable=True)

    meta:   Mapped[dict]  = mapped_column(JSONB, default=dict)
    active: Mapped[bool]  = mapped_column(Boolean, default=True, nullable=False)

    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    group   = relationship("SupportGroup", back_populates="teams")
    members = relationship("SupportTeamMember", back_populates="team", cascade="all, delete-orphan")

class SupportTeamMember(Base):
    __tablename__ = "support_team_members"

    team_id: Mapped[str] = mapped_column(
        String, ForeignKey("support_teams.team_id", ondelete="CASCADE"),
        primary_key=True, index=True
    )
    user_id: Mapped[str] = mapped_column(
        String, ForeignKey("user_stub.user_id", ondelete="CASCADE"),
        primary_key=True, index=True
    )

    role: Mapped[GroupMemberRole] = mapped_column(Enum(GroupMemberRole), default=GroupMemberRole.agent, nullable=False)
    proficiency: Mapped[ProficiencyLevel] = mapped_column(Enum(ProficiencyLevel), default=ProficiencyLevel.l1, nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    weekly_capacity_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)

    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    team = relationship("SupportTeam", back_populates="members")

    __table_args__ = (
        Index("ix_support_team_members_team", "team_id"),
        Index("ix_support_team_members_user", "user_id"),
    )

# -------------------- Routing Policies (optional) --------------------

class RoutingPolicy(Base):
    __tablename__ = "routing_policies"

    policy_id: Mapped[str] = mapped_column(String, primary_key=True, index=True)
    org_id:    Mapped[str] = mapped_column(String, index=True, nullable=False)
    group_id:  Mapped[str | None] = mapped_column(String, ForeignKey("support_groups.group_id", ondelete="CASCADE"), index=True, nullable=True)
    team_id:   Mapped[str | None] = mapped_column(String, ForeignKey("support_teams.team_id", ondelete="CASCADE"), index=True, nullable=True)

    name:   Mapped[str] = mapped_column(String, nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    target: Mapped[RoutingTarget] = mapped_column(Enum(RoutingTarget), default=RoutingTarget.team, nullable=False)

    rules: Mapped[dict] = mapped_column(JSONB, default=dict)  # { when: {}, route_to: {}, fallthrough: {} }
    meta:  Mapped[dict] = mapped_column(JSONB, default=dict)

    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
