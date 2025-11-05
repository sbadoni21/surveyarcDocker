# app/routes/organisation.py
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..db import get_db
from ..models.organisation import Organisation
from ..schemas.organisation import (
    OrganisationCreate,
    OrganisationResponse,
    OrganisationUpdate,
)

# Redis deps
from ..dependencies.redis import get_redis_optional
from ..core.redis_client import (
    RedisClient,
    serialize_for_redis,
    deserialize_from_redis,
)

router = APIRouter(prefix="/organisation", tags=["Organisation"])


# ---------------------------- helpers ----------------------------

def _serialize_organisation(org: Organisation) -> dict:
    """Convert Organisation model to a JSON-serializable dict."""
    return {
        "org_id": org.org_id,
        "name": org.name,
        "owner_email": org.owner_email,
        "owner_uid": org.owner_uid,
        "created_at": org.created_at.isoformat() if org.created_at else None,
        "updated_at": org.updated_at.isoformat() if org.updated_at else None,
        "last_activity": org.last_activity.isoformat() if org.last_activity else None,
        "deleted_at": org.deleted_at.isoformat() if org.deleted_at else None,
        "subscription": org.subscription or {},
        "business_type": org.business_type,
        "organisation_size": org.organisation_size,
        "industry": org.industry,
        "tags": org.tags or [],
        "theme_settings": org.theme_settings or {},
        "team_members": org.team_members or [],
        "sso_config": org.sso_config or {},
        "scim_config": org.scim_config or {},
        "api_rate_limits": org.api_rate_limits or {},
        "features": org.features or {},
        "integrations": org.integrations or {},
        "billing_details": org.billing_details or {},
        "compliance": org.compliance or {},
        "region": getattr(org, "region", ""),
        "country": getattr(org, "country", ""),
        "timezone": getattr(org, "timezone", ""),
        "supported_locales": org.supported_locales or ["en"],
        "default_locale": org.default_locale,
        "data_region": getattr(org, "data_region", ""),
        "encryption": org.encryption or {},
        "onboarding": org.onboarding or {},
        "referral_code": org.referral_code,
        "created_via": org.created_via,
        "is_active": org.is_active,
        "is_suspended": org.is_suspended,
    }

def _deserialize_organisation(org_data: dict) -> dict:
    """Rehydrate ISO datetime strings into datetime objects for response model."""
    if org_data.get("created_at"):
        org_data["created_at"] = datetime.fromisoformat(org_data["created_at"])
    if org_data.get("updated_at"):
        org_data["updated_at"] = datetime.fromisoformat(org_data["updated_at"])
    if org_data.get("last_activity"):
        org_data["last_activity"] = datetime.fromisoformat(org_data["last_activity"])
    if org_data.get("deleted_at"):
        org_data["deleted_at"] = datetime.fromisoformat(org_data["deleted_at"])
    return org_data

def _redis_set_json(redis: Optional[RedisClient], key: str, value, ex: Optional[int] = None):
    """Serialize value to JSON and store via wrapper safely."""
    try:
        if redis and redis.ping():
            payload = serialize_for_redis(value)
            redis.safe_set(key, payload, ex=ex)
    except Exception as e:
        print(f"[organisation] redis set error (ignored): {e}")

def _redis_get_json(redis: Optional[RedisClient], key: str):
    """Get JSON string and deserialize to Python object; return None if missing."""
    try:
        if not (redis and redis.ping()):
            return None
        raw = redis.safe_get(key)
        return deserialize_from_redis(raw)
    except Exception as e:
        print(f"[organisation] redis get error (ignored): {e}")
        return None

def _redis_delete(redis: Optional[RedisClient], *keys: str):
    try:
        if redis and redis.ping():
            redis.safe_delete(*keys)
    except Exception as e:
        print(f"[organisation] redis delete error (ignored): {e}")

def _redis_clear_pattern(redis: Optional[RedisClient], pattern: str):
    """Prefer flush_pattern; if unavailable, no-op."""
    try:
        if redis and redis.ping():
            if hasattr(redis, "flush_pattern"):
                redis.flush_pattern(pattern)
            elif hasattr(redis, "clear_pattern"):
                # supports older client shape if present
                getattr(redis, "clear_pattern")(pattern)
    except Exception as e:
        print(f"[organisation] redis clear pattern error (ignored): {e}")

def _redis_invalidate_user_session(redis: Optional[RedisClient], uid: str):
    """Fallback if client lacks a helper: delete user_session:{uid}."""
    try:
        if not (redis and redis.ping()):
            return
        if hasattr(redis, "invalidate_user_session"):
            getattr(redis, "invalidate_user_session")(uid)
        else:
            _redis_delete(redis, f"user_session:{uid}")
    except Exception as e:
        print(f"[organisation] redis invalidate session error (ignored): {e}")


# ---------------------------- routes ----------------------------

