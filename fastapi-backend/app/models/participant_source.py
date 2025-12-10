# app/models/participant_source.py
from sqlalchemy import Column, String, DateTime, Boolean, Integer, Enum as SQLEnum
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func
from sqlalchemy.ext.mutable import MutableDict, MutableList
from ..db import Base
import enum


class SourceType(str, enum.Enum):
    """Type of participant source"""
    INTERNAL = "internal"  # Like Cint, Azure, Dynata
    EXTERNAL = "external"  # Custom external panels
    FILE = "file"  # CSV/Excel uploads


class VariableRequirement(str, enum.Enum):
    """URL variable requirements"""
    REQUIRED = "required"
    UNIQUE = "unique"
    OPTIONAL = "optional"


class AuthenticationType(str, enum.Enum):
    """Authentication type for variables"""
    NO_AUTH = "no_authentication"
    BASIC = "basic"
    TOKEN = "token"
    CUSTOM = "custom"


class ParticipantSource(Base):
    """
    Manages external participant sources/panels with URL variables,
    exit pages, and quota management.
    """
    __tablename__ = "participant_sources"

    id = Column(String, primary_key=True)  # UUID
    org_id = Column(String, nullable=False, index=True)
    survey_id = Column(String, nullable=False, index=True)
    
    # Basic Info
    source_name = Column(String, nullable=False)
    source_type = Column(
            SQLEnum(
                SourceType,
                name="source_type",  # matches existing enum type name in PG
                values_callable=lambda x: [e.value for e in x],  # <- use values, not names
            ),
            nullable=False,
            default=SourceType.EXTERNAL,
        ) 
    description = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    
    # URL Variables Configuration
    url_variables = Column(
        MutableList.as_mutable(JSONB),
        default=list
    )
    # Structure: [
    #   {
    #     "var_name": "trans_id",
    #     "required": "unique",
    #     "authentication": "no_authentication",
    #     "description": "Transaction ID"
    #   }
    # ]
    
    # Exit Pages Configuration
    exit_pages = Column(
        MutableDict.as_mutable(JSONB),
        default=dict
    )
    # Structure: {
    #   "terminated": {
    #     "type": "redirect",
    #     "url": "https://...",
    #     "conditions": []  # Optional: conditional logic
    #   },
    #   "quota_full": {...},
    #   "qualified": {...},
    #   "custom_exits": [...]
    # }
    
    # Quota Management
    expected_completes = Column(Integer, nullable=True)
    current_completes = Column(Integer, default=0)
    expected_incidence_rate = Column(Integer, nullable=True)  # Percentage
    
    # Tracking
    total_clicks = Column(Integer, default=0)
    total_starts = Column(Integer, default=0)
    
    # Metadata
    meta_data = Column(MutableDict.as_mutable(JSONB), default=dict)
    
    # Timestamps
    created_by = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class CustomExitPage(Base):
    """
    Custom exit pages with conditional logic
    """
    __tablename__ = "custom_exit_pages"
    
    id = Column(String, primary_key=True)
    source_id = Column(String, nullable=False, index=True)
    
    # Exit Configuration
    exit_name = Column(String, nullable=False)
    exit_type = Column(String, nullable=False)  # "redirect", "message", "api_call"
    
    # Conditions (when to show this exit)
    show_if = Column(
        MutableDict.as_mutable(JSONB),
        default=dict
    )
    # Structure: {
    #   "condition": "terminated",
    #   "and_has_marker": "qualityscore",
    #   "operator": "AND"
    # }
    
    # Redirect Configuration
    redirect_url = Column(String, nullable=True)
    redirect_method = Column(String, default="GET")  # GET or POST
    
    # Message Configuration (if showing message instead)
    message_title = Column(String, nullable=True)
    message_body = Column(String, nullable=True)
    
    # URL Parameters to pass
    url_params = Column(
        MutableDict.as_mutable(JSONB),
        default=dict
    )
    
    # Order/Priority
    priority = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class UniqueIDErrorMessage(Base):
    """
    Custom error messages for unique ID validation
    """
    __tablename__ = "unique_id_error_messages"
    
    id = Column(String, primary_key=True)
    source_id = Column(String, nullable=False, index=True)
    
    # Error Type
    error_type = Column(String, nullable=False)  # "duplicate", "invalid", "missing"
    
    # Message Configuration
    title = Column(String, nullable=False)
    message = Column(String, nullable=False)
    button_text = Column(String, default="Close")
    
    # Action
    action_type = Column(String, default="close")  # "close", "redirect", "retry"
    redirect_url = Column(String, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())