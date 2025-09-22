from sqlalchemy import Column, String, DateTime, JSON
from sqlalchemy.dialects.postgresql import ARRAY
from datetime import datetime
from app.db import Base

class User(Base):
    __tablename__ = "users"

    uid = Column(String, primary_key=True, index=True)
    email = Column(String, unique=True, nullable=False)
    display_name = Column(String, nullable=False)
    role = Column(String, default="user")
    org_ids = Column(ARRAY(String), default=list)
    status = Column(String, default="active")
    meta_data = Column(JSON, default=dict)      # ✅ FIXED: JSON, not MetaData
    joined_at = Column(DateTime, default=datetime.utcnow)
    last_login_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
