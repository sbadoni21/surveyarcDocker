import uuid
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..db import get_db
from ..models.answer import Answer
from ..models.responses import Response
from ..schemas.responses import ResponseCreate, ResponseUpdate, ResponseOut
from ..services.redis_response_service import RedisResponseService

router = APIRouter(prefix="/responses", tags=["Responses"])

# helpers
def normalize_response(row):
    base = {
        k: v.isoformat() if isinstance(v, datetime) else v
        for k, v in row.__dict__.items()
        if not k.startswith("_")
    }
    base["answers"] = row.answers_blob or []
    return base

def _write_answers(db, survey_id: str, response_id: str, answers: list, org_id: str):
    from ..models.answer import Answer
    from ..schemas.answer import AnswerCreate
    import uuid
    # print("_write_answers called with:", survey_id, response_id, answers, org_id)
    for ans in answers:
        if not ans:
            continue

        question_id = ans.get("questionId")
        project_id = ans.get("projectId") or ""
        answer_val = ans.get("answer")

        answer_data = AnswerCreate(
            question_id=question_id,
            project_id=project_id,
            survey_id=survey_id,
            org_id=org_id, 
            response_id=response_id,
            answer_config={"value": answer_val},
        )

        new_id = str(uuid.uuid4())
        db_answer = Answer(id=new_id, **answer_data.dict())
        db.add(db_answer)


@router.post("/", response_model=ResponseOut)
def create_response(data: ResponseCreate, db: Session = Depends(get_db)):
    rid = data.response_id or "resp_" + uuid.uuid4().hex[:10]

    answers_data = [a.model_dump() for a in data.answers or []]

    row = Response(
            response_id=rid,
            org_id=data.org_id,
            survey_id=data.survey_id,
            respondent_id=data.respondent_id,
            status=data.status or "started",
            meta_data=data.meta_data or {},
            source_id=data.source_id,          # <--- HERE
            started_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
            answers_blob=answers_data,
        )

    db.add(row)
    answers_list = [a.model_dump() for a in data.answers or []]
    _write_answers(db, data.survey_id, rid, answers_list, data.org_id)
    db.commit()
    db.refresh(row)

    # 🔹 FIX: Normalize before caching
    normalized_response = normalize_response(row)
    RedisResponseService.cache_response(normalized_response)
    
    # 🔹 FIX: Get all responses, normalize them, then cache
    rows = db.query(Response).filter(Response.survey_id == data.survey_id).all()
    normalized_list = [normalize_response(r) for r in rows]
    RedisResponseService.cache_list(data.survey_id, normalized_list)
    RedisResponseService.cache_count(data.survey_id, len(rows))

    # Return the normalized response
    return normalized_response

@router.get("", response_model=List[ResponseOut])
def list_responses(survey_id: str = Query(...), db: Session = Depends(get_db)):
    cached = RedisResponseService.get_list(survey_id)
    if cached is not None:
        return cached

    rows = (
        db.query(Response)
        .filter(Response.survey_id == survey_id)
        .order_by(Response.started_at.desc())
        .all()
    )

    normalized = [normalize_response(r) for r in rows]

    # 🔹 FIX: Cache the normalized data, not the ORM objects
    RedisResponseService.cache_list(survey_id, normalized)  # ✅ This is correct
    RedisResponseService.cache_count(survey_id, len(rows))

    return normalized


@router.get("/count")
def count_responses(survey_id: str = Query(...), db: Session = Depends(get_db)):
    cached = RedisResponseService.get_count(survey_id)
    if cached is not None:
        return {"count": cached}
    count = db.query(Response).filter(Response.survey_id == survey_id).count()
    RedisResponseService.cache_count(survey_id, count)
    return {"count": count}

@router.get("/{survey_id}/{response_id}", response_model=ResponseOut)
def get_response(survey_id: str, response_id: str, db: Session = Depends(get_db)):
    cached = RedisResponseService.get_response(response_id)
    if cached is not None:
        return cached

    row = (
        db.query(Response)
        .filter(Response.survey_id == survey_id, Response.response_id == response_id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Response not found")

    formatted = normalize_response(row)
    RedisResponseService.cache_response(formatted)
    return formatted


@router.patch("/{survey_id}/{response_id}", response_model=ResponseOut)
def update_response(survey_id: str, response_id: str, data: ResponseUpdate, db: Session = Depends(get_db)):
    row = (
        db.query(Response)
        .filter(Response.survey_id == survey_id, Response.response_id == response_id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Response not found")

    upd = data.dict(exclude_unset=True)
    answers = upd.pop("answers", None)

    for k, v in upd.items():
        setattr(row, k, v)
    row.updated_at = datetime.utcnow()
    if answers is not None:
        row.answers_blob = answers
        _write_answers(db, survey_id, response_id, answers, data.org_id)  # 🔹 Add org_id parameter

    db.commit()
    db.refresh(row)

    # 🔹 FIX: Normalize before caching
    normalized_response = normalize_response(row)
    RedisResponseService.cache_response(normalized_response)
    RedisResponseService.invalidate(response_id, survey_id=survey_id)
    
    return normalized_response  # 🔹 Return normalized, not ORM object
@router.delete("/{survey_id}/{response_id}")
def delete_response(survey_id: str, response_id: str, db: Session = Depends(get_db)):
    row = (
        db.query(Response)
        .filter(Response.survey_id == survey_id, Response.response_id == response_id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Response not found")

    db.delete(row)
    db.commit()

    RedisResponseService.invalidate(response_id, survey_id=survey_id)
    return {"detail": "Response deleted"}
