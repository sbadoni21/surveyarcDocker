from datetime import datetime
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field
from typing import Literal, List, Optional, Dict, Any


# ---------- Base ----------
class ThemeBase(BaseModel):
    org_id: str
    name: str


    light_primary_color: str
    light_secondary_color: str
    light_text_color: Optional[str] = None
    light_background_color: Optional[str] = None

    dark_primary_color: str
    dark_secondary_color: str
    dark_text_color: Optional[str] = None
    dark_background_color: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    logo_url: Optional[str] = None

    meta: Dict[str, Any] = Field(default_factory=dict)

    is_active: bool = True


# ---------- CREATE ----------


class ThemeCreate(BaseModel):
    org_id: str
    name: str
    created_by: str

    light_primary_color: str
    light_secondary_color: str
    light_text_color: Optional[str] = None
    light_background_color: Optional[str] = None

    dark_primary_color: str
    dark_secondary_color: str
    dark_text_color: Optional[str] = None
    dark_background_color: Optional[str] = None

    logo_url: Optional[str] = None
    meta: Optional[Dict[str, Any]] = {}
    is_active: Optional[bool] = True



# ---------- UPDATE (PATCH) ----------
class ThemeUpdate(BaseModel):
    name: Optional[str] = None

    light_primary_color: Optional[str] = None
    light_secondary_color: Optional[str] = None
    light_text_color: Optional[str] = None
    light_background_color: Optional[str] = None

    dark_primary_color: Optional[str] = None
    dark_secondary_color: Optional[str] = None
    dark_text_color: Optional[str] = None
    dark_background_color: Optional[str] = None

    logo_url: Optional[str] = None
    meta: Optional[Dict[str, Any]] = None
    is_active: Optional[bool] = None


# ---------- RESPONSE ----------
class ThemeOut(BaseModel):
    theme_id: str
    org_id: str
    name: str
    light_primary_color: str
    light_secondary_color: str
    light_text_color: str
    light_background_color: str
    dark_primary_color: str
    dark_secondary_color: str
    dark_text_color: str
    dark_background_color: str
    logo_url: Optional[str]
    meta: Dict | None = None
    is_active: bool
    created_by: str

    created_at: datetime
    updated_at: datetime


    class Config:
        orm_mode = True
# delete this
class ThemeListOut(BaseModel):
    themes: List[ThemeOut]

