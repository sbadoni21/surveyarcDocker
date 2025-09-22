from pydantic import BaseModel
from typing import Optional, List, Dict
from datetime import datetime

class OrganisationBase(BaseModel):
    name: str
    owner_uid: str
    org_id: str
    owner_email: str

class OrganisationCreate(OrganisationBase):
    subscription: Optional[Dict] = None
    business_type: Optional[str] = "small"
    organisation_size: Optional[str] = "1"  
    industry: Optional[str] = ""
    tags: Optional[List[str]] = []
    theme_settings: Optional[Dict] = None
    team_members: Optional[List[Dict]] = []
    sso_config: Optional[Dict] = None
    scim_config: Optional[Dict] = None
    api_rate_limits: Optional[Dict] = None
    features: Optional[Dict] = None
    integrations: Optional[Dict] = None
    billing_details: Optional[Dict] = None
    compliance: Optional[Dict] = None
    supported_locales: Optional[List[str]] = ["en"]
    default_locale: Optional[str] = "en"
    encryption: Optional[Dict] = None
    onboarding: Optional[Dict] = None
    referral_code: Optional[str] = ""
    created_via: Optional[str] = "web"
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    last_activity: Optional[datetime] = None
    is_active: Optional[bool] = True
    is_suspended: Optional[bool] = False
    deleted_at: Optional[datetime] = None
    
class OrganisationUpdate(BaseModel):
    # all fields optional so you can send one or many
    name: Optional[str] = None
    owner_uid: Optional[str] = None
    org_id: Optional[str] = None
    owner_email: Optional[str] = None
    subscription: Optional[Dict] = None
    business_type: Optional[str] = None
    organisation_size: Optional[str] = None
    industry: Optional[str] = None
    tags: Optional[List[str]] = None
    theme_settings: Optional[Dict] = None
    team_members: Optional[List[Dict]] = None
    sso_config: Optional[Dict] = None
    scim_config: Optional[Dict] = None
    api_rate_limits: Optional[Dict] = None
    features: Optional[Dict] = None
    integrations: Optional[Dict] = None
    billing_details: Optional[Dict] = None
    compliance: Optional[Dict] = None
    supported_locales: Optional[List[str]] = None
    default_locale: Optional[str] = None
    encryption: Optional[Dict] = None
    onboarding: Optional[Dict] = None
    referral_code: Optional[str] = None
    created_via: Optional[str] = None
    last_activity: Optional[datetime] = None
    is_active: Optional[bool] = None
    is_suspended: Optional[bool] = None
    deleted_at: Optional[datetime] = None
    
class OrganisationResponse(OrganisationCreate):
    org_id: str
    created_at: datetime
    updated_at: Optional[datetime]
    is_active: bool
    is_suspended: bool
    deleted_at: Optional[datetime]

    class Config:
        from_attributes = True
