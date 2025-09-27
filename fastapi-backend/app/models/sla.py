from __future__ import annotations
from sqlalchemy import String, Boolean, DateTime, Text, Integer, ForeignKey, Enum, Index
from sqlalchemy.orm import relationship, Mapped, mapped_column
from sqlalchemy.sql import func
from sqlalchemy.dialects.postgresql import JSONB
import enum

from ..db import Base

class SLADimension(str, enum.Enum):
    first_response = "first_response"
    resolution = "resolution"
    
class SLADimension(str, enum.Enum):
    first_response = "first_response"
    resolution = "resolution"
    custom = "custom"

class BusinessCalendar(Base):
    __tablename__ = "biz_calendars"
    calendar_id: Mapped[str] = mapped_column(String, primary_key=True, index=True)
    org_id:      Mapped[str] = mapped_column(String, index=True, nullable=False)
    name:        Mapped[str] = mapped_column(String, nullable=False)
    timezone:    Mapped[str] = mapped_column(String, nullable=False, default="UTC")
    active:      Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    meta:        Mapped[dict] = mapped_column(JSONB, default=dict)
    created_at:  Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at:  Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    hours = relationship("BusinessCalendarHour", cascade="all, delete-orphan", back_populates="calendar")
    holidays = relationship("BusinessCalendarHoliday", cascade="all, delete-orphan", back_populates="calendar")

class BusinessCalendarHour(Base):
    __tablename__ = "biz_calendar_hours"
    id:          Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    calendar_id: Mapped[str] = mapped_column(String, ForeignKey("biz_calendars.calendar_id", ondelete="CASCADE"), index=True)
    # 0=Mon … 6=Sun
    weekday:     Mapped[int] = mapped_column(Integer, nullable=False)
    start_min:   Mapped[int] = mapped_column(Integer, nullable=False)  # minutes from 00:00
    end_min:     Mapped[int] = mapped_column(Integer, nullable=False)

    calendar = relationship("BusinessCalendar", back_populates="hours")

class BusinessCalendarHoliday(Base):
    __tablename__ = "biz_calendar_holidays"
    id:          Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    calendar_id: Mapped[str] = mapped_column(String, ForeignKey("biz_calendars.calendar_id", ondelete="CASCADE"), index=True)
    date_iso:    Mapped[str] = mapped_column(String, nullable=False)  # 'YYYY-MM-DD'
    name:        Mapped[str] = mapped_column(String, nullable=True)

    calendar = relationship("BusinessCalendar", back_populates="holidays")

class SLAPauseWindow(Base):
    __tablename__ = "sla_pause_windows"
    id:          Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    ticket_id:   Mapped[str] = mapped_column(String, ForeignKey("tickets.ticket_id", ondelete="CASCADE"), index=True, nullable=False)
    dimension:   Mapped[SLADimension] = mapped_column(Enum(SLADimension), nullable=False)
    reason:      Mapped[str] = mapped_column(String, nullable=False)
    started_at:  Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    ended_at:    Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    meta:        Mapped[dict] = mapped_column(JSONB, default=dict)

    __table_args__ = (Index("ix_sla_pause_active", "ticket_id", "dimension", "ended_at"),)
