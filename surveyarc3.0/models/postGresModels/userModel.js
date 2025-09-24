// models/postGresModels/userModel.js
const BASE = "/en/api/post-gres-apis/users";

const json = async (res) => {
  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText} :: ${msg}`);
  }
  return res.json();
};

const UserModel = {
  async create({ uid, email, displayName, role = "member", initialOrgId }) {
    const body = {
      uid,
      email,
      org_ids: [],
      display_name: displayName || "",
      role,
      meta_data: {},
    };
    if (initialOrgId) body.org_ids = [String(initialOrgId)];
    const res = await fetch(`${BASE}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    return json(res);
  },

  async addOrg(uid, orgId) {
    const res = await fetch(`${BASE}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uid, org_ids: [String(orgId)] }),
      cache: "no-store",
    });
    return json(res); // { ok, message, org_ids? }
  },

  async get(uid) {
    const url = new URL(BASE, window.location.origin);
    url.searchParams.set("uid", uid);
    console.log(url.toString());
    console.log("uid", uid);
    const res = await fetch('url.toString()', { cache: "no-store" });
    return json(res);
  },

  async update(uid, data) {
    const res = await fetch(`${BASE}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uid, ...data }),
      cache: "no-store",
    });
    return json(res);
  },

  async delete(uid) {
    const res = await fetch(`${BASE}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uid }),
      cache: "no-store",
    });
    return json(res);
  },
  // NEW ---- list users by org (FastAPI: GET /users/org/{org_id})
  async listByOrg(orgId) {
    const res = await fetch(`${BASE}/org/${encodeURIComponent(orgId)}`, {
      cache: "no-store",
    });
    return json(res); // returns UserOut[]
  },

  // NEW ---- active users by org (client-side filter)
  async listActiveByOrg(orgId) {
    const users = await this.listByOrg(orgId);
    return (users || []).filter((u) => u?.status === "active");
  },
};

export default UserModel;
