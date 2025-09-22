from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class ArchiveBase(BaseModel):
    org_id: str
    type: str
    url: str
    format: str
    record_count: Optional[int] = 0
    size_bytes: Optional[int] = 0

class ArchiveCreate(ArchiveBase):
    archive_id: str

class ArchiveResponse(ArchiveBase):
    archive_id: str
    generated_at: datetime

    class Config:
        from_attributes = True
