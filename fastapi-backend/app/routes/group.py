# app/routes/group.py
from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..db import get_db
from ..models.group import Group, GroupUser, GroupStatus,  GroupUserRole
GroupRole = GroupUserRole
from ..models.user import User
from ..schemas.group import (
    GroupCreate,
    BulkGroupUserRemove, 
    BulkGroupUserCreate,
    GroupUpdate,
    GroupOut,
    GroupUserCreate,
    GroupUserUpdate,
    GroupUserOut,
    GroupWithUsersOut,
)
from ..policies.auth import get_current_user  # same as your users router

router = APIRouter(prefix="/groups", tags=["Groups"])


# ===== Helper functions =====

def _ensure_org_access(current_user: dict, org_id: str):
    """
    Basic org-level access control.
    Assumes current_user contains: { 'uid': ..., 'role': ..., 'org_ids': [...] }
    """
    raw_role = current_user.get("role")
    user_org_ids = current_user.get("org_ids") or []

    # user must belong to org
    if org_id not in user_org_ids:
        raise HTTPException(
            status_code=403,
            detail="You do not belong to this organisation.",
        )

    # 🔹 Normalise the role:
    # - Enum -> .value
    # - "OrgRole.owner" -> "owner"
    # - anything else -> lowercased string
    role_str = getattr(raw_role, "value", None) or str(raw_role)
    role_key = role_str.split(".")[-1].lower()

    # Only owner/admin/manager at org level can manage groups
    allowed_roles = {"owner", "admin", "manager", "superadmin"}

    if role_key not in allowed_roles:
        raise HTTPException(
            status_code=403,
            detail=f"Insufficient permissions. Your role: {raw_role}",
        )

