class PricingPlan {
  constructor() {
    this.plans = [
      {
        id: "free",
        name: "Free",
        price: "₹0/month",
        amount: 0,
        features: ["Basic surveys", "Up to 5 users"],
      },
      {
        id: "pro",
        name: "Pro",
        price: "₹999/month",
        amount: 999,
        features: ["Unlimited surveys", "Up to 50 users", "Premium support"],
      },
    ];
  }

  getAll() {
    return this.plans;
  }

  findById(id) {
    return this.plans.find((plan) => plan.id === id);
  }
}

const pricingPlan = new PricingPlan();
export default pricingPlan;
