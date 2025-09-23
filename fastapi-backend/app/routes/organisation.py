from sqlalchemy import func
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..db import get_db
from ..models.organisation import Organisation
from ..schemas.organisation import OrganisationCreate, OrganisationResponse, OrganisationUpdate
from sqlalchemy.exc import IntegrityError
from datetime import datetime
from typing import List

# Import Redis dependencies
from ..dependencies.redis import get_redis_optional
from ..core.redis_client import RedisClient

router = APIRouter(prefix="/organisation", tags=["Organisation"])

@router.post("/", response_model=OrganisationResponse)
def create_organisation(
    org: OrganisationCreate, 
    db: Session = Depends(get_db),
    redis: RedisClient = Depends(get_redis_optional)
):
    """Create organisation with Redis caching"""
    print(org)
    
    # Check if organisation already exists
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
    
    # Cache the new organisation
    if redis:
        org_data = _serialize_organisation(db_org)
        redis.set(f"org:{db_org.org_id}", org_data, expire=3600)  # Cache for 1 hour
        
        # Cache in owner's organisation list
        redis.delete(f"owner_orgs:{db_org.owner_uid}")
        
        # Cache organisation settings if they exist
        if db_org.theme_settings:
            redis.set(f"org_settings:{db_org.org_id}", db_org.theme_settings, expire=7200)
    
    return db_org

@router.patch("/{org_id}", response_model=OrganisationResponse)
def update_organisation(
    org_id: str, 
    update_data: OrganisationUpdate, 
    db: Session = Depends(get_db),
    redis: RedisClient = Depends(get_redis_optional)
):
    """Update organisation with cache invalidation"""
    print(update_data)
    
    db_org = db.query(Organisation).filter(Organisation.org_id == org_id).first()
    if not db_org:
        raise HTTPException(status_code=404, detail="Organisation not found")
    
    # Store old owner_uid for cache cleanup
    old_owner_uid = db_org.owner_uid
    
    # Update fields
    for key, value in update_data.dict(exclude_unset=True).items():
        setattr(db_org, key, value)
    
    db_org.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(db_org)
    
    # Invalidate and update caches
    if redis:
        # Update organisation cache
        org_data = _serialize_organisation(db_org)
        redis.set(f"org:{org_id}", org_data, expire=3600)
        
        # Invalidate owner organisation lists (old and new if owner changed)
        redis.delete(f"owner_orgs:{old_owner_uid}")
        if db_org.owner_uid != old_owner_uid:
            redis.delete(f"owner_orgs:{db_org.owner_uid}")
        
        # Update organisation settings cache
        if db_org.theme_settings:
            redis.set(f"org_settings:{org_id}", db_org.theme_settings, expire=7200)
        else:
            redis.delete(f"org_settings:{org_id}")
        
        # Invalidate any team-related caches
        redis.clear_pattern(f"org_members:{org_id}*")
        redis.clear_pattern(f"org_stats:{org_id}*")
    
    return db_org

@router.get("/{org_id}", response_model=OrganisationResponse)
def get_organisation(
    org_id: str, 
    db: Session = Depends(get_db),
    redis: RedisClient = Depends(get_redis_optional)
):
    """Get organisation with Redis caching"""
    
    # Try cache first
    if redis:
        cached_org = redis.get(f"org:{org_id}")
        if cached_org:
            # Convert datetime strings back to datetime objects
            cached_org = _deserialize_organisation(cached_org)
            return OrganisationResponse(**cached_org)
    
    # Query database
    db_org = db.query(Organisation).filter(Organisation.org_id == org_id).first()
    if not db_org:
        raise HTTPException(status_code=404, detail="Organisation not found")
    
    # Cache the organisation
    if redis:
        org_data = _serialize_organisation(db_org)
        redis.set(f"org:{org_id}", org_data, expire=3600)
    
    return db_org

