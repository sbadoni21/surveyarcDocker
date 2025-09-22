from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..db import get_db
from ..models.answer import Answer
from ..schemas.answer import AnswerCreate, AnswerResponse
import uuid

router = APIRouter(prefix="/answers", tags=["Answers"])

@router.post("/", response_model=AnswerResponse)
def create_answer(answer: AnswerCreate, db: Session = Depends(get_db)):
    new_id = str(uuid.uuid4())  # auto-generate ID like Firestore
    db_answer = Answer(id=new_id, **answer.dict())
    db.add(db_answer)
    db.commit()
    db.refresh(db_answer)
    return db_answer

@router.get("/{answer_id}", response_model=AnswerResponse)
def get_answer(answer_id: str, db: Session = Depends(get_db)):
    db_answer = db.query(Answer).filter(Answer.id == answer_id).first()
    if not db_answer:
        raise HTTPException(status_code=404, detail="Answer not found")
    return db_answer

@router.put("/{answer_id}", response_model=AnswerResponse)
def update_answer(answer_id: str, update_data: AnswerCreate, db: Session = Depends(get_db)):
    db_answer = db.query(Answer).filter(Answer.id == answer_id).first()
    if not db_answer:
        raise HTTPException(status_code=404, detail="Answer not found")
    for key, value in update_data.dict().items():
        setattr(db_answer, key, value)
    db.commit()
    db.refresh(db_answer)
    return db_answer

@router.delete("/{answer_id}", response_model=dict)
def delete_answer(answer_id: str, db: Session = Depends(get_db)):
    db_answer = db.query(Answer).filter(Answer.id == answer_id).first()
    if not db_answer:
        raise HTTPException(status_code=404, detail="Answer not found")
    db.delete(db_answer)
    db.commit()
    return {"detail": "Answer deleted"}
