from fastapi import APIRouter, Depends, Header, Request, Query, HTTPException
from pydantic import BaseModel, Field, validator
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import select, func, and_, or_
from datetime import datetime
import uuid

from ..services.ticket_template_service import TicketTemplateService, TicketTemplateUsage, TicketTemplate
from ..db import get_db
from ..policies.auth import get_current_user
from ..schemas.ticket_templates import TemplateDetailResponse, TemplateResponse, CreateTemplateRequest, CreateTicketFromTemplateRequest,UpdateTemplateRequest

router = APIRouter(prefix="/ticket-templates", tags=["Ticket Templates"])



# ============================================================================
# TEMPLATE CRUD OPERATIONS
# ============================================================================

@router.get("/templates", response_model=List[TemplateResponse])
async def list_templates(
    org_id: str = Query(...),
    is_active: Optional[bool] = Query(None),
    search: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    List all ticket templates for an organization
    
    Query Parameters:
    - org_id: Organization ID (required)
    - is_active: Filter by active status
    - search: Search in name or description
    - skip: Pagination offset
    - limit: Maximum results per page
    """
    # Build query
    query = select(TicketTemplate).where(TicketTemplate.org_id == org_id)
    
    # Apply filters
    if is_active is not None:
        query = query.where(TicketTemplate.is_active == is_active)
    
    if search:
        search_term = f"%{search}%"
        query = query.where(
            or_(
                TicketTemplate.name.ilike(search_term),
                TicketTemplate.description.ilike(search_term)
            )
        )
    
    # Apply pagination and ordering
    query = query.order_by(TicketTemplate.created_at.desc())
    query = query.offset(skip).limit(limit)
    
    templates = db.scalars(query).all()
    
    return [
        TemplateResponse(
            template_id=t.template_id,
            name=t.name,
            description=t.description,
            is_active=t.is_active,
            usage_count=t.usage_count,
            last_used_at=t.last_used_at,
            created_at=t.created_at,
            updated_at=t.updated_at
        )
        for t in templates
    ]


@router.get("/templates/{template_id}", response_model=TemplateDetailResponse)
async def get_template(
    template_id: str,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Get detailed information about a specific template"""
    stmt = select(TicketTemplate).where(
        TicketTemplate.template_id == template_id,
        TicketTemplate.org_id == current_user.org_id
    )
    template = db.scalar(stmt)
    
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    return TemplateDetailResponse(
        template_id=template.template_id,
        name=template.name,
        description=template.description,
        api_key=template.api_key,
        subject_template=template.subject_template,
        description_template=template.description_template,
        default_priority=template.default_priority.value,
        default_severity=template.default_severity.value,
        default_status=template.default_status.value,
        default_assignee_id=template.default_assignee_id,
        default_team_id=template.default_team_id,
        default_group_id=template.default_group_id,
        default_category_id=template.default_category_id,
        default_subcategory_id=template.default_subcategory_id,
        default_feature_id=template.default_feature_id,
        default_impact_id=template.default_impact_id,
        default_sla_id=template.default_sla_id,
        default_tag_ids=template.default_tag_ids,
        allowed_variables=template.allowed_variables,
        validation_rules=template.validation_rules,
        default_custom_fields=template.default_custom_fields,
        meta=template.meta,
        is_active=template.is_active,
        usage_count=template.usage_count,
        last_used_at=template.last_used_at,
        created_at=template.created_at,
        updated_at=template.updated_at,
        created_by=template.created_by
    )


@router.post("/templates", status_code=201)
async def create_template(
    request: CreateTemplateRequest,
    db: Session = Depends(get_db),
    org_id: str = Query(...),
    x_user_id: str = Header(None, alias="X-User-Id")    # ✅ pick up user
):
    """
    Create a new ticket template
    Returns the created template with a generated API key
    """

    # ✅ Validate required fields
    if not x_user_id:
        raise HTTPException(
            status_code=400,
            detail="X-User-Id header required"
        )
    
    if not request.org_id:
        raise HTTPException(
            status_code=400,
            detail="org_id is required"
        )

    # ✅ Check duplicates
    existing = db.scalar(
        select(TicketTemplate).where(
            TicketTemplate.org_id == request.org_id,
            TicketTemplate.name == request.name
        )
    )

    if existing:
        raise HTTPException(
            status_code=409,
            detail=f"Template with name '{request.name}' already exists"
        )

    # ✅ Create new template
    template = TicketTemplate(
        template_id=f"tpl_{uuid.uuid4().hex[:16]}",
        org_id=org_id,
        name=request.name,
        description=request.description_template,
        api_key=TicketTemplate.generate_api_key(),
        subject_template=request.subject_template,
        description_template=request.description_template,
        default_priority=request.default_priority,
        default_severity=request.default_severity,
        default_status=getattr(request, "default_status", None),
        default_assignee_id=request.default_assignee_id,
        default_team_id=request.default_team_id,
        default_group_id=request.default_group_id,
        default_category_id=request.default_category_id,
        default_subcategory_id=request.default_subcategory_id,
        default_feature_id=getattr(request, "default_feature_id", None),
        default_impact_id=getattr(request, "default_impact_id", None),
        default_sla_id=getattr(request, "default_sla_id", None),
        default_tag_ids=request.default_tag_ids,
        allowed_variables=request.allowed_variables,
        validation_rules=request.validation_rules,
        default_custom_fields=request.default_custom_fields,
        meta=getattr(request, "meta", {}),
        is_active=getattr(request, "is_active", True),
        created_by=x_user_id
    )

    db.add(template)
    db.commit()
    db.refresh(template)

    return {
        "template_id": template.template_id,
        "name": template.name,
        "api_key": template.api_key,
        "is_active": template.is_active,
        "created_at": template.created_at,
        "message": "Template created successfully"
    }

@router.patch("/templates/{template_id}")
async def update_template(
    template_id: str,
    request: UpdateTemplateRequest,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Update an existing ticket template
    
    Only provided fields will be updated
    """
    # Get template
    stmt = select(TicketTemplate).where(
        TicketTemplate.template_id == template_id,
        TicketTemplate.org_id == current_user.org_id
    )
    template = db.scalar(stmt)
    
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    # Check for name conflict if name is being updated
    if request.name and request.name != template.name:
        existing = db.scalar(
            select(TicketTemplate).where(
                TicketTemplate.org_id == current_user.org_id,
                TicketTemplate.name == request.name,
                TicketTemplate.template_id != template_id
            )
        )
        if existing:
            raise HTTPException(
                status_code=409,
                detail=f"Template with name '{request.name}' already exists"
            )
    
    # Update fields
    update_data = request.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(template, field, value)
    
    template.updated_at = func.now()
    
    db.commit()
    db.refresh(template)
    
    return {
        "template_id": template.template_id,
        "name": template.name,
        "updated_at": template.updated_at,
        "message": "Template updated successfully"
    }


@router.delete("/templates/{template_id}", status_code=204)
async def delete_template(
    template_id: str,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Delete a ticket template
    
    This will also delete all associated usage logs
    """
    stmt = select(TicketTemplate).where(
        TicketTemplate.template_id == template_id,
    )
    template = db.scalar(stmt)
    
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    db.delete(template)
    db.commit()
    
    return None


@router.post("/templates/{template_id}/toggle")
async def toggle_template_status(
    template_id: str,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Toggle template active/inactive status"""
    stmt = select(TicketTemplate).where(
        TicketTemplate.template_id == template_id,
        TicketTemplate.org_id == current_user.org_id
    )
    template = db.scalar(stmt)
    
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    template.is_active = not template.is_active
    template.updated_at = func.now()
    
    db.commit()
    db.refresh(template)
    
    return {
        "template_id": template.template_id,
        "is_active": template.is_active,
        "message": f"Template {'activated' if template.is_active else 'deactivated'}"
    }


@router.post("/templates/{template_id}/regenerate-key")
async def regenerate_api_key(
    template_id: str,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Regenerate API key for a template
    
    ⚠️ Warning: This will invalidate the old API key
    """
    stmt = select(TicketTemplate).where(
        TicketTemplate.template_id == template_id,
        TicketTemplate.org_id == current_user.org_id
    )
    template = db.scalar(stmt)
    
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    # Generate new API key
    template.api_key = TicketTemplate.generate_api_key()
    template.updated_at = func.now()
    
    db.commit()
    db.refresh(template)
    
    return {
        "template_id": template.template_id,
        "api_key": template.api_key,
        "message": "API key regenerated successfully"
    }


# ============================================================================
# TICKET CREATION FROM TEMPLATE
# ============================================================================

@router.post("/create-ticket")
async def create_ticket_from_template(
    request: CreateTicketFromTemplateRequest,
    req: Request,
    db: Session = Depends(get_db),
    x_api_key: str = Header(..., alias="X-API-Key")
):
    """
    Create a ticket from a predefined template using API key
    
    Headers:
        X-API-Key: Your template API key
    
    Body:
        requester_id: User ID creating the ticket
        variables: Dictionary of variables to substitute in templates
        overrides: Dictionary of fields to override template defaults
    """
    # Get template by API key
    template = TicketTemplateService.get_template_by_api_key(db, x_api_key)
    if not template:
        raise HTTPException(401, detail="Invalid or inactive API key")
    
    # Gather request metadata
    request_meta = {
        "ip_address": req.client.host if req.client else None,
        "user_agent": req.headers.get("user-agent"),
    }
    
    try:
        # Create ticket from template
        ticket = TicketTemplateService.create_ticket_from_template(
            db=db,
            template=template,
            requester_id=request.requester_id,
            variables=request.variables,
            overrides=request.overrides,
            request_meta=request_meta
        )
        
        return {
            "ticket_id": ticket.ticket_id,
            "number": ticket.number,
            "subject": ticket.subject,
            "status": ticket.status,
            "priority": ticket.priority,
            "severity": ticket.severity,
            "created_at": ticket.created_at,
            "message": "Ticket created successfully from template"
        }
    
    except HTTPException:
        raise
    except Exception as e:
        # Log failed usage
        usage = TicketTemplateUsage(
            usage_id=f"tplu_{uuid.uuid4().hex[:16]}",
            template_id=template.template_id,
            provided_variables=request.variables,
            success=False,
            error_message=str(e),
            created_by=request.requester_id,
            ip_address=request_meta.get("ip_address"),
            user_agent=request_meta.get("user_agent")
        )
        db.add(usage)
        db.commit()
        
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create ticket: {str(e)}"
        )


# ============================================================================
# TEMPLATE ANALYTICS & STATS
# ============================================================================

@router.get("/templates/{template_id}/stats")
async def get_template_stats(
    template_id: str,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Get usage statistics for a template"""
    stmt = select(TicketTemplate).where(
        TicketTemplate.template_id == template_id,
        TicketTemplate.org_id == current_user.org_id
    )
    template = db.scalar(stmt)
    
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    # Get usage stats
    total_uses = db.scalar(
        select(func.count(TicketTemplateUsage.usage_id))
        .where(TicketTemplateUsage.template_id == template_id)
    ) or 0
    
    successful_uses = db.scalar(
        select(func.count(TicketTemplateUsage.usage_id))
        .where(
            TicketTemplateUsage.template_id == template_id,
            TicketTemplateUsage.success == True
        )
    ) or 0
    
    failed_uses = total_uses - successful_uses
    
    # Get recent usage
    recent_usage_stmt = (
        select(TicketTemplateUsage)
        .where(TicketTemplateUsage.template_id == template_id)
        .order_by(TicketTemplateUsage.created_at.desc())
        .limit(10)
    )
    recent_usage = db.scalars(recent_usage_stmt).all()
    
    return {
        "template_id": template.template_id,
        "name": template.name,
        "is_active": template.is_active,
        "usage_count": template.usage_count,
        "last_used_at": template.last_used_at,
        "stats": {
            "total_uses": total_uses,
            "successful_uses": successful_uses,
            "failed_uses": failed_uses,
            "success_rate": (successful_uses / total_uses * 100) if total_uses > 0 else 0
        },
        "recent_usage": [
            {
                "usage_id": u.usage_id,
                "ticket_id": u.ticket_id,
                "success": u.success,
                "error_message": u.error_message,
                "created_at": u.created_at,
                "created_by": u.created_by
            }
            for u in recent_usage
        ]
    }


@router.get("/templates/{template_id}/usage-logs")
async def get_template_usage_logs(
    template_id: str,
    success: Optional[bool] = Query(None),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Get detailed usage logs for a template"""
    # Verify template exists and belongs to org
    template_stmt = select(TicketTemplate).where(
        TicketTemplate.template_id == template_id,
        TicketTemplate.org_id == current_user.org_id
    )
    template = db.scalar(template_stmt)
    
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    # Build query
    query = select(TicketTemplateUsage).where(
        TicketTemplateUsage.template_id == template_id
    )
    
    # Apply filters
    if success is not None:
        query = query.where(TicketTemplateUsage.success == success)
    
    if start_date:
        query = query.where(TicketTemplateUsage.created_at >= start_date)
    
    if end_date:
        query = query.where(TicketTemplateUsage.created_at <= end_date)
    
    # Get total count
    count_query = select(func.count()).select_from(query.subquery())
    total = db.scalar(count_query) or 0
    
    # Apply pagination
    query = query.order_by(TicketTemplateUsage.created_at.desc())
    query = query.offset(skip).limit(limit)
    
    logs = db.scalars(query).all()
    
    return {
        "total": total,
        "skip": skip,
        "limit": limit,
        "logs": [
            {
                "usage_id": log.usage_id,
                "ticket_id": log.ticket_id,
                "created_by": log.created_by,
                "success": log.success,
                "error_message": log.error_message,
                "provided_variables": log.provided_variables,
                "ip_address": log.ip_address,
                "user_agent": log.user_agent,
                "created_at": log.created_at
            }
            for log in logs
        ]
    }


@router.post("/templates/{template_id}/duplicate")
async def duplicate_template(
    template_id: str,
    new_name: str = Query(..., description="Name for the duplicated template"),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Create a copy of an existing template"""
    # Get original template
    stmt = select(TicketTemplate).where(
        TicketTemplate.template_id == template_id,
        TicketTemplate.org_id == current_user.org_id
    )
    original = db.scalar(stmt)
    
    if not original:
        raise HTTPException(status_code=404, detail="Template not found")
    
    # Check for duplicate name
    existing = db.scalar(
        select(TicketTemplate).where(
            TicketTemplate.org_id == current_user.org_id,
            TicketTemplate.name == new_name
        )
    )
    if existing:
        raise HTTPException(
            status_code=409,
            detail=f"Template with name '{new_name}' already exists"
        )
    
    # Create duplicate
    duplicate = TicketTemplate(
        template_id=f"tpl_{uuid.uuid4().hex[:16]}",
        org_id=current_user.org_id,
        name=new_name,
        description=original.description,
        api_key=TicketTemplate.generate_api_key(),
        subject_template=original.subject_template,
        description_template=original.description_template,
        default_priority=original.default_priority,
        default_severity=original.default_severity,
        default_status=original.default_status,
        default_assignee_id=original.default_assignee_id,
        default_team_id=original.default_team_id,
        default_group_id=original.default_group_id,
        default_category_id=original.default_category_id,
        default_subcategory_id=original.default_subcategory_id,
        default_feature_id=original.default_feature_id,
        default_impact_id=original.default_impact_id,
        default_sla_id=original.default_sla_id,
        default_tag_ids=original.default_tag_ids.copy(),
        allowed_variables=original.allowed_variables.copy(),
        validation_rules=original.validation_rules.copy(),
        default_custom_fields=original.default_custom_fields.copy(),
        meta=original.meta.copy(),
        is_active=True,
        created_by=current_user.user_id
    )
    
    db.add(duplicate)
    db.commit()
    db.refresh(duplicate)
    
    return {
        "template_id": duplicate.template_id,
        "name": duplicate.name,
        "api_key": duplicate.api_key,
        "message": "Template duplicated successfully"
    }