@router.delete("/{org_id}", response_model=OrganisationResponse)
def soft_delete_organisation(
    org_id: str, 
    db: Session = Depends(get_db),
    redis: RedisClient = Depends(get_redis_optional)
):
    """Soft delete organisation with cache cleanup"""
    
    db_org = db.query(Organisation).filter(Organisation.org_id == org_id).first()
    if not db_org:
        raise HTTPException(status_code=404, detail="Organisation not found")
    
    # Store owner_uid for cache cleanup
    owner_uid = db_org.owner_uid
    
    db_org.is_active = False
    db_org.is_suspended = True
    db_org.deleted_at = func.now()
    db_org.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(db_org)
    
    # Clean up all organisation-related caches
    if redis:
        redis.delete(f"org:{org_id}")
        redis.delete(f"org_settings:{org_id}")
        redis.delete(f"owner_orgs:{owner_uid}")
        
        # Clear all related caches
        redis.clear_pattern(f"org_members:{org_id}*")
        redis.clear_pattern(f"org_stats:{org_id}*")
        redis.clear_pattern(f"org_*:{org_id}")
        
        # Invalidate user caches for all team members
        if db_org.team_members:
            for member in db_org.team_members:
                if isinstance(member, dict) and member.get('uid'):
                    redis.delete(f"user:{member['uid']}")
                    redis.delete(f"user_session:{member['uid']}")
    
    return db_org

@router.get("/owner/{owner_uid}", response_model=List[OrganisationResponse])
def get_organisations_by_owner(
    owner_uid: str,
    include_inactive: bool = False,
    db: Session = Depends(get_db),
    redis: RedisClient = Depends(get_redis_optional)
):
    """Get all organisations owned by a user with caching"""
    
    cache_key = f"owner_orgs:{owner_uid}:inactive_{include_inactive}"
    
    # Try cache first
    if redis:
        cached_orgs = redis.get(cache_key)
        if cached_orgs:
            # Convert cached data back to response models
            orgs_data = []
            for org_data in cached_orgs:
                org_data = _deserialize_organisation(org_data)
                orgs_data.append(OrganisationResponse(**org_data))
            return orgs_data
    
    # Query database
    query = db.query(Organisation).filter(Organisation.owner_uid == owner_uid)
    
    if not include_inactive:
        query = query.filter(Organisation.is_active == True, Organisation.deleted_at.is_(None))
    
    organisations = query.all()
    
    # Cache the results
    if redis:
        orgs_data = []
        for org in organisations:
            org_data = _serialize_organisation(org)
            orgs_data.append(org_data)
            
            # Also cache individual organisations
            redis.set(f"org:{org.org_id}", org_data, expire=3600)
        
        redis.set(cache_key, orgs_data, expire=1800)  # Cache for 30 minutes
    
    return organisations

@router.get("/{org_id}/settings")
def get_organisation_settings(
    org_id: str,
    db: Session = Depends(get_db),
    redis: RedisClient = Depends(get_redis_optional)
):
    """Get organisation theme settings with caching"""
    
    # Try cache first
    if redis:
        cached_settings = redis.get(f"org_settings:{org_id}")
        if cached_settings:
            return {
                "org_id": org_id,
                "settings": cached_settings,
                "source": "cache"
            }
    
    # Query database
    db_org = db.query(Organisation).filter(Organisation.org_id == org_id).first()
    if not db_org:
        raise HTTPException(status_code=404, detail="Organisation not found")
    
    settings = db_org.theme_settings or {}
    
    # Cache the settings
    if redis:
        redis.set(f"org_settings:{org_id}", settings, expire=7200)  # Cache for 2 hours
    
    return {
        "org_id": org_id,
        "settings": settings,
        "source": "database"
    }

@router.patch("/{org_id}/settings")
def update_organisation_settings(
    org_id: str,
    settings: dict,
    db: Session = Depends(get_db),
    redis: RedisClient = Depends(get_redis_optional)
):
    """Update organisation theme settings with cache update"""
    
    db_org = db.query(Organisation).filter(Organisation.org_id == org_id).first()
    if not db_org:
        raise HTTPException(status_code=404, detail="Organisation not found")
    
    # Merge with existing settings
    existing_settings = db_org.theme_settings or {}
    existing_settings.update(settings)
    
    db_org.theme_settings = existing_settings
    db_org.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(db_org)
    
    # Update caches
    if redis:
        # Update settings cache
        redis.set(f"org_settings:{org_id}", existing_settings, expire=7200)
        
        # Invalidate organisation cache to force refresh
        redis.delete(f"org:{org_id}")
        
        # Invalidate owner organisation list
        redis.delete(f"owner_orgs:{db_org.owner_uid}")
    
    return {
        "org_id": org_id,
        "settings": existing_settings,
        "message": "Settings updated successfully"
    }

