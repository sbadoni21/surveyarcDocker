// models/postGresModels/supportGroupModel.js
const BASE = "/api/post-gres-apis/support-groups";

const json = async (res) => {
  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText} :: ${msg}`);
  }
  return res.json();
};

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
  async listByOrg(orgId) {
    const qs = new URLSearchParams({ org_id: orgId });
    const res = await fetch(`${BASE}?${qs.toString()}`, { cache: "no-store" });
    const arr = await json(res);
    return (arr || []).map(toCamel);
  },
};

export default SupportGroupModel;
