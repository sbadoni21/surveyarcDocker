// models/postGresModels/slaModel.js
const BASE = "/api/post-gres-apis/slas";

const safeJson = async (res) => {
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json();
};

const SlaMakingModel = {
  async list({ orgId, active } = {}) {
    const params = new URLSearchParams();
    if (orgId) params.set("org_id", orgId);
    if (active !== undefined) params.set("active", String(active));
    const res = await fetch(`${BASE}?${params.toString()}`, { cache: "no-store" });
    return safeJson(res);
  },

  async get(slaId) {
    const res = await fetch(`${BASE}/${encodeURIComponent(slaId)}`, { cache: "no-store" });
    return safeJson(res);
  },

  async create(payload) {
    const res = await fetch(BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return safeJson(res);
  },

  async update(slaId, patch) {
    const res = await fetch(`${BASE}/${encodeURIComponent(slaId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    return safeJson(res);
  },

  async remove(slaId) {
    const res = await fetch(`${BASE}/${encodeURIComponent(slaId)}`, { method: "DELETE" });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(text || `HTTP ${res.status}`);
    }
    return true;
  },

  // calendars (simple, minimal)
  async listCalendars({ orgId }) {
    const params = new URLSearchParams({ org_id: orgId });
    const res = await fetch(`${BASE}/business-calendars?${params.toString()}`, { cache: "no-store" });
    return safeJson(res);
  },
};

export default SlaMakingModel;