@router.get("/{org_id}/members")
def get_organisation_members(
    org_id: str,
    db: Session = Depends(get_db),
    redis: RedisClient = Depends(get_redis_optional)
):
    """Get organisation team members with caching"""
    
    cache_key = f"org_members:{org_id}"
    
    # Try cache first
    if redis:
        cached_members = redis.get(cache_key)
        if cached_members:
            return {
                "org_id": org_id,
                "members": cached_members,
                "total": len(cached_members),
                "source": "cache"
            }
    
    # Query database
    db_org = db.query(Organisation).filter(Organisation.org_id == org_id).first()
    if not db_org:
        raise HTTPException(status_code=404, detail="Organisation not found")
    
    members = db_org.team_members or []
    
    # Cache the members
    if redis:
        redis.set(cache_key, members, expire=1800)  # Cache for 30 minutes
    
    return {
        "org_id": org_id,
        "members": members,
        "total": len(members),
        "source": "database"
    }

@router.post("/{org_id}/activate")
def activate_organisation(
    org_id: str,
    db: Session = Depends(get_db),
    redis: RedisClient = Depends(get_redis_optional)
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
    
    # Update caches
    if redis:
        redis.delete(f"org:{org_id}")  # Force refresh
        redis.delete(f"owner_orgs:{db_org.owner_uid}")  # Refresh owner's org list
    
    return {
        "org_id": org_id,
        "message": "Organisation activated successfully",
        "is_active": db_org.is_active
    }

@router.post("/{org_id}/suspend")
def suspend_organisation(
    org_id: str,
    db: Session = Depends(get_db),
    redis: RedisClient = Depends(get_redis_optional)
):
    """Suspend organisation with cache cleanup"""
    
    db_org = db.query(Organisation).filter(Organisation.org_id == org_id).first()
    if not db_org:
        raise HTTPException(status_code=404, detail="Organisation not found")
    
    db_org.is_suspended = True
    db_org.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(db_org)
    
    # Clean up caches for suspended org
    if redis:
        redis.delete(f"org:{org_id}")
        redis.delete(f"owner_orgs:{db_org.owner_uid}")
        redis.clear_pattern(f"org_*:{org_id}")
        
        # Clear sessions for all team members
        if db_org.team_members:
            for member in db_org.team_members:
                if isinstance(member, dict) and member.get('uid'):
                    redis.invalidate_user_session(member['uid'])
    
    return {
        "org_id": org_id,
        "message": "Organisation suspended successfully",
        "is_suspended": db_org.is_suspended
    }

# Helper functions for serialization
def _serialize_organisation(org: Organisation) -> dict:
    """Convert Organisation model to dict for Redis caching"""
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
        "region": getattr(org, 'region', ''),
        "country": getattr(org, 'country', ''),
        "timezone": getattr(org, 'timezone', ''),
        "supported_locales": org.supported_locales or ["en"],
        "default_locale": org.default_locale,
        "data_region": getattr(org, 'data_region', ''),
        "encryption": org.encryption or {},
        "onboarding": org.onboarding or {},
        "referral_code": org.referral_code,
        "created_via": org.created_via,
        "is_active": org.is_active,
        "is_suspended": org.is_suspended,
    }

def _deserialize_organisation(org_data: dict) -> dict:
    """Convert cached dict back to Organisation-like dict with proper datetime objects"""
    if org_data.get("created_at"):
        org_data["created_at"] = datetime.fromisoformat(org_data["created_at"])
    if org_data.get("updated_at"):
        org_data["updated_at"] = datetime.fromisoformat(org_data["updated_at"])
    if org_data.get("last_activity"):
        org_data["last_activity"] = datetime.fromisoformat(org_data["last_activity"])
    if org_data.get("deleted_at"):
        org_data["deleted_at"] = datetime.fromisoformat(org_data["deleted_at"])
    
    return org_data