from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..db import get_db
from ..models.themes import Theme
from ..schemas.themes import (
    ThemeCreate,
    ThemeUpdate,
    ThemeOut,
    ThemeListOut,
)
from ..services.redis_theme_service import RedisThemeService

from uuid import uuid4
from typing import Optional, List


router = APIRouter(prefix="/themes", tags=["Themes"])


# ✅ Helper → DB → dict
def _to_dict(theme: Theme) -> dict:
    return {
        "theme_id": theme.theme_id,
        "org_id": theme.org_id,
        "name": theme.name,
        "light_primary_color": theme.light_primary_color,
        "light_secondary_color": theme.light_secondary_color,
        "light_text_color": theme.light_text_color,
        "light_background_color": theme.light_background_color,
        "dark_primary_color": theme.dark_primary_color,
        "dark_secondary_color": theme.dark_secondary_color,
        "dark_text_color": theme.dark_text_color,
        "dark_background_color": theme.dark_background_color,
        "logo_url": theme.logo_url,
        "meta": theme.meta,
        "is_active": theme.is_active,
        "created_by": theme.created_by,
        "created_at": theme.created_at,
        "updated_at": theme.updated_at,
    }


# --------------------------------------------------------
# ✅ Get list by org_id (+active)
# --------------------------------------------------------
@router.get("/", response_model=List[ThemeOut])
def list_themes(
    org_id: str = Query(...),
    active: Optional[bool] = Query(None),
    db: Session = Depends(get_db),
):
    # Try Redis
    cached = RedisThemeService.get_list_by_org(org_id, active)
    if cached is not None:
        return cached

    # Fetch from DB
    q = db.query(Theme).filter(Theme.org_id == org_id)
    if active is not None:
        q = q.filter(Theme.is_active == active)

    rows = [_to_dict(t) for t in q.all()]

    # Cache Redis
    RedisThemeService.cache_list_by_org(org_id, active, rows)
    return rows


# --------------------------------------------------------
# ✅ Get single theme
# --------------------------------------------------------
@router.get("/{theme_id}", response_model=ThemeOut)
def get_theme(
    theme_id: str,
    db: Session = Depends(get_db),
):
    # Try Redis
    cached = RedisThemeService.get_theme(theme_id)
    if cached is not None:
        return cached

    # DB Load
    row = db.query(Theme).filter(Theme.theme_id == theme_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Theme not found")

    data = _to_dict(row)

    # Cache
    RedisThemeService.cache_theme(theme_id, data)
    return data


# --------------------------------------------------------
# ✅ Create theme
# --------------------------------------------------------
@router.post("/", response_model=ThemeOut)
def create_theme(
    payload: ThemeCreate,
    db: Session = Depends(get_db),
):
    # Check duplicate name per org
    exists = (
        db.query(Theme)
        .filter(Theme.org_id == payload.org_id, Theme.name == payload.name)
        .first()
    )
    if exists:
        raise HTTPException(status_code=400, detail="Theme name already exists in org")

    theme = Theme(
        theme_id=str(uuid4()),
        **payload.dict(),
    )

    db.add(theme)
    db.commit()
    db.refresh(theme)

    data = _to_dict(theme)

    # Store cache
    RedisThemeService.cache_theme(theme.theme_id, data)
    RedisThemeService.invalidate_theme(theme.theme_id, org_id=theme.org_id)

    return data


# --------------------------------------------------------
# ✅ Update theme
# --------------------------------------------------------
@router.patch("/{theme_id}", response_model=ThemeOut)
def update_theme(
    theme_id: str,
    payload: ThemeUpdate,
    db: Session = Depends(get_db),
):
    theme = db.query(Theme).filter(Theme.theme_id == theme_id).first()
    if not theme:
        raise HTTPException(status_code=404, detail="Theme not found")

    for k, v in payload.dict(exclude_unset=True).items():
        setattr(theme, k, v)

    db.commit()
    db.refresh(theme)

    data = _to_dict(theme)

    # Refresh cache
    RedisThemeService.cache_theme(theme.theme_id, data)
    RedisThemeService.invalidate_theme(theme.theme_id, org_id=theme.org_id)

    return data


# --------------------------------------------------------
# ✅ Toggle Active
# --------------------------------------------------------
@router.patch("/{theme_id}/toggle", response_model=ThemeOut)
def toggle_active(
    theme_id: str,
    db: Session = Depends(get_db),
):
    theme = db.query(Theme).filter(Theme.theme_id == theme_id).first()
    if not theme:
        raise HTTPException(status_code=404, detail="Theme not found")

    theme.is_active = not theme.is_active
    db.commit()
    db.refresh(theme)

    data = _to_dict(theme)

    RedisThemeService.cache_theme(theme_id, data)
    RedisThemeService.invalidate_theme(theme_id, org_id=theme.org_id)

    return data
