# app/routers/tags.py
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import func, or_, desc, and_
from typing import List, Optional, Dict, Any
import uuid
import hashlib

from ..db import get_db
from ..models.tickets import Tag, ticket_tags, Ticket
from ..schemas.tickets import TagOut, TagCreate, TagUpdate

router = APIRouter(prefix="/tags", tags=["Tags"])


# ==================== COUNT & STATS ====================

@router.get("/count")
def count_tags(
    org_id: str = Query(..., description="Organization ID"),
    category: Optional[str] = Query(None, description="Filter by category"),
    include_categories: bool = Query(False, description="Include breakdown by category"),
    db: Session = Depends(get_db)
):
    """
    Count total tags for an organization
    
    - **org_id**: Organization ID (required)
    - **category**: Optional filter by category
    - **include_categories**: Include category breakdown
    """
    query = db.query(Tag).filter(Tag.org_id == org_id)
    
    if category:
        query = query.filter(Tag.category == category)
    
    total_count = query.count()
    
    result = {
        "count": total_count,
        "org_id": org_id
    }
    
    if include_categories:
        category_counts = db.query(
            Tag.category,
            func.count(Tag.tag_id).label('count')
        ).filter(
            Tag.org_id == org_id,
            Tag.category.isnot(None)
        ).group_by(Tag.category).all()
        
        result["by_category"] = {
            cat: count for cat, count in category_counts
        }
        
        # Also include uncategorized count
        uncategorized = db.query(Tag).filter(
            Tag.org_id == org_id,
            Tag.category.is_(None)
        ).count()
        
        if uncategorized > 0:
            result["by_category"]["uncategorized"] = uncategorized
    
    return result


@router.get("/stats")
def get_tag_stats(
    org_id: str = Query(..., description="Organization ID"),
    db: Session = Depends(get_db)
):
    """
    Get comprehensive statistics about tags
    
    - Total tags
    - Most used tags
    - Tags by category
    - Usage distribution
    """
    # Total tags
    total = db.query(Tag).filter(Tag.org_id == org_id).count()
    
    # Most used tags
    most_used = db.query(Tag).filter(
        Tag.org_id == org_id
    ).order_by(desc(Tag.usage_count)).limit(10).all()
    
    # Tags by category
    by_category = db.query(
        Tag.category,
        func.count(Tag.tag_id).label('count')
    ).filter(
        Tag.org_id == org_id
    ).group_by(Tag.category).all()
    
    # Unused tags
    unused = db.query(Tag).filter(
        Tag.org_id == org_id,
        Tag.usage_count == 0
    ).count()
    
    return {
        "total_tags": total,
        "unused_tags": unused,
        "most_used": [
            {
                "tag_id": tag.tag_id,
                "name": tag.name,
                "usage_count": tag.usage_count,
                "color": tag.color
            }
            for tag in most_used
        ],
        "by_category": {
            cat or "uncategorized": count 
            for cat, count in by_category
        }
    }


# ==================== CATEGORIES ====================

@router.get("/categories")
def list_tag_categories(
    org_id: str = Query(..., description="Organization ID"),
    include_counts: bool = Query(False, description="Include tag count per category"),
    db: Session = Depends(get_db)
):
    """
    Get all tag categories for an organization
    
    - **org_id**: Organization ID (required)
    - **include_counts**: Include number of tags per category
    """
    if include_counts:
        categories = db.query(
            Tag.category,
            func.count(Tag.tag_id).label('count')
        ).filter(
            Tag.org_id == org_id,
            Tag.category.isnot(None)
        ).group_by(Tag.category).order_by(Tag.category).all()
        
        return [
            {"name": cat, "count": count}
            for cat, count in categories
        ]
    else:
        categories = db.query(Tag.category).filter(
            Tag.org_id == org_id,
            Tag.category.isnot(None)
        ).distinct().order_by(Tag.category).all()
        
        return [cat[0] for cat in categories if cat[0]]


# ==================== LIST & SEARCH ====================

