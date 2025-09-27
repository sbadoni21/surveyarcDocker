// models/postGresModels/slaMakingModel.js
const BASE = "/api/post-gres-apis/slas";

const safeJson = async (res) => {
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json();
};

const SlaMakingModel = {
  // -------- SLAs --------
  async list({ orgId, active, scope, q, limit, offset } = {}) {
    const params = new URLSearchParams();
    if (orgId) params.set("org_id", orgId);
    if (active !== undefined) params.set("active", String(active));
    if (scope) params.set("scope", scope);
    if (q) params.set("q", q);
    if (limit != null) params.set("limit", String(limit));
    if (offset != null) params.set("offset", String(offset));
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
      cache: "no-store",
    });
    return safeJson(res);
  },

  async update(slaId, patch) {
    const res = await fetch(`${BASE}/${encodeURIComponent(slaId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
      cache: "no-store",
    });
    return safeJson(res);
  },

  async remove(slaId) {
    const res = await fetch(`${BASE}/${encodeURIComponent(slaId)}`, {
      method: "DELETE",
      cache: "no-store",
    });
    if (!res.ok && res.status !== 204) {
      const text = await res.text().catch(() => "");
      throw new Error(text || `HTTP ${res.status}`);
    }
    return true;
  },

  async activate(slaId) {
    const res = await fetch(`${BASE}/${encodeURIComponent(slaId)}/activate`, {
      method: "POST",
      cache: "no-store",
    });
    return safeJson(res);
  },

  async deactivate(slaId) {
    const res = await fetch(`${BASE}/${encodeURIComponent(slaId)}/deactivate`, {
      method: "POST",
      cache: "no-store",
    });
    return safeJson(res);
  },

  async duplicate(slaId, overrides = {}) {
    const res = await fetch(`${BASE}/${encodeURIComponent(slaId)}/duplicate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(overrides),
      cache: "no-store",
    });
    return safeJson(res);
  },

  // -------- Objectives --------
  async listObjectives(slaId) {
    const res = await fetch(`${BASE}/${encodeURIComponent(slaId)}/objectives`, { cache: "no-store" });
    return safeJson(res);
  },

  async createObjective(slaId, payload) {
    const res = await fetch(`${BASE}/${encodeURIComponent(slaId)}/objectives`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload), // server will bind sla_id from path
      cache: "no-store",
    });
    return safeJson(res);
  },

  async getObjective(objectiveId) {
    const res = await fetch(`${BASE}/objectives/${encodeURIComponent(objectiveId)}`, { cache: "no-store" });
    return safeJson(res);
  },

  async updateObjective(objectiveId, patch) {
    const res = await fetch(`${BASE}/objectives/${encodeURIComponent(objectiveId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
      cache: "no-store",
    });
    return safeJson(res);
  },

  async removeObjective(objectiveId) {
    const res = await fetch(`${BASE}/objectives/${encodeURIComponent(objectiveId)}`, {
      method: "DELETE",
      cache: "no-store",
    });
    if (!res.ok && res.status !== 204) {
      const text = await res.text().catch(() => "");
      throw new Error(text || `HTTP ${res.status}`);
    }
    return true;
  },

  // -------- Credit Rules --------
  async listCreditRules(slaId) {
    const res = await fetch(`${BASE}/${encodeURIComponent(slaId)}/credit-rules`, { cache: "no-store" });
    return safeJson(res);
  },

  async createCreditRule(slaId, payload) {
    const res = await fetch(`${BASE}/${encodeURIComponent(slaId)}/credit-rules`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload), // server will bind sla_id from path
      cache: "no-store",
    });
    return safeJson(res);
  },

  async getCreditRule(ruleId) {
    const res = await fetch(`${BASE}/credit-rules/${encodeURIComponent(ruleId)}`, { cache: "no-store" });
    return safeJson(res);
  },

  async updateCreditRule(ruleId, patch) {
    const res = await fetch(`${BASE}/credit-rules/${encodeURIComponent(ruleId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
      cache: "no-store",
    });
    return safeJson(res);
  },

  async removeCreditRule(ruleId) {
    const res = await fetch(`${BASE}/credit-rules/${encodeURIComponent(ruleId)}`, {
      method: "DELETE",
      cache: "no-store",
    });
    if (!res.ok && res.status !== 204) {
      const text = await res.text().catch(() => "");
      throw new Error(text || `HTTP ${res.status}`);
    }
    return true;
  },
};

export default SlaMakingModel;
