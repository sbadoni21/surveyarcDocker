from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

class UserBase(BaseModel):
    email: str
    display_name: str = Field(..., alias="displayName")
    role: str = Field("user", alias="role")
    org_ids: List[str] = Field(default=[], alias="orgId")

    class Config:
        orm_mode = True
        populate_by_name = True


class UserCreate(UserBase):
    uid: str
    status: str = "active"
    meta_data: dict = Field(default={}, alias="metadata")

    class Config:
        orm_mode = True
        populate_by_name = True


class UserUpdate(BaseModel):
    display_name: Optional[str] = Field(None, alias="displayName")
    role: Optional[str] = None
    status: Optional[str] = None
    org_ids: Optional[List[str]] = Field(None, alias="orgId")
    meta_data: Optional[dict] = Field(None, alias="metadata")

    class Config:
        orm_mode = True
        populate_by_name = True


class UserOut(BaseModel):
    uid: str
    email: str
    display_name: str
    role: str
    org_ids: List[str] = []
    status: str
    meta_data: dict
    joined_at: Optional[datetime] = None
    last_login_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True   # 👈 important fix