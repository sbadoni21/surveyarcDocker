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
import secrets

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
        "created_at":theme.created_at, 
        "updated_at":theme.updated_at}


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
def generate_theme_id():
    return "theme_" + secrets.token_hex(4)
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
        theme_id = generate_theme_id(),
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
@router.delete("/{theme_id}", response_model=ThemeOut)
def delete_theme(
    theme_id: str,
    db: Session = Depends(get_db),
):
    theme = db.query(Theme).filter(Theme.theme_id == theme_id).first()
    if not theme:
        raise HTTPException(status_code=404, detail="Theme not found")

    data = _to_dict(theme)
    org_id = theme.org_id

    db.delete(theme)
    db.commit()

    # Redis remove
    RedisThemeService.invalidate_theme(theme_id, org_id=org_id)

    return data


    return data
# --------------------------------------------------------
# ✅ Duplicate theme
# --------------------------------------------------------
@router.post("/{theme_id}/duplicate", response_model=ThemeOut)
def duplicate_theme(
    theme_id: str,
    db: Session = Depends(get_db),
):
    # Find original theme
    original = db.query(Theme).filter(Theme.theme_id == theme_id).first()
    if not original:
        raise HTTPException(status_code=404, detail="Theme not found")
    
    # Generate new name
    base_name = original.name
    copy_number = 1
    new_name = f"{base_name} (Copy)"
    
    # Check for existing copies and increment
    while db.query(Theme).filter(
        Theme.org_id == original.org_id,
        Theme.name == new_name
    ).first():
        copy_number += 1
        new_name = f"{base_name} (Copy {copy_number})"
    
    # Create duplicate
    duplicate = Theme(
        theme_id=generate_theme_id(),
        org_id=original.org_id,
        name=new_name,
        light_primary_color=original.light_primary_color,
        light_secondary_color=original.light_secondary_color,
        light_text_color=original.light_text_color,
        light_background_color=original.light_background_color,
        dark_primary_color=original.dark_primary_color,
        dark_secondary_color=original.dark_secondary_color,
        dark_text_color=original.dark_text_color,
        dark_background_color=original.dark_background_color,
        logo_url=original.logo_url,
        meta=original.meta,
        is_active=True,  # New duplicates are active by default
        created_by=original.created_by,
    )
    
    db.add(duplicate)
    db.commit()
    db.refresh(duplicate)
    
    data = _to_dict(duplicate)
    
    # Cache new theme
    RedisThemeService.cache_theme(duplicate.theme_id, data)
    RedisThemeService.invalidate_theme(duplicate.theme_id, org_id=duplicate.org_id)
    
    return data