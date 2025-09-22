from pydantic import BaseModel
from typing import List

class PricingPlan(BaseModel):
    id: str
    name: str
    price: str
    amount: float
    features: List[str]
