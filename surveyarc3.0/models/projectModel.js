// models/postGresModels/projectModel.js
const BASE = "/api/post-gres-apis/projects";

// ---------- helpers ----------
const toJson = async (res) => {
  const txt = await res.text();
  let data = {};
  try { data = txt ? JSON.parse(txt) : {}; } catch {}
  if (!res.ok) {
    const msg = typeof data === "object" && data?.detail ? JSON.stringify(data.detail) : txt;
    throw new Error(`${res.status} ${res.statusText} :: ${msg || "Request failed"}`);
  }
  return data;
};

const snakeToCamel = (obj) => {
  if (Array.isArray(obj)) return obj.map(snakeToCamel);
  if (obj && typeof obj === "object") {
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => {
        const ck = k.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
        return [ck, snakeToCamel(v)];
      })
    );
  }
  return obj;
};

const camelToSnake = (obj) => {
  if (Array.isArray(obj)) return obj.map(camelToSnake);
  if (obj && typeof obj === "object") {
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => {
        const sk = k.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
        return [sk, camelToSnake(v)];
      })
    );
  }
  return obj;
};

// default payload your FastAPI understands
const defaultData = ({ projectId, orgId, name, description = "", ownerUID }) => {
  const now = new Date().toISOString();
  return {
    project_id: projectId,
    org_id: orgId,
    name,
    description,
    owner_uid: ownerUID,
    is_active: true,
    members: [{ uid: ownerUID, role: "owner", status: "active", joined_at: now }],
    start_date: now,
    due_date: null,
    milestones: [],
    status: "planning",
    progress_percent: 0,
    priority: "medium",
    category: "",
    tags: [],
    attachments: [],
    is_public: false,
    notifications_enabled: true,
    last_activity: now,
    survey_ids: [],
    created_at: now,
    updated_at: now,
  };
};

