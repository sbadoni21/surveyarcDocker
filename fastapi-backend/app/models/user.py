# app/models/user.py - CLEAN VERSION (No role field)

from sqlalchemy import Column, String, DateTime, JSON
from sqlalchemy.dialects.postgresql import ARRAY
from datetime import datetime
from app.db import Base

class User(Base):
    """
    User model - Core user identity
    
    ✅ NO ROLE FIELD - Roles managed entirely by RBAC system
    """
    __tablename__ = "users"

    uid = Column(String, primary_key=True, index=True)
    email = Column(String, unique=True, nullable=False, index=True)
    display_name = Column(String, nullable=False)
    
    # ✅ NO ROLE FIELD!
    
    org_ids = Column(ARRAY(String), default=list)
    status = Column(String, default="active", index=True)
    meta_data = Column(JSON, default=dict)
    
    # Timestamps
    joined_at = Column(DateTime, default=datetime.utcnow)
    last_login_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<User(uid='{self.uid}', email='{self.email}', status='{self.status}')>"