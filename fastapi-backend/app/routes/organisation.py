from sqlalchemy import func
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..db import get_db
from ..models.organisation import Organisation
from ..schemas.organisation import OrganisationCreate, OrganisationResponse, OrganisationUpdate
from sqlalchemy.exc import IntegrityError

router = APIRouter(prefix="/organisation", tags=["Organisation"])

@router.post("/", response_model=OrganisationResponse)
def create_organisation(org: OrganisationCreate, db: Session = Depends(get_db)):
    print(org)
    db_org = Organisation(**org.dict(exclude_unset=True)) 
    db.add(db_org)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Organisation already exists")
    db.refresh(db_org)
    return db_org

@router.patch("/{org_id}", response_model=OrganisationResponse)
def update_organisation(org_id: str, update_data: OrganisationUpdate, db: Session = Depends(get_db)):
    print(update_data)
    db_org = db.query(Organisation).filter(Organisation.org_id == org_id).first()
    if not db_org:
        raise HTTPException(status_code=404, detail="Organisation not found")
    for key, value in update_data.dict(exclude_unset=True).items():
        setattr(db_org, key, value)
    db.commit()
    db.refresh(db_org)
    return db_org

@router.get("/{org_id}", response_model=OrganisationResponse)
def get_organisation(org_id: str, db: Session = Depends(get_db)):
    db_org = db.query(Organisation).filter(Organisation.org_id == org_id).first()
    if not db_org:
        raise HTTPException(status_code=404, detail="Organisation not found")
    return db_org

@router.delete("/{org_id}", response_model=OrganisationResponse)
def soft_delete_organisation(org_id: str, db: Session = Depends(get_db)):
    db_org = db.query(Organisation).filter(Organisation.org_id == org_id).first()
    if not db_org:
        raise HTTPException(status_code=404, detail="Organisation not found")
    db_org.is_active = False
    db_org.deleted_at = func.now()
    db.commit()
    db.refresh(db_org)
    return db_org