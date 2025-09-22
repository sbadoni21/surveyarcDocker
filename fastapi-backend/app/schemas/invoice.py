from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class InvoiceBase(BaseModel):
    org_id: str
    order_id: str
    amount: float
    currency: str
    url_pdf: Optional[str] = None
    status: Optional[str] = "draft"
    issued_at: Optional[datetime] = None
    due_date: Optional[datetime] = None

class InvoiceCreate(InvoiceBase):
    invoice_id: str

class InvoiceResponse(InvoiceBase):
    invoice_id: str
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
