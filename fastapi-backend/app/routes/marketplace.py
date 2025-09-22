from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from sqlalchemy.sql import func
from ..db import get_db
from ..models.marketplace import Marketplace
from ..schemas.marketplace import MarketplaceCreate, MarketplaceResponse

router = APIRouter(prefix="/marketplace", tags=["Marketplace"])

@router.post("/", response_model=MarketplaceResponse)
def create_marketplace(data: MarketplaceCreate, db: Session = Depends(get_db)):
    db_item = Marketplace(**data.dict())
    db.add(db_item)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Marketplace entry already exists")
    db.refresh(db_item)
    return db_item

@router.get("/{app_id}", response_model=MarketplaceResponse)
def get_marketplace(app_id: str, db: Session = Depends(get_db)):
    db_item = db.query(Marketplace).filter(Marketplace.app_id == app_id).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Marketplace entry not found")
    return db_item

@router.put("/{app_id}", response_model=MarketplaceResponse)
def update_marketplace(app_id: str, update_data: MarketplaceCreate, db: Session = Depends(get_db)):
    db_item = db.query(Marketplace).filter(Marketplace.app_id == app_id).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Marketplace entry not found")
    for key, value in update_data.dict().items():
        setattr(db_item, key, value)
    db_item.updated_at = func.now()
    db.commit()
    db.refresh(db_item)
    return db_item

@router.delete("/{app_id}", response_model=dict)
def delete_marketplace(app_id: str, db: Session = Depends(get_db)):
    db_item = db.query(Marketplace).filter(Marketplace.app_id == app_id).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Marketplace entry not found")
    db.delete(db_item)
    db.commit()
    return {"detail": "Marketplace entry deleted"}
