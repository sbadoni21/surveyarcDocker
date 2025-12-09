from pydantic import BaseModel, Field, EmailStr, field_validator, ConfigDict
from typing import List, Optional, Annotated
from datetime import datetime
from pydantic.types import StringConstraints
from ..models.user import OrgRole

class UserBase(BaseModel):
    email: str
    display_name: str 
    role: OrgRole = OrgRole.member
    org_ids: List[str]

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class UserCreate(UserBase):
    uid: str
    status: str = "active"
    meta_data: dict = {}


class UserUpdate(BaseModel):
    display_name: Optional[str] = Field(None, alias="displayName")
    role: Optional[OrgRole] = None
    status: Optional[str] = None
    org_ids: Optional[List[str]] = Field(None, alias="orgId")
    meta_data: Optional[dict] = Field(None, alias="metadata")

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class UserOut(BaseModel):
    uid: str
    email: str
    display_name: str
    role: str
    org_ids: List[str] = []
    status: str
    meta_data: dict = {}
    joined_at: Optional[datetime] = None
    last_login_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class AdminCreateUserRequest(BaseModel):
    """
    Schema for admin user creation endpoint.
    Uses Pydantic v2 Annotated types for validation.
    """
    email: EmailStr
    password: Annotated[str, StringConstraints(min_length=8)]
    display_name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]
    role: str = "member"
    org_id: str
    status: str = "active"
    meta_data: Optional[dict] = None

    @field_validator('role')
    @classmethod
    def validate_role(cls, v: str) -> str:
        valid_roles = [role.value for role in OrgRole]
        if v not in valid_roles:
            raise ValueError(f'Invalid role. Must be one of: {", ".join(valid_roles)}')
        return v

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "email": "user@example.com",
                "password": "securePassword123",
                "display_name": "John Doe",
                "role": "member",
                "org_id": "org_123456",
                "status": "active",
                "meta_data": {}
            }
        }
    )