# ============================================
# FASTAPI ROUTES - app/routers/ticket_categories.py
# ============================================

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, selectinload
from sqlalchemy import select, func
from typing import List, Optional
import uuid

from ..db import get_db
from ..models.ticket_categories import TicketCategory, TicketSubcategory, TicketProduct
from ..schemas.ticket_categories import (
    CategoryCreate, CategoryUpdate, CategoryOut, CategoryWithSubcategories,
    SubcategoryCreate, SubcategoryUpdate, SubcategoryOut,
    ProductCreate, ProductUpdate, ProductOut
)
from ..services.redis_category_service import RedisCategoryService

router = APIRouter(prefix="/ticket-categories", tags=["Ticket Categories"])

# ==================== CATEGORIES ====================

@router.get("/categories", response_model=List[CategoryOut])
def list_categories(
    org_id: str = Query(...),
    include_inactive: bool = Query(False),
    db: Session = Depends(get_db)
):
    """List all categories for an organization"""
    # Try cache first
    if not include_inactive:
        cached = RedisCategoryService.get_categories_by_org(org_id)
        if cached is not None:
            return cached
    
    query = select(TicketCategory).where(TicketCategory.org_id == org_id)
    
    if not include_inactive:
        query = query.where(TicketCategory.active == True)
    
    query = query.order_by(TicketCategory.display_order, TicketCategory.name)
    
    categories = db.execute(query).scalars().all()
    
    # Add subcategory count
    result = []
    for cat in categories:
        cat_dict = CategoryOut.model_validate(cat, from_attributes=True).model_dump()
        # Count subcategories
        subcat_count = db.execute(
            select(func.count(TicketSubcategory.subcategory_id))
            .where(
                TicketSubcategory.category_id == cat.category_id,
                TicketSubcategory.active == True
            )
        ).scalar()
        cat_dict['subcategory_count'] = subcat_count or 0
        result.append(cat_dict)
    
    # Cache result
    if not include_inactive:
        RedisCategoryService.cache_categories_by_org(org_id, result)
    
    return result


@router.get("/categories/{category_id}", response_model=CategoryWithSubcategories)
def get_category(
    category_id: str,
    include_subcategories: bool = Query(True),
    db: Session = Depends(get_db)
):
    """Get a single category with optional subcategories"""
    # Try cache first
    if include_subcategories:
        cached = RedisCategoryService.get_category_with_subcategories(category_id)
        if cached is not None:
            return cached
    else:
        cached = RedisCategoryService.get_category(category_id)
        if cached is not None:
            return cached
    
    if include_subcategories:
        category = db.execute(
            select(TicketCategory)
            .options(selectinload(TicketCategory.subcategories))
            .where(TicketCategory.category_id == category_id)
        ).scalar_one_or_none()
    else:
        category = db.get(TicketCategory, category_id)
    
    if not category:
        raise HTTPException(404, "Category not found")
    
    if include_subcategories:
        # Filter active subcategories and sort
        active_subs = [
            sub for sub in category.subcategories 
            if sub.active
        ]
        active_subs.sort(key=lambda x: (x.display_order, x.name))
        
        cat_dict = CategoryOut.model_validate(category, from_attributes=True).model_dump()
        cat_dict['subcategory_count'] = len(active_subs)
        cat_dict['subcategories'] = [
            SubcategoryOut.model_validate(sub, from_attributes=True).model_dump()
            for sub in active_subs
        ]
        
        # Cache result
        RedisCategoryService.cache_category_with_subcategories(category_id, cat_dict)
        return cat_dict
    else:
        cat_dict = CategoryOut.model_validate(category, from_attributes=True).model_dump()
        # Get subcategory count
        subcat_count = db.execute(
            select(func.count(TicketSubcategory.subcategory_id))
            .where(
                TicketSubcategory.category_id == category_id,
                TicketSubcategory.active == True
            )
        ).scalar()
        cat_dict['subcategory_count'] = subcat_count or 0
        
        # Cache result
        RedisCategoryService.cache_category(category_id, cat_dict)
        return cat_dict


@router.post("/categories", response_model=CategoryOut, status_code=201)
def create_category(payload: CategoryCreate, db: Session = Depends(get_db)):
    """Create a new category"""
    category_id = payload.category_id or f"cat_{uuid.uuid4().hex[:10]}"
    
    category = TicketCategory(
        category_id=category_id,
        org_id=payload.org_id,
        name=payload.name,
        description=payload.description,
        icon=payload.icon,
        color=payload.color,
        display_order=payload.display_order,
        meta=payload.meta,
        active=True
    )
    
    db.add(category)
    db.commit()
    db.refresh(category)
    
    # Invalidate caches
    RedisCategoryService.invalidate_category_caches(category_id, payload.org_id)
    
    cat_dict = CategoryOut.model_validate(category, from_attributes=True).model_dump()
    cat_dict['subcategory_count'] = 0
    return cat_dict


