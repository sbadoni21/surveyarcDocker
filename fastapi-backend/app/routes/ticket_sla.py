# app/routers/ticket_sla.py
from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime, timezone
import uuid

from ..db import get_db
from ..models.sla import SLADimension
from ..models.tickets import Ticket, TicketSLAStatus, TicketSLAPauseHistory, SLAPauseReason
from ..schemas.tickets import (
    SLAPauseRequest, 
    SLAResumeRequest, 
    TicketSLAStatusOut,
    SLAPauseHistoryOut
)
from ..services import sla_service

router = APIRouter(prefix="/tickets", tags=["Tickets.SLA"])


def get_current_user_id(x_user_id: Optional[str] = Header(None)) -> str:
    """Extract user ID from header or raise error"""
    if not x_user_id:
        raise HTTPException(401, "X-User-Id header required")
    return x_user_id


@router.post("/{ticket_id}/sla/pause", response_model=TicketSLAStatusOut)
def pause_ticket_sla(
    ticket_id: str, 
    payload: SLAPauseRequest, 
    db: Session = Depends(get_db),
    actor_id: str = Depends(get_current_user_id)
):
    """
    Pause an SLA timer for a specific dimension (first_response or resolution)
    """
    # Get ticket
    ticket = db.get(Ticket, ticket_id)
    if not ticket:
        raise HTTPException(404, "Ticket not found")
    
    if not ticket.sla_id or not ticket.sla_status:
        raise HTTPException(400, "No SLA attached to this ticket")
    
    sla_status = ticket.sla_status
    now = datetime.now(timezone.utc)
    
    # Validate dimension
    if payload.dimension not in ["first_response", "resolution"]:
        raise HTTPException(400, f"Invalid dimension: {payload.dimension}")
    
    # Check if already paused
    if payload.dimension == "first_response":
        if sla_status.first_response_paused:
            raise HTTPException(400, "First response timer is already paused")
        
        # Calculate elapsed time since last resume
        if sla_status.last_resume_first_response:
            elapsed = (now - sla_status.last_resume_first_response).total_seconds() / 60
            sla_status.elapsed_first_response_minutes += int(elapsed)
        
        # Set pause state
        sla_status.first_response_paused = True
        sla_status.first_response_paused_at = now
        
    elif payload.dimension == "resolution":
        if sla_status.resolution_paused:
            raise HTTPException(400, "Resolution timer is already paused")
        
        # Calculate elapsed time since last resume
        if sla_status.last_resume_resolution:
            elapsed = (now - sla_status.last_resume_resolution).total_seconds() / 60
            sla_status.elapsed_resolution_minutes += int(elapsed)
        
        # Set pause state
        sla_status.resolution_paused = True
        sla_status.resolution_paused_at = now
    
    # Update legacy fields for backward compatibility
    sla_status.paused = True
    sla_status.pause_reason = payload.reason.value if isinstance(payload.reason, SLAPauseReason) else payload.reason
    
    # Create pause history record
    pause_record = TicketSLAPauseHistory(
        pause_id=str(uuid.uuid4()),
        ticket_id=ticket_id,
        dimension=payload.dimension,
        action="pause",
        action_at=now,
        actor_id=actor_id,
        reason=payload.reason,
        reason_note=payload.reason_note,
        meta={}
    )
    db.add(pause_record)
    
    # Commit changes
    db.commit()
    db.refresh(sla_status)
    
    return sla_status


@router.post("/{ticket_id}/sla/resume", response_model=TicketSLAStatusOut)
def resume_ticket_sla(
    ticket_id: str, 
    payload: SLAResumeRequest, 
    db: Session = Depends(get_db),
    actor_id: str = Depends(get_current_user_id)
):
    """
    Resume an SLA timer for a specific dimension
    Automatically extends the due date by the pause duration
    """
    # Get ticket
    ticket = db.get(Ticket, ticket_id)
    if not ticket:
        raise HTTPException(404, "Ticket not found")
    
    if not ticket.sla_id or not ticket.sla_status:
        raise HTTPException(400, "No SLA attached to this ticket")
    
    sla_status = ticket.sla_status
    now = datetime.now(timezone.utc)
    
    # Validate dimension
    if payload.dimension not in ["first_response", "resolution"]:
        raise HTTPException(400, f"Invalid dimension: {payload.dimension}")
    
    pause_duration_minutes = 0
    due_date_extension_minutes = 0
    
    # Handle dimension-specific resume
    if payload.dimension == "first_response":
        if not sla_status.first_response_paused:
            raise HTTPException(400, "First response timer is not paused")
        
        # Calculate pause duration
        if sla_status.first_response_paused_at:
            pause_duration = (now - sla_status.first_response_paused_at).total_seconds() / 60
            pause_duration_minutes = int(pause_duration)
            sla_status.total_paused_first_response_minutes += pause_duration_minutes
            
            # Extend due date
            if sla_status.first_response_due_at:
                from datetime import timedelta
                sla_status.first_response_due_at += timedelta(minutes=pause_duration_minutes)
                due_date_extension_minutes = pause_duration_minutes
        
        # Clear pause state
        sla_status.first_response_paused = False
        sla_status.first_response_paused_at = None
        sla_status.last_resume_first_response = now
        
    elif payload.dimension == "resolution":
        if not sla_status.resolution_paused:
            raise HTTPException(400, "Resolution timer is not paused")
        
        # Calculate pause duration
        if sla_status.resolution_paused_at:
            pause_duration = (now - sla_status.resolution_paused_at).total_seconds() / 60
            pause_duration_minutes = int(pause_duration)
            sla_status.total_paused_resolution_minutes += pause_duration_minutes
            
            # Extend due date
            if sla_status.resolution_due_at:
                from datetime import timedelta
                sla_status.resolution_due_at += timedelta(minutes=pause_duration_minutes)
                due_date_extension_minutes = pause_duration_minutes
        
        # Clear pause state
        sla_status.resolution_paused = False
        sla_status.resolution_paused_at = None
        sla_status.last_resume_resolution = now
    
    # Update legacy fields
    sla_status.paused = False
    sla_status.pause_reason = None
    
    # Create resume history record
    resume_record = TicketSLAPauseHistory(
        pause_id=str(uuid.uuid4()),
        ticket_id=ticket_id,
        dimension=payload.dimension,
        action="resume",
        action_at=now,
        actor_id=actor_id,
        pause_duration_minutes=pause_duration_minutes,
        due_date_extension_minutes=due_date_extension_minutes,
        meta={}
    )
    db.add(resume_record)
    
    # Commit changes
    db.commit()
    db.refresh(sla_status)
    
    return sla_status


