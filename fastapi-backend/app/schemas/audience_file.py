from pydantic import BaseModel
from typing import Optional, Dict, Any, List
from datetime import datetime


class AudienceFileBase(BaseModel):
    org_id: str
    storage_key: str
    filename: str

    storage_provider: str = "firebase"
    download_url: Optional[str] = None
    content_type: Optional[str] = None
    size_bytes: Optional[int] = None

    audience_name: Optional[str] = None
    audience_tag: Optional[str] = None

    row_count: Optional[int] = None
    header_row: List[str] = []
    column_mapping: Dict[str, str] = {}   # logical -> real column header

    meta_data: Dict[str, Any] = {}
    uploaded_by: Optional[str] = None


class AudienceFileCreate(AudienceFileBase):
    """Sent from frontend after uploading file to Firebase."""
    pass


class AudienceFileUpdate(BaseModel):
    audience_name: Optional[str] = None
    audience_tag: Optional[str] = None
    row_count: Optional[int] = None
    header_row: Optional[List[str]] = None
    column_mapping: Optional[Dict[str, str]] = None
    meta_data: Optional[Dict[str, Any]] = None


class AudienceFileResponse(AudienceFileBase):
    id: str
    uploaded_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class AudienceFileList(BaseModel):
    items: List[AudienceFileResponse]
    total: int
