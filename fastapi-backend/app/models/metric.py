from sqlalchemy import Column, String, DateTime, JSON
from sqlalchemy.sql import func
from ..db import Base


class Metric(Base):
    __tablename__ = "metrics"

    metric_id = Column(String, primary_key=True, index=True)
    org_id = Column(String, nullable=False)
    name = Column(String, nullable=False)
    interval = Column(String, nullable=False)  # e.g., "hourly" | "daily"
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    values = Column(JSON, default={})
