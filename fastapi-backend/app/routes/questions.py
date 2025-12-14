from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime

from ..db import get_db
from ..models.questions import Question            # SQLAlchemy model
from ..schemas.questions import QuestionCreate, QuestionUpdate, QuestionOut, BulkQuestionsRequest
from ..services.redis_question_service import RedisQuestionService
from ..services.question_label_service import generate_next_serial_label


router = APIRouter(prefix="/questions", tags=["Questions"])

@router.post("/", response_model=QuestionOut)
def create_question(data: QuestionCreate, db: Session = Depends(get_db)):
    serial_label = data.serial_label

    # ✅ Auto-generate if not provided
    if not serial_label:
        serial_label = generate_next_serial_label(db, data.survey_id, prefix="Q")

    # ❌ Check uniqueness
    exists = (
        db.query(Question)
        .filter(
            Question.survey_id == data.survey_id,
            Question.serial_label == serial_label,
        )
        .first()
    )
    if exists:
        raise HTTPException(409, detail="serial_label already exists in this survey")

    q = Question(
        question_id=data.question_id,
        survey_id=data.survey_id,
        org_id=data.org_id,
        project_id=data.project_id,
        type=data.type,

        label=data.label,
        serial_label=serial_label,   # ✅

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
        .filter(
            Question.survey_id == survey_id,
            Question.question_id == question_id,
        )
        .first()
    )
    if not q:
        raise HTTPException(status_code=404, detail="Question not found")

    if data.serial_label:
        dup = (
            db.query(Question)
            .filter(
                Question.survey_id == survey_id,
                Question.serial_label == data.serial_label,
                Question.question_id != question_id,
            )
            .first()
        )
        if dup:
            raise HTTPException(409, detail="serial_label already exists")

    updates = data.dict(exclude_unset=True)
    for k, v in updates.items():
        setattr(q, k, v)

    q.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(q)

    RedisQuestionService.cache_question(survey_id, q)
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


# NEW: Bulk questions endpoint - no survey_id required
@router.post("/bulk", response_model=List[QuestionOut])
def get_bulk_questions(data: BulkQuestionsRequest, db: Session = Depends(get_db)):
    """
    Fetch multiple questions by their IDs, regardless of survey.
    Useful for getting questions from submitted answers.
    """
    if not data.question_ids:
        return []
    
    # Try to get from cache first (check each individually)
    results = []
    uncached_ids = []
    
    for qid in data.question_ids:
        # We don't have survey_id, so skip cache or use a different cache strategy
        uncached_ids.append(qid)
    
    # Fetch all uncached questions from DB in one query
    if uncached_ids:
        questions = (
            db.query(Question)
            .filter(Question.question_id.in_(uncached_ids))
            .all()
        )
        
        # Cache each question individually if we have survey_id
        for q in questions:
            if q.survey_id:
                RedisQuestionService.cache_question(q.survey_id, q)
        
        results.extend(questions)
    
    # Return in the same order as requested
    question_map = {q.question_id: q for q in results}
    ordered_results = [question_map[qid] for qid in data.question_ids if qid in question_map]
    
    return ordered_results
