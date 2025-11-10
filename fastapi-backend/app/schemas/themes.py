from datetime import datetime
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field
from typing import Literal, List


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

    logo_url: Optional[str] = None

    meta: Dict[str, Any] = Field(default_factory=dict)

    is_active: bool = True


# ---------- CREATE ----------
class ThemeCreate(ThemeBase):
    created_by: str


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
class ThemeOut(ThemeBase):
    theme_id: str
    created_by: str
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True
# delete this
class ThemeListOut(BaseModel):
    themes: List[ThemeOut]