const projectModel = {
  defaultData,

  // ===== CORE =====
  async create(data, userId) {
    const payload = defaultData({
      projectId: data.projectId, orgId: data.orgId, name: data.name,
      description: data.description, ownerUID: data.ownerUID,
    });
    const res = await fetch(`${BASE}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ ...payload, user_id: userId }),
    });
    return snakeToCamel(await toJson(res));
  },

  async getAll(orgId, userId) {
    const url = new URL(`${BASE}`, window.location.origin);
    url.searchParams.set("orgId", String(orgId));
    url.searchParams.set("userId", String(userId));
    const res = await fetch(url.toString(), { cache: "no-store" });
    const data = await toJson(res);
    return Array.isArray(data) ? data.map(snakeToCamel) : [];
  },

  async getById(orgId, projectId, userId) {
    const url = new URL(`${BASE}/${projectId}`, window.location.origin);
    url.searchParams.set("orgId", String(orgId));
    url.searchParams.set("userId", String(userId));
    const res = await fetch(url.toString(), { cache: "no-store" });
    return snakeToCamel(await toJson(res));
  },

  async update(orgId, projectId, patch, userId) {
    const res = await fetch(`${BASE}/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ orgId, user_id: userId, ...camelToSnake(patch) }),
    });
    return snakeToCamel(await toJson(res));
  },

  async deleteProject(orgId, projectId, userId) {
    const res = await fetch(
      `${BASE}/${projectId}?orgId=${orgId}&userId=${userId}`,
      { method: "DELETE", cache: "no-store" }
    );
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  // ===== MEMBERS =====
  async getMembers(orgId, projectId, userId) {
    const url = new URL(`${BASE}/${projectId}/members`, window.location.origin);
    url.searchParams.set("orgId", String(orgId));
    url.searchParams.set("userId", String(userId));
    const res = await fetch(url.toString(), { cache: "no-store" });
    return await toJson(res);
  },

  async getMember(orgId, projectId, memberUid, userId) {
    const url = new URL(`${BASE}/${projectId}/members/${memberUid}`, window.location.origin);
    url.searchParams.set("orgId", String(orgId));
    url.searchParams.set("userId", String(userId));
    const res = await fetch(url.toString(), { cache: "no-store" });
    return await toJson(res);
  },

  async addMember(orgId, projectId, member, userId) {
    const res = await fetch(`${BASE}/${projectId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ orgId, user_id: userId, ...member }),
    });
    return await toJson(res);
  },

  async updateMember(orgId, projectId, memberUid, memberUpdate, userId) {
    const res = await fetch(`${BASE}/${projectId}/members/${memberUid}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ orgId, user_id: userId, ...memberUpdate }),
    });
    return await toJson(res);
  },

  async removeMember(orgId, projectId, memberUid, userId) {
    const url = new URL(`${BASE}/${projectId}/members/${memberUid}`, window.location.origin);
    url.searchParams.set("orgId", String(orgId));
    url.searchParams.set("userId", String(userId));
    const res = await fetch(url.toString(), { method: "DELETE", cache: "no-store" });
    return await toJson(res);
  },

  async bulkAddMembers(projectId, userUids, role, userId) {
    const res = await fetch(
      `${BASE}/${encodeURIComponent(projectId)}/members/bulk`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_uids: userUids,
          role: role,
          user_id: userId,
        }),
        cache: "no-store",
      }
    );
    return toJson(res);
  },

  async bulkRemoveMembers(projectId, userUids, userId) {
    const res = await fetch(
      `${BASE}/${encodeURIComponent(projectId)}/members/bulk-remove`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_uids: userUids,
          user_id: userId,
        }),
        cache: "no-store",
      }
    );
    return toJson(res);
  },

  // ===== SURVEYS =====
  async patchSurveys(orgId, projectId, { add = [], remove = [] }, userId) {
    const res = await fetch(`${BASE}/${projectId}/surveys`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ orgId, user_id: userId, add, remove }),
    });
    return await toJson(res);
  },

  async addSurveyId(orgId, projectId, surveyId, userId) {
    const res = await fetch(`${BASE}/${projectId}/surveys`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ orgId, user_id: userId, surveyId }),
    });
    return await toJson(res);
  },

  async removeSurveyId(orgId, projectId, surveyId, userId) {
    const url = new URL(`${BASE}/${projectId}/surveys/${surveyId}`, window.location.origin);
    url.searchParams.set("orgId", String(orgId));
    url.searchParams.set("userId", String(userId));
    const res = await fetch(url.toString(), { method: "DELETE", cache: "no-store" });
    return await toJson(res);
  },

  // ===== MILESTONES =====
  async listMilestones(orgId, projectId, userId) {
    const url = new URL(`${BASE}/${projectId}/milestones`, window.location.origin);
    url.searchParams.set("orgId", String(orgId));
    url.searchParams.set("userId", String(userId));
    const res = await fetch(url.toString(), { cache: "no-store" });
    return await toJson(res);
  },

  async addMilestone(orgId, projectId, milestone, userId) {
    const res = await fetch(`${BASE}/${projectId}/milestones`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ orgId, user_id: userId, ...milestone }),
    });
    return await toJson(res);
  },

  async patchMilestone(orgId, projectId, mid, patch, userId) {
    const res = await fetch(`${BASE}/${projectId}/milestones/${mid}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ orgId, user_id: userId, ...patch }),
    });
    return await toJson(res);
  },

  async deleteMilestone(orgId, projectId, mid, userId) {
    const url = new URL(`${BASE}/${projectId}/milestones/${mid}`, window.location.origin);
    url.searchParams.set("orgId", String(orgId));
    url.searchParams.set("userId", String(userId));
    const res = await fetch(url.toString(), { method: "DELETE", cache: "no-store" });
    return await toJson(res);
  },

  // ===== TAGS =====
  async patchTags(orgId, projectId, { add = [], remove = [] }, userId) {
    const res = await fetch(`${BASE}/${projectId}/tags`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ orgId, user_id: userId, add, remove }),
    });
    return await toJson(res);
  },

  // ===== ATTACHMENTS =====
  async listAttachments(orgId, projectId, userId) {
    const url = new URL(`${BASE}/${projectId}/attachments`, window.location.origin);
    url.searchParams.set("orgId", String(orgId));
    url.searchParams.set("userId", String(userId));
    const res = await fetch(url.toString(), { cache: "no-store" });
    return await toJson(res);
  },

  async addAttachment(orgId, projectId, attachment, userId) {
    const res = await fetch(`${BASE}/${projectId}/attachments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ orgId, user_id: userId, ...attachment }),
    });
    return await toJson(res);
  },

  async removeAttachment(orgId, projectId, aid, userId) {
    const url = new URL(`${BASE}/${projectId}/attachments/${aid}`, window.location.origin);
    url.searchParams.set("orgId", String(orgId));
    url.searchParams.set("userId", String(userId));
    const res = await fetch(url.toString(), { method: "DELETE", cache: "no-store" });
    return await toJson(res);
  },

  // ===== STATUS / TIMELINE / PROGRESS =====
  async setStatus(orgId, projectId, { status, reason }, userId) {
    const res = await fetch(`${BASE}/${projectId}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ orgId, user_id: userId, status, reason }),
    });
    return await toJson(res);
  },

  async timeline(orgId, projectId, userId) {
    const url = new URL(`${BASE}/${projectId}/timeline`, window.location.origin);
    url.searchParams.set("orgId", String(orgId));
    url.searchParams.set("userId", String(userId));
    const res = await fetch(url.toString(), { cache: "no-store" });
    return await toJson(res);
  },

  async recomputeProgress(orgId, projectId, userId) {
    const res = await fetch(`${BASE}/${projectId}/progress/recompute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ orgId, user_id: userId }),
    });
    return await toJson(res);
  },

  // ===== ORG-SCOPED =====
  async search(orgId, query, userId) {
    const res = await fetch(`${BASE}/org/${orgId}/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ ...(query || {}), user_id: userId }),
    });
    return await toJson(res);
  },

  async bulk(orgId, body, userId) {
    if (!body?.op) {
      throw new Error("Bulk op is required");
    }
    const changeBody = camelToSnake({ ...body, userId });
    const method = body.op === "delete" ? "DELETE" : "POST";

    const res = await fetch(
      `/api/post-gres-apis/projects/org/${orgId}/bulk`,
      {
        method,
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify(changeBody),
      }
    );

    return await toJson(res);
  },

  async listFavorites(orgId, userId) {
    const res = await fetch(`${BASE}/org/${orgId}/favorites/${userId}`, { cache: "no-store" });
    return await toJson(res);
  },

  async addFavorite(orgId, userId, projectId) {
    console.log("first");
    const res = await fetch(`${BASE}/${projectId}/org/${orgId}/favorites/${userId}`, {
      method: "POST", cache: "no-store",
    });
    return await toJson(res);
  },

  async removeFavorite(orgId, userId, projectId) {
    const res = await fetch(`${BASE}/${projectId}/org/${orgId}/favorites/${userId}`, {
      method: "DELETE", cache: "no-store",
    });
    return await toJson(res);
  },
};

export default projectModel;