from sqlalchemy import Column, String, Float, DateTime, JSON
from sqlalchemy.sql import func

from ..db import Base

class Payment(Base):
    __tablename__ = "payments"

    payment_id = Column(String, primary_key=True, index=True)
    amount = Column(Float, nullable=False)
    currency = Column(String, nullable=False)
    status = Column(String, nullable=True)
    method = Column(String, nullable=True)  # e.g., "razorpay", "stripe"
    details = Column(JSON, default={})      # any additional payment info
    created_at = Column(DateTime(timezone=True), server_default=func.now())
