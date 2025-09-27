const BASE = "/api/post-gres-apis/support/routing";
const json = async (r) => (r.ok ? r.json() : Promise.reject(await r.text()));

const RoutingPolicyModel = {
  async list(orgId) {
    const r = await fetch(`${BASE}?org_id=${encodeURIComponent(orgId)}`, { cache: "no-store" });
    return json(r);
  },
  async get(policyId) {
    const r = await fetch(`${BASE}/${encodeURIComponent(policyId)}`, { cache: "no-store" });
    return json(r);
  },
  async create(body) {
    const r = await fetch(BASE, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return json(r);
  },
  async update(policyId, patch) {
    const r = await fetch(`${BASE}/${encodeURIComponent(policyId)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
    return json(r);
  },
  async remove(policyId) {
    const r = await fetch(`${BASE}/${encodeURIComponent(policyId)}`, { method: "DELETE" });
    if (!r.ok && r.status !== 204) throw new Error(await r.text());
    return true;
  },
  async evaluate(orgId, ticketLike) {
    const qs = new URLSearchParams({ org_id: orgId });
    const r = await fetch(`${BASE}/evaluate?${qs}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(ticketLike) });
    return json(r);
  },
};

export default RoutingPolicyModel;