@router.get("/", response_model=List[TagOut])
def list_tags(
    org_id: str = Query(..., description="Organization ID"),
    category: Optional[str] = Query(None, description="Filter by category"),
    search: Optional[str] = Query(None, description="Search in name and description"),
    sort_by: str = Query("usage", description="Sort by: usage, name, created"),
    sort_order: str = Query("desc", description="Sort order: asc, desc"),
    include_unused: bool = Query(True, description="Include tags with 0 usage"),
    limit: int = Query(100, ge=1, le=500, description="Max results"),
    offset: int = Query(0, ge=0, description="Offset for pagination"),
    db: Session = Depends(get_db)
):
    """
    List all tags for an organization with filtering and sorting
    
    - **org_id**: Organization ID (required)
    - **category**: Filter by category
    - **search**: Search term (searches in name and description)
    - **sort_by**: Sort field (usage, name, created)
    - **sort_order**: asc or desc
    - **include_unused**: Include tags with no usage
    - **limit**: Maximum number of results
    - **offset**: Pagination offset
    """
    query = db.query(Tag).filter(Tag.org_id == org_id)
    
    # Filter by category
    if category:
        if category.lower() == "uncategorized":
            query = query.filter(Tag.category.is_(None))
        else:
            query = query.filter(Tag.category == category)
    
    # Search filter
    if search:
        search_term = f"%{search.lower()}%"
        query = query.filter(
            or_(
                Tag.name.ilike(search_term),
                Tag.description.ilike(search_term)
            )
        )
    
    # Exclude unused tags if requested
    if not include_unused:
        query = query.filter(Tag.usage_count > 0)
    
    # Sorting
    if sort_by == "usage":
        sort_col = Tag.usage_count
    elif sort_by == "name":
        sort_col = Tag.name
    elif sort_by == "created":
        sort_col = Tag.created_at
    else:
        sort_col = Tag.usage_count
    
    if sort_order.lower() == "asc":
        query = query.order_by(sort_col.asc())
    else:
        query = query.order_by(sort_col.desc())
    
    # Secondary sort by name for consistency
    query = query.order_by(Tag.name)
    
    # Pagination
    tags = query.offset(offset).limit(limit).all()
    
    return tags


# ==================== SINGLE TAG OPERATIONS ====================

@router.get("/{tag_id}", response_model=TagOut)
def get_tag(
    tag_id: str,
    org_id: str = Query(..., description="Organization ID"),
    db: Session = Depends(get_db)
):
    """
    Get a single tag by ID
    
    - **tag_id**: Tag ID
    - **org_id**: Organization ID for security
    """
    tag = db.query(Tag).filter(
        Tag.tag_id == tag_id,
        Tag.org_id == org_id
    ).first()
    
    if not tag:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Tag {tag_id} not found"
        )
    
    return tag


@router.post("/", response_model=TagOut, status_code=status.HTTP_201_CREATED)
def create_tag(
    tag: TagCreate,
    db: Session = Depends(get_db)
):
    """
    Create a new tag
    
    - **name**: Tag name (required, unique per org)
    - **color**: Hex color code (auto-generated if not provided)
    - **description**: Optional description
    - **category**: Optional category
    """
    # Generate tag_id if not provided
    tag_id = tag.tag_id or f"tag_{uuid.uuid4().hex[:12]}"
    
    # Check if tag already exists
    existing = db.query(Tag).filter(
        Tag.org_id == tag.org_id,
        Tag.name == tag.name
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Tag with name '{tag.name}' already exists"
        )
    
    # Generate default color if not provided
    color = tag.color
    if not color:
        # Generate color from tag name hash
        color_hash = hashlib.md5(tag.name.encode()).hexdigest()[:6]
        color = f"#{color_hash}"

    new_tag = Tag(
        tag_id=tag_id,
        org_id=tag.org_id,
        name=tag.name,
        color=color,
        description=tag.description,
        category=tag.category,
        usage_count=0,
        meta=tag.meta or {}
    )
    
    db.add(new_tag)
    db.commit()
    db.refresh(new_tag)
    
    return new_tag


