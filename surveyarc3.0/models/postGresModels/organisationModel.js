// models/organisationModel.js 
const BASE = "/api/post-gres-apis/organisation";

const toJson = async (res) => {
  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText} :: ${msg}`);
  }
  return res.json();
};

const defaultData = ({ uid, name, ownerUID, ownerEmail }) => {
  const now = new Date().toISOString();
  const endsAt = new Date(Date.now() + 28 * 24 * 60 * 60 * 1000).toISOString();
  return {
    org_id: uid,
    name,
    owner_uid: ownerUID,
    owner_email: ownerEmail,
    created_at: now,
    updated_at: now,
    subscription: {
      plan: "free",
      renewalType: "none",
      startDate: now,
      endDate: endsAt,
      autoRenew: true,
      trial: { isActive: true, endsAt },
      quota: { surveys: 10, responses: 1000, teamMembers: 5 },
      currentUsage: { surveys: 0, responses: 0, teamMembers: 1 },
    },
    business_type: "small",
    organisation_size: "1",
    industry: "",
    tags: [],
    theme_settings: {
      primaryColor: "#1e40af",
      secondaryColor: "#facc15",
      logoUrl: "",
      darkMode: false,
    },
    team_members: [
      {
        email: ownerEmail || "",
        role: "owner",
        status: "active",
        uid: ownerUID || "",
        joinedAt: new Date().toISOString(),
      },
    ],
    sso_config: {
      enabled: false,
      provider: "saml",
      metadataUrl: "",
      certificate: "",
      issuer: "",
    },
    scim_config: { enabled: false, baseUrl: "", authToken: "" },
    api_rate_limits: { requestsPerMinute: 1000, burstSize: 200 },
    features: {
      survey: true,
      insights: false,
      integrations: false,
      customBranding: false,
      webhooks: false,
      apiAccess: false,
      whiteLabeling: false,
    },
    integrations: { zapier: false, slack: false, crmConnected: false },
    billing_details: {
      gstNumber: "",
      billingEmail: "",
      billingAddress: "",
      country: "",
      currency: "INR",
      isGSTApplicable: true,
    },
    last_activity: now,
    compliance: { gdpr: true, ccpa: true, iso27001: false, lastAuditDate: now },
    region: "",
    country: "",
    timezone: "",
    supported_locales: ["en"],
    default_locale: "en",
    data_region: "",
    encryption: { kmsKeyName: "", customerManaged: false },
    onboarding: { step: "welcome", startedAt: now, lastStepAt: now },
    referral_code: "",
    created_via: "web",
    is_active: true,
    is_suspended: false,
    deleted_at: null,
  };
};

const organisationModel = {
  defaultData,

  async create(orgData) {
    const payload = defaultData({
      uid: String(orgData.uid),
      name: orgData.orgName,
      ownerUID: orgData.ownerUID,
      ownerEmail: orgData.ownerEmail,
      industry: orgData.industry,
      organisation_size: orgData.size,
      business_type: orgData.business_type,

    });

    console.log("payload", payload);

    const res = await fetch(`${BASE}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify(payload),
    });

    console.log("res", res);
    return toJson(res);
  },

  async getById(orgId) {
    const url = new URL(BASE, window.location.origin);
    url.searchParams.set("orgId", String(orgId));
    const res = await fetch(url.toString(), { cache: "no-store" });
    // const res = await fetch(`${BASE}/${orgId}`, { cache: "no-store" });
    return toJson(res);
  },
  async getByIdmail(orgId) {
    // const url = new URL(BASE, window.location.origin);
    // url.searchParams.set("orgId", String(orgId));
    // const res = await fetch(url.toString(), { cache: "no-store" });
    const res = await fetch(`${BASE}/${orgId}`, { cache: "no-store" });
    return toJson(res);
  },

  async update(orgId, patch) {
    console.log(orgId);
    console.log("patch", patch);
    const res = await fetch(`${BASE}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ orgId: String(orgId), ...patch }),
    });
    console.log(res);
    return toJson(res);
  },

  async softDelete(orgId) {
    const res = await fetch(`${BASE}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({
        orgId: String(orgId),
        is_active: false,
        deleted_at: new Date().toISOString(),
      }),
    });
    return toJson(res);
  },
};

export default organisationModel;
