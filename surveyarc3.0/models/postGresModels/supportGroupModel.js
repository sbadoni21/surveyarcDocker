const BASE = "/api/post-gres-apis/support-groups";
const json = async (r) => (r.ok ? r.json() : Promise.reject(await r.text()));

const toCamel = (g) => ({
  groupId: g.group_id,
  orgId: g.org_id,
  name: g.name,
  email: g.email,
  description: g.description,
  createdAt: g.created_at,
  updatedAt: g.updated_at,
});

const SupportGroupModel = {
  async list(orgId) {
    const r = await fetch(`${BASE}?org_id=${encodeURIComponent(orgId)}`, { cache: "no-store" });
    return (await json(r)).map(toCamel);
  },
  async get(groupId) {
    const r = await fetch(`${BASE}/${encodeURIComponent(groupId)}`, { cache: "no-store" });
    return toCamel(await json(r));
  },
  async create(body) {
    const r = await fetch(BASE, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return toCamel(await json(r));
  },
  async remove(groupId) {
    const r = await fetch(`${BASE}/${encodeURIComponent(groupId)}`, { method: "DELETE" });
    if (!r.ok && r.status !== 204) throw new Error(await r.text());
    return true;
  },

  async listMembers(groupId) {
    const r = await fetch(`${BASE}/${encodeURIComponent(groupId)}/members`, { cache: "no-store" });
    return json(r);
  },
  async addMember(groupId, body) {
    const r = await fetch(`${BASE}/${encodeURIComponent(groupId)}/members`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return json(r);
  },
  async updateMember(groupId, userId, patch) {
    const r = await fetch(`${BASE}/${encodeURIComponent(groupId)}/members/${encodeURIComponent(userId)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
    return json(r);
  },
  async removeMember(groupId, userId) {
    const r = await fetch(`${BASE}/${encodeURIComponent(groupId)}/members/${encodeURIComponent(userId)}`, { method: "DELETE" });
    if (!r.ok && r.status !== 204) throw new Error(await r.text());
    return true;
  },
};

export default SupportGroupModel;
