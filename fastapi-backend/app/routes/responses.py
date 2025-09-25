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
def _write_answers(db: Session, survey_id: str, response_id: str, answers_payload: Optional[list]):
    if answers_payload is None:
        return
    # replace strategy
    db.query(Answer).filter(Answer.response_id == response_id).delete()
    for a in answers_payload:
        ans = Answer(
            answer_id="ans_" + uuid.uuid4().hex[:10],
            response_id=response_id,
            survey_id=survey_id,
            question_id=a.get("questionId"),
            value=a.get("answer"),
            meta={"projectId": a.get("projectId")} if a.get("projectId") else {},
        )
        db.add(ans)

@router.post("/", response_model=ResponseOut)
def create_response(data: ResponseCreate, db: Session = Depends(get_db)):
    rid = data.response_id or "resp_" + uuid.uuid4().hex[:10]
    row = Response(
        response_id=rid,
        org_id=data.org_id,
        survey_id=data.survey_id,
        respondent_id=data.respondent_id,
        status=data.status or "started",
        meta_data=data.meta_data or {},
        started_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
        answers_blob=data.answers or [],
    )
    db.add(row)
    _write_answers(db, data.survey_id, rid, data.answers)
    db.commit()
    db.refresh(row)

    RedisResponseService.cache_response(row)
    # refresh list + count caches
    rows = db.query(Response).filter(Response.survey_id == data.survey_id).all()
    RedisResponseService.cache_list(data.survey_id, rows)
    RedisResponseService.cache_count(data.survey_id, len(rows))
    return row

@router.get("", response_model=List[ResponseOut])
def list_responses(survey_id: str = Query(...), db: Session = Depends(get_db)):
    cached = RedisResponseService.get_list(survey_id)
    if cached is not None:
        return cached
    rows = db.query(Response).filter(Response.survey_id == survey_id).order_by(Response.started_at.desc()).all()
    if rows:
        RedisResponseService.cache_list(survey_id, rows)
        RedisResponseService.cache_count(survey_id, len(rows))
    return rows

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
    if cached:
        return cached
    row = (
        db.query(Response)
        .filter(Response.survey_id == survey_id, Response.response_id == response_id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Response not found")
    RedisResponseService.cache_response(row)
    return row

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
    # inline answers update
    answers = upd.pop("answers", None)

    for k, v in upd.items():
        setattr(row, k, v)
    row.updated_at = datetime.utcnow()
    if answers is not None:
        row.answers_blob = answers
        _write_answers(db, survey_id, response_id, answers)

    db.commit()
    db.refresh(row)

    RedisResponseService.cache_response(row)
    # invalidate list & count to be safe
    RedisResponseService.invalidate(response_id, survey_id=survey_id)
    return row

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