@router.get("/{ticket_id}/sla/timers", response_model=TicketSLAStatusOut)
def read_ticket_sla_timers(
    ticket_id: str, 
    db: Session = Depends(get_db)
):
    """
    Get current SLA timer status for a ticket
    """
    ticket = db.get(Ticket, ticket_id)
    if not ticket:
        raise HTTPException(404, "Ticket not found")
    
    if not ticket.sla_status:
        raise HTTPException(404, "No SLA status found for this ticket")
    
    return ticket.sla_status


@router.get("/{ticket_id}/sla/pause-history", response_model=List[SLAPauseHistoryOut])
def read_ticket_sla_pause_history(
    ticket_id: str,
    dimension: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Get pause/resume history for a ticket
    Optionally filter by dimension (first_response or resolution)
    """
    ticket = db.get(Ticket, ticket_id)
    if not ticket:
        raise HTTPException(404, "Ticket not found")
    
    query = db.query(TicketSLAPauseHistory).filter(
        TicketSLAPauseHistory.ticket_id == ticket_id
    )
    
    if dimension:
        if dimension not in ["first_response", "resolution"]:
            raise HTTPException(400, f"Invalid dimension: {dimension}")
        query = query.filter(TicketSLAPauseHistory.dimension == dimension)
    
    history = query.order_by(TicketSLAPauseHistory.created_at.desc()).all()
    return history


@router.get("/{ticket_id}/sla/status", response_model=dict)
def get_ticket_sla_status(
    ticket_id: str,
    db: Session = Depends(get_db)
):
    """
    Get comprehensive SLA status including calculated fields
    """
    ticket = db.get(Ticket, ticket_id)
    if not ticket:
        raise HTTPException(404, "Ticket not found")
    
    if not ticket.sla_status:
        return {
            "has_sla": False,
            "ticket_id": ticket_id,
            "message": "No SLA attached to this ticket"
        }
    
    sla_status = ticket.sla_status
    now = datetime.now(timezone.utc)
    
    # Calculate current elapsed time (if not paused)
    current_first_response_elapsed = sla_status.elapsed_first_response_minutes
    current_resolution_elapsed = sla_status.elapsed_resolution_minutes
    
    if not sla_status.first_response_paused and sla_status.last_resume_first_response:
        additional = (now - sla_status.last_resume_first_response).total_seconds() / 60
        current_first_response_elapsed += int(additional)
    
    if not sla_status.resolution_paused and sla_status.last_resume_resolution:
        additional = (now - sla_status.last_resume_resolution).total_seconds() / 60
        current_resolution_elapsed += int(additional)
    
    return {
        "has_sla": True,
        "ticket_id": ticket_id,
        "sla_id": sla_status.sla_id,
        "first_response": {
            "due_at": sla_status.first_response_due_at,
            "started_at": sla_status.first_response_started_at,
            "completed_at": sla_status.first_response_completed_at,
            "paused": sla_status.first_response_paused,
            "paused_at": sla_status.first_response_paused_at,
            "elapsed_minutes": current_first_response_elapsed,
            "total_paused_minutes": sla_status.total_paused_first_response_minutes,
            "breached": sla_status.breached_first_response
        },
        "resolution": {
            "due_at": sla_status.resolution_due_at,
            "started_at": sla_status.resolution_started_at,
            "completed_at": sla_status.resolution_completed_at,
            "paused": sla_status.resolution_paused,
            "paused_at": sla_status.resolution_paused_at,
            "elapsed_minutes": current_resolution_elapsed,
            "total_paused_minutes": sla_status.total_paused_resolution_minutes,
            "breached": sla_status.breached_resolution
        }
    }