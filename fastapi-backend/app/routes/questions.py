from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime

from ..db import get_db
from ..models.questions import Question            # SQLAlchemy model
from ..schemas.questions import QuestionCreate, QuestionUpdate, QuestionOut
from ..services.redis_question_service import RedisQuestionService

router = APIRouter(prefix="/questions", tags=["Questions"])

@router.post("/", response_model=QuestionOut)
def create_question(data: QuestionCreate, db: Session = Depends(get_db)):
    # Generate server timestamps if your model has them
    q = Question(
        question_id=data.question_id,        # optional in schema; if None, DB default/trigger or set here
        survey_id=data.survey_id,
        org_id=data.org_id,
        project_id=data.project_id,
        type=data.type,
        label=data.label,
        required=data.required if data.required is not None else True,
        description=data.description or "",
        config=data.config or {},
        logic=data.logic or [],
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(q)
    db.commit()
    db.refresh(q)

    RedisQuestionService.cache_question(q.survey_id, q)
    RedisQuestionService.cache_questions_list(q.survey_id, [q])
    return q

@router.get("/{survey_id}", response_model=List[QuestionOut])
def get_all_questions(survey_id: str, db: Session = Depends(get_db)):
    # Try to get from cache
    cached = RedisQuestionService.get_questions_for_survey(survey_id)
    if cached is not None:  # Explicitly check for None, not just falsy
        print(f"[API] Returning {len(cached)} questions from cache for survey {survey_id}")
        return cached

    # Cache miss or expired - fetch from DB
    print(f"[API] Cache miss for survey {survey_id}, fetching from DB")
    rows = db.query(Question).filter(Question.survey_id == survey_id).all()
    
    # Cache the results if we got any
    if rows:
        print(f"[API] Caching {len(rows)} questions for survey {survey_id}")
        RedisQuestionService.cache_questions_list(survey_id, rows)
    
    return rows

@router.get("/{survey_id}/{question_id}", response_model=QuestionOut)
def get_question(survey_id: str, question_id: str, db: Session = Depends(get_db)):
    cached = RedisQuestionService.get_question(survey_id, question_id)
    if cached is not None:
        return cached

    q = (
        db.query(Question)
        .filter(Question.survey_id == survey_id, Question.question_id == question_id)
        .first()
    )
    if not q:
        raise HTTPException(status_code=404, detail="Question not found")

    RedisQuestionService.cache_question(survey_id, q)
    return q

@router.patch("/{survey_id}/{question_id}", response_model=QuestionOut)
def update_question(survey_id: str, question_id: str, data: QuestionUpdate, db: Session = Depends(get_db)):
    q = (
        db.query(Question)
        .filter(Question.survey_id == survey_id, Question.question_id == question_id)
        .first()
    )
    if not q:
        raise HTTPException(status_code=404, detail="Question not found")

    updates = data.dict(exclude_unset=True)
    for k, v in updates.items():
        setattr(q, k, v)
    q.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(q)

    RedisQuestionService.cache_question(survey_id, q)
    # list membership unchanged (same id), no need to rewrite list
    return q

@router.delete("/{survey_id}/{question_id}")
def delete_question(survey_id: str, question_id: str, db: Session = Depends(get_db)):
    q = (
        db.query(Question)
        .filter(Question.survey_id == survey_id, Question.question_id == question_id)
        .first()
    )
    if not q:
        raise HTTPException(status_code=404, detail="Question not found")

    db.delete(q)
    db.commit()

    RedisQuestionService.invalidate_question(survey_id, question_id)
    RedisQuestionService.remove_from_list(survey_id, question_id)
    return {"detail": "Question deleted"}