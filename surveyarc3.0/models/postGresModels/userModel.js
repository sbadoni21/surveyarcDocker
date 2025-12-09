// models/postGresModels/userModel.js
const BASE = "/api/post-gres-apis/users";

// Generic response handler
const parseJson = async (res) => {
  const text = await res.text();
  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }

  if (!res.ok) {
    const msg =
      data?.detail ||
      data?.message ||
      data?.error ||
      res.statusText ||
      "Request failed";
    throw new Error(msg);
  }

  return data;
};

const UserModel = {
  /**
   * Admin-create a new user (via /users/admin-create)
   * ✅ FIXED: Removed double destructuring
   */
  async adminCreate(data) {  // ✅ Changed from { data } to data
    const {
      email,
      password,
      current_user_id,
      displayName,
      role = "member",
      orgId,
      status = "active",
      metaData = {},
    } = data;

    const body = {
      email,
      password, 
      current_user_id,
      display_name: displayName || "",
      role,
      org_id: String(orgId),
      status,
      meta_data: metaData,
    };

    const res = await fetch(`${BASE}/admin-create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    return parseJson(res);
  },

  /**
   * Create user via plain /users/ (non-admin)
   */
  async create({
    uid,
    email,
    displayName,
    role = "member",
    orgIds = [],
    status = "active",
    metaData = {},
  }) {
    const body = {
      uid,
      email,
      display_name: displayName || "",
      role,
      org_ids: (orgIds || []).map(String),
      status,
      meta_data: metaData,
    };

    const res = await fetch(`${BASE}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    return parseJson(res);
  },

  async get(uid) {
    const res = await fetch(`${BASE}/${encodeURIComponent(uid)}`, {
      method: "GET",
      cache: "no-store",
    });
    return parseJson(res);
  },

  async update(uid, data) {
    const res = await fetch(`${BASE}/${encodeURIComponent(uid)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
      cache: "no-store",
    });
    return parseJson(res);
  },

  async delete(uid) {
    const res = await fetch(`${BASE}/${encodeURIComponent(uid)}`, {
      method: "DELETE",
      cache: "no-store",
    });
    return parseJson(res);
  },

  async login(uid) {
    const res = await fetch(`${BASE}/${encodeURIComponent(uid)}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    });
    return parseJson(res);
  },

  async addOrg(uid, orgId) {
    const res = await fetch(`${BASE}/${encodeURIComponent(uid)}/orgs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ org_id: String(orgId) }),
      cache: "no-store",
    });
    return parseJson(res);
  },

  async activate(uid) {
    const res = await fetch(`${BASE}/${encodeURIComponent(uid)}/activate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    });
    return parseJson(res);
  },

  async suspend(uid) {
    const res = await fetch(`${BASE}/${encodeURIComponent(uid)}/suspend`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    });
    return parseJson(res);
  },

  async listByOrg(orgId) {
    const id = typeof orgId === "object" ? orgId.orgId : orgId;
    const res = await fetch(`${BASE}/org/${encodeURIComponent(id)}`, {
      cache: "no-store",
    });
    return parseJson(res);
  },

  async listActiveByOrg(orgId) {
    const users = await this.listByOrg(orgId);
    return (users || []).filter((u) => u?.status === "active");
  },

  async getByEmail(email) {
    const res = await fetch(`${BASE}/email/${encodeURIComponent(email)}`, {
      cache: "no-store",
    });
    return parseJson(res);
  },

  async exists(uid) {
    try {
      await this.get(uid);
      return true;
    } catch (error) {
      if (error.message?.includes("404")) return false;
      throw error;
    }
  },
  async getUsersByIds(uids) {
    if (!uids || uids.length === 0) {
      return [];
    }

    // Remove duplicates and validate
    const uniqueIds = [...new Set(uids)].filter(Boolean);
    
    if (uniqueIds.length === 0) {
      return [];
    }

    if (uniqueIds.length > 100) {
      console.warn("[UserModel] Truncating request to 100 user IDs");
      uniqueIds.splice(100);
    }

    const res = await fetch(`${BASE}/batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_ids: uniqueIds }),
      cache: "no-store",
    });

    return parseJson(res);
  },
  async isActive(uid) {
    try {
      const user = await this.get(uid);
      return user.status === "active";
    } catch {
      return false;
    }
  },
};

export default UserModel;