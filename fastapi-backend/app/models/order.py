from sqlalchemy import Column, String, Float, DateTime, JSON
from sqlalchemy.sql import func
from typing import Optional

from ..db import Base

class Order(Base):
    __tablename__ = "orders"

    order_id = Column(String, primary_key=True, index=True)
    org_id = Column(String, nullable=False)
    user_id = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    amount = Column(Float, nullable=False)
    currency = Column(String, nullable=False)
    items = Column(JSON, default=[])
    status = Column(String, default="pending")  # "pending" | "paid" | "failed" | "refunded"
    payment_method = Column(String, nullable=True)
    transaction_id = Column(String, nullable=True)
    coupon_code = Column(String, nullable=True)
    discount_amount = Column(Float, default=0)
    gst_amount = Column(Float, default=0)
    subscription_info = Column(JSON, nullable=True)  # e.g., {plan, startDate, endDate}
