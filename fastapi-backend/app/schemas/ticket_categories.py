
# ============================================
# SCHEMAS - app/schemas/ticket_categories.py
# ============================================

from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from datetime import datetime

# -------- Category Schemas --------
class CategoryBase(BaseModel):
    name: str
    description: Optional[str] = None
    icon: Optional[str] = None
    color: Optional[str] = None
    display_order: int = 0
    meta: Dict[str, Any] = Field(default_factory=dict)

class CategoryCreate(CategoryBase):
    category_id: Optional[str] = None
    org_id: str

class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    icon: Optional[str] = None
    color: Optional[str] = None
    active: Optional[bool] = None
    display_order: Optional[int] = None
    meta: Optional[Dict[str, Any]] = None

class CategoryOut(CategoryBase):
    category_id: str
    org_id: str
    active: bool
    created_at: datetime
    updated_at: datetime
    subcategory_count: int = 0
    
    class Config:
        from_attributes = True

class CategoryWithSubcategories(CategoryOut):
    subcategories: List['SubcategoryOut'] = []

# -------- Subcategory Schemas --------
class SubcategoryBase(BaseModel):
    name: str
    description: Optional[str] = None
    display_order: int = 0
    default_priority: Optional[str] = None
    default_severity: Optional[str] = None
    default_sla_id: Optional[str] = None
    meta: Dict[str, Any] = Field(default_factory=dict)

class SubcategoryCreate(SubcategoryBase):
    subcategory_id: Optional[str] = None
    category_id: str
    org_id: str

class SubcategoryUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    active: Optional[bool] = None
    display_order: Optional[int] = None
    default_priority: Optional[str] = None
    default_severity: Optional[str] = None
    default_sla_id: Optional[str] = None
    meta: Optional[Dict[str, Any]] = None

class SubcategoryOut(SubcategoryBase):
    subcategory_id: str
    category_id: str
    org_id: str
    active: bool
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

# -------- Product Schemas --------
class ProductBase(BaseModel):
    name: str
    code: str
    description: Optional[str] = None
    version: Optional[str] = None
    platform: Optional[str] = None
    display_order: int = 0
    meta: Dict[str, Any] = Field(default_factory=dict)

class ProductCreate(ProductBase):
    product_id: Optional[str] = None
    org_id: str

class ProductUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    description: Optional[str] = None
    version: Optional[str] = None
    platform: Optional[str] = None
    active: Optional[bool] = None
    display_order: Optional[int] = None
    meta: Optional[Dict[str, Any]] = None

class ProductOut(ProductBase):
    product_id: str
    org_id: str
    active: bool
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

