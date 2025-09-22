from pydantic import BaseModel
from typing import Dict, Optional
from datetime import datetime

class MetricBase(BaseModel):
    org_id: str
    name: str
    interval: str
    timestamp: Optional[datetime] = None
    values: Optional[Dict] = {}

class MetricCreate(MetricBase):
    metric_id: str

class MetricResponse(MetricBase):
    metric_id: str

    class Config:
        from_attributes = True
