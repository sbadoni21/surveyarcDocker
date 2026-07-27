# app/schemas/user.py - CLEAN VERSION (No role field)

from pydantic import BaseModel, EmailStr, Field, ConfigDict
from typing import Optional, List, Dict, Any
from datetime import datetime

class UserBase(BaseModel):
    email: EmailStr
    display_name: str

class UserCreate(BaseModel):
    """Schema for creating a user via regular /users endpoint"""
    uid: str
    email: EmailStr
    display_name: str
    org_ids: Optional[List[str]] = []
    status: Optional[str] = "active"
    meta_data: Optional[Dict[str, Any]] = {}

class AdminCreateUserRequest(BaseModel):
    """
    Schema for admin-create endpoint
    
    ✅ NO ROLE FIELD - Role assigned via RBAC system
    """
    email: EmailStr
    password: str = Field(..., min_length=6, description="User password (min 6 characters)")
    display_name: str = Field(..., min_length=1, description="User's display name")
    
    # RBAC role name (from roles table)
    role_name: str = Field(..., description="RBAC role name from roles table")
    
    org_id: str = Field(..., description="Organization ID")
    current_user_id: str = Field(..., description="UID of admin creating this user")
    
    status: Optional[str] = Field(default="active", description="User status")
    meta_data: Optional[Dict[str, Any]] = Field(default=None, description="Additional metadata")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "email": "user@example.com",
                "password": "securePassword123",
                "display_name": "John Doe",
                "role_name": "admin",
                "org_id": "org_123456",
                "current_user_id": "admin_uid_789",
                "status": "active",
                "meta_data": {}
            }
        }
    )

class UserUpdate(BaseModel):
    """Schema for updating a user"""
    display_name: Optional[str] = None
    org_ids: Optional[List[str]] = None
    status: Optional[str] = None
    meta_data: Optional[Dict[str, Any]] = None

    model_config = ConfigDict(from_attributes=True)

class UserOut(BaseModel):
    """
    Schema for user response
    
    ✅ NO ROLE FIELD - Get roles from RBAC system if needed
    """
    uid: str
    email: str
    display_name: str
    org_ids: List[str] = []
    status: str
    meta_data: Dict[str, Any] = {}
    joined_at: Optional[datetime] = None
    last_login_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)