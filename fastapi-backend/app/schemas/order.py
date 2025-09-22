from pydantic import BaseModel
from typing import Optional, List, Dict
from datetime import datetime

class OrderItem(BaseModel):
    product_id: str
    name: str
    qty: int
    unit_price: float

class SubscriptionInfo(BaseModel):
    plan: str
    start_date: Optional[datetime]
    end_date: Optional[datetime]

class OrderBase(BaseModel):
    org_id: str
    user_id: str
    amount: float
    currency: str
    items: List[OrderItem] = []
    status: Optional[str] = "pending"
    payment_method: Optional[str] = None
    transaction_id: Optional[str] = None
    coupon_code: Optional[str] = None
    discount_amount: Optional[float] = 0
    gst_amount: Optional[float] = 0
    subscription_info: Optional[Dict] = None

class OrderCreate(OrderBase):
    order_id: str

class OrderResponse(OrderBase):
    order_id: str
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True
