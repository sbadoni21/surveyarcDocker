from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import Optional
import uuid
import pandas as pd
import io
import os
from datetime import datetime, UTC

from ..db import get_db
from ..models.audience_file import AudienceFile
from ..schemas.audience_file import (
    AudienceFileCreate,
    AudienceFileResponse,
    AudienceFileUpdate,
    AudienceFileList,
)

router = APIRouter(prefix="/audience-files", tags=["Audience Files (B2C)"])


# ============================================
# ✅ UPLOAD ENDPOINT - FIXED TO MATCH MODEL
# ============================================
@router.post("/upload")
async def upload_audience_file(
    file: UploadFile = File(...),
    audience_name: str = Form(...),
    org_id: str = Form(...),
    uploaded_by: Optional[str] = Form(None),  # ✅ Changed from user_id to uploaded_by
    db: Session = Depends(get_db),
):
    """
    Upload and process CSV/Excel file for B2C campaigns.
    
    - Validates file format
    - Reads and validates required columns
    - Saves to temporary storage
    - Returns file metadata
    
    NOTE: This endpoint receives multipart/form-data (file upload)
    The DecryptMiddleware will skip this request automatically.
    The response is returned as plain JSON.
    """
    try:
        print(f"📤 [Backend] Receiving file upload: {file.filename}")
        print(f"📋 [Backend] Details - audience_name: {audience_name}, org_id: {org_id}")
        
        # Validate file type
        allowed_types = [
            'text/csv',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/csv',
        ]
        
        file_extension = file.filename.split('.')[-1].lower() if '.' in file.filename else ''
        
        if file.content_type not in allowed_types and file_extension not in ['csv', 'xlsx', 'xls']:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid file type. Only CSV and Excel files are supported. Got: {file.content_type}"
            )
        
        # Read file content
        content = await file.read()
        
        # Validate file size (50MB max)
        max_size = 50 * 1024 * 1024  # 50MB
        if len(content) > max_size:
            raise HTTPException(
                status_code=400,
                detail=f"File too large. Maximum size is 50MB. Got: {len(content) / 1024 / 1024:.2f}MB"
            )
        
        print(f"📊 [Backend] File size: {len(content) / 1024:.2f} KB")
        
        # Parse file based on extension
        try:
            if file_extension == 'csv' or file.content_type == 'text/csv':
                df = pd.read_csv(io.BytesIO(content))
            elif file_extension in ['xlsx', 'xls']:
                df = pd.read_excel(io.BytesIO(content))
            else:
                raise HTTPException(
                    status_code=400,
                    detail=f"Unsupported file format: {file_extension}"
                )
        except Exception as e:
            raise HTTPException(
                status_code=400,
                detail=f"Failed to parse file: {str(e)}"
            )
        
        # Validate DataFrame
        if df.empty:
            raise HTTPException(
                status_code=400,
                detail="File is empty or contains no data"
            )
        
        print(f"📊 [Backend] Parsed {len(df)} rows, {len(df.columns)} columns")
        
        # Normalize column names (lowercase, strip whitespace)
        df.columns = df.columns.str.lower().str.strip()
        
        # Validate required columns
        has_email = 'email' in df.columns
        has_phone = 'phone' in df.columns
        
        if not has_email and not has_phone:
            raise HTTPException(
                status_code=400,
                detail="File must contain at least one of: 'email' or 'phone' column"
            )
        
        print(f"✓ [Backend] Validation passed - has_email: {has_email}, has_phone: {has_phone}")
        
        # Get actual columns
        header_row = df.columns.tolist()
        row_count = len(df)
        
        # Generate unique file ID
        file_id = str(uuid.uuid4())
        
        # Save file to temporary storage
        temp_dir = "/tmp/b2c_campaigns"
        os.makedirs(temp_dir, exist_ok=True)
        
        # Save as CSV
        file_path = os.path.join(temp_dir, f"{file_id}.csv")
        df.to_csv(file_path, index=False)
        
        print(f"💾 [Backend] Saved to: {file_path}")
        
        # ✅ Create database record matching your AudienceFile model
        db_file = AudienceFile(
            id=file_id,
            org_id=org_id,
            storage_key=file_path,  # ✅ Required field
            filename=file.filename,  # ✅ Required field
            storage_provider="local",  # ✅ Required field (default)
            content_type=file.content_type,
            size_bytes=len(content),
            audience_name=audience_name,
            row_count=row_count,
            header_row=header_row,
            uploaded_by=uploaded_by,  # ✅ Using uploaded_by, not user_id
        )
        
        db.add(db_file)
        db.commit()
        db.refresh(db_file)
        
        print(f"✅ [Backend] Upload successful - file_id: {file_id}")
        
        # Return response matching frontend expectations
        return {
            "id": db_file.id,
            "org_id": db_file.org_id,
            "audience_name": db_file.audience_name,
            "file_url": db_file.storage_key,  # Frontend expects file_url
            "file_type": file_extension,
            "row_count": db_file.row_count,
            "header_row": db_file.header_row,
            "uploaded_at": db_file.uploaded_at.isoformat() if db_file.uploaded_at else None,
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ [Backend] Upload error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to upload file: {str(e)}"
        )


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

    # Also delete the physical file if it exists
    if db_file.storage_key and os.path.exists(db_file.storage_key):
        try:
            os.remove(db_file.storage_key)
        except Exception as e:
            print(f"Failed to delete file: {e}")

    db.delete(db_file)
    db.commit()
    return {"detail": "Audience file deleted"}