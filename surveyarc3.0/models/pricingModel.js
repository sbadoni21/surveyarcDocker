class PricingPlan {
  constructor() {
    this.plans = [
      {
        id: "starter",
        name: "Starter (MVP Founder Tier)",
        price: "₹3,50,000/year",
        amount: 350000,
        projects: 10,
        surveys: 10,
        responses: 30000,
        users: 10,
        emails: 15000, // per month
        campaigns: 5, // per month
        tickets: 200, // per year
        themes: 2,
        features: [
          "Up to 10 projects",
          "Up to 10 active surveys",
          "Up to 30,000 responses/year",
          "Up to 10 platform users",
          "Up to 15,000 emails/month",
          "Up to 5 campaigns/month",
          "Up to 200 tickets/year",
          "Up to 2 custom themes",
          "Role-based access (Viewer, Editor, Owner)",
          "Basic analytics dashboard",
          "Survey campaigns via email",
          "Theme editor (basic)",
          "Standard support",
        ],
      },
      {
        id: "growth",
        name: "Growth",
        price: "₹6,00,000/year",
        amount: 600000,
        projects: "Unlimited",
        surveys: "Unlimited",
        responses: 150000,
        users: 50,
        emails: 75000, // per month
        campaigns: 25, // per month
        tickets: 2500, // per year
        themes: 10,
        features: [
          "Unlimited projects",
          "Unlimited surveys",
          "Up to 150,000 responses/year",
          "Up to 50 platform users",
          "Up to 75,000 emails/month",
          "Up to 25 campaigns/month",
          "Up to 2,500 tickets/year",
          "Up to 10 custom themes",
          "Teams & role management",
          "Multi-section surveys",
          "Advanced logic & branching",
          "Ticketing with SLA & escalation",
          "Nested conditions & rules",
          "Campaign automation (Email + SMS)",
          "Theme editor (full customization)",
          "Custom reports & exports (CSV/XLS)",
          "Priority support",
        ],
      },
      {
        id: "enterprise",
        name: "Enterprise",
        price: "₹10,00,000+/year",
        amount: 1000000,
        projects: "Unlimited",
        surveys: "Unlimited",
        responses: "Unlimited",
        users: "Unlimited",
        emails: "Unlimited",
        campaigns: "Unlimited",
        tickets: "Unlimited",
        themes: "Unlimited",
        features: [
          "Unlimited projects, surveys, and responses",
          "Unlimited platform users",
          "Unlimited email campaigns",
          "Unlimited ticketing",
          "Unlimited custom themes",
          "Dedicated AWS/VPC infrastructure",
          "White-label branding",
          "Custom roles & access policies",
          "API + CRM/ERP integrations (Salesforce, HubSpot, Zoho)",
          "Custom analytics dashboards",
          "On-prem or hybrid deployment",
          "SSO (Azure AD / Okta / Google)",
          "Dedicated account manager",
          "99.9% SLA uptime",
          "Onboarding & training sessions",
        ],
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
