from sqlalchemy import Column, String, Float, DateTime
from sqlalchemy.sql import func
from ..db import Base
from typing import Optional


class Invoice(Base):
    __tablename__ = "invoices"

    invoice_id = Column(String, primary_key=True, index=True)
    org_id = Column(String, nullable=False)
    order_id = Column(String, nullable=False)
    issued_at = Column(DateTime(timezone=True), server_default=func.now())
    due_date = Column(DateTime(timezone=True), nullable=True)
    amount = Column(Float, nullable=False)
    currency = Column(String, nullable=False)
    url_pdf = Column(String, nullable=True)
    status = Column(String, default="draft")
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
