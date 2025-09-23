from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..db import get_db
from ..models.user import User
from ..schemas.user import UserCreate, UserUpdate, UserOut
from typing import List
from sqlalchemy.sql import func

# Import Redis dependencies
from ..dependencies.redis import get_redis_optional
from ..core.redis_client import RedisClient

router = APIRouter(prefix="/users", tags=["Users"])

@router.post("/", response_model=UserOut)
def create_user(
    user_in: UserCreate, 
    db: Session = Depends(get_db),
    redis: RedisClient = Depends(get_redis_optional)
):
    """Create a new user with Redis caching"""
    
    # Check if user already exists
    existing_user = db.query(User).filter(User.uid == user_in.uid).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="User with this UID already exists")
    
    # Check email uniqueness
    existing_email = db.query(User).filter(User.email == user_in.email).first()
    if existing_email:
        raise HTTPException(status_code=400, detail="User with this email already exists")
    
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
    db.refresh(user)
    
    # Cache the new user
    if redis:
        user_data = {
            "uid": user.uid,
            "email": user.email,
            "display_name": user.display_name,
            "role": user.role,
            "org_ids": user.org_ids or [],
            "status": user.status,
            "meta_data": user.meta_data or {},
            "joined_at": user.joined_at.isoformat() if user.joined_at else None,
            "last_login_at": user.last_login_at.isoformat() if user.last_login_at else None,
            "updated_at": user.updated_at.isoformat() if user.updated_at else None
        }
        redis.set(f"user:{user.uid}", user_data, expire=3600)  # Cache for 1 hour
        
        # Cache user by email for login lookups
        redis.set(f"user_email:{user.email}", user.uid, expire=3600)
        
        # Invalidate org user lists cache
        for org_id in user.org_ids or []:
            redis.delete(f"org_users:{org_id}")
    
    return UserOut.from_orm(user)

@router.post("/{uid}/orgs")
def add_org(
    uid: str, 
    org_id: str, 
    db: Session = Depends(get_db),
    redis: RedisClient = Depends(get_redis_optional)
):
    """Add organization to user with cache invalidation"""
    
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
    user.updated_at = datetime.utcnow()
    db.commit()
    
    # Invalidate caches
    if redis:
        redis.delete(f"user:{uid}")
        redis.delete(f"org_users:{org_id}")
        # Invalidate all org caches for this user
        for old_org_id in (user.org_ids or []):
            redis.delete(f"org_users:{old_org_id}")
    
    return {"ok": True, "message": "added"}

@router.get("/{uid}", response_model=UserOut)
def get_user(
    uid: str, 
    db: Session = Depends(get_db),
    redis: RedisClient = Depends(get_redis_optional)
):
    """Get user with Redis caching"""
    
    # Try cache first
    if redis:
        cached_user = redis.get(f"user:{uid}")
        if cached_user:
            # Convert datetime strings back to datetime objects for response
            if cached_user.get("joined_at"):
                cached_user["joined_at"] = datetime.fromisoformat(cached_user["joined_at"])
            if cached_user.get("last_login_at"):
                cached_user["last_login_at"] = datetime.fromisoformat(cached_user["last_login_at"])
            if cached_user.get("updated_at"):
                cached_user["updated_at"] = datetime.fromisoformat(cached_user["updated_at"])
            
            return UserOut(**cached_user)
    
    # Query database
    user = db.query(User).filter(User.uid == uid).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Cache the user
    if redis:
        user_data = {
            "uid": user.uid,
            "email": user.email,
            "display_name": user.display_name,
            "role": user.role,
            "org_ids": user.org_ids or [],
            "status": user.status,
            "meta_data": user.meta_data or {},
            "joined_at": user.joined_at.isoformat() if user.joined_at else None,
            "last_login_at": user.last_login_at.isoformat() if user.last_login_at else None,
            "updated_at": user.updated_at.isoformat() if user.updated_at else None
        }
        redis.set(f"user:{uid}", user_data, expire=3600)
    
    return user

@router.patch("/{uid}")
def update_user(
    uid: str, 
    data: UserUpdate, 
    db: Session = Depends(get_db),
    redis: RedisClient = Depends(get_redis_optional)
):
    """Update user with cache invalidation"""
    
    user = db.query(User).filter(User.uid == uid).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    old_org_ids = set(user.org_ids or [])
    update_data = data.dict(exclude_unset=True)

    for key, value in update_data.items():
        if key == "org_ids" and value:
            # Merge instead of replace
            existing = set(user.org_ids or [])
            new_ids = set(value)
            user.org_ids = list(existing.union(new_ids))
        else:
            setattr(user, key, value)
    
    user.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(user)
    
    # Invalidate caches
    if redis:
        redis.delete(f"user:{uid}")
        redis.delete(f"user_email:{user.email}")
        
        # Invalidate org caches for old and new orgs
        new_org_ids = set(user.org_ids or [])
        affected_orgs = old_org_ids.union(new_org_ids)
        for org_id in affected_orgs:
            redis.delete(f"org_users:{org_id}")
    
    return user

@router.delete("/{uid}")
def delete_user(
    uid: str, 
    db: Session = Depends(get_db),
    redis: RedisClient = Depends(get_redis_optional)
):
    """Delete user with cache cleanup"""
    
    user = db.query(User).filter(User.uid == uid).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Store user data for cache cleanup
    user_email = user.email
    user_orgs = user.org_ids or []
    
    db.delete(user)
    db.commit()
    
    # Clean up all user caches
    if redis:
        redis.delete(f"user:{uid}")
        redis.delete(f"user_email:{user_email}")
        redis.delete(f"user_session:{uid}")
        
        # Invalidate org user lists
        for org_id in user_orgs:
            redis.delete(f"org_users:{org_id}")
    
    return {"detail": "User deleted"}

