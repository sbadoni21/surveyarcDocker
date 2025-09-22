from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..db import get_db
from ..models.archive import Archive
from ..schemas.archive import ArchiveCreate, ArchiveResponse
from sqlalchemy.exc import IntegrityError
from sqlalchemy.sql import func

router = APIRouter(prefix="/archives", tags=["Archives"])

@router.post("/", response_model=ArchiveResponse)
def create_archive(data: ArchiveCreate, db: Session = Depends(get_db)):
    db_archive = Archive(**data.dict())
    db.add(db_archive)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Archive already exists")
    db.refresh(db_archive)
    return db_archive

@router.get("/{archive_id}", response_model=ArchiveResponse)
def get_archive(archive_id: str, db: Session = Depends(get_db)):
    db_archive = db.query(Archive).filter(Archive.archive_id == archive_id).first()
    if not db_archive:
        raise HTTPException(status_code=404, detail="Archive not found")
    return db_archive

@router.put("/{archive_id}", response_model=ArchiveResponse)
def update_archive(archive_id: str, update_data: ArchiveCreate, db: Session = Depends(get_db)):
    db_archive = db.query(Archive).filter(Archive.archive_id == archive_id).first()
    if not db_archive:
        raise HTTPException(status_code=404, detail="Archive not found")
    for key, value in update_data.dict().items():
        setattr(db_archive, key, value)
    db_archive.generated_at = func.now()  # update timestamp like Firestore
    db.commit()
    db.refresh(db_archive)
    return db_archive

@router.delete("/{archive_id}", response_model=dict)
def delete_archive(archive_id: str, db: Session = Depends(get_db)):
    db_archive = db.query(Archive).filter(Archive.archive_id == archive_id).first()
    if not db_archive:
        raise HTTPException(status_code=404, detail="Archive not found")
    db.delete(db_archive)
    db.commit()
    return {"detail": "Archive deleted"}