@router.put("/{tag_id}", response_model=TagOut)
def update_tag(
    tag_id: str,
    tag_update: TagUpdate,
    org_id: str = Query(..., description="Organization ID"),
    db: Session = Depends(get_db)
):
    """
    Update an existing tag
    
    - **tag_id**: Tag ID to update
    - **org_id**: Organization ID for security
    """
    tag = db.query(Tag).filter(
        Tag.tag_id == tag_id,
        Tag.org_id == org_id
    ).first()
    
    if not tag:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Tag {tag_id} not found"
        )
    
    # Check name uniqueness if name is being changed
    if tag_update.name and tag_update.name != tag.name:
        existing = db.query(Tag).filter(
            Tag.org_id == org_id,
            Tag.name == tag_update.name,
            Tag.tag_id != tag_id
        ).first()
        
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Tag with name '{tag_update.name}' already exists"
            )
    
    # Update fields
    update_data = tag_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(tag, field, value)
    
    db.commit()
    db.refresh(tag)
    
    return tag


@router.patch("/{tag_id}/category")
def update_tag_category(
    tag_id: str,
    category: Optional[str],
    org_id: str = Query(..., description="Organization ID"),
    db: Session = Depends(get_db)
):
    """
    Update only the category of a tag
    
    - **tag_id**: Tag ID
    - **category**: New category (null to remove)
    - **org_id**: Organization ID
    """
    tag = db.query(Tag).filter(
        Tag.tag_id == tag_id,
        Tag.org_id == org_id
    ).first()
    
    if not tag:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Tag {tag_id} not found"
        )
    
    tag.category = category
    db.commit()
    
    return {"message": "Category updated", "tag_id": tag_id, "category": category}


@router.delete("/{tag_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_tag(
    tag_id: str,
    org_id: str = Query(..., description="Organization ID"),
    force: bool = Query(False, description="Force delete even if in use"),
    db: Session = Depends(get_db)
):
    """
    Delete a tag
    
    - **tag_id**: Tag ID to delete
    - **org_id**: Organization ID for security
    - **force**: Force delete even if tag is being used
    """
    tag = db.query(Tag).filter(
        Tag.tag_id == tag_id,
        Tag.org_id == org_id
    ).first()
    
    if not tag:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Tag {tag_id} not found"
        )
    
    # Check if tag is in use
    if tag.usage_count > 0 and not force:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Tag is being used by {tag.usage_count} tickets. Use force=true to delete anyway."
        )
    
    db.delete(tag)
    db.commit()
    
    return None


# ==================== BULK OPERATIONS ====================

@router.post("/bulk-create", response_model=List[TagOut])
def bulk_create_tags(
    tags: List[TagCreate],
    skip_existing: bool = Query(True, description="Skip tags that already exist"),
    db: Session = Depends(get_db)
):
    """
    Create multiple tags at once
    
    - **tags**: List of tags to create
    - **skip_existing**: Skip tags with duplicate names instead of failing
    """
    if not tags:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No tags provided"
        )
    
    org_id = tags[0].org_id
    created_tags = []
    skipped = []
    
    for tag_data in tags:
        # Check if exists
        existing = db.query(Tag).filter(
            Tag.org_id == tag_data.org_id,
            Tag.name == tag_data.name
        ).first()
        
        if existing:
            if skip_existing:
                skipped.append(tag_data.name)
                continue
            else:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Tag '{tag_data.name}' already exists"
                )
        
        # Generate color if not provided
        color = tag_data.color
        if not color:
            color_hash = hashlib.md5(tag_data.name.encode()).hexdigest()[:6]
            color = f"#{color_hash}"
        
        new_tag = Tag(
            tag_id=f"tag_{uuid.uuid4().hex[:12]}",
            org_id=tag_data.org_id,
            name=tag_data.name,
            color=color,
            description=tag_data.description,
            category=tag_data.category,
            usage_count=0,
            meta=tag_data.meta or {}
        )
        
        db.add(new_tag)
        created_tags.append(new_tag)
    
    db.commit()
    
    for tag in created_tags:
        db.refresh(tag)
    
    return created_tags


