from pydantic import BaseModel
from typing import Optional, Dict
from datetime import datetime

class PaymentBase(BaseModel):
    amount: float
    currency: str
    status: Optional[str] = None
    method: Optional[str] = None
    details: Optional[Dict] = {}

class PaymentCreate(PaymentBase):
    payment_id: str

class PaymentResponse(PaymentBase):
    payment_id: str
    created_at: datetime

    class Config:
        from_attributes = True
