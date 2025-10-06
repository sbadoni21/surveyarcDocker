# app/policies/auth.py
from fastapi import Header, HTTPException, Depends
from sqlalchemy.orm import Session
from typing import Optional
import firebase_admin
from firebase_admin import auth as firebase_auth

from ..db import get_db

# Initialize Firebase Admin (do this once in your app startup)
# if not firebase_admin._apps:
#     firebase_admin.initialize_app()


def get_current_user(
    x_user_id: Optional[str] = Header(None),
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    """
    Extract and validate user from request headers.
    
    Returns:
    {
        "uid": str,
        "role": str,
        "org_ids": list[str],
        "email": str,
        ...other user fields
    }
    """
    
    # Option 1: Simple X-User-Id header (if you trust Next.js middleware)
    if x_user_id:
        return _get_user_from_db(db, x_user_id)
    
    # Option 2: Validate Firebase token from Authorization header
    if authorization and authorization.startswith("Bearer "):
        token = authorization.replace("Bearer ", "")
        return _validate_firebase_token(db, token)
    
    raise HTTPException(401, "Unauthorized - No valid authentication provided")


def _get_user_from_db(db: Session, user_id: str):
    """
    Fetch user from database and return auth context.
    """
    try:
        from ..models.user import User
    except ImportError:
        # If User model doesn't exist, return minimal info
        return {
            "uid": user_id,
            "role": "agent",  # default role
            "org_ids": []
        }
    
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(404, "User not found")
    
    # Extract org_ids - adjust based on your User model structure
    org_ids = []
    if hasattr(user, 'org_id') and user.org_id:
        org_ids = [user.org_id]
    elif hasattr(user, 'org_ids') and user.org_ids:
        org_ids = user.org_ids
    
    # Extract role - adjust field name based on your model
    role = getattr(user, 'role', 'user')
    
    return {
        "uid": user.uid,
        "role": role,
        "org_ids": org_ids,
        "email": getattr(user, 'email', None),
        "name": getattr(user, 'name', None),
    }


def _validate_firebase_token(db: Session, token: str):
    """
    Validate Firebase ID token and get user info.
    """
    try:
        # Verify the token with Firebase Admin
        decoded_token = firebase_auth.verify_id_token(token)
        user_id = decoded_token['uid']
        
        # Get user from database
        return _get_user_from_db(db, user_id)
        
    except firebase_auth.InvalidIdTokenError:
        raise HTTPException(401, "Invalid authentication token")
    except Exception as e:
        raise HTTPException(401, f"Authentication failed: {str(e)}")


# Optional: Get current user or None (for optional auth)
def get_current_user_optional(
    x_user_id: Optional[str] = Header(None),
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    """
    Get current user if authenticated, otherwise return None.
    """
    try:
        return get_current_user(x_user_id, authorization, db)
    except HTTPException:
        return None