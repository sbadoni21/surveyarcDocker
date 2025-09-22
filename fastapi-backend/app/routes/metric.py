from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from sqlalchemy.sql import func
from ..db import get_db
from ..models.metric import Metric
from ..schemas.metric import MetricCreate, MetricResponse

router = APIRouter(prefix="/metrics", tags=["Metrics"])

@router.post("/", response_model=MetricResponse)
def create_metric(data: MetricCreate, db: Session = Depends(get_db)):
    db_metric = Metric(**data.dict())
    db.add(db_metric)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Metric already exists")
    db.refresh(db_metric)
    return db_metric

@router.get("/{metric_id}", response_model=MetricResponse)
def get_metric(metric_id: str, db: Session = Depends(get_db)):
    db_metric = db.query(Metric).filter(Metric.metric_id == metric_id).first()
    if not db_metric:
        raise HTTPException(status_code=404, detail="Metric not found")
    return db_metric

@router.put("/{metric_id}", response_model=MetricResponse)
def update_metric(metric_id: str, update_data: MetricCreate, db: Session = Depends(get_db)):
    db_metric = db.query(Metric).filter(Metric.metric_id == metric_id).first()
    if not db_metric:
        raise HTTPException(status_code=404, detail="Metric not found")
    for key, value in update_data.dict().items():
        setattr(db_metric, key, value)
    db_metric.timestamp = update_data.timestamp or func.now()
    db.commit()
    db.refresh(db_metric)
    return db_metric

@router.delete("/{metric_id}", response_model=dict)
def delete_metric(metric_id: str, db: Session = Depends(get_db)):
    db_metric = db.query(Metric).filter(Metric.metric_id == metric_id).first()
    if not db_metric:
        raise HTTPException(status_code=404, detail="Metric not found")
    db.delete(db_metric)
    db.commit()
    return {"detail": "Metric deleted"}
