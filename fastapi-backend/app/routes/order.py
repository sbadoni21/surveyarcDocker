from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from sqlalchemy.sql import func
from ..db import get_db
from ..models.order import Order
from ..schemas.order import OrderCreate, OrderResponse

router = APIRouter(prefix="/orders", tags=["Orders"])

@router.post("/", response_model=OrderResponse)
def create_order(data: OrderCreate, db: Session = Depends(get_db)):
    db_order = Order(**data.dict())
    db.add(db_order)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Order already exists")
    db.refresh(db_order)
    return db_order

@router.get("/{order_id}", response_model=OrderResponse)
def get_order(order_id: str, db: Session = Depends(get_db)):
    db_order = db.query(Order).filter(Order.order_id == order_id).first()
    if not db_order:
        raise HTTPException(status_code=404, detail="Order not found")
    return db_order

@router.put("/{order_id}", response_model=OrderResponse)
def update_order(order_id: str, update_data: OrderCreate, db: Session = Depends(get_db)):
    db_order = db.query(Order).filter(Order.order_id == order_id).first()
    if not db_order:
        raise HTTPException(status_code=404, detail="Order not found")
    for key, value in update_data.dict().items():
        setattr(db_order, key, value)
    db_order.updated_at = func.now()
    db.commit()
    db.refresh(db_order)
    return db_order

@router.delete("/{order_id}", response_model=dict)
def delete_order(order_id: str, db: Session = Depends(get_db)):
    db_order = db.query(Order).filter(Order.order_id == order_id).first()
    if not db_order:
        raise HTTPException(status_code=404, detail="Order not found")
    db.delete(db_order)
    db.commit()
    return {"detail": "Order deleted"}
