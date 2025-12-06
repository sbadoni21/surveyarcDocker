from sqlalchemy import Column, String, DateTime, Integer
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func
from sqlalchemy.ext.mutable import MutableDict
from ..db import Base


class AudienceFile(Base):
    """
    B2C audience file (CSV/Excel) stored in Firebase/S3.

    ❌ No FK to contacts / contact_lists.
    ✅ Just a pointer to the uploaded file + some metadata.
    """
    __tablename__ = "audience_files"

    id = Column(String, primary_key=True)  # UUID

    # Ownership
    org_id = Column(String, nullable=False, index=True)

    # Human labels
    audience_name = Column(String, nullable=True)      # e.g. "Diwali_Blast_2025"
    audience_tag = Column(String, nullable=True)       # e.g. "b2c", "promo"

    # Storage info (Firebase now, S3 later)
    storage_key = Column(String, nullable=False)       # "b2c/org123/audiences/abc.csv"
    storage_provider = Column(String, nullable=False, default="firebase")
    download_url = Column(String, nullable=True)

    # File info
    filename = Column(String, nullable=False)
    content_type = Column(String, nullable=True)
    size_bytes = Column(Integer, nullable=True)

    # Parsed information (optional)
    row_count = Column(Integer, nullable=True)         # total rows (excluding header)
    header_row = Column(JSONB, default=list)           # ["email", "name", "city"]
    column_mapping = Column(                          # logical_name -> column header
        MutableDict.as_mutable(JSONB),
        default=dict
    )
    # Free-form metadata
    meta_data = Column(MutableDict.as_mutable(JSONB), default=dict)

    # Who uploaded
    uploaded_by = Column(String, nullable=True)
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
