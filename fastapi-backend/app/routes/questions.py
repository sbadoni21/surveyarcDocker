from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..db import get_db
from ..models.questions import Question
from ..schemas.questions import QuestionCreate, QuestionUpdate
from typing import List

router = APIRouter(prefix="/questions", tags=["Questions"])

@router.post("/", response_model=QuestionCreate)
def create_question(data: QuestionCreate, db: Session = Depends(get_db)):
    db_question = Question(**data.dict())
    db.add(db_question)
    db.commit()
    db.refresh(db_question)
    return db_question

@router.get("/{survey_id}", response_model=List[QuestionCreate])
def get_all_questions(survey_id: str, db: Session = Depends(get_db)):
    questions = db.query(Question).filter(Question.survey_id == survey_id).all()
    return questions

@router.get("/{survey_id}/{question_id}", response_model=QuestionCreate)
def get_question(survey_id: str, question_id: str, db: Session = Depends(get_db)):
    question = db.query(Question).filter(Question.survey_id == survey_id,
                                         Question.question_id == question_id).first()
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    return question

@router.patch("/{survey_id}/{question_id}", response_model=QuestionCreate)
def update_question(survey_id: str, question_id: str, data: QuestionUpdate, db: Session = Depends(get_db)):
    question = db.query(Question).filter(Question.survey_id == survey_id,
                                         Question.question_id == question_id).first()
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    for key, value in data.dict(exclude_unset=True).items():
        setattr(question, key, value)
    db.commit()
    db.refresh(question)
    return question

@router.delete("/{survey_id}/{question_id}")
def delete_question(survey_id: str, question_id: str, db: Session = Depends(get_db)):
    question = db.query(Question).filter(Question.survey_id == survey_id,
                                         Question.question_id == question_id).first()
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    db.delete(question)
    db.commit()
    return {"detail": "Question deleted"}
