from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..db import get_db
from ..models.user import User
from ..schemas.user import UserCreate, UserUpdate, UserOut
from typing import List
from sqlalchemy.sql import func

router = APIRouter(prefix="/users", tags=["Users"])

@router.post("/", response_model=UserOut)
def create_user(user_in: UserCreate, db: Session = Depends(get_db)):
    user = User(
        uid=user_in.uid,
        email=user_in.email,
        display_name=user_in.display_name,
        role=user_in.role,
        org_ids=user_in.org_ids,
        status=user_in.status,
        meta_data=user_in.meta_data,
        joined_at=datetime.utcnow(),
        last_login_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(user)
    db.commit()
    db.refresh(user)   # ✅ refresh to get DB defaults
    return UserOut.from_orm(user)

# Add org to user
@router.post("/{uid}/orgs")
def add_org(uid: str, org_id: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.uid == uid).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    current = user.org_ids or []
    if org_id in current:
        return {"ok": True, "message": "already-in"}
    if len(current) >= 100:
        return {"ok": False, "message": "limit"}
    
    current.append(org_id)
    user.org_ids = current
    db.commit()
    return {"ok": True, "message": "added"}

# Get user
@router.get("/{uid}", response_model=UserOut)
def get_user(uid: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.uid == uid).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@router.patch("/{uid}")
def update_user(uid: str, data: UserUpdate, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.uid == uid).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    update_data = data.dict(exclude_unset=True)

    for key, value in update_data.items():
        if key == "org_ids" and value:
            # Merge instead of replace
            existing = set(user.org_ids or [])
            new_ids = set(value)
            user.org_ids = list(existing.union(new_ids))
        else:
            setattr(user, key, value)

    db.commit()
    db.refresh(user)
    return user


# Delete user
@router.delete("/{uid}")
def delete_user(uid: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.uid == uid).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    db.delete(user)
    db.commit()
    return {"detail": "User deleted"}

# Activate user
@router.post("/{uid}/activate")
def activate_user(uid: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.uid == uid).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.status = "active"
    user.joined_at = func.now()
    db.commit()
    return user

# Suspend user
@router.post("/{uid}/suspend")
def suspend_user(uid: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.uid == uid).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.status = "suspended"
    db.commit()
    return user

# Track login
@router.post("/{uid}/login")
def track_login(uid: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.uid == uid).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.last_login_at = func.now()
    db.commit()
    return user

# List users by org
@router.get("/org/{org_id}", response_model=List[UserOut])
def list_users_by_org(org_id: str, db: Session = Depends(get_db)):
    users = db.query(User).filter(User.org_ids.any(org_id)).all()
    return users
