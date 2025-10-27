# app/routes/survey.py
import uuid
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..db import get_db
from ..models.survey import Survey
from ..schemas.survey import SurveyCreate, SurveyUpdate, SurveyOut  # define SurveyOut similar to SurveyCreate but as response schema
from ..services.redis_survey_service import RedisSurveyService

router = APIRouter(prefix="/surveys", tags=["Surveys"])

@router.post("/", response_model=SurveyOut)
def create_survey(data: SurveyCreate, db: Session = Depends(get_db)):
    survey_id = data.survey_id or "survey_" + uuid.uuid4().hex[:9]
    survey = Survey(
        survey_id=survey_id,
        org_id=data.org_id,
        project_id=data.project_id,
        name=data.name,
        slug=survey_id,
        version=1,
        status=data.status or "draft",
        created_by=data.created_by,
        updated_by=data.updated_by or data.created_by,
        time=data.time,
        settings=data.settings or {"anonymous": False},
        question_order=data.question_order or [],
        meta_data=data.meta_data or {},
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(survey)
    db.commit()
    db.refresh(survey)

    # cache + list invalidation
    RedisSurveyService.cache_survey(survey)
    RedisSurveyService.cache_project_surveys(survey.project_id, [survey])

    return survey

@router.get("/{survey_id}", response_model=SurveyOut)
def get_survey(survey_id: str, db: Session = Depends(get_db)):
    cached = RedisSurveyService.get_survey(survey_id)
    if cached:
        return cached

    survey = db.query(Survey).filter(Survey.survey_id == survey_id).first()
    if not survey:
        raise HTTPException(status_code=404, detail="Survey not found")

    RedisSurveyService.cache_survey(survey)
    return survey

@router.get("", response_model=List[SurveyOut])
def list_surveys(project_id: Optional[str] = Query(None), db: Session = Depends(get_db)):
    if project_id:
        cached_list = RedisSurveyService.get_project_surveys(project_id)
        if cached_list:
            return cached_list
        surveys = db.query(Survey).filter(Survey.project_id == project_id).all()
        RedisSurveyService.set_project_surveys_exact(project_id, surveys)
        return surveys    
    # If no project_id passed, return empty or all (choose your policy)
    return []

@router.get("/project/{project_id}", response_model=List[SurveyOut])
def get_all_surveys(project_id: str, db: Session = Depends(get_db)):
    cached_list = RedisSurveyService.get_project_surveys(project_id)
    if cached_list:
        return cached_list
    surveys = db.query(Survey).filter(Survey.project_id == project_id).all()
    RedisSurveyService.set_project_surveys_exact(project_id, surveys)
    return surveys

# app/routes/survey.py

@router.patch("/{survey_id}", response_model=SurveyOut)
def update_survey(survey_id: str, data: SurveyUpdate, db: Session = Depends(get_db)):
    survey = db.query(Survey).filter(Survey.survey_id == survey_id).first()
    if not survey:
        raise HTTPException(status_code=404, detail="Survey not found")

    old_project_id = survey.project_id

    update_data = data.model_dump(exclude_unset=True)
    for k, v in update_data.items():
        setattr(survey, k, v)
    survey.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(survey)

    RedisSurveyService.cache_survey(survey)

    if survey.project_id:
        if survey.project_id != old_project_id and old_project_id:
            # remove from old + add to new (exact rebuilds for safety)
            old_list = db.query(Survey).filter(Survey.project_id == old_project_id).all()
            RedisSurveyService.set_project_surveys_exact(old_project_id, old_list)

            new_list = db.query(Survey).filter(Survey.project_id == survey.project_id).all()
            RedisSurveyService.set_project_surveys_exact(survey.project_id, new_list)
        else:
            # same project, merge is fine
            RedisSurveyService.cache_project_surveys(survey.project_id, [survey])

    return survey

@router.delete("/{survey_id}")
def delete_survey(survey_id: str, db: Session = Depends(get_db)):
    survey = db.query(Survey).filter(Survey.survey_id == survey_id).first()
    if not survey:
        raise HTTPException(status_code=404, detail="Survey not found")

    project_id = survey.project_id
    db.delete(survey)
    db.commit()

    RedisSurveyService.invalidate_survey(survey_id)
    if project_id:
        # Rebuild project list cache (simple strategy)
        surveys = db.query(Survey).filter(Survey.project_id == project_id).all()
        RedisSurveyService.set_project_surveys_exact(project_id, surveys)

    return {"detail": "Survey deleted"}

# ---- Optional: Responses endpoints (for your popup & counts) ----
@router.get("/{survey_id}/responses/count")
def get_responses_count(survey_id: str, db: Session = Depends(get_db)):
    # If you have a real responses table, query it. Here, we try cache only.
    cached = RedisSurveyService.get_responses_count(survey_id)
    if cached is not None:
        return {"count": cached}
    # Fallback (no table): 0
    RedisSurveyService.cache_responses_count(survey_id, 0)
    return {"count": 0}

@router.get("/{survey_id}/responses")
def list_responses(survey_id: str, db: Session = Depends(get_db)):
    cached = RedisSurveyService.get_responses(survey_id)
    if cached is not None:
        return cached
    # Fallback empty list if you haven't implemented responses storage yet
    RedisSurveyService.cache_responses(survey_id, [])
    return []
