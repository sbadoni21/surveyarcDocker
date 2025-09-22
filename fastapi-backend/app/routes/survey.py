from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..db import get_db
from ..models.survey import Survey
from ..schemas.survey import SurveyCreate, SurveyUpdate
import uuid

router = APIRouter(prefix="/surveys", tags=["Surveys"])

@router.post("/", response_model=SurveyCreate)
def create_survey(data: SurveyCreate, db: Session = Depends(get_db)):
    survey_id = data.survey_id or "survey_" + uuid.uuid4().hex[:9]
    survey = Survey(
        survey_id=survey_id,
        org_id=data.org_id,
        project_id=data.project_id,
        name=data.name,
        slug=survey_id,
        version=1,
        status="draft",
        created_by=data.created_by,
        updated_by=data.updated_by,
        time=data.time,
        settings=data.settings or {"anonymous": False},
        question_order=data.question_order or [],
        meta_data=data.meta_data or {}
    )
    db.add(survey)
    db.commit()
    db.refresh(survey)

    # increment currentUsage.surveys if you have an Organization table
    # db.query(Organization).filter(Organization.org_id == data.org_id).update({"subscription.current_usage_surveys": Organization.subscription["currentUsage"]["surveys"] + 1})

    return survey

@router.get("/{survey_id}", response_model=SurveyCreate)
def get_survey(survey_id: str, db: Session = Depends(get_db)):
    survey = db.query(Survey).filter(Survey.survey_id == survey_id).first()
    if not survey:
        raise HTTPException(status_code=404, detail="Survey not found")
    return survey

@router.get("/project/{project_id}", response_model=list[SurveyCreate])
def get_all_surveys(project_id: str, db: Session = Depends(get_db)):
    surveys = db.query(Survey).filter(Survey.project_id == project_id).all()
    return surveys

@router.patch("/{survey_id}", response_model=SurveyCreate)
def update_survey(survey_id: str, data: SurveyUpdate, db: Session = Depends(get_db)):
    survey = db.query(Survey).filter(Survey.survey_id == survey_id).first()
    if not survey:
        raise HTTPException(status_code=404, detail="Survey not found")
    for key, value in data.dict(exclude_unset=True).items():
        setattr(survey, key, value)
    db.commit()
    db.refresh(survey)
    return survey

@router.delete("/{survey_id}")
def delete_survey(survey_id: str, db: Session = Depends(get_db)):
    survey = db.query(Survey).filter(Survey.survey_id == survey_id).first()
    if not survey:
        raise HTTPException(status_code=404, detail="Survey not found")
    db.delete(survey)
    db.commit()

    # decrement subscription.currentUsage.surveys if Organization table exists
    return {"detail": "Survey deleted"}
