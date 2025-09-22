from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..db import get_db
from ..models.responses import Response
from ..schemas.responses import ResponseCreate, ResponseUpdate

router = APIRouter(prefix="/responses", tags=["Responses"])

@router.post("/", response_model=ResponseCreate)
def create_response(data: ResponseCreate, db: Session = Depends(get_db)):
    db_response = Response(**data.dict())
    db.add(db_response)
    db.commit()
    db.refresh(db_response)
    return db_response

@router.get("/{survey_id}/{response_id}", response_model=ResponseCreate)
def get_response(survey_id: str, response_id: str, db: Session = Depends(get_db)):
    response = db.query(Response).filter(Response.survey_id==survey_id, Response.response_id==response_id).first()
    if not response:
        raise HTTPException(status_code=404, detail="Response not found")
    return response

@router.patch("/{survey_id}/{response_id}", response_model=ResponseCreate)
def update_response(survey_id: str, response_id: str, data: ResponseUpdate, db: Session = Depends(get_db)):
    response = db.query(Response).filter(Response.survey_id==survey_id, Response.response_id==response_id).first()
    if not response:
        raise HTTPException(status_code=404, detail="Response not found")
    for key, value in data.dict(exclude_unset=True).items():
        setattr(response, key, value)
    db.commit()
    db.refresh(response)
    return response

@router.delete("/{survey_id}/{response_id}")
def delete_response(survey_id: str, response_id: str, db: Session = Depends(get_db)):
    response = db.query(Response).filter(Response.survey_id==survey_id, Response.response_id==response_id).first()
    if not response:
        raise HTTPException(status_code=404, detail="Response not found")
    db.delete(response)
    db.commit()
    return {"detail": "Response deleted"}
