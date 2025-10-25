# app/routers/business_calendars.py
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, selectinload
from sqlalchemy import select, delete
from typing import List, Optional
import uuid

from ..db import get_db
from ..models.business_calendar import BusinessCalendar, BusinessCalendarHour, BusinessCalendarHoliday
from ..schemas.business_calendar import (
    BusinessCalendarCreate, BusinessCalendarUpdate, BusinessCalendarOut,
    SetHoursRequest, SetHolidaysRequest
)
from ..services.redis_calendar_service import RedisCalendarService as RCal

router = APIRouter(prefix="/business-calendars", tags=["Business Calendars"])

# ---------- list ----------
@router.get("/", response_model=List[BusinessCalendarOut])
def list_business_calendars(
    org_id: str = Query(...),
    active: Optional[bool] = Query(None),
    db: Session = Depends(get_db)
):
    # try cache (list + full objects)
    cached = RCal.get_list_by_org(org_id, active)
    if cached is not None:
        # Return as Pydantic objects
        return [BusinessCalendarOut(**row) for row in cached]

    stmt = select(BusinessCalendar).where(BusinessCalendar.org_id == org_id)
    if active is not None:
        stmt = stmt.where(BusinessCalendar.active == active)
    stmt = stmt.options(selectinload(BusinessCalendar.hours), selectinload(BusinessCalendar.holidays))
    rows = db.execute(stmt).scalars().all()

    out = [BusinessCalendarOut.model_validate(r, from_attributes=True).model_dump() for r in rows]
    RCal.cache_list_by_org(org_id, active, out)
    # also seed per-item full cache for fast get
    for r in out:
        RCal.cache_calendar_full(r["calendar_id"], r)
        # light item cache (without children) if you want:
        RCal.cache_calendar(r["calendar_id"], {k: v for k, v in r.items() if k not in ("hours", "holidays")})
    return [BusinessCalendarOut(**r) for r in out]

# ---------- get one (full) ----------
@router.get("/{calendar_id}", response_model=BusinessCalendarOut)
def get_business_calendar(calendar_id: str, db: Session = Depends(get_db)):
    cached = RCal.get_calendar_full(calendar_id)
    if cached is not None:
        return BusinessCalendarOut(**cached)

    stmt = (select(BusinessCalendar)
            .where(BusinessCalendar.calendar_id == calendar_id)
            .options(selectinload(BusinessCalendar.hours), selectinload(BusinessCalendar.holidays)))
    row = db.execute(stmt).scalar_one_or_none()
    if not row:
        raise HTTPException(404, "Business calendar not found")

    out = BusinessCalendarOut.model_validate(row, from_attributes=True).model_dump()
    RCal.cache_calendar_full(calendar_id, out)
    # also seed short cache
    RCal.cache_calendar(calendar_id, {k: v for k, v in out.items() if k not in ("hours", "holidays")})
    return BusinessCalendarOut(**out)

# ---------- create ----------
@router.post("/", response_model=BusinessCalendarOut, status_code=201)
def create_business_calendar(payload: BusinessCalendarCreate, db: Session = Depends(get_db)):
    calendar_id = payload.calendar_id or f"cal_{uuid.uuid4().hex[:10]}"
    row = BusinessCalendar(
        calendar_id=calendar_id,
        org_id=payload.org_id,
        name=payload.name,
        timezone=payload.timezone or "UTC",
        active=True if payload.active is None else payload.active,
        meta=payload.meta or {},
    )
    db.add(row); db.commit(); db.refresh(row)

    out = BusinessCalendarOut.model_validate(row, from_attributes=True).model_dump()
    # prime caches
    RCal.invalidate_calendar(calendar_id, row.org_id)  # ensure org list is fresh
    RCal.cache_calendar(calendar_id, {k: v for k, v in out.items() if k not in ("hours", "holidays")})
    RCal.cache_calendar_full(calendar_id, out)
    return BusinessCalendarOut(**out)

# ---------- update ----------
@router.patch("/{calendar_id}", response_model=BusinessCalendarOut)
def update_business_calendar(calendar_id: str, payload: BusinessCalendarUpdate, db: Session = Depends(get_db)):
    row = db.get(BusinessCalendar, calendar_id)
    if not row:
        raise HTTPException(404, "Business calendar not found")

    data = payload.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(row, k, v)

    db.commit(); db.refresh(row)

    out = BusinessCalendarOut.model_validate(row, from_attributes=True).model_dump()
    # invalidate all related keys (including org lists) and re-seed
    RCal.invalidate_calendar(calendar_id, row.org_id)
    RCal.cache_calendar(calendar_id, {k: v for k, v in out.items() if k not in ("hours", "holidays")})
    RCal.cache_calendar_full(calendar_id, out)
    return BusinessCalendarOut(**out)

