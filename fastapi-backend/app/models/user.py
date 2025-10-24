from sqlalchemy import Column, String, DateTime, JSON
from sqlalchemy.dialects.postgresql import ARRAY
from datetime import datetime
from app.db import Base
import enum, typing 
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func
from sqlalchemy import (
     Enum as SAEnum
)
class OrgRole(str, enum.Enum):
    owner            = "owner"
    admin            = "admin"
    billing_admin    = "billing_admin"
    security_admin   = "security_admin"
    manager          = "manager"
    member           = "member"        # regular internal user/agent
    auditor          = "auditor"       # read-only
    integration      = "integration"   # bots/integrations
    user = "user"   # <-- add temporarily

class User(Base):
    __tablename__ = "users"

    uid = Column(String, primary_key=True, index=True)
    email = Column(String, unique=True, nullable=False)
    display_name = Column(String, nullable=False)
    role:         Mapped[OrgRole] = mapped_column(SAEnum(OrgRole, name="org_role"), default=OrgRole.member, nullable=False)
    org_ids = Column(ARRAY(String), default=list)
    status = Column(String, default="active")
    meta_data = Column(JSON, default=dict)      # ✅ FIXED: JSON, not MetaData
    joined_at = Column(DateTime, default=datetime.utcnow)
    last_login_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