@router.delete("/bulk-delete")
def bulk_delete_tags(
    tag_ids: List[str],
    org_id: str = Query(..., description="Organization ID"),
    force: bool = Query(False, description="Force delete even if in use"),
    db: Session = Depends(get_db)
):
    """
    Delete multiple tags at once
    
    - **tag_ids**: List of tag IDs to delete
    - **org_id**: Organization ID for security
    - **force**: Force delete even if tags are in use
    """
    if not tag_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No tag IDs provided"
        )
    
    # Get all tags
    tags = db.query(Tag).filter(
        Tag.tag_id.in_(tag_ids),
        Tag.org_id == org_id
    ).all()
    
    if not tags:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No tags found with provided IDs"
        )
    
    # Check usage
    if not force:
        in_use = [tag for tag in tags if tag.usage_count > 0]
        if in_use:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"{len(in_use)} tags are in use. Use force=true to delete anyway."
            )
    
    deleted_count = len(tags)
    
    for tag in tags:
        db.delete(tag)
    
    db.commit()
    
    return {
        "message": f"Deleted {deleted_count} tags",
        "deleted_count": deleted_count
    }


# ==================== TAG USAGE ====================

@router.get("/{tag_id}/tickets")
def get_tag_tickets(
    tag_id: str,
    org_id: str = Query(..., description="Organization ID"),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db)
):
    """
    Get all tickets that have this tag
    
    - **tag_id**: Tag ID
    - **org_id**: Organization ID for security
    - **limit**: Maximum results
    - **offset**: Pagination offset
    """
    tag = db.query(Tag).filter(
        Tag.tag_id == tag_id,
        Tag.org_id == org_id
    ).first()
    
    if not tag:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Tag {tag_id} not found"
        )
    
    # Get tickets with this tag
    tickets = db.query(Ticket).join(
        ticket_tags,
        Ticket.ticket_id == ticket_tags.c.ticket_id
    ).filter(
        ticket_tags.c.tag_id == tag_id,
        Ticket.org_id == org_id
    ).offset(offset).limit(limit).all()
    
    return {
        "tag_id": tag_id,
        "tag_name": tag.name,
        "total_tickets": tag.usage_count,
        "tickets": [
            {
                "ticket_id": t.ticket_id,
                "number": t.number,
                "subject": t.subject,
                "status": t.status.value,
                "priority": t.priority.value
            }
            for t in tickets
        ]
    }


@router.post("/{tag_id}/recalculate-usage")
def recalculate_tag_usage(
    tag_id: str,
    org_id: str = Query(..., description="Organization ID"),
    db: Session = Depends(get_db)
):
    """
    Recalculate the usage count for a tag
    
    - **tag_id**: Tag ID
    - **org_id**: Organization ID for security
    """
    tag = db.query(Tag).filter(
        Tag.tag_id == tag_id,
        Tag.org_id == org_id
    ).first()
    
    if not tag:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Tag {tag_id} not found"
        )
    
    # Count actual usage
    actual_count = db.query(ticket_tags).filter(
        ticket_tags.c.tag_id == tag_id
    ).count()
    
    old_count = tag.usage_count
    tag.usage_count = actual_count
    
    db.commit()
    
    return {
        "tag_id": tag_id,
        "old_usage_count": old_count,
        "new_usage_count": actual_count,
        "difference": actual_count - old_count
    }


@router.post("/recalculate-all-usage")
def recalculate_all_usage(
    org_id: str = Query(..., description="Organization ID"),
    db: Session = Depends(get_db)
):
    """
    Recalculate usage counts for all tags in an organization
    
    - **org_id**: Organization ID
    """
    tags = db.query(Tag).filter(Tag.org_id == org_id).all()
    
    updated_count = 0
    
    for tag in tags:
        actual_count = db.query(ticket_tags).filter(
            ticket_tags.c.tag_id == tag.tag_id
        ).count()
        
        if tag.usage_count != actual_count:
            tag.usage_count = actual_count
            updated_count += 1
    
    db.commit()
    
    return {
        "message": f"Recalculated usage for {len(tags)} tags",
        "total_tags": len(tags),
        "updated_tags": updated_count
    }


# ==================== TAG MERGING ====================