@router.post("/", response_model=OrganisationResponse)
def create_organisation(
    org: OrganisationCreate,
    db: Session = Depends(get_db),
    redis: Optional[RedisClient] = Depends(get_redis_optional),
):
    """Create organisation with Redis caching"""
    print("[/organisation POST] payload:", org)

    # Uniqueness check
    existing_org = db.query(Organisation).filter(Organisation.org_id == org.org_id).first()
    if existing_org:
        raise HTTPException(status_code=400, detail="Organisation with this ID already exists")

    db_org = Organisation(**org.dict(exclude_unset=True))
    db_org.created_at = datetime.utcnow()
    db_org.updated_at = datetime.utcnow()

    db.add(db_org)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Organisation already exists")
    db.refresh(db_org)

    # Cache the new organisation + invalidate owner list
    org_data = _serialize_organisation(db_org)
    _redis_set_json(redis, f"org:{db_org.org_id}", org_data, ex=3600)
    _redis_delete(redis, f"owner_orgs:{db_org.owner_uid}")

    # Cache org settings if present
    if db_org.theme_settings:
        _redis_set_json(redis, f"org_settings:{db_org.org_id}", db_org.theme_settings, ex=7200)

    return db_org


@router.patch("/{org_id}", response_model=OrganisationResponse)
def update_organisation(
    org_id: str,
    update_data: OrganisationUpdate,
    db: Session = Depends(get_db),
    redis: Optional[RedisClient] = Depends(get_redis_optional),
):
    """Update organisation with cache invalidation"""
    print("[/organisation PATCH] payload:", update_data)

    db_org = db.query(Organisation).filter(Organisation.org_id == org_id).first()
    if not db_org:
        raise HTTPException(status_code=404, detail="Organisation not found")

    old_owner_uid = db_org.owner_uid

    for key, value in update_data.dict(exclude_unset=True).items():
        setattr(db_org, key, value)

    db_org.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(db_org)

    # Update caches
    org_data = _serialize_organisation(db_org)
    _redis_set_json(redis, f"org:{org_id}", org_data, ex=3600)
    _redis_delete(redis, f"owner_orgs:{old_owner_uid}")
    if db_org.owner_uid != old_owner_uid:
        _redis_delete(redis, f"owner_orgs:{db_org.owner_uid}")

    if db_org.theme_settings:
        _redis_set_json(redis, f"org_settings:{org_id}", db_org.theme_settings, ex=7200)
    else:
        _redis_delete(redis, f"org_settings:{org_id}")

    _redis_clear_pattern(redis, f"org_members:{org_id}*")
    _redis_clear_pattern(redis, f"org_stats:{org_id}*")

    return db_org


@router.get("/{org_id}", response_model=OrganisationResponse)
def get_organisation(
    org_id: str,
    db: Session = Depends(get_db),
    redis: Optional[RedisClient] = Depends(get_redis_optional),
):
    """Get organisation with Redis caching"""

    cached = _redis_get_json(redis, f"org:{org_id}")
    if cached is not None:
        return OrganisationResponse(**_deserialize_organisation(cached))

    db_org = db.query(Organisation).filter(Organisation.org_id == org_id).first()
    if not db_org:
        raise HTTPException(status_code=404, detail="Organisation not found")

    _redis_set_json(redis, f"org:{org_id}", _serialize_organisation(db_org), ex=3600)
    return db_org


@router.delete("/{org_id}", response_model=OrganisationResponse)
def soft_delete_organisation(
    org_id: str,
    db: Session = Depends(get_db),
    redis: Optional[RedisClient] = Depends(get_redis_optional),
):
    """Soft delete organisation with cache cleanup"""

    db_org = db.query(Organisation).filter(Organisation.org_id == org_id).first()
    if not db_org:
        raise HTTPException(status_code=404, detail="Organisation not found")

    owner_uid = db_org.owner_uid

    db_org.is_active = False
    db_org.is_suspended = True
    db_org.deleted_at = func.now()
    db_org.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(db_org)

    _redis_delete(redis, f"org:{org_id}", f"org_settings:{org_id}", f"owner_orgs:{owner_uid}")
    _redis_clear_pattern(redis, f"org_members:{org_id}*")
    _redis_clear_pattern(redis, f"org_stats:{org_id}*")
    _redis_clear_pattern(redis, f"org_*:{org_id}")

    if db_org.team_members:
        for member in db_org.team_members:
            if isinstance(member, dict) and member.get("uid"):
                _redis_delete(redis, f"user:{member['uid']}")
                _redis_invalidate_user_session(redis, member["uid"])

    return db_org


