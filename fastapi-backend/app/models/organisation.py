from sqlalchemy import Column, String, Boolean, DateTime
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func
from ..db import Base

class Organisation(Base):
    __tablename__ = "organisations"

    org_id = Column(String, primary_key=True, index=True)  # ✅ take from frontend
    name = Column(String, nullable=False)
    owner_email = Column(String, nullable=False)
    owner_uid = Column(String, nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    subscription = Column(JSONB, default=dict)
    business_type = Column(String, default="small")
    organisation_size = Column(String, default="1")  # ✅ keep as string (frontend sends string)
    industry = Column(String, default="")
    tags = Column(JSONB, default=list)
    theme_settings = Column(JSONB, default=dict)
    team_members = Column(JSONB, default=list)
    sso_config = Column(JSONB, default=dict)
    scim_config = Column(JSONB, default=dict)
    api_rate_limits = Column(JSONB, default=dict)
    features = Column(JSONB, default=dict)
    integrations = Column(JSONB, default=dict)
    billing_details = Column(JSONB, default=dict)
    last_activity = Column(DateTime(timezone=True), server_default=func.now())
    compliance = Column(JSONB, default=dict)
    region = Column(String, default="")
    country = Column(String, default="")
    timezone = Column(String, default="")
    supported_locales = Column(JSONB, default=list)
    default_locale = Column(String, default="en")
    data_region = Column(String, default="")
    encryption = Column(JSONB, default=dict)
    onboarding = Column(JSONB, default=dict)
    referral_code = Column(String, default="")
    created_via = Column(String, default="web")
    is_active = Column(Boolean, default=True)
    is_suspended = Column(Boolean, default=False)
    deleted_at = Column(DateTime(timezone=True), nullable=True)
