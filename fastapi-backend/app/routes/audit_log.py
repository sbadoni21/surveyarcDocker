from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..db import get_db
from ..models.audit_log import AuditLog
from ..schemas.audit_log import AuditLogCreate, AuditLogResponse
from sqlalchemy.exc import IntegrityError
from sqlalchemy.sql import func

router = APIRouter(prefix="/audit-logs", tags=["AuditLogs"])

@router.post("/", response_model=AuditLogResponse)
def create_audit_log(log: AuditLogCreate, db: Session = Depends(get_db)):
    db_log = AuditLog(**log.dict())
    db.add(db_log)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Audit log already exists")
    db.refresh(db_log)
    return db_log

@router.get("/{log_id}", response_model=AuditLogResponse)
def get_audit_log(log_id: str, db: Session = Depends(get_db)):
    db_log = db.query(AuditLog).filter(AuditLog.log_id == log_id).first()
    if not db_log:
        raise HTTPException(status_code=404, detail="Audit log not found")
    return db_log

@router.put("/{log_id}", response_model=AuditLogResponse)
def update_audit_log(log_id: str, update_data: AuditLogCreate, db: Session = Depends(get_db)):
    db_log = db.query(AuditLog).filter(AuditLog.log_id == log_id).first()
    if not db_log:
        raise HTTPException(status_code=404, detail="Audit log not found")
    for key, value in update_data.dict().items():
        setattr(db_log, key, value)
    db_log.timestamp = func.now()  # update timestamp like Firestore
    db.commit()
    db.refresh(db_log)
    return db_log

@router.delete("/{log_id}", response_model=dict)
def delete_audit_log(log_id: str, db: Session = Depends(get_db)):
    db_log = db.query(AuditLog).filter(AuditLog.log_id == log_id).first()
    if not db_log:
        raise HTTPException(status_code=404, detail="Audit log not found")
    db.delete(db_log)
    db.commit()
    return {"detail": "Audit log deleted"}
