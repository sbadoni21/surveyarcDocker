from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from ..db import get_db
from ..models.payment import Payment
from ..schemas.payment import PaymentCreate, PaymentResponse

router = APIRouter(prefix="/payments", tags=["Payments"])

@router.post("/", response_model=PaymentResponse)
def create_payment(data: PaymentCreate, db: Session = Depends(get_db)):
    db_payment = Payment(**data.dict())
    db.add(db_payment)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Payment already exists")
    db.refresh(db_payment)
    return db_payment

@router.get("/{payment_id}", response_model=PaymentResponse)
def get_payment(payment_id: str, db: Session = Depends(get_db)):
    db_payment = db.query(Payment).filter(Payment.payment_id == payment_id).first()
    if not db_payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    return db_payment

@router.delete("/{payment_id}", response_model=dict)
def delete_payment(payment_id: str, db: Session = Depends(get_db)):
    db_payment = db.query(Payment).filter(Payment.payment_id == payment_id).first()
    if not db_payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    db.delete(db_payment)
    db.commit()
    return {"detail": "Payment deleted"}