# ---------- delete ----------
@router.delete("/{calendar_id}", status_code=204)
def delete_business_calendar(calendar_id: str, db: Session = Depends(get_db)):
    row = db.get(BusinessCalendar, calendar_id)
    if not row:
        raise HTTPException(404, "Business calendar not found")
    org_id = row.org_id
    db.delete(row); db.commit()
    RCal.invalidate_calendar(calendar_id, org_id)
    return None

# ---------- hours ----------
@router.get("/{calendar_id}/hours", response_model=List[dict])
def get_business_hours(calendar_id: str, db: Session = Depends(get_db)):
    # prefer child cache
    cached = RCal.get_hours(calendar_id)
    if cached is not None:
        return cached

    cal = db.get(BusinessCalendar, calendar_id)
    if not cal:
        raise HTTPException(404, "Business calendar not found")

    stmt = select(BusinessCalendarHour).where(BusinessCalendarHour.calendar_id == calendar_id)
    hours = db.execute(stmt).scalars().all()
    out = [{"id": h.id, "weekday": h.weekday, "start_min": h.start_min, "end_min": h.end_min} for h in hours]
    RCal.cache_hours(calendar_id, out)
    return out

@router.put("/{calendar_id}/hours", response_model=dict)
def set_business_hours(calendar_id: str, payload: SetHoursRequest, db: Session = Depends(get_db)):
    cal = db.get(BusinessCalendar, calendar_id)
    if not cal:
        raise HTTPException(404, "Business calendar not found")

    db.execute(delete(BusinessCalendarHour).where(BusinessCalendarHour.calendar_id == calendar_id))
    for hour in payload.hours:
        db.add(BusinessCalendarHour(
            calendar_id=calendar_id,
            weekday=hour.weekday,
            start_min=hour.start_min,
            end_min=hour.end_min,
        ))
    db.commit()

    # bust & reseed related caches
    RCal.invalidate_calendar(calendar_id, cal.org_id)
    # (optional) seed hours cache right away
    RCal.cache_hours(calendar_id, [
        {"id": h.id, "weekday": h.weekday, "start_min": h.start_min, "end_min": h.end_min}
        for h in db.query(BusinessCalendarHour).filter_by(calendar_id=calendar_id).all()
    ])
    return {"status": "success", "message": f"Updated {len(payload.hours)} business hours"}

# ---------- holidays ----------
@router.get("/{calendar_id}/holidays", response_model=List[dict])
def get_business_holidays(calendar_id: str, db: Session = Depends(get_db)):
    cached = RCal.get_holidays(calendar_id)
    if cached is not None:
        return cached

    cal = db.get(BusinessCalendar, calendar_id)
    if not cal:
        raise HTTPException(404, "Business calendar not found")

    stmt = select(BusinessCalendarHoliday).where(BusinessCalendarHoliday.calendar_id == calendar_id)
    holidays = db.execute(stmt).scalars().all()
    out = [{"id": h.id, "date_iso": h.date_iso, "name": h.name} for h in holidays]
    RCal.cache_holidays(calendar_id, out)
    return out

@router.put("/{calendar_id}/holidays", response_model=dict)
def set_business_holidays(calendar_id: str, payload: SetHolidaysRequest, db: Session = Depends(get_db)):
    cal = db.get(BusinessCalendar, calendar_id)
    if not cal:
        raise HTTPException(404, "Business calendar not found")

    db.execute(delete(BusinessCalendarHoliday).where(BusinessCalendarHoliday.calendar_id == calendar_id))
    for h in payload.holidays:
        db.add(BusinessCalendarHoliday(calendar_id=calendar_id, date_iso=h.date_iso, name=h.name))
    db.commit()

    # bust & reseed related caches
    RCal.invalidate_calendar(calendar_id, cal.org_id)
    RCal.cache_holidays(calendar_id, [
        {"id": h.id, "date_iso": h.date_iso, "name": h.name}
        for h in db.query(BusinessCalendarHoliday).filter_by(calendar_id=calendar_id).all()
    ])
    return {"status": "success", "message": f"Updated {len(payload.holidays)} business holidays"}