@router.patch("/categories/{category_id}", response_model=CategoryOut)
def update_category(
    category_id: str,
    payload: CategoryUpdate,
    db: Session = Depends(get_db)
):
    """Update a category"""
    category = db.get(TicketCategory, category_id)
    if not category:
        raise HTTPException(404, "Category not found")
    
    # Update fields
    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(category, field, value)
    
    db.commit()
    db.refresh(category)
    
    # Invalidate caches
    RedisCategoryService.invalidate_category_caches(category_id, category.org_id)
    
    # Get subcategory count
    subcat_count = db.execute(
        select(func.count(TicketSubcategory.subcategory_id))
        .where(
            TicketSubcategory.category_id == category_id,
            TicketSubcategory.active == True
        )
    ).scalar()
    
    cat_dict = CategoryOut.model_validate(category, from_attributes=True).model_dump()
    cat_dict['subcategory_count'] = subcat_count or 0
    return cat_dict


@router.delete("/categories/{category_id}", status_code=204)
def delete_category(category_id: str, db: Session = Depends(get_db)):
    """Soft delete a category"""
    category = db.get(TicketCategory, category_id)
    if not category:
        raise HTTPException(404, "Category not found")
    
    # Soft delete category and all subcategories
    category.active = False
    
    # Also deactivate all subcategories
    db.execute(
        select(TicketSubcategory)
        .where(TicketSubcategory.category_id == category_id)
    ).scalars().all()
    
    for sub in category.subcategories:
        sub.active = False
    
    db.commit()
    
    # Invalidate caches
    RedisCategoryService.invalidate_category_caches(category_id, category.org_id)
    
    return None


# ==================== SUBCATEGORIES ====================

@router.get("/subcategories", response_model=List[SubcategoryOut])
def list_subcategories(
    org_id: Optional[str] = Query(None),
    category_id: Optional[str] = Query(None),
    include_inactive: bool = Query(False),
    db: Session = Depends(get_db)
):
    """List subcategories by org or category"""
    if not org_id and not category_id:
        raise HTTPException(400, "Either org_id or category_id must be provided")
    
    # Try cache first
    if not include_inactive:
        if category_id:
            cached = RedisCategoryService.get_subcategories_by_category(category_id)
            if cached is not None:
                return cached
        elif org_id:
            cached = RedisCategoryService.get_subcategories_by_org(org_id)
            if cached is not None:
                return cached
    
    query = select(TicketSubcategory)
    
    if category_id:
        query = query.where(TicketSubcategory.category_id == category_id)
    elif org_id:
        query = query.where(TicketSubcategory.org_id == org_id)
    
    if not include_inactive:
        query = query.where(TicketSubcategory.active == True)
    
    query = query.order_by(TicketSubcategory.display_order, TicketSubcategory.name)
    
    subcategories = db.execute(query).scalars().all()
    result = [SubcategoryOut.model_validate(sub, from_attributes=True).model_dump() for sub in subcategories]
    
    # Cache result
    if not include_inactive:
        if category_id:
            RedisCategoryService.cache_subcategories_by_category(category_id, result)
        elif org_id:
            RedisCategoryService.cache_subcategories_by_org(org_id, result)
    
    return result


@router.get("/subcategories/{subcategory_id}", response_model=SubcategoryOut)
def get_subcategory(subcategory_id: str, db: Session = Depends(get_db)):
    """Get a single subcategory"""
    # Try cache first
    cached = RedisCategoryService.get_subcategory(subcategory_id)
    if cached is not None:
        return cached
    
    subcategory = db.get(TicketSubcategory, subcategory_id)
    if not subcategory:
        raise HTTPException(404, "Subcategory not found")
    
    result = SubcategoryOut.model_validate(subcategory, from_attributes=True).model_dump()
    
    # Cache result
    RedisCategoryService.cache_subcategory(subcategory_id, result)
    
    return result


@router.post("/subcategories", response_model=SubcategoryOut, status_code=201)
def create_subcategory(payload: SubcategoryCreate, db: Session = Depends(get_db)):
    """Create a new subcategory"""
    # Verify category exists
    category = db.get(TicketCategory, payload.category_id)
    if not category or not category.active:
        raise HTTPException(404, "Category not found or inactive")
    
    subcategory_id = payload.subcategory_id or f"subcat_{uuid.uuid4().hex[:10]}"
    
    subcategory = TicketSubcategory(
        subcategory_id=subcategory_id,
        category_id=payload.category_id,
        org_id=payload.org_id,
        name=payload.name,
        description=payload.description,
        display_order=payload.display_order,
        default_priority=payload.default_priority,
        default_severity=payload.default_severity,
        default_sla_id=payload.default_sla_id,
        meta=payload.meta,
        active=True
    )
    
    db.add(subcategory)
    db.commit()
    db.refresh(subcategory)
    
    # Invalidate caches
    RedisCategoryService.invalidate_subcategory_caches(
        subcategory_id, payload.category_id, payload.org_id
    )
    
    return SubcategoryOut.model_validate(subcategory, from_attributes=True)


