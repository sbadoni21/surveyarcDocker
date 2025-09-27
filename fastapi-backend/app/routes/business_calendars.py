# app/routers/business_calendars.py
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, selectinload
from sqlalchemy import select, delete
from typing import List, Optional
import uuid

from ..db import get_db
from ..models.business_calendar import BusinessCalendar, BusinessCalendarHour, BusinessCalendarHoliday
from ..schemas.business_calendar import (
    BusinessCalendarCreate, 
    BusinessCalendarUpdate, 
    BusinessCalendarOut,
    BusinessCalendarHourIn,
    BusinessCalendarHolidayIn,
    SetHoursRequest,
    SetHolidaysRequest
)

# This can be mounted under /slas/business-calendars or as a separate router
router = APIRouter(prefix="/business-calendars", tags=["Business Calendars"])

@router.get("/", response_model=List[BusinessCalendarOut])
def list_business_calendars(
    org_id: str = Query(...), 
    active: Optional[bool] = Query(None), 
    db: Session = Depends(get_db)
):
    stmt = select(BusinessCalendar).where(BusinessCalendar.org_id == org_id)
    if active is not None:
        stmt = stmt.where(BusinessCalendar.active == active)
    
    # Include hours and holidays in the response
    stmt = stmt.options(selectinload(BusinessCalendar.hours), selectinload(BusinessCalendar.holidays))
    rows = db.execute(stmt).scalars().all()
    return [BusinessCalendarOut.model_validate(r, from_attributes=True) for r in rows]

@router.get("/{calendar_id}", response_model=BusinessCalendarOut)
def get_business_calendar(calendar_id: str, db: Session = Depends(get_db)):
    stmt = select(BusinessCalendar).where(BusinessCalendar.calendar_id == calendar_id).options(
        selectinload(BusinessCalendar.hours), 
        selectinload(BusinessCalendar.holidays)
    )
    row = db.execute(stmt).scalar_one_or_none()
    if not row:
        raise HTTPException(404, "Business calendar not found")
    return BusinessCalendarOut.model_validate(row, from_attributes=True)

@router.post("/", response_model=BusinessCalendarOut, status_code=201)
def create_business_calendar(payload: BusinessCalendarCreate, db: Session = Depends(get_db)):
    calendar_id = payload.calendar_id or f"cal_{uuid.uuid4().hex[:10]}"
    
    row = BusinessCalendar(
        calendar_id=calendar_id,
        org_id=payload.org_id,
        name=payload.name,
        timezone=payload.timezone or "UTC",
        active=payload.active if payload.active is not None else True,
        meta=payload.meta or {},
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return BusinessCalendarOut.model_validate(row, from_attributes=True)

@router.patch("/{calendar_id}", response_model=BusinessCalendarOut)
def update_business_calendar(
    calendar_id: str, 
    payload: BusinessCalendarUpdate, 
    db: Session = Depends(get_db)
):
    row = db.get(BusinessCalendar, calendar_id)
    if not row:
        raise HTTPException(404, "Business calendar not found")
    
    data = payload.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(row, k, v)
    
    db.commit()
    db.refresh(row)
    return BusinessCalendarOut.model_validate(row, from_attributes=True)

@router.delete("/{calendar_id}", status_code=204)
def delete_business_calendar(calendar_id: str, db: Session = Depends(get_db)):
    row = db.get(BusinessCalendar, calendar_id)
    if not row:
        raise HTTPException(404, "Business calendar not found")
    
    db.delete(row)
    db.commit()
    return None

# Business Hours Management
@router.get("/{calendar_id}/hours", response_model=List[dict])
def get_business_hours(calendar_id: str, db: Session = Depends(get_db)):
    # Verify calendar exists
    calendar = db.get(BusinessCalendar, calendar_id)
    if not calendar:
        raise HTTPException(404, "Business calendar not found")
    
    stmt = select(BusinessCalendarHour).where(BusinessCalendarHour.calendar_id == calendar_id)
    hours = db.execute(stmt).scalars().all()
    
    return [
        {
            "id": h.id,
            "weekday": h.weekday,
            "start_min": h.start_min,
            "end_min": h.end_min,
        }
        for h in hours
    ]

@router.put("/{calendar_id}/hours", response_model=dict)
def set_business_hours(
    calendar_id: str, 
    payload: SetHoursRequest, 
    db: Session = Depends(get_db)
):
    # Verify calendar exists
    calendar = db.get(BusinessCalendar, calendar_id)
    if not calendar:
        raise HTTPException(404, "Business calendar not found")
    
    # Delete existing hours
    db.execute(delete(BusinessCalendarHour).where(BusinessCalendarHour.calendar_id == calendar_id))
    
    # Add new hours
    for hour_data in payload.hours:
        hour = BusinessCalendarHour(
            calendar_id=calendar_id,
            weekday=hour_data.weekday,
            start_min=hour_data.start_min,
            end_min=hour_data.end_min,
        )
        db.add(hour)
    
    db.commit()
    return {"status": "success", "message": f"Updated {len(payload.hours)} business hours"}

# Business Holidays Management
@router.get("/{calendar_id}/holidays", response_model=List[dict])
def get_business_holidays(calendar_id: str, db: Session = Depends(get_db)):
    # Verify calendar exists
    calendar = db.get(BusinessCalendar, calendar_id)
    if not calendar:
        raise HTTPException(404, "Business calendar not found")
    
    stmt = select(BusinessCalendarHoliday).where(BusinessCalendarHoliday.calendar_id == calendar_id)
    holidays = db.execute(stmt).scalars().all()
    
    return [
        {
            "id": h.id,
            "date_iso": h.date_iso,
            "name": h.name,
        }
        for h in holidays
    ]

@router.put("/{calendar_id}/holidays", response_model=dict)
def set_business_holidays(
    calendar_id: str, 
    payload: SetHolidaysRequest, 
    db: Session = Depends(get_db)
):
    # Verify calendar exists
    calendar = db.get(BusinessCalendar, calendar_id)
    if not calendar:
        raise HTTPException(404, "Business calendar not found")
    
    # Delete existing holidays
    db.execute(delete(BusinessCalendarHoliday).where(BusinessCalendarHoliday.calendar_id == calendar_id))
    
    # Add new holidays
    for holiday_data in payload.holidays:
        holiday = BusinessCalendarHoliday(
            calendar_id=calendar_id,
            date_iso=holiday_data.date_iso,
            name=holiday_data.name,
        )
        db.add(holiday)
    
    db.commit()
    return {"status": "success", "message": f"Updated {len(payload.holidays)} business holidays"}