@router.get("/owner/{owner_uid}", response_model=List[OrganisationResponse])
def get_organisations_by_owner(
    owner_uid: str,
    include_inactive: bool = False,
    db: Session = Depends(get_db),
    redis: Optional[RedisClient] = Depends(get_redis_optional),
):
    """Get all organisations owned by a user with caching"""

    cache_key = f"owner_orgs:{owner_uid}:inactive_{include_inactive}"

    cached_list = _redis_get_json(redis, cache_key)
    if isinstance(cached_list, list) and cached_list:
        out: List[OrganisationResponse] = []
        for org_data in cached_list:
            out.append(OrganisationResponse(**_deserialize_organisation(org_data)))
        return out

    query = db.query(Organisation).filter(Organisation.owner_uid == owner_uid)
    if not include_inactive:
        query = query.filter(Organisation.is_active == True, Organisation.deleted_at.is_(None))

    organisations = query.all()

    # Cache list + individual orgs
    orgs_payload = []
    for org in organisations:
        data = _serialize_organisation(org)
        orgs_payload.append(data)
        _redis_set_json(redis, f"org:{org['org_id'] if isinstance(org, dict) else org.org_id}", data, ex=3600)

    _redis_set_json(redis, cache_key, orgs_payload, ex=1800)
    return organisations


@router.get("/{org_id}/settings")
def get_organisation_settings(
    org_id: str,
    db: Session = Depends(get_db),
    redis: Optional[RedisClient] = Depends(get_redis_optional),
):
    """Get organisation theme settings with caching"""

    cached = _redis_get_json(redis, f"org_settings:{org_id}")
    if isinstance(cached, dict):
        return {"org_id": org_id, "settings": cached, "source": "cache"}

    db_org = db.query(Organisation).filter(Organisation.org_id == org_id).first()
    if not db_org:
        raise HTTPException(status_code=404, detail="Organisation not found")

    settings = db_org.theme_settings or {}
    _redis_set_json(redis, f"org_settings:{org_id}", settings, ex=7200)

    return {"org_id": org_id, "settings": settings, "source": "database"}


@router.patch("/{org_id}/settings")
def update_organisation_settings(
    org_id: str,
    settings: dict,
    db: Session = Depends(get_db),
    redis: Optional[RedisClient] = Depends(get_redis_optional),
):
    """Update organisation theme settings with cache update"""

    db_org = db.query(Organisation).filter(Organisation.org_id == org_id).first()
    if not db_org:
        raise HTTPException(status_code=404, detail="Organisation not found")

    merged = (db_org.theme_settings or {}).copy()
    merged.update(settings)

    db_org.theme_settings = merged
    db_org.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(db_org)

    _redis_set_json(redis, f"org_settings:{org_id}", merged, ex=7200)
    _redis_delete(redis, f"org:{org_id}", f"owner_orgs:{db_org.owner_uid}")  # force refresh

    return {"org_id": org_id, "settings": merged, "message": "Settings updated successfully"}


@router.get("/{org_id}/members")
def get_organisation_members(
    org_id: str,
    db: Session = Depends(get_db),
    redis: Optional[RedisClient] = Depends(get_redis_optional),
):
    """Get organisation team members with caching"""

    cache_key = f"org_members:{org_id}"

    cached_members = _redis_get_json(redis, cache_key)
    if isinstance(cached_members, list):
        return {
            "org_id": org_id,
            "members": cached_members,
            "total": len(cached_members),
            "source": "cache",
        }

    db_org = db.query(Organisation).filter(Organisation.org_id == org_id).first()
    if not db_org:
        raise HTTPException(status_code=404, detail="Organisation not found")

    members = db_org.team_members or []
    _redis_set_json(redis, cache_key, members, ex=1800)

    return {"org_id": org_id, "members": members, "total": len(members), "source": "database"}


@router.post("/{org_id}/activate")
def activate_organisation(
    org_id: str,
    db: Session = Depends(get_db),
    redis: Optional[RedisClient] = Depends(get_redis_optional),
):
    """Activate organisation with cache update"""

    db_org = db.query(Organisation).filter(Organisation.org_id == org_id).first()
    if not db_org:
        raise HTTPException(status_code=404, detail="Organisation not found")

    db_org.is_active = True
    db_org.is_suspended = False
    db_org.deleted_at = None
    db_org.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(db_org)

    _redis_delete(redis, f"org:{org_id}", f"owner_orgs:{db_org.owner_uid}")
    return {"org_id": org_id, "message": "Organisation activated successfully", "is_active": db_org.is_active}


@router.post("/{org_id}/suspend")
def suspend_organisation(
    org_id: str,
    db: Session = Depends(get_db),
    redis: Optional[RedisClient] = Depends(get_redis_optional),
):
    """Suspend organisation with cache cleanup"""

    db_org = db.query(Organisation).filter(Organisation.org_id == org_id).first()
    if not db_org:
        raise HTTPException(status_code=404, detail="Organisation not found")

    db_org.is_suspended = True
    db_org.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(db_org)

    _redis_delete(redis, f"org:{org_id}", f"owner_orgs:{db_org.owner_uid}")
    _redis_clear_pattern(redis, f"org_*:{org_id}")

    if db_org.team_members:
        for member in db_org.team_members:
            if isinstance(member, dict) and member.get("uid"):
                _redis_invalidate_user_session(redis, member["uid"])

    return {"org_id": org_id, "message": "Organisation suspended successfully", "is_suspended": db_org.is_suspended}
