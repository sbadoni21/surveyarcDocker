from fastapi import Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional

from ..db import get_db
from ..models.tickets import Ticket, TicketWatcher, SupportGroup, TicketCollaborator  # TicketCollaborator if you added it
# If you didn't add TicketCollaborator yet, comment it out in checks.

# ---- Replace this with your real auth dependency ----
def get_current_user():
    """
    Return object/dict with:
    - uid: str (user id)
    - role: str ("admin" | "group_lead" | "agent" | "user")
    - org_ids: list[str]
    """
    # placeholder; wire to your auth
    return {"uid": "usr_demo", "role": "agent", "org_ids": ["org_abc"]}

def _is_group_member(db: Session, group_id: Optional[str], user_id: str) -> bool:
    if not group_id:
        return False
    grp: SupportGroup | None = db.get(SupportGroup, group_id)
    if not grp:
        return False
    # members is relationship to UserStub with .user_id
    return any(m.user_id == user_id for m in grp.members or [])

def can_view_ticket(ticket_id: str, db: Session = Depends(get_db), user = Depends(get_current_user)):
    t: Ticket | None = db.get(Ticket, ticket_id)
    if not t:
        raise HTTPException(404, "Ticket not found")
    uid = user["uid"]
    role = user.get("role", "user")

    # requester can view
    if t.requester_id == uid:
        return t

    # watchers can view
    if db.query(TicketWatcher).filter_by(ticket_id=ticket_id, user_id=uid).first():
        return t

    # collaborators (if implemented)
    try:
        if db.query(TicketCollaborator).filter_by(ticket_id=ticket_id, user_id=uid).first():
            return t
    except Exception:
        pass

    # group members can view
    if _is_group_member(db, t.group_id, uid):
        return t

    # admins can view
    if role in ("admin",):
        return t

    raise HTTPException(403, "Forbidden")

def can_edit_ticket(ticket_id: str, db: Session = Depends(get_db), user = Depends(get_current_user)):
    t = can_view_ticket(ticket_id, db, user)  # also ensures exists
    uid = user["uid"]
    role = user.get("role", "user")

    # assignee can edit
    if t.assignee_id == uid:
        return t

    # group agent can edit
    if role in ("admin", "group_lead", "agent") and _is_group_member(db, t.group_id, uid):
        return t

    # admin can edit
    if role in ("admin",):
        return t

    raise HTTPException(403, "Forbidden")

def can_reassign_ticket(ticket_id: str, db: Session = Depends(get_db), user = Depends(get_current_user)):
    t = can_view_ticket(ticket_id, db, user)
    role = user.get("role", "user")

    if role in ("admin", "group_lead"):
        return t
    raise HTTPException(403, "Forbidden")