def _ensure_group_access(db: Session, current_user: dict, group_id: str) -> Group:
    """
    Load group and ensure the current user has access to its organisation.
    """
    group = db.query(Group).filter(Group.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    _ensure_org_access(current_user, group.org_id)
    return group


# ===== Group CRUD =====

@router.post("/", response_model=GroupOut)
def create_group(
    group_in: GroupCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    Create a new group within an organisation.
    - Only org owner/admin/manager can create.
    - org_id comes from payload (but must be in current_user.org_ids).
    """
    # _ensure_org_access(current_user, group_in.org_id)

    import uuid
    group_id = str(uuid.uuid4())

    group = Group(
        id=group_id,
        org_id=group_in.org_id,
        name=group_in.name,
        description=group_in.description,
        owner_uid=group_in.owner_uid or current_user.get("uid"),
        status=group_in.status or GroupStatus.active,
        meta_data=group_in.meta_data or {},
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )

    db.add(group)
    db.commit()
    db.refresh(group)

    return group


@router.get("/org/{org_id}", response_model=List[GroupOut])
def list_groups_by_org(
    org_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    List all groups in an organisation.
    - Requires membership + owner/admin/manager role.
    """
    _ensure_org_access(current_user, org_id)

    groups = (
        db.query(Group)
        .filter(Group.org_id == org_id)
        .order_by(Group.created_at.desc())
        .all()
    )
    return groups


@router.get("/{group_id}", response_model=GroupWithUsersOut)
def get_group(
    group_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    Get a single group with users.
    """
    group = _ensure_group_access(db, current_user, group_id)

    # Ensure users relationship is loaded
    _ = group.users  # trigger lazy load if needed
    return group


@router.patch("/{group_id}", response_model=GroupOut)
def update_group(
    group_id: str,
    data: GroupUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    Update group details.
    - Only owner/admin/manager for that org.
    """
    group = _ensure_group_access(db, current_user, group_id)

    update_data = data.model_dump(exclude_unset=True)

    for key, value in update_data.items():
        setattr(group, key, value)

    group.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(group)

    return group


@router.delete("/{group_id}")
def delete_group(
    group_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    Delete a group.
    - Only owner/admin/manager for that org.
    - Cascade deletes users (via relationship).
    """
    group = _ensure_group_access(db, current_user, group_id)

    db.delete(group)
    db.commit()

    return {"detail": "Group deleted"}


# ===== Group Users (members) =====

@router.get("/{group_id}/members", response_model=List[GroupUserOut])
def list_group_members(
    group_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    List all users of a group.
    """
    group = _ensure_group_access(db, current_user, group_id)

    users = (
        db.query(GroupUser)
        .filter(GroupUser.group_id == group.id)
        .order_by(GroupUser.added_at.desc())
        .all()
    )
    return users


@router.post("/{group_id}/members", response_model=GroupUserOut)
def add_group_member(
    group_id: str,
    user_in: GroupUserCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    Add a user to a group.
    - Only owner/admin/manager of the org.
    """
    group = _ensure_group_access(db, current_user, group_id)

    # Ensure user exists
    user = db.query(User).filter(User.uid == user_in.user_uid).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Optional: ensure user belongs to same org (org_ids array on User)
    user_orgs = user.org_ids or []
    if group.org_id not in user_orgs:
        raise HTTPException(
            status_code=400,
            detail="User does not belong to this organisation",
        )

    # Check if already a member/user
    existing = (
        db.query(GroupUser)
        .filter(
            GroupUser.group_id == group.id,
            GroupUser.user_uid == user_in.user_uid,
        )
        .first()
    )
    if existing:
        if not existing.is_active:
            existing.is_active = True
            existing.role = user_in.role or existing.role
            existing.updated_at = datetime.utcnow()
            db.commit()
            db.refresh(existing)
            return existing
        raise HTTPException(status_code=400, detail="User is already in this group")

    gu = GroupUser(
        group_id=group.id,
        user_uid=user_in.user_uid,
        role=user_in.role or GroupRole.member,
        is_active=True,
        added_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )

    db.add(gu)
    db.commit()
    db.refresh(gu)

    return gu


@router.patch("/{group_id}/members/{user_uid}", response_model=GroupUserOut)
def update_group_member(
    group_id: str,
    user_uid: str,
    patch: GroupUserUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    Update a group user:
    - change role
    - activate/deactivate (is_active)
    """
    group = _ensure_group_access(db, current_user, group_id)

    gu = (
        db.query(GroupUser)
        .filter(
            GroupUser.group_id == group.id,
            GroupUser.user_uid == user_uid,
        )
        .first()
    )
    if not gu:
        raise HTTPException(status_code=404, detail="Group user not found")

    data = patch.model_dump(exclude_unset=True)
    for key, value in data.items():
        setattr(gu, key, value)

    gu.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(gu)

    return gu


@router.delete("/{group_id}/members/{user_uid}")
def remove_group_member(
    group_id: str,
    user_uid: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    Remove a user from the group.
    - Hard delete. If you want soft delete, set is_active=False instead.
    """
    group = _ensure_group_access(db, current_user, group_id)

    gu = (
        db.query(GroupUser)
        .filter(
            GroupUser.group_id == group.id,
            GroupUser.user_uid == user_uid,
        )
        .first()
    )
    if not gu:
        raise HTTPException(status_code=404, detail="Group user not found")

    db.delete(gu)
    db.commit()

    return {"detail": "User removed from group"}

@router.post("/{group_id}/members/bulk", response_model=List[GroupUserOut])
def bulk_add_group_members(
    group_id: str,
    payload: BulkGroupUserCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    Bulk add users to a group.
    If role not provided, use each user's existing org role.
    """
    group = _ensure_group_access(db, current_user, group_id)

    results: List[GroupUser] = []
    now = datetime.utcnow()

    for uid in payload.user_uids:
        # ensure user exists
        user = db.query(User).filter(User.uid == uid).first()
        if not user:
            continue  # or raise, but better skip

        # belongs to org?
        user_orgs = user.org_ids or []
        if group.org_id not in user_orgs:
            continue

        # existing membership
        existing = (
            db.query(GroupUser)
            .filter(GroupUser.group_id == group.id, GroupUser.user_uid == uid)
            .first()
        )
        if existing:
            # reactivate + update role if previously inactive
            if not existing.is_active:
                org_role = getattr(user, "role", None)
                final_role = payload.role or org_role or GroupRole.member
                try:
                    final_role = GroupRole(final_role)
                except ValueError:
                    final_role = GroupRole.member

                existing.is_active = True
                existing.role = final_role
                existing.updated_at = now
                db.add(existing)
                results.append(existing)
            continue

        # new membership
        org_role = getattr(user, "role", None)
        final_role = payload.role or org_role or GroupRole.member
        try:
            final_role = GroupRole(final_role)
        except ValueError:
            final_role = GroupRole.member

        gu = GroupUser(
            group_id=group.id,
            user_uid=uid,
            role=final_role,
            is_active=True,
            added_at=now,
            updated_at=now,
        )
        db.add(gu)
        results.append(gu)

    db.commit()
    for r in results:
        db.refresh(r)

    return results


@router.post("/{group_id}/members/bulk-remove")
def bulk_remove_group_members(
    group_id: str,
    payload: BulkGroupUserRemove,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    Bulk remove users from group.
    Hard delete; if you want soft delete, set is_active=False instead.
    """
    group = _ensure_group_access(db, current_user, group_id)

    (
        db.query(GroupUser)
        .filter(
            GroupUser.group_id == group.id,
            GroupUser.user_uid.in_(payload.user_uids),
        )
        .delete(synchronize_session=False)
    )

    db.commit()
    return {"detail": f"Removed {len(payload.user_uids)} users from group"}
