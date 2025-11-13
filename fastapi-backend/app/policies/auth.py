# app/policies/auth.py

from fastapi import Header, HTTPException, Depends
from sqlalchemy.orm import Session
from typing import Optional
import firebase_admin
from firebase_admin import auth as firebase_auth

from ..db import get_db

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
        "org_id": str,  # ✅ Single org_id for backward compatibility
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
        
        user = db.query(User).filter(User.uid == user_id).first()
        
        if not user:
            raise HTTPException(404, f"User not found: {user_id}")
        
        # ✅ Extract org_ids (handle both singular and plural)
        org_ids = []
        org_id = None
        
        # Check for org_ids field first (list)
        if hasattr(user, 'org_ids') and user.org_ids:
            org_ids = user.org_ids if isinstance(user.org_ids, list) else [user.org_ids]
            org_id = org_ids[0] if org_ids else None
        # Fallback to singular org_id field
        elif hasattr(user, 'org_id') and user.org_id:
            org_id = user.org_id
            org_ids = [org_id]
        
        # ✅ If still no org_id, raise error
        if not org_id:
            raise HTTPException(
                400, 
                f"User {user_id} has no organization assigned. Please contact support."
            )
        
        # Extract role
        role = getattr(user, 'role', 'user')
        
        print(f"✅ User authenticated: {user.uid}, Org: {org_id}, Role: {role}")
        
        return {
            "uid": user.uid,
            "user_id": user.uid,  # ✅ Add for backward compatibility
            "role": role,
            "org_id": org_id,  # ✅ Primary org (first in list)
            "org_ids": org_ids,  # ✅ All orgs
            "email": getattr(user, 'email', None),
            "name": getattr(user, 'display_name', getattr(user, 'name', None)),
            "is_admin": role in ['admin', 'superadmin'],
        }
        
    except ImportError:
        # If User model doesn't exist, return minimal info
        print(f"⚠️  User model not found, using fallback for {user_id}")
        return {
            "uid": user_id,
            "user_id": user_id,
            "role": "agent",
            "org_id": "org_default",  # TODO: Replace with actual org
            "org_ids": ["org_default"],
            "is_admin": False,
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