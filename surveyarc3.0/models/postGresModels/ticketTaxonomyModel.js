// ============================================
// FRONTEND MODEL - models/postGresModels/ticketTaxonomyModel.js
// ============================================

const BASE = "/api/post-gres-apis/ticket-taxonomies";
const json = async (r) => (r.ok ? r.json() : Promise.reject(await r.text()));

const omitNullish = (obj) => {
  const out = {};
  for (const [k, v] of Object.entries(obj || {})) {
    if (v !== undefined && v !== null) out[k] = v;
  }
  return out;
};
const get = (obj, camel, snake) => obj?.[camel] ?? obj?.[snake] ?? undefined;

export const toApiFormat = (data = {}) =>
  omitNullish({
    // common
    feature_id: get(data, "featureId", "feature_id"),
    impact_id: get(data, "impactId", "impact_id"),
    rca_id: get(data, "rcaId", "rca_id"),
    org_id: get(data, "orgId", "org_id"),
    name: get(data, "name", "name"),
    description: get(data, "description", "description"),
    code: get(data, "code", "code"),
    product_id: get(data, "productId", "product_id"),
    active: get(data, "active", "active"),
    display_order: get(data, "displayOrder", "display_order"),
    meta: get(data, "meta", "meta"),
  });

export const fromApiFormat = (row = {}) => ({
  // common mapped fields
  featureId: get(row, "featureId", "feature_id"),
  impactId: get(row, "impactId", "impact_id"),
  rcaId: get(row, "rcaId", "rca_id"),
  orgId: get(row, "orgId", "org_id"),
  productId: get(row, "productId", "product_id"),
  name: get(row, "name", "name"),
  description: get(row, "description", "description"),
  code: get(row, "code", "code"),
  active: get(row, "active", "active"),
  displayOrder: get(row, "displayOrder", "display_order"),
  meta: get(row, "meta", "meta") || {},
  createdAt: get(row, "createdAt", "created_at"),
  updatedAt: get(row, "updatedAt", "updated_at"),
});

const TaxonomyModel = {
  // ============ Features ============
  async listFeatures(orgId, { productId, includeInactive = false } = {}) {
    if (!orgId) throw new Error("Organization ID is required");
    const qs = new URLSearchParams({ org_id: orgId });
    if (productId) qs.set("product_id", productId);
    if (includeInactive) qs.set("include_inactive", "true");
    const r = await fetch(`${BASE}/features?${qs}`, { cache: "no-store" });
    const arr = await json(r);
    return Array.isArray(arr) ? arr.map(fromApiFormat) : [];
  },
  async getFeature(featureId) {
    if (!featureId) throw new Error("Feature ID is required");
    const r = await fetch(`${BASE}/features/${encodeURIComponent(featureId)}`, { cache: "no-store" });
    return fromApiFormat(await json(r));
  },
  async createFeature(body) {
    if (!body.name || !body.orgId) throw new Error("name and orgId are required");
    const payload = toApiFormat(body);
    const r = await fetch(`${BASE}/features`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    return fromApiFormat(await json(r));
  },
  async updateFeature(featureId, patch) {
    if (!featureId) throw new Error("Feature ID is required");
    const payload = toApiFormat(patch);
    const r = await fetch(`${BASE}/features/${encodeURIComponent(featureId)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    return fromApiFormat(await json(r));
  },
  async deleteFeature(featureId) {
    if (!featureId) throw new Error("Feature ID is required");
    const r = await fetch(`${BASE}/features/${encodeURIComponent(featureId)}`, { method: "DELETE" });
    if (!r.ok && r.status !== 204) throw new Error(await r.text());
    return true;
  },

  // ============ Impact Areas ============
  async listImpacts(orgId, { includeInactive = false } = {}) {
    if (!orgId) throw new Error("Organization ID is required");
    const qs = new URLSearchParams({ org_id: orgId });
    if (includeInactive) qs.set("include_inactive", "true");
    const r = await fetch(`${BASE}/impacts?${qs}`, { cache: "no-store" });
    const arr = await json(r);
    return Array.isArray(arr) ? arr.map(fromApiFormat) : [];
  },
  async getImpact(impactId) {
    if (!impactId) throw new Error("Impact ID is required");
    const r = await fetch(`${BASE}/impacts/${encodeURIComponent(impactId)}`, { cache: "no-store" });
    return fromApiFormat(await json(r));
  },
  async createImpact(body) {
    if (!body.name || !body.orgId) throw new Error("name and orgId are required");
    const payload = toApiFormat(body);
    const r = await fetch(`${BASE}/impacts`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    return fromApiFormat(await json(r));
  },
  async updateImpact(impactId, patch) {
    if (!impactId) throw new Error("Impact ID is required");
    const payload = toApiFormat(patch);
    const r = await fetch(`${BASE}/impacts/${encodeURIComponent(impactId)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    return fromApiFormat(await json(r));
  },
  async deleteImpact(impactId) {
    if (!impactId) throw new Error("Impact ID is required");
    const r = await fetch(`${BASE}/impacts/${encodeURIComponent(impactId)}`, { method: "DELETE" });
    if (!r.ok && r.status !== 204) throw new Error(await r.text());
    return true;
  },

  // ============ Root Cause Types ============
  async listRootCauses(orgId, { includeInactive = false } = {}) {
    if (!orgId) throw new Error("Organization ID is required");
    const qs = new URLSearchParams({ org_id: orgId });
    if (includeInactive) qs.set("include_inactive", "true");
    const r = await fetch(`${BASE}/root-causes?${qs}`, { cache: "no-store" });
    const arr = await json(r);
    return Array.isArray(arr) ? arr.map(fromApiFormat) : [];
  },
  async getRootCause(rcaId) {
    if (!rcaId) throw new Error("RCA ID is required");
    const r = await fetch(`${BASE}/root-causes/${encodeURIComponent(rcaId)}`, { cache: "no-store" });
    return fromApiFormat(await json(r));
  },
  async createRootCause(body) {
    if (!body.name || !body.orgId) throw new Error("name and orgId are required");
    const payload = toApiFormat(body);
    const r = await fetch(`${BASE}/root-causes`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    return fromApiFormat(await json(r));
  },
  async updateRootCause(rcaId, patch) {
    if (!rcaId) throw new Error("RCA ID is required");
    const payload = toApiFormat(patch);
    const r = await fetch(`${BASE}/root-causes/${encodeURIComponent(rcaId)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    return fromApiFormat(await json(r));
  },
  async deleteRootCause(rcaId) {
    if (!rcaId) throw new Error("RCA ID is required");
    const r = await fetch(`${BASE}/root-causes/${encodeURIComponent(rcaId)}`, { method: "DELETE" });
    if (!r.ok && r.status !== 204) throw new Error(await r.text());
    return true;
  },

  // ============ Ticket Root Cause setter ============
  async setTicketRootCause(ticketId, { rcaId, rcaNote, confirmedBy, confirmedAt } = {}) {
    if (!ticketId || !rcaId || !confirmedBy) throw new Error("ticketId, rcaId, confirmedBy are required");
    const payload = omitNullish({
      rca_id: rcaId,
      rca_note: rcaNote,
      confirmed_by: confirmedBy,
      confirmed_at: confirmedAt,
    });
    const r = await fetch(`/api/post-gres-apis/tickets/${encodeURIComponent(ticketId)}/root-cause`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return json(r); // returns TicketOut
  },
};

export default TaxonomyModel;
