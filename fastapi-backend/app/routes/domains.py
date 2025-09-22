from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..db import get_db
from ..models.domains import Domain
from ..schemas.domains import DomainCreate, DomainResponse
from sqlalchemy.exc import IntegrityError
from sqlalchemy.sql import func

router = APIRouter(prefix="/domains", tags=["Domains"])

@router.post("/", response_model=DomainResponse)
def create_domain(data: DomainCreate, db: Session = Depends(get_db)):
    db_domain = Domain(**data.dict())
    db.add(db_domain)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Domain already exists")
    db.refresh(db_domain)
    return db_domain

@router.get("/{domain_id}", response_model=DomainResponse)
def get_domain(domain_id: str, db: Session = Depends(get_db)):
    db_domain = db.query(Domain).filter(Domain.domain_id == domain_id).first()
    if not db_domain:
        raise HTTPException(status_code=404, detail="Domain not found")
    return db_domain

@router.put("/{domain_id}", response_model=DomainResponse)
def update_domain(domain_id: str, update_data: DomainCreate, db: Session = Depends(get_db)):
    db_domain = db.query(Domain).filter(Domain.domain_id == domain_id).first()
    if not db_domain:
        raise HTTPException(status_code=404, detail="Domain not found")
    for key, value in update_data.dict().items():
        setattr(db_domain, key, value)
    db_domain.updated_at = func.now()  # update timestamp like Firestore
    db.commit()
    db.refresh(db_domain)
    return db_domain

@router.delete("/{domain_id}", response_model=dict)
def delete_domain(domain_id: str, db: Session = Depends(get_db)):
    db_domain = db.query(Domain).filter(Domain.domain_id == domain_id).first()
    if not db_domain:
        raise HTTPException(status_code=404, detail="Domain not found")
    db.delete(db_domain)
    db.commit()
    return {"detail": "Domain deleted"}
