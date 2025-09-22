from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..db import get_db
from ..models.integration import Integration
from ..schemas.integration import IntegrationCreate, IntegrationResponse
from sqlalchemy.exc import IntegrityError
from sqlalchemy.sql import func

router = APIRouter(prefix="/integrations", tags=["Integrations"])

@router.post("/", response_model=IntegrationResponse)
def create_integration(data: IntegrationCreate, db: Session = Depends(get_db)):
    db_integration = Integration(**data.dict())
    db.add(db_integration)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Integration already exists")
    db.refresh(db_integration)
    return db_integration

@router.get("/{int_id}", response_model=IntegrationResponse)
def get_integration(int_id: str, db: Session = Depends(get_db)):
    db_integration = db.query(Integration).filter(Integration.int_id == int_id).first()
    if not db_integration:
        raise HTTPException(status_code=404, detail="Integration not found")
    return db_integration

@router.put("/{int_id}", response_model=IntegrationResponse)
def update_integration(int_id: str, update_data: IntegrationCreate, db: Session = Depends(get_db)):
    db_integration = db.query(Integration).filter(Integration.int_id == int_id).first()
    if not db_integration:
        raise HTTPException(status_code=404, detail="Integration not found")
    for key, value in update_data.dict().items():
        setattr(db_integration, key, value)
    db_integration.updated_at = func.now()  # mimic Firestore Timestamp
    db.commit()
    db.refresh(db_integration)
    return db_integration

@router.delete("/{int_id}", response_model=dict)
def delete_integration(int_id: str, db: Session = Depends(get_db)):
    db_integration = db.query(Integration).filter(Integration.int_id == int_id).first()
    if not db_integration:
        raise HTTPException(status_code=404, detail="Integration not found")
    db.delete(db_integration)
    db.commit()
    return {"detail": "Integration deleted"}
