# app/schemas/business_calendar.py
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime

# Business Calendar Hour schemas
class BusinessCalendarHourIn(BaseModel):
    weekday: int = Field(..., ge=0, le=6, description="0=Monday, 6=Sunday")
    start_min: int = Field(..., ge=0, le=1439, description="Minutes from 00:00")
    end_min: int = Field(..., ge=0, le=1439, description="Minutes from 00:00")

class BusinessCalendarHourOut(BusinessCalendarHourIn):
    id: int

# Business Calendar Holiday schemas
class BusinessCalendarHolidayIn(BaseModel):
    date_iso: str = Field(..., description="Date in YYYY-MM-DD format")
    name: Optional[str] = Field(None, description="Holiday name")

class BusinessCalendarHolidayOut(BusinessCalendarHolidayIn):
    id: int

# Request schemas for bulk operations
class SetHoursRequest(BaseModel):
    hours: List[BusinessCalendarHourIn] = Field(..., description="List of business hours")

class SetHolidaysRequest(BaseModel):
    holidays: List[BusinessCalendarHolidayIn] = Field(..., description="List of business holidays")

# Main Business Calendar schemas
class BusinessCalendarBase(BaseModel):
    name: str = Field(..., description="Calendar name")
    timezone: Optional[str] = Field("UTC", description="Timezone for the calendar")
    active: Optional[bool] = Field(True, description="Whether the calendar is active")
    meta: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Additional metadata")

class BusinessCalendarCreate(BusinessCalendarBase):
    calendar_id: Optional[str] = Field(None, description="Calendar ID (auto-generated if not provided)")
    org_id: str = Field(..., description="Organization ID")

class BusinessCalendarUpdate(BaseModel):
    name: Optional[str] = Field(None, description="Calendar name")
    timezone: Optional[str] = Field(None, description="Timezone for the calendar")
    active: Optional[bool] = Field(None, description="Whether the calendar is active")
    meta: Optional[Dict[str, Any]] = Field(None, description="Additional metadata")

class BusinessCalendarOut(BusinessCalendarBase):
    calendar_id: str
    org_id: str
    created_at: datetime
    updated_at: datetime
    hours: List[BusinessCalendarHourOut] = Field(default_factory=list)
    holidays: List[BusinessCalendarHolidayOut] = Field(default_factory=list)

    class Config:
        from_attributes = True