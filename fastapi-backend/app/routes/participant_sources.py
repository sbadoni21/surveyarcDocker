# app/routes/participant_sources.py
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional, List
import uuid

from ..db import get_db
from ..models.participant_source import (
    ParticipantSource,
    CustomExitPage,
    UniqueIDErrorMessage
)
from ..schemas.participant_source import (
    ParticipantSourceCreate,
    ParticipantSourceUpdate,
    ParticipantSourceResponse,
    ParticipantSourceList,
    ParticipantSourceStats,
    CustomExitPageCreate,
    CustomExitPageResponse,
    UniqueIDErrorMessageCreate,
    UniqueIDErrorMessageResponse,
    GeneratedSurveyURL,
)

router = APIRouter(prefix="/participant-sources", tags=["Participant Sources"])


# ==================== PARTICIPANT SOURCES ====================

@router.post("/", response_model=ParticipantSourceResponse)
def create_participant_source(
    payload: ParticipantSourceCreate,
    db: Session = Depends(get_db),
):
    """
    Create a new participant source configuration.
    """
    new_id = str(uuid.uuid4())
    
    db_source = ParticipantSource(
        id=new_id,
        **payload.dict(),
    )
    db.add(db_source)
    db.commit()
    db.refresh(db_source)
    return db_source


@router.get("/{source_id}", response_model=ParticipantSourceResponse)
def get_participant_source(
    source_id: str,
    db: Session = Depends(get_db),
):
    """
    Get a specific participant source by ID.
    """
    db_source = db.query(ParticipantSource).filter(
        ParticipantSource.id == source_id
    ).first()
    
    if not db_source:
        raise HTTPException(status_code=404, detail="Participant source not found")
    
    return db_source


