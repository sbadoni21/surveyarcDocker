// models/postGresModels/groupModel.js
const BASE = "/api/post-gres-apis/groups";

// ======================= UTIL =======================
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

// ======================= API MODEL =======================
const GroupModel = {
  // --------- GROUPS ---------
  async create(data) {
    // allow both camelCase + snake_case
    const {
      name,
      description,
      org_id,
      orgId,
      owner_uid,
      ownerUid,
      status = "active",
      metaData = {},
      group_type,
      user_id,
      userId,
    } = data || {};

    const finalOrgId = org_id || orgId;
    const finalOwnerUid = owner_uid || ownerUid;
    const finalUserId = user_id || userId;

    const body = {
      name,
      description,
      org_id: finalOrgId,
      owner_uid: finalOwnerUid,
      status,
      group_type,
      // optional, backend doesn’t really need this but harmless:
      user_id: finalUserId,
      meta_data: metaData,
    };

    const res = await fetch(`${BASE}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(finalUserId ? { "X-User-Id": finalUserId } : {}),
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    return parseJson(res);
  },

  async listByOrg(orgId, userId) {
    const res = await fetch(`${BASE}/org/${encodeURIComponent(orgId)}`, {
      headers: {
        ...(userId ? { "X-User-Id": userId } : {}),
      },
      cache: "no-store",
    });
    return parseJson(res);
  },

  async get(groupId, userId) {
    const res = await fetch(`${BASE}/${encodeURIComponent(groupId)}`, {
      headers: {
        ...(userId ? { "X-User-Id": userId } : {}),
      },
      cache: "no-store",
    });
    return parseJson(res);
  },

  async update(groupId, data, userId) {
    const res = await fetch(`${BASE}/${encodeURIComponent(groupId)}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...(userId ? { "X-User-Id": userId } : {}),
      },
      body: JSON.stringify(data),
      cache: "no-store",
    });
    return parseJson(res);
  },

  async delete(groupId, userId) {
    const res = await fetch(`${BASE}/${encodeURIComponent(groupId)}`, {
      method: "DELETE",
      headers: {
        ...(userId ? { "X-User-Id": userId } : {}),
      },
      cache: "no-store",
    });
    return parseJson(res);
  },

  // --------- MEMBERS ---------
  async listMembers(groupId, userId) {
    const res = await fetch(`${BASE}/${encodeURIComponent(groupId)}/members`, {
      headers: {
        ...(userId ? { "X-User-Id": userId } : {}),
      },
      cache: "no-store",
    });
    return parseJson(res);
  },

  async addMember(groupId, userUid, role = "member", userId) {
    const body = { user_uid: userUid, role, group_id: groupId };

    const res = await fetch(`${BASE}/${encodeURIComponent(groupId)}/members`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(userId ? { "X-User-Id": userId } : {}),
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    return parseJson(res);
  },

  async updateMember(groupId, userUid, data, userId) {
    const res = await fetch(
      `${BASE}/${encodeURIComponent(groupId)}/members/${encodeURIComponent(
        userUid
      )}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(userId ? { "X-User-Id": userId } : {}),
        },
        body: JSON.stringify(data),
        cache: "no-store",
      }
    );
    return parseJson(res);
  },
async bulkAddMembers(groupId, userUids, userId, role) {
  const body = { user_uids: userUids };
  if (role) body.role = role; // if you want override

  const res = await fetch(
    `${BASE}/${encodeURIComponent(groupId)}/members/bulk`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(userId ? { "X-User-Id": userId } : {}),
      },
      body: JSON.stringify(body),
      cache: "no-store",
    }
  );
  return parseJson(res);
},

async bulkRemoveMembers(groupId, userUids, userId) {
  const body = { user_uids: userUids };

  const res = await fetch(
    `${BASE}/${encodeURIComponent(groupId)}/members/bulk-remove`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(userId ? { "X-User-Id": userId } : {}),
      },
      body: JSON.stringify(body),
      cache: "no-store",
    }
  );
  return parseJson(res);
},

  async removeMember(groupId, userUid, userId) {
    const res = await fetch(
      `${BASE}/${encodeURIComponent(groupId)}/members/${encodeURIComponent(
        userUid
      )}`,
      {
        method: "DELETE",
        headers: {
          ...(userId ? { "X-User-Id": userId } : {}),
        },
        cache: "no-store",
      }
    );
    return parseJson(res);
  },
};

export default GroupModel;
