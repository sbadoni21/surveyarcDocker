from fastapi import APIRouter
from typing import List
from ..schemas.pricing_plan import PricingPlan

router = APIRouter(prefix="/pricing-plan", tags=["Pricing"])

# In-memory plans (same as your JS array)
plans_data = [
    {
        "id": "free",
        "name": "Free",
        "price": "₹0/month",
        "amount": 0,
        "features": ["Basic surveys", "Up to 5 users"],
    },
    {
        "id": "pro",
        "name": "Pro",
        "price": "₹999/month",
        "amount": 999,
        "features": ["Unlimited surveys", "Up to 50 users", "Premium support"],
    },
]

@router.get("/", response_model=List[PricingPlan])
def get_all_plans():
    return plans_data

@router.get("/{plan_id}", response_model=PricingPlan)
def get_plan(plan_id: str):
    plan = next((p for p in plans_data if p["id"] == plan_id), None)
    if not plan:
        return {"detail": "Plan not found"}
    return plan