@router.get("/", response_model=ParticipantSourceList)
def list_participant_sources(
    db: Session = Depends(get_db),
    survey_id: Optional[str] = Query(None),
    org_id: Optional[str] = Query(None),
    source_type: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    """
    List participant sources with filters.
    """
    q = db.query(ParticipantSource)
    
    if survey_id:
        q = q.filter(ParticipantSource.survey_id == survey_id)
    if org_id:
        q = q.filter(ParticipantSource.org_id == org_id)
    if source_type:
        q = q.filter(ParticipantSource.source_type == source_type)
    if is_active is not None:
        q = q.filter(ParticipantSource.is_active == is_active)
    
    total = q.count()
    items = (
        q.order_by(ParticipantSource.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    
    return ParticipantSourceList(items=items, total=total)


@router.put("/{source_id}", response_model=ParticipantSourceResponse)
def update_participant_source(
    source_id: str,
    payload: ParticipantSourceUpdate,
    db: Session = Depends(get_db),
):
    """
    Update participant source configuration.
    """
    db_source = db.query(ParticipantSource).filter(
        ParticipantSource.id == source_id
    ).first()
    
    if not db_source:
        raise HTTPException(status_code=404, detail="Participant source not found")
    
    data = payload.dict(exclude_unset=True)
    for key, value in data.items():
        setattr(db_source, key, value)
    
    db.commit()
    db.refresh(db_source)
    return db_source


@router.delete("/{source_id}", response_model=dict)
def delete_participant_source(
    source_id: str,
    db: Session = Depends(get_db),
):
    """
    Delete a participant source.
    """
    db_source = db.query(ParticipantSource).filter(
        ParticipantSource.id == source_id
    ).first()
    
    if not db_source:
        raise HTTPException(status_code=404, detail="Participant source not found")
    
    db.delete(db_source)
    db.commit()
    return {"detail": "Participant source deleted"}


# ==================== CUSTOM EXIT PAGES ====================

@router.post("/{source_id}/exit-pages", response_model=CustomExitPageResponse)
def create_custom_exit_page(
    source_id: str,
    payload: CustomExitPageCreate,
    db: Session = Depends(get_db),
):
    """
    Add a custom exit page to a participant source.
    """
    # Verify source exists
    db_source = db.query(ParticipantSource).filter(
        ParticipantSource.id == source_id
    ).first()
    
    if not db_source:
        raise HTTPException(status_code=404, detail="Participant source not found")
    
    new_id = str(uuid.uuid4())
    db_exit = CustomExitPage(
        id=new_id,
        source_id=source_id,
        **payload.dict(),
    )
    
    db.add(db_exit)
    db.commit()
    db.refresh(db_exit)
    return db_exit


@router.get("/{source_id}/exit-pages", response_model=List[CustomExitPageResponse])
def list_custom_exit_pages(
    source_id: str,
    db: Session = Depends(get_db),
):
    """
    List all custom exit pages for a source.
    """
    exits = db.query(CustomExitPage).filter(
        CustomExitPage.source_id == source_id
    ).order_by(CustomExitPage.priority.asc()).all()
    
    return exits


@router.put("/exit-pages/{exit_id}", response_model=CustomExitPageResponse)
def update_custom_exit_page(
    exit_id: str,
    payload: CustomExitPageCreate,
    db: Session = Depends(get_db),
):
    """
    Update a custom exit page.
    """
    db_exit = db.query(CustomExitPage).filter(
        CustomExitPage.id == exit_id
    ).first()
    
    if not db_exit:
        raise HTTPException(status_code=404, detail="Exit page not found")
    
    data = payload.dict(exclude_unset=True)
    for key, value in data.items():
        setattr(db_exit, key, value)
    
    db.commit()
    db.refresh(db_exit)
    return db_exit


@router.delete("/exit-pages/{exit_id}", response_model=dict)
def delete_custom_exit_page(
    exit_id: str,
    db: Session = Depends(get_db),
):
    """
    Delete a custom exit page.
    """
    db_exit = db.query(CustomExitPage).filter(
        CustomExitPage.id == exit_id
    ).first()
    
    if not db_exit:
        raise HTTPException(status_code=404, detail="Exit page not found")
    
    db.delete(db_exit)
    db.commit()
    return {"detail": "Exit page deleted"}


# ==================== UNIQUE ID ERROR MESSAGES ====================

@router.post("/{source_id}/error-messages", response_model=UniqueIDErrorMessageResponse)
def create_error_message(
    source_id: str,
    payload: UniqueIDErrorMessageCreate,
    db: Session = Depends(get_db),
):
    """
    Add custom error message for unique ID validation.
    """
    db_source = db.query(ParticipantSource).filter(
        ParticipantSource.id == source_id
    ).first()
    
    if not db_source:
        raise HTTPException(status_code=404, detail="Participant source not found")
    
    new_id = str(uuid.uuid4())
    db_error = UniqueIDErrorMessage(
        id=new_id,
        source_id=source_id,
        **payload.dict(),
    )
    
    db.add(db_error)
    db.commit()
    db.refresh(db_error)
    return db_error


@router.get("/{source_id}/error-messages", response_model=List[UniqueIDErrorMessageResponse])
def list_error_messages(
    source_id: str,
    db: Session = Depends(get_db),
):
    """
    List error messages for a source.
    """
    messages = db.query(UniqueIDErrorMessage).filter(
        UniqueIDErrorMessage.source_id == source_id
    ).all()
    
    return messages


# ==================== STATISTICS & URL GENERATION ====================

@router.get("/{source_id}/stats", response_model=ParticipantSourceStats)
def get_source_statistics(
    source_id: str,
    db: Session = Depends(get_db),
):
    """
    Get statistics for a participant source.
    """
    db_source = db.query(ParticipantSource).filter(
        ParticipantSource.id == source_id
    ).first()
    
    if not db_source:
        raise HTTPException(status_code=404, detail="Participant source not found")
    
    completion_rate = None
    if db_source.total_starts > 0:
        completion_rate = (db_source.current_completes / db_source.total_starts) * 100
    
    incidence_rate = None
    if db_source.total_clicks > 0:
        incidence_rate = (db_source.total_starts / db_source.total_clicks) * 100
    
    return ParticipantSourceStats(
        source_id=db_source.id,
        source_name=db_source.source_name,
        total_clicks=db_source.total_clicks,
        total_starts=db_source.total_starts,
        current_completes=db_source.current_completes,
        expected_completes=db_source.expected_completes,
        completion_rate=completion_rate,
        incidence_rate=incidence_rate,
    )


@router.get("/{source_id}/generate-url", response_model=GeneratedSurveyURL)
def generate_survey_url(
    source_id: str,
    base_url: str = Query(..., description="Base survey URL"),
    db: Session = Depends(get_db),
):
    """
    Generate survey URL with all required parameters for a source.
    """
    db_source = db.query(ParticipantSource).filter(
        ParticipantSource.id == source_id
    ).first()
    
    if not db_source:
        raise HTTPException(status_code=404, detail="Participant source not found")
    
    required_params = []
    optional_params = []
    
    for var in db_source.url_variables:
        var_name = var.get("var_name")
        if var.get("required") in ["required", "unique"]:
            required_params.append(var_name)
        else:
            optional_params.append(var_name)
    
    # Build example URL
    example_params = []
    for var in db_source.url_variables:
        var_name = var.get("var_name")
        example_params.append(f"{var_name}=${{{var_name}}}")
    
    separator = "&" if "?" in base_url else "?"
    example_url = base_url + separator + "&".join(example_params)
    
    return GeneratedSurveyURL(
        source_id=db_source.id,
        source_name=db_source.source_name,
        survey_url=base_url,
        required_params=required_params,
        optional_params=optional_params,
        example_url=example_url,
    )


# ==================== TRACKING ENDPOINTS ====================

@router.post("/{source_id}/track/click", response_model=dict)
def track_click(
    source_id: str,
    db: Session = Depends(get_db),
):
    """
    Increment click counter for a source.
    """
    db_source = db.query(ParticipantSource).filter(
        ParticipantSource.id == source_id
    ).first()
    
    if not db_source:
        raise HTTPException(status_code=404, detail="Participant source not found")
    
    db_source.total_clicks += 1
    db.commit()
    
    return {"detail": "Click tracked", "total_clicks": db_source.total_clicks}


@router.post("/{source_id}/track/start", response_model=dict)
def track_start(
    source_id: str,
    db: Session = Depends(get_db),
):
    """
    Increment start counter for a source.
    """
    db_source = db.query(ParticipantSource).filter(
        ParticipantSource.id == source_id
    ).first()
    
    if not db_source:
        raise HTTPException(status_code=404, detail="Participant source not found")
    
    db_source.total_starts += 1
    db.commit()
    
    return {"detail": "Start tracked", "total_starts": db_source.total_starts}


@router.post("/{source_id}/track/complete", response_model=dict)
def track_complete(
    source_id: str,
    db: Session = Depends(get_db),
):
    """
    Increment completion counter for a source.
    """
    db_source = db.query(ParticipantSource).filter(
        ParticipantSource.id == source_id
    ).first()
    
    if not db_source:
        raise HTTPException(status_code=404, detail="Participant source not found")
    
    db_source.current_completes += 1
    db.commit()
    
    return {"detail": "Complete tracked", "current_completes": db_source.current_completes}