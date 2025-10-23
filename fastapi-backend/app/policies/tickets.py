# app/policies/tickets.py
from fastapi import Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional

from ..db import get_db
from ..models.tickets import Ticket, TicketWatcher, TicketCollaborator
from ..models.support import SupportGroup, SupportTeam

# Import the real auth dependency
from .auth import get_current_user


def _is_group_member(db: Session, group_id: Optional[str], user_id: str) -> bool:
    """Check if user is a member of the support group"""
    if not group_id:
        return False
    grp: SupportGroup | None = db.get(SupportGroup, group_id)
    if not grp:
        return False
    return any(m.user_id == user_id for m in grp.members or [])


def _is_team_member(db: Session, team_id: Optional[str], user_id: str) -> bool:
    """Check if user is a member of the support team"""
    if not team_id:
        return False
    team: SupportTeam | None = db.get(SupportTeam, team_id)
    if not team:
        return False
    return any(m.user_id == user_id for m in team.members or [])


def can_view_ticket(
    ticket_id: str, 
    db: Session = Depends(get_db), 
    user: dict = Depends(get_current_user)  # ← Now uses real auth
):
    """
    Determine if user can view a ticket.
    """
    t: Ticket | None = db.get(Ticket, ticket_id)
    if not t:
        raise HTTPException(404, "Ticket not found")
    
    uid = user["uid"]
    role = user.get("role", "user")

    # Requester can view
    if t.requester_id == uid:
        return t

    # Assignee can view (primary assignee)
    if t.assignee_id == uid:
        return t

    # Agent assigned to ticket can view (additional agent)
    if t.agent_id == uid:
        return t

    # Team member can view
    if _is_team_member(db, t.team_id, uid):
        return t

    # Watchers can view
    if db.query(TicketWatcher).filter_by(ticket_id=ticket_id, user_id=uid).first():
        return t

    # Collaborators can view
    try:
        if db.query(TicketCollaborator).filter_by(ticket_id=ticket_id, user_id=uid).first():
            return t
    except Exception:
        pass

    # Group members can view
    if _is_group_member(db, t.group_id, uid):
        return t

    # Admins can view
    if role in ("admin",):
        return t

    raise HTTPException(403, "Forbidden")


def can_edit_ticket(
    ticket_id: str, 
    db: Session = Depends(get_db), 
    user: dict = Depends(get_current_user)  # ← Now uses real auth
):
    """
    Determine if user can edit a ticket.
    """
    t = can_view_ticket(ticket_id, db, user)
    uid = user["uid"]
    role = user.get("role", "user")

    # Assignee can edit
    if t.assignee_id == uid:
        return t

    # Agent assigned to ticket can edit
    if t.agent_id == uid:
        return t

    # Team member can edit
    if _is_team_member(db, t.team_id, uid):
        return t

    # Group agent can edit
    if role in ("admin", "group_lead", "agent") and _is_group_member(db, t.group_id, uid):
        return t

    # Admin can edit
    if role in ("admin",):
        return t

    raise HTTPException(403, "Forbidden")


def can_reassign_ticket(
    ticket_id: str, 
    db: Session = Depends(get_db), 
    user: dict = Depends(get_current_user)  # ← Now uses real auth
):
    """
    Determine if user can reassign a ticket.
    """
    t = can_view_ticket(ticket_id, db, user)
    uid = user["uid"]
    role = user.get("role", "user")

    # Admins and group leads can reassign
    if role in ("admin", "group_lead"):
        return t
    
    # Team leads can reassign tickets on their team
    if role == "lead" and _is_team_member(db, t.team_id, uid):
        return t

    raise HTTPException(403, "Forbidden")