from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional
import uuid

from ..db import get_db
from ..models.audience_file import AudienceFile
from ..schemas.audience_file import (
    AudienceFileCreate,
    AudienceFileResponse,
    AudienceFileUpdate,
    AudienceFileList,
)

router = APIRouter(prefix="/audience-files", tags=["Audience Files (B2C)"])


@router.post("/", response_model=AudienceFileResponse)
def create_audience_file(
    payload: AudienceFileCreate,
    db: Session = Depends(get_db),
):
    """
    Store reference for an uploaded CSV/Excel audience file.
    (Firebase upload already done on frontend.)
    """
    new_id = str(uuid.uuid4())

    db_file = AudienceFile(
        id=new_id,
        **payload.dict(),
    )
    db.add(db_file)
    db.commit()
    db.refresh(db_file)
    return db_file


@router.get("/{file_id}", response_model=AudienceFileResponse)
def get_audience_file(
    file_id: str,
    db: Session = Depends(get_db),
):
    db_file = db.query(AudienceFile).filter(AudienceFile.id == file_id).first()
    if not db_file:
        raise HTTPException(status_code=404, detail="Audience file not found")
    return db_file


@router.get("/", response_model=AudienceFileList)
def list_audience_files(
    db: Session = Depends(get_db),
    org_id: str = Query(..., description="Org ID"),
    audience_tag: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    """
    List uploaded B2C audience files for an org.
    """
    q = db.query(AudienceFile).filter(AudienceFile.org_id == org_id)

    if audience_tag:
        q = q.filter(AudienceFile.audience_tag == audience_tag)

    total = q.count()
    items = (
        q.order_by(AudienceFile.uploaded_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    return AudienceFileList(items=items, total=total)


@router.put("/{file_id}", response_model=AudienceFileResponse)
def update_audience_file(
    file_id: str,
    payload: AudienceFileUpdate,
    db: Session = Depends(get_db),
):
    db_file = db.query(AudienceFile).filter(AudienceFile.id == file_id).first()
    if not db_file:
        raise HTTPException(status_code=404, detail="Audience file not found")

    data = payload.dict(exclude_unset=True)
    for key, value in data.items():
        setattr(db_file, key, value)

    db.commit()
    db.refresh(db_file)
    return db_file


@router.delete("/{file_id}", response_model=dict)
def delete_audience_file(
    file_id: str,
    db: Session = Depends(get_db),
):
    db_file = db.query(AudienceFile).filter(AudienceFile.id == file_id).first()
    if not db_file:
        raise HTTPException(status_code=404, detail="Audience file not found")

    db.delete(db_file)
    db.commit()
    return {"detail": "Audience file deleted"}
