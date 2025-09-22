from sqlalchemy import Column, String, Integer, DateTime
from sqlalchemy.sql import func
from ..db import Base

class Archive(Base):
    __tablename__ = "archives"

    archive_id = Column(String, primary_key=True, index=True)
    org_id = Column(String, nullable=False)
    type = Column(String, nullable=False)
    url = Column(String, nullable=False)
    format = Column(String, nullable=False)
    record_count = Column(Integer, default=0)
    size_bytes = Column(Integer, default=0)
    generated_at = Column(DateTime(timezone=True), server_default=func.now())