@router.post("/merge")
def merge_tags(
    source_tag_ids: List[str],
    target_tag_id: str,
    org_id: str = Query(..., description="Organization ID"),
    delete_source: bool = Query(True, description="Delete source tags after merge"),
    db: Session = Depends(get_db)
):
    """
    Merge multiple tags into one target tag
    
    - **source_tag_ids**: Tags to merge from
    - **target_tag_id**: Tag to merge into
    - **org_id**: Organization ID for security
    - **delete_source**: Delete source tags after merging
    """
    # Validate target tag
    target_tag = db.query(Tag).filter(
        Tag.tag_id == target_tag_id,
        Tag.org_id == org_id
    ).first()
    
    if not target_tag:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Target tag {target_tag_id} not found"
        )
    
    # Validate source tags
    source_tags = db.query(Tag).filter(
        Tag.tag_id.in_(source_tag_ids),
        Tag.org_id == org_id
    ).all()
    
    if not source_tags:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No source tags found"
        )
    
    # Get all tickets with source tags
    affected_tickets = db.query(Ticket.ticket_id).join(
        ticket_tags,
        Ticket.ticket_id == ticket_tags.c.ticket_id
    ).filter(
        ticket_tags.c.tag_id.in_(source_tag_ids),
        Ticket.org_id == org_id
    ).distinct().all()
    
    merged_count = 0
    
    # For each affected ticket, replace source tags with target tag
    for (ticket_id,) in affected_tickets:
        # Remove all source tags from this ticket
        db.execute(
            ticket_tags.delete().where(
                and_(
                    ticket_tags.c.ticket_id == ticket_id,
                    ticket_tags.c.tag_id.in_(source_tag_ids)
                )
            )
        )
        
        # Check if target tag already exists on this ticket
        existing = db.execute(
            ticket_tags.select().where(
                and_(
                    ticket_tags.c.ticket_id == ticket_id,
                    ticket_tags.c.tag_id == target_tag_id
                )
            )
        ).first()
        
        # Add target tag if not already present
        if not existing:
            db.execute(
                ticket_tags.insert().values(
                    ticket_id=ticket_id,
                    tag_id=target_tag_id
                )
            )
            merged_count += 1
    
    # Update usage counts
    target_tag.usage_count = db.query(ticket_tags).filter(
        ticket_tags.c.tag_id == target_tag_id
    ).count()
    
    # Delete source tags if requested
    if delete_source:
        for tag in source_tags:
            db.delete(tag)
    else:
        # Reset usage counts
        for tag in source_tags:
            tag.usage_count = 0
    
    db.commit()
    
    return {
        "message": "Tags merged successfully",
        "source_tags": len(source_tags),
        "affected_tickets": len(affected_tickets),
        "merged_count": merged_count,
        "target_tag": {
            "tag_id": target_tag.tag_id,
            "name": target_tag.name,
            "usage_count": target_tag.usage_count
        },
        "source_deleted": delete_source
    }


# ==================== CLEANUP ====================

@router.delete("/cleanup-unused")
def cleanup_unused_tags(
    org_id: str = Query(..., description="Organization ID"),
    older_than_days: int = Query(30, ge=0, description="Delete tags unused for N days"),
    db: Session = Depends(get_db)
):
    """
    Delete all unused tags (usage_count = 0) older than specified days
    
    - **org_id**: Organization ID
    - **older_than_days**: Delete tags created more than N days ago with 0 usage
    """
    from datetime import datetime, timedelta
    
    cutoff_date = datetime.utcnow() - timedelta(days=older_than_days)
    
    unused_tags = db.query(Tag).filter(
        Tag.org_id == org_id,
        Tag.usage_count == 0,
        Tag.created_at < cutoff_date
    ).all()
    
    deleted_count = len(unused_tags)
    
    for tag in unused_tags:
        db.delete(tag)
    
    db.commit()
    
    return {
        "message": f"Deleted {deleted_count} unused tags",
        "deleted_count": deleted_count,
        "criteria": {
            "usage_count": 0,
            "older_than_days": older_than_days
        }
    }