@router.post("/{uid}/activate")
def activate_user(
    uid: str, 
    db: Session = Depends(get_db),
    redis: RedisClient = Depends(get_redis_optional)
):
    """Activate user with cache update"""
    
    user = db.query(User).filter(User.uid == uid).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user.status = "active"
    user.joined_at = func.now()
    user.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(user)
    
    # Invalidate user cache to force refresh
    if redis:
        redis.delete(f"user:{uid}")
    
    return user

@router.post("/{uid}/suspend")
def suspend_user(
    uid: str, 
    db: Session = Depends(get_db),
    redis: RedisClient = Depends(get_redis_optional)
):
    """Suspend user with cache and session cleanup"""
    
    user = db.query(User).filter(User.uid == uid).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user.status = "suspended"
    user.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(user)
    
    # Clean up user caches and sessions
    if redis:
        redis.delete(f"user:{uid}")
        redis.invalidate_user_session(uid)  # Remove active sessions
        
        # Clear any rate limiting for suspended user
        redis.clear_pattern(f"rate_limit:*:{uid}")
    
    return user

@router.post("/{uid}/login")
def track_login(
    uid: str, 
    db: Session = Depends(get_db),
    redis: RedisClient = Depends(get_redis_optional)
):
    """Track user login with session caching"""
    
    user = db.query(User).filter(User.uid == uid).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user.status != "active":
        raise HTTPException(status_code=403, detail="User account is not active")
    
    user.last_login_at = func.now()
    user.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(user)
    
    # Cache user session and invalidate user cache
    if redis:
        redis.delete(f"user:{uid}")
        
        # Create user session
        session_data = {
            "uid": user.uid,
            "email": user.email,
            "role": user.role,
            "org_ids": user.org_ids or [],
            "status": user.status,
            "last_login_at": user.last_login_at.isoformat() if user.last_login_at else None
        }
        redis.cache_user_session(uid, session_data, expire=7200)  # 2 hours
    
    return {
        "uid": user.uid,
        "message": "Login tracked successfully",
        "last_login_at": user.last_login_at
    }

@router.get("/org/{org_id}", response_model=List[UserOut])
def list_users_by_org(
    org_id: str, 
    db: Session = Depends(get_db),
    redis: RedisClient = Depends(get_redis_optional)
):
    """List users by organization with caching"""
    
    # Try cache first
    if redis:
        cached_users = redis.get(f"org_users:{org_id}")
        if cached_users:
            # Convert cached data back to UserOut objects
            users_data = []
            for user_data in cached_users:
                if user_data.get("joined_at"):
                    user_data["joined_at"] = datetime.fromisoformat(user_data["joined_at"])
                if user_data.get("last_login_at"):
                    user_data["last_login_at"] = datetime.fromisoformat(user_data["last_login_at"])
                if user_data.get("updated_at"):
                    user_data["updated_at"] = datetime.fromisoformat(user_data["updated_at"])
                users_data.append(UserOut(**user_data))
            return users_data
    
    # Query database
    users = db.query(User).filter(User.org_ids.any(org_id)).all()
    
    # Cache the results
    if redis:
        users_data = []
        for user in users:
            user_data = {
                "uid": user.uid,
                "email": user.email,
                "display_name": user.display_name,
                "role": user.role,
                "org_ids": user.org_ids or [],
                "status": user.status,
                "meta_data": user.meta_data or {},
                "joined_at": user.joined_at.isoformat() if user.joined_at else None,
                "last_login_at": user.last_login_at.isoformat() if user.last_login_at else None,
                "updated_at": user.updated_at.isoformat() if user.updated_at else None
            }
            users_data.append(user_data)
        
        redis.set(f"org_users:{org_id}", users_data, expire=1800)  # Cache for 30 minutes
    
    return users

# Additional Redis-specific endpoints for user management

@router.get("/{uid}/session")
def get_user_session(
    uid: str,
    redis: RedisClient = Depends(get_redis_optional)
):
    """Get user session data from Redis"""
    if not redis:
        raise HTTPException(status_code=503, detail="Redis service unavailable")
    
    session_data = redis.get_user_session(uid)
    if not session_data:
        raise HTTPException(status_code=404, detail="No active session found")
    
    return {
        "uid": uid,
        "session_data": session_data,
        "message": "Session retrieved successfully"
    }

@router.delete("/{uid}/session")
def invalidate_user_session(
    uid: str,
    redis: RedisClient = Depends(get_redis_optional)
):
    """Invalidate user session (logout)"""
    if not redis:
        raise HTTPException(status_code=503, detail="Redis service unavailable")
    
    redis.invalidate_user_session(uid)
    return {
        "uid": uid,
        "message": "Session invalidated successfully"
    }

@router.get("/email/{email}")
def get_user_by_email(
    email: str,
    db: Session = Depends(get_db),
    redis: RedisClient = Depends(get_redis_optional)
):
    """Get user by email with caching"""
    
    # Try to get UID from email cache first
    if redis:
        cached_uid = redis.get(f"user_email:{email}")
        if cached_uid:
            # Get user by UID (which might also be cached)
            return get_user(cached_uid, db, redis)
    
    # Query database
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Cache email -> UID mapping
    if redis:
        redis.set(f"user_email:{email}", user.uid, expire=3600)
    
    return get_user(user.uid, db, redis)