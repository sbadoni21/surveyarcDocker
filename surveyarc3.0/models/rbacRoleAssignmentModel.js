const BASE = "/api/post-gres-apis/rbac";

const json = async (res) => {
  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText} :: ${msg}`);
  }
  return res.json();
};

// Optional: normalize response
const toCamel = (r) => ({
  id: r.id,
  userId: r.user_uid,
  roleId: r.role_id,
  roleName: r.role_name || r.role?.name,
  scope: r.scope,
  resourceId: r.resource_id,
  createdAt: r.created_at,
});

const RBACRoleAssignmentModel = {
  // -----------------------------
  // List roles for user
  // -----------------------------
  async listUserRoles(userId) {
    const res = await fetch(`${BASE}/user/${encodeURIComponent(userId)}`, {
      cache: "no-store",
    });
    const arr = await json(res);
    return (arr || []).map(toCamel);
  },

  // -----------------------------
  // Assign role
  // -----------------------------
  async assignRole(data) {
    const body = {
      user_id: data.userId,
      role_name: data.roleName,
      scope: data.scope,              // org | group | team | project
      resource_id: data.resourceId,   // orgId / groupId / projectId
      org_id: data.orgId || null,
    };

    const res = await fetch(`${BASE}/assign-role`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    return toCamel(await json(res));
  },

  // -----------------------------
  // Remove role
  // -----------------------------
  async removeRole(data) {
    const body = {
      user_uid: data.userId,
      role_name: data.roleName,
      scope: data.scope,
      resource_id: data.resourceId,
    };

    const res = await fetch(`${BASE}/remove-role`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    return json(res);
  },
};

export default RBACRoleAssignmentModel;
