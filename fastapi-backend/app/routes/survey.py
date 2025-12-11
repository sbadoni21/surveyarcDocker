# app/routes/survey.py
import uuid
from datetime import datetime
from typing import List, Optional, Dict

from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from sqlalchemy.orm import Session

from ..db import get_db
from ..models.survey import Survey
from ..schemas.survey import SurveyCreate, SurveyUpdate, SurveyOut
from ..services.redis_survey_service import RedisSurveyService
import os
import asyncio
from pydantic import BaseModel, Field

from ..services.dummy_responses_bot import (
    DummyBotConfig,
    generate_dummy_responses,
)



router = APIRouter(prefix="/surveys", tags=["Surveys"])
dummy_generation_tasks: Dict[str, dict] = {}

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
    if cached is not None:  # FIXED: explicit None check
        print(f"[API] Returning survey {survey_id} from cache")
        return cached

    print(f"[API] Cache miss for survey {survey_id}, fetching from DB")
    survey = db.query(Survey).filter(Survey.survey_id == survey_id).first()
    if not survey:
        raise HTTPException(status_code=404, detail="Survey not found")

    RedisSurveyService.cache_survey(survey)
    return survey


@router.get("", response_model=List[SurveyOut])
def list_surveys(
    project_id: Optional[str] = Query(None),
    org_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """
    List surveys.

    - If project_id is provided: return surveys for that project (with cache)
    - Else if org_id is provided: return all surveys for that org (no cache for now)
    - Else: return all surveys in the system (careful if DB is huge)
    """
    # --- 1) By project (existing behaviour + cache) ---
    if project_id:
        cached_list = RedisSurveyService.get_project_surveys(project_id)
        if cached_list is not None:
            print(
                f"[API] Returning {len(cached_list)} surveys from cache for project {project_id}"
            )
            return cached_list

        print(f"[API] Cache miss for project {project_id}, fetching from DB")
        surveys = db.query(Survey).filter(Survey.project_id == project_id).all()
        if surveys:
            RedisSurveyService.set_project_surveys_exact(project_id, surveys)
        return surveys

    # --- 2) By org ---
    if org_id:
        print(f"[API] Fetching surveys for org {org_id} from DB")
        surveys = db.query(Survey).filter(Survey.org_id == org_id).all()
        # you can add org-level cache later if needed
        return surveys

    # --- 3) All surveys (no filters) ---
    print("[API] Fetching ALL surveys from DB (no project/org filter)")
    surveys = db.query(Survey).all()
    return surveys

@router.get("/project/{project_id}", response_model=List[SurveyOut])
def get_all_surveys(project_id: str, db: Session = Depends(get_db)):
    cached_list = RedisSurveyService.get_project_surveys(project_id)
    if cached_list is not None:  # FIXED: explicit None check
        print(f"[API] Returning {len(cached_list)} surveys from cache for project {project_id}")
        return cached_list
    
    print(f"[API] Cache miss for project {project_id}, fetching from DB")
    surveys = db.query(Survey).filter(Survey.project_id == project_id).all()
    if surveys:
        RedisSurveyService.set_project_surveys_exact(project_id, surveys)
    return surveys

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
    if cached is not None:  # FIXED: explicit None check
        return {"count": cached}
    # Fallback (no table): 0
    RedisSurveyService.cache_responses_count(survey_id, 0)
    return {"count": 0}

@router.get("/{survey_id}/responses")
def list_responses(survey_id: str, db: Session = Depends(get_db)):
    cached = RedisSurveyService.get_responses(survey_id)
    if cached is not None:  # FIXED: explicit None check
        return cached
    # Fallback empty list if you haven't implemented responses storage yet
    RedisSurveyService.cache_responses(survey_id, [])
    return []

class DummyGenerateRequest(BaseModel):
    org_id: str
    project_id: str
    count: int = Field(100, ge=1, le=1000)
    concurrency: int = Field(5, ge=1, le=20)
    headless: bool = True
    base_form_url: str | None = None


@router.post("/{survey_id}/generate-dummy")
async def generate_dummy_for_survey(
    survey_id: str,
    payload: DummyGenerateRequest,
    background_tasks: BackgroundTasks,
):
    """
    Start dummy response generation and return task ID for tracking.
    """
    task_id = f"task_{uuid.uuid4().hex[:12]}"
    
    base_form_url = (
       
         "http://localhost:3000/en/form"
    )

    cfg = DummyBotConfig(
        base_form_url=base_form_url,
        org_id=payload.org_id,
        project_id=payload.project_id,
        survey_id=survey_id,
        total_respondents=payload.count,
        concurrency=payload.concurrency,
        headless=payload.headless,
    )

    # Initialize task status
    dummy_generation_tasks[task_id] = {
        "status": "running",
        "survey_id": survey_id,
        "started_at": datetime.utcnow().isoformat(),
        "progress": {"completed": 0, "total": payload.count},
        "result": None,
    }

    # 🔹 IMPROVED: Proper background task with error handling
    async def _bg_task():
        try:
            result = await generate_dummy_responses(cfg)
            dummy_generation_tasks[task_id].update({
                "status": "completed",
                "completed_at": datetime.utcnow().isoformat(),
                "result": result,
            })
        except Exception as e:
            print(f"[BOT] Task {task_id} failed:", e)
            dummy_generation_tasks[task_id].update({
                "status": "failed",
                "completed_at": datetime.utcnow().isoformat(),
                "error": str(e),
            })

    # Use BackgroundTasks to ensure proper lifecycle
    background_tasks.add_task(_bg_task)

    return {
        "task_id": task_id,
        "status": "started",
        "survey_id": survey_id,
        "config": {
            "org_id": payload.org_id,
            "project_id": payload.project_id,
            "count": payload.count,
            "concurrency": payload.concurrency,
        },
        "check_status_url": f"/surveys/{survey_id}/generate-dummy/{task_id}",
    }


@router.get("/{survey_id}/generate-dummy/{task_id}")
def get_dummy_generation_status(survey_id: str, task_id: str):
    """
    Check the status of a dummy generation task.
    """
    if task_id not in dummy_generation_tasks:
        raise HTTPException(status_code=404, detail="Task not found")
    
    task = dummy_generation_tasks[task_id]
    
    if task["survey_id"] != survey_id:
        raise HTTPException(status_code=400, detail="Survey ID mismatch")
    
    return task


@router.delete("/{survey_id}/generate-dummy/{task_id}")
def cancel_dummy_generation(survey_id: str, task_id: str):
    """
    Cancel/remove a dummy generation task.
    Note: This only removes the tracking entry; 
    can't actually stop Playwright tasks once started.
    """
    if task_id not in dummy_generation_tasks:
        raise HTTPException(status_code=404, detail="Task not found")
    
    del dummy_generation_tasks[task_id]
    
    return {"detail": f"Task {task_id} removed"}


@router.get("/{survey_id}/generate-dummy")
def list_dummy_generation_tasks(survey_id: str):
    """
    List all dummy generation tasks for a survey.
    """
    tasks = {
        tid: task 
        for tid, task in dummy_generation_tasks.items()
        if task["survey_id"] == survey_id
    }
    
    return {"survey_id": survey_id, "tasks": tasks}