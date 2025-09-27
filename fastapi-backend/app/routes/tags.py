

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from ..db import get_db
from ..models.tickets import Tag
from ..schemas.tickets import TagOut, TagCreate, TagUpdate

router = APIRouter(prefix="/tags", tags=["Tags"])

@router.get("/", response_model=List[TagOut])
def list_tags(
    org_id: str = Query(...),
    category: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db)
):
    """List all tags for an organization"""
    query = db.query(Tag).filter(Tag.org_id == org_id)
    
    if category:
        query = query.filter(Tag.category == category)
    
    if search:
        search_term = f"%{search.lower()}%"
        query = query.filter(
            Tag.name.ilike(search_term) | 
            Tag.description.ilike(search_term)
        )
    
    tags = query.order_by(Tag.usage_count.desc(), Tag.name).limit(limit).all()
    return tags

@router.post("/", response_model=TagOut, status_code=201)
def create_tag(tag: TagCreate, db: Session = Depends(get_db)):
    """Create a new tag"""
    import uuid
    
    tag_id = tag.tag_id or f"tag_{uuid.uuid4().hex[:8]}"
    
    # Check if tag already exists
    existing = db.query(Tag).filter(
        Tag.org_id == tag.org_id,
        Tag.name == tag.name
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail="Tag with this name already exists")
    
    # Generate default color if not provided
    if not tag.color:
        import hashlib
        color_hash = hashlib.md5(tag.name.encode()).hexdigest()[:6]
        tag.color = f"#{color_hash}"

    new_tag = Tag(
        tag_id=tag_id,
        org_id=tag.org_id,
        name=tag.name,
        color=tag.color,
        description=tag.description,
        category=tag.category,
        usage_count=0
    )
    
    db.add(new_tag)
    db.commit()
    db.refresh(new_tag)
    
    return new_tag

@router.get("/categories", response_model=List[str])
def list_tag_categories(
    org_id: str = Query(...),
    db: Session = Depends(get_db)
):
    """Get all tag categories for an organization"""
    categories = db.query(Tag.category).filter(
        Tag.org_id == org_id,
        Tag.category.isnot(None)
    ).distinct().all()
    
    return [cat[0] for cat in categories if cat[0]]