@router.patch("/subcategories/{subcategory_id}", response_model=SubcategoryOut)
def update_subcategory(
    subcategory_id: str,
    payload: SubcategoryUpdate,
    db: Session = Depends(get_db)
):
    """Update a subcategory"""
    subcategory = db.get(TicketSubcategory, subcategory_id)
    if not subcategory:
        raise HTTPException(404, "Subcategory not found")
    
    # Update fields
    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(subcategory, field, value)
    
    db.commit()
    db.refresh(subcategory)
    
    # Invalidate caches
    RedisCategoryService.invalidate_subcategory_caches(
        subcategory_id, subcategory.category_id, subcategory.org_id
    )
    
    return SubcategoryOut.model_validate(subcategory, from_attributes=True)


@router.delete("/subcategories/{subcategory_id}", status_code=204)
def delete_subcategory(subcategory_id: str, db: Session = Depends(get_db)):
    """Soft delete a subcategory"""
    subcategory = db.get(TicketSubcategory, subcategory_id)
    if not subcategory:
        raise HTTPException(404, "Subcategory not found")
    
    subcategory.active = False
    db.commit()
    
    # Invalidate caches
    RedisCategoryService.invalidate_subcategory_caches(
        subcategory_id, subcategory.category_id, subcategory.org_id
    )
    
    return None


# ==================== PRODUCTS ====================

@router.get("/products", response_model=List[ProductOut])
def list_products(
    org_id: str = Query(...),
    platform: Optional[str] = Query(None),
    include_inactive: bool = Query(False),
    db: Session = Depends(get_db)
):
    """List all products for an organization"""
    # Try cache first
    if not include_inactive and not platform:
        cached = RedisCategoryService.get_products_by_org(org_id)
        if cached is not None:
            return cached
    
    query = select(TicketProduct).where(TicketProduct.org_id == org_id)
    
    if not include_inactive:
        query = query.where(TicketProduct.active == True)
    
    if platform:
        query = query.where(TicketProduct.platform == platform)
    
    query = query.order_by(TicketProduct.display_order, TicketProduct.name)
    
    products = db.execute(query).scalars().all()
    result = [ProductOut.model_validate(prod, from_attributes=True).model_dump() for prod in products]
    
    # Cache result
    if not include_inactive and not platform:
        RedisCategoryService.cache_products_by_org(org_id, result)
    
    return result


@router.get("/products/{product_id}", response_model=ProductOut)
def get_product(product_id: str, db: Session = Depends(get_db)):
    """Get a single product"""
    # Try cache first
    cached = RedisCategoryService.get_product(product_id)
    if cached is not None:
        return cached
    
    product = db.get(TicketProduct, product_id)
    if not product:
        raise HTTPException(404, "Product not found")
    
    result = ProductOut.model_validate(product, from_attributes=True).model_dump()
    
    # Cache result
    RedisCategoryService.cache_product(product_id, result)
    
    return result


@router.post("/products", response_model=ProductOut, status_code=201)
def create_product(payload: ProductCreate, db: Session = Depends(get_db)):
    """Create a new product"""
    product_id = payload.product_id or f"prod_{uuid.uuid4().hex[:10]}"
    
    product = TicketProduct(
        product_id=product_id,
        org_id=payload.org_id,
        name=payload.name,
        code=payload.code,
        description=payload.description,
        version=payload.version,
        platform=payload.platform,
        display_order=payload.display_order,
        meta=payload.meta,
        active=True
    )
    
    db.add(product)
    db.commit()
    db.refresh(product)
    
    # Invalidate caches
    RedisCategoryService.invalidate_product_caches(product_id, payload.org_id)
    
    return ProductOut.model_validate(product, from_attributes=True)


@router.patch("/products/{product_id}", response_model=ProductOut)
def update_product(
    product_id: str,
    payload: ProductUpdate,
    db: Session = Depends(get_db)
):
    """Update a product"""
    product = db.get(TicketProduct, product_id)
    if not product:
        raise HTTPException(404, "Product not found")
    
    # Update fields
    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(product, field, value)
    
    db.commit()
    db.refresh(product)
    
    # Invalidate caches
    RedisCategoryService.invalidate_product_caches(product_id, product.org_id)
    
    return ProductOut.model_validate(product, from_attributes=True)


@router.delete("/products/{product_id}", status_code=204)
def delete_product(product_id: str, db: Session = Depends(get_db)):
    """Soft delete a product"""
    product = db.get(TicketProduct, product_id)
    if not product:
        raise HTTPException(404, "Product not found")
    
    product.active = False
    db.commit()
    
    # Invalidate caches
    RedisCategoryService.invalidate_product_caches(product_id, product.org_id)
    
    return None