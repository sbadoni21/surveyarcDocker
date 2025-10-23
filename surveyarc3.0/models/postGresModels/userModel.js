// models/postGresModels/userModel.js
const BASE = "/api/post-gres-apis/users";

const json = async (res) => {
  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    
    throw new Error(`${res.status} ${res.statusText} :: ${msg}`);
  }
  return res.json();
};

const UserModel = {
  /**
   * Create a new user
   * POST /users/
   */
  async create({ uid, email, displayName, role = "user", orgIds = [], status = "active", metaData = {} }) {
    const body = {
      uid,
      email,
      display_name: displayName || "",
      role,
      org_ids: orgIds,
      status,
      meta_data: metaData,
    };
    
    const res = await fetch(`${BASE}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    
    return json(res);
  },

  /**
   * Get user by UID
   * GET /users/{uid}
   */
  async get(uid) {
    const res = await fetch(`${BASE}/${encodeURIComponent(uid)}`, {
      method: "GET",
      cache: "no-store",
    });
    return json(res);
  },

  /**
   * Update user
   * PATCH /users/{uid}
   */
  async update(uid, data) {
    const res = await fetch(`${BASE}/org/${encodeURIComponent(uid)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
      cache: "no-store",
    });
    return json(res);
  },

  /**
   * Delete user
   * DELETE /users/{uid}
   */
  async delete(uid) {
    const res = await fetch(`${BASE}/${encodeURIComponent(uid)}`, {
      method: "DELETE",
      cache: "no-store",
    });
    return json(res);
  },

  /**
   * Track user login
   * POST /users/{uid}/login
   */
  async login(uid) {
    const res = await fetch(`${BASE}/${encodeURIComponent(uid)}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    });
    return json(res);
  },

  /**
   * Add organization to user
   * POST /users/{uid}/orgs
   */
  async addOrg(uid, orgId) {
    const res = await fetch(`${BASE}/${encodeURIComponent(uid)}/orgs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ org_id: orgId }),
      cache: "no-store",
    });
    return json(res);
  },

  /**
   * Activate user
   * POST /users/{uid}/activate
   */
  async activate(uid) {
    const res = await fetch(`${BASE}/${encodeURIComponent(uid)}/activate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    });
    return json(res);
  },

  /**
   * Suspend user
   * POST /users/{uid}/suspend
   */
  async suspend(uid) {
    const res = await fetch(`${BASE}/${encodeURIComponent(uid)}/suspend`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    });
    return json(res);
  },

  /**
   * List users by organization
   * GET /users/org/{org_id}
   */
  async listByOrg(orgId) {
    const res = await fetch(`${BASE}/org/${encodeURIComponent(orgId.orgId)}`, {
      cache: "no-store",
    });
    return json(res);
  },

  /**
   * List active users by organization (client-side filter)
   */
  async listActiveByOrg(orgId) {
    const users = await this.listByOrg(orgId);
    return (users || []).filter((u) => u?.status === "active");
  },

  /**
   * Get user session
   * GET /users/{uid}/session
   */
  async getSession(uid) {
    const res = await fetch(`${BASE}/${encodeURIComponent(uid)}/session`, {
      method: "GET",
      cache: "no-store",
    });
    return json(res);
  },

  /**
   * Invalidate user session (logout)
   * DELETE /users/{uid}/session
   */
  async logout(uid) {
    const res = await fetch(`${BASE}/${encodeURIComponent(uid)}/session`, {
      method: "DELETE",
      cache: "no-store",
    });
    return json(res);
  },

  /**
   * Get user by email
   * GET /users/email/{email}
   */
  async getByEmail(email) {
    const res = await fetch(`${BASE}/email/${encodeURIComponent(email)}`, {
      cache: "no-store",
    });
    return json(res);
  },

  /**
   * Utility method: Check if user exists
   */
  async exists(uid) {
    try {
      await this.get(uid);
      return true;
    } catch (error) {
      if (error.message.includes('404')) {
        return false;
      }
      throw error;
    }
  },

  /**
   * Utility method: Check if user is active
   */
  async isActive(uid) {
    try {
      const user = await this.get(uid);
      return user.status === "active";
    } catch (error) {
      return false;
    }
  }
};

export default UserModel;