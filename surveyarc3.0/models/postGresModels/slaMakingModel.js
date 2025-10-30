// models/postGresModels/slaMakingModel.js
const BASE = "/api/post-gres-apis/slas";
const BASE2 = "/api/post-gres-apis"; // no trailing slash; we'll append paths

const safeJson = async (res) => {
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json();
};

const safeBlob = async (res) => {
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `HTTP ${res.status}`);
  }
  const blob = await res.blob();
  const cd = res.headers.get("content-disposition") || "";
  const match = cd.match(/filename="?([^"]+)"?/i);
  return { blob, filename: match?.[1] || "download.json" };
};

const toISO = (d) => (d instanceof Date ? d.toISOString() : d);

const SlaMakingModel = {
  // -------- SLAs (CRUD + actions) --------
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

  async activate(orgId,slaId) {
    const res = await fetch(`${BASE}/${encodeURIComponent(orgId)}/${encodeURIComponent(slaId)}/activate`, {
      method: "POST",
      cache: "no-store",
    });
    return safeJson(res);
  },

  async deactivate(orgId,slaId) {
    const res = await fetch(`${BASE}/${encodeURIComponent(orgId)}/${encodeURIComponent(slaId)}/deactivate`, {
      method: "POST",
      cache: "no-store",
    });
    return safeJson(res);
  },

  async publish(orgId,slaId, { effective_from } = {}) {
    const body = effective_from ? { effective_from: toISO(effective_from) } : {};
    const res = await fetch(`${BASE}/${encodeURIComponent(orgId)}/${encodeURIComponent(slaId)}/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    return safeJson(res);
  },

  async archive(orgId,slaId) {
    const res = await fetch(`${BASE}/${encodeURIComponent(orgId)}/${encodeURIComponent(slaId)}/archive`, {
      method: "POST",
      cache: "no-store",
    });
    return safeJson(res);
  },

  async validate(orgId,slaId) {
    const res = await fetch(`${BASE}/${encodeURIComponent(orgId)}/${encodeURIComponent(slaId)}/validate`, {
      method: "POST",
      cache: "no-store",
    });
    return safeJson(res);
  },

  async duplicate(orgId,slaId, overrides = {}) {
    const res = await fetch(`${BASE}/${encodeURIComponent(orgId)}/${encodeURIComponent(slaId)}/duplicate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(overrides),
      cache: "no-store",
    });
    return safeJson(res);
  },

  async createNewVersion(orgId,slaId, changes = {}) {
    const res = await fetch(`${BASE}/${encodeURIComponent(orgId)}/${encodeURIComponent(slaId)}/version`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(changes),
      cache: "no-store",
    });
    return safeJson(res);
  },

  async listVersions(orgId,slaId) {
    const res = await fetch(`${BASE}/${encodeURIComponent(orgId)}/${encodeURIComponent(slaId)}/versions`, { cache: "no-store" });
    return safeJson(res);
  },

  async dependencies(slaId, { limit } = {}) {
    const params = new URLSearchParams();
    if (limit != null) params.set("limit", String(limit));
    const res = await fetch(`${BASE}/${encodeURIComponent(orgId)}/${encodeURIComponent(slaId)}/dependencies?${params}`, {
      cache: "no-store",
    });
    return safeJson(res);
  },

  // -------- Bulk ops --------
  async bulkUpsert(slas = [], { updateExisting = true } = {}) {
    const params = new URLSearchParams();
    params.set("update_existing", String(updateExisting));
    const res = await fetch(`${BASE}/bulk?${params}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(slas),
      cache: "no-store",
    });
    return safeJson(res);
  },

  async bulkDelete(slaIds = [], { force = false } = {}) {
    const params = new URLSearchParams();
    params.set("force", String(force));
    const res = await fetch(`${BASE}/bulk?${params}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sla_ids: slaIds }),
      cache: "no-store",
    });
    return safeJson(res);
  },

  // -------- Org-level query/match/report --------
  async match(orgId, criteria = {}) {
    const res = await fetch(`${BASE}/${encodeURIComponent(orgId)}/match`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(criteria),
      cache: "no-store",
    });
    return safeJson(res);
  },

  async simulate(orgId, criteria = {}) {
    const res = await fetch(`${BASE}/${encodeURIComponent(orgId)}/simulate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(criteria),
      cache: "no-store",
    });
    return safeJson(res);
  },

  async effective(orgId, { at_time, scope } = {}) {
    const params = new URLSearchParams();
    if (at_time) params.set("at_time", toISO(at_time));
    if (scope) params.set("scope", scope);
    const res = await fetch(`${BASE}/${encodeURIComponent(orgId)}/effective?${params}`, {
      cache: "no-store",
    });
    return safeJson(res);
  },

  async stats(orgId) {
    const res = await fetch(`${BASE}/${encodeURIComponent(orgId)}/stats`, { cache: "no-store" });
    return safeJson(res);
  },

  async compliance(orgId, { from_date, to_date } = {}) {
    const params = new URLSearchParams();
    if (from_date) params.set("from_date", toISO(from_date));
    if (to_date) params.set("to_date", toISO(to_date));
    const res = await fetch(`${BASE}/${encodeURIComponent(orgId)}/compliance?${params}`, {
      cache: "no-store",
    });
    return safeJson(res);
  },

  async export(orgId, { includeObjectives = true, includeCreditRules = true } = {}) {
    const params = new URLSearchParams();
    params.set("include_objectives", String(includeObjectives));
    params.set("include_credit_rules", String(includeCreditRules));
    const res = await fetch(`${BASE}/${encodeURIComponent(orgId)}/export?${params}`, {
      cache: "no-store",
    });
    return safeBlob(res); // returns { blob, filename }
  },

  async import(orgId, file, { updateExisting = true } = {}) {
    const params = new URLSearchParams();
    params.set("update_existing", String(updateExisting));
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`${BASE}/${encodeURIComponent(orgId)}/import?${params}`, {
      method: "POST",
      body: fd,
      cache: "no-store",
    });
    return safeJson(res);
  },

  async cleanup(orgId, { olderThanDays = 90, dryRun = true } = {}) {
    const params = new URLSearchParams();
    params.set("older_than_days", String(olderThanDays));
    params.set("dry_run", String(dryRun));
    const res = await fetch(`${BASE}/${encodeURIComponent(orgId)}/cleanup?${params}`, {
      method: "POST",
      cache: "no-store",
    });
    return safeJson(res);
  },

  // -------- Objectives --------
  async listObjectives(orgId,slaId) {
    const res = await fetch(`${BASE}/${encodeURIComponent(orgId)}/${(slaId)}/objectives`, { cache: "no-store" });
    return safeJson(res);
  },

  async createObjective(orgId,slaId, payload) {
    console.log(payload)
    const res = await fetch(`${BASE}/${encodeURIComponent(orgId)}/${(slaId)}/objectives`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
    return safeJson(res);
  },

  async getObjective(orgId, objectiveId) {
    const res = await fetch(`${BASE}/objectives/${(objectiveId)}`, { cache: "no-store" });
    return safeJson(res);
  },

  async updateObjective(orgId, objectiveId, patch) {
    const res = await fetch(`${BASE}/objectives/${(objectiveId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
      cache: "no-store",
    });
    return safeJson(res);
  },

  async removeObjective(orgId, objectiveId) {
    const res = await fetch(`${BASE}/objectives/${(objectiveId)}`, {
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
  async listCreditRules(orgId, slaId) {
    const res = await fetch(`${BASE}/${encodeURIComponent(orgId)}/${encodeURIComponent(slaId)}/credit-rules`, { cache: "no-store" });
    return safeJson(res);
  },

  async createCreditRule(orgId, slaId, payload) {
    const res = await fetch(`${BASE}/${encodeURIComponent(orgId)}/${encodeURIComponent(slaId)}/credit-rules`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
    return safeJson(res);
  },

  async getCreditRule(orgId, ruleId) {
    const res = await fetch(`${BASE}/${encodeURIComponent(orgId)}/credit-rules/${encodeURIComponent(ruleId)}`, { cache: "no-store" });
    return safeJson(res);
  },

  async updateCreditRule(orgId, ruleId, patch) {
    const res = await fetch(`${BASE}/${encodeURIComponent(orgId)}/credit-rules/${encodeURIComponent(ruleId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
      cache: "no-store",
    });
    return safeJson(res);
  },

  async removeCreditRule(orgId, ruleId) {
    const res = await fetch(`${BASE}/${encodeURIComponent(orgId)}/credit-rules/${encodeURIComponent(ruleId)}`, {
      method: "DELETE",
      cache: "no-store",
    });
    if (!res.ok && res.status !== 204) {
      const text = await res.text().catch(() => "");
      throw new Error(text || `HTTP ${res.status}`);
    }
    return true;
  },

  // -------- Ticket SLA (status / timers / pause / resume / history) --------
  async getTicketStatus(ticketId) {
    if (!ticketId) throw new Error("ticketId is required");
    const res = await fetch(`${BASE2}/tickets/${encodeURIComponent(ticketId)}/sla/status`, {
      cache: "no-store",
    });
    return safeJson(res);
  },

  async getTicketTimers(ticketId) {
    if (!ticketId) throw new Error("ticketId is required");
    const res = await fetch(`${BASE2}/tickets/${encodeURIComponent(ticketId)}/sla/timers`, {
      cache: "no-store",
    });
    return safeJson(res);
  },

  async getTicketPauseHistory(ticketId, { dimension } = {}) {
    if (!ticketId) throw new Error("ticketId is required");
    const params = new URLSearchParams();
    if (dimension) params.set("dimension", dimension);
    const res = await fetch(
      `${BASE2}/tickets/${encodeURIComponent(ticketId)}/sla/pause-history${params.toString() ? `?${params}` : ""}`,
      { cache: "no-store" }
    );
    return safeJson(res);
  },

  async pauseTicketSLA(ticketId, { dimension, reason, reason_note }, { userId } = {}) {
    if (!ticketId) throw new Error("ticketId is required");
    const headers = { "Content-Type": "application/json" };
    if (userId) headers["X-User-Id"] = userId;
    const res = await fetch(`${BASE2}/tickets/${encodeURIComponent(ticketId)}/sla/pause`, {
      method: "POST",
      headers,
      body: JSON.stringify({ dimension, reason, reason_note }),
      cache: "no-store",
    });
    return safeJson(res);
  },

  async resumeTicketSLA(ticketId, { dimension }, { userId } = {}) {
    if (!ticketId) throw new Error("ticketId is required");
    const headers = { "Content-Type": "application/json" };
    if (userId) headers["X-User-Id"] = userId;
    // fixed path: /tickets/{id}/sla/resume
    const res = await fetch(`${BASE2}/tickets/${encodeURIComponent(ticketId)}/sla/resume`, {
      method: "POST",
      headers,
      body: JSON.stringify({ dimension }),
      cache: "no-store",
    });
    return safeJson(res);
  },
};

export default SlaMakingModel;
