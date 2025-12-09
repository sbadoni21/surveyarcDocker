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
  async create(data) {
    const payload = defaultData({
      projectId: data.projectId, orgId: data.orgId, name: data.name,
      description: data.description, ownerUID: data.ownerUID,
    });
    const res = await fetch(`${BASE}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify(payload),
    });
    return snakeToCamel(await toJson(res));
  },

  async getAll(orgId) {
    const url = new URL(`${BASE}`, window.location.origin);
    url.searchParams.set("orgId", String(orgId));
    const res = await fetch(url.toString(), { cache: "no-store" });
    const data = await toJson(res);
    return Array.isArray(data) ? data.map(snakeToCamel) : [];
  },

  async getById(orgId, projectId) {
    const url = new URL(`${BASE}/${projectId}`, window.location.origin);
    url.searchParams.set("orgId", String(orgId));
    const res = await fetch(url.toString(), { cache: "no-store" });
    return snakeToCamel(await toJson(res));
  },

  async update(orgId, projectId, patch) {
    const res = await fetch(`${BASE}/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ orgId, ...camelToSnake(patch) }),
    });
    return snakeToCamel(await toJson(res));
  },

  async delete(orgId, projectId) {
    const url = new URL(`${BASE}/${projectId}`, window.location.origin);
    url.searchParams.set("orgId", String(orgId));
    const res = await fetch(url.toString(), { method: "DELETE", cache: "no-store" });
    return toJson(res);
  },

  // ===== MEMBERS =====
  async getMembers(orgId, projectId) {
    const url = new URL(`${BASE}/${projectId}/members`, window.location.origin);
    url.searchParams.set("orgId", String(orgId));
    const res = await fetch(url.toString(), { cache: "no-store" });
    return await toJson(res); // your route already normalizes
  },

  async getMember(orgId, projectId, memberUid) {
    const url = new URL(`${BASE}/${projectId}/members/${memberUid}`, window.location.origin);
    url.searchParams.set("orgId", String(orgId));
    const res = await fetch(url.toString(), { cache: "no-store" });
    return await toJson(res);
  },

  async addMember(orgId, projectId, member) {
    const res = await fetch(`${BASE}/${projectId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ orgId, ...member }),
    });
    return await toJson(res);
  },

  async updateMember(orgId, projectId, memberUid, memberUpdate) {
    const res = await fetch(`${BASE}/${projectId}/members/${memberUid}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ orgId, ...memberUpdate }),
    });
    return await toJson(res);
  },

  async removeMember(orgId, projectId, memberUid) {
    const url = new URL(`${BASE}/${projectId}/members/${memberUid}`, window.location.origin);
    url.searchParams.set("orgId", String(orgId));
    const res = await fetch(url.toString(), { method: "DELETE", cache: "no-store" });
    return await toJson(res);
  },

  // ===== SURVEYS =====
  async patchSurveys(orgId, projectId, { add = [], remove = [] }) {
    const res = await fetch(`${BASE}/${projectId}/surveys`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ orgId, add, remove }),
    });
    return await toJson(res);
  },
  async addSurveyId(orgId, projectId, surveyId) {
    const res = await fetch(`${BASE}/${projectId}/surveys`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ orgId, surveyId }),
    });
    return await toJson(res);
  },
  async removeSurveyId(orgId, projectId, surveyId) {
    const url = new URL(`${BASE}/${projectId}/surveys/${surveyId}`, window.location.origin);
    url.searchParams.set("orgId", String(orgId));
    const res = await fetch(url.toString(), { method: "DELETE", cache: "no-store" });
    return await toJson(res);
  },
   
  async bulkAddMembers(projectId, userUids, role = "contributor") {
    const res = await fetch(
      `${BASE}/${encodeURIComponent(projectId)}/members/bulk`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_uids: userUids,
          role: role,
        }),
        cache: "no-store",
      }
    );

    return parseJson(res);
  },

  /**
   * Bulk remove multiple members from a project
   * @param {string} projectId - Project ID
   * @param {string[]} userUids - Array of user UIDs to remove
   * @returns {Promise<{removed: number, details: Array}>}
   */
  async bulkRemoveMembers(projectId, userUids) {
    const res = await fetch(
      `${BASE}/${encodeURIComponent(projectId)}/members/bulk-remove`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_uids: userUids,
        }),
        cache: "no-store",
      }
    );

    return parseJson(res);
  },

  // ===== MILESTONES =====
  async listMilestones(orgId, projectId) {
    const url = new URL(`${BASE}/${projectId}/milestones`, window.location.origin);
    url.searchParams.set("orgId", String(orgId));
    const res = await fetch(url.toString(), { cache: "no-store" });
    return await toJson(res);
  },
  async addMilestone(orgId, projectId, milestone) {
    const res = await fetch(`${BASE}/${projectId}/milestones`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ orgId, ...milestone }),
    });
    return await toJson(res);
  },
  async patchMilestone(orgId, projectId, mid, patch) {
    const res = await fetch(`${BASE}/${projectId}/milestones/${mid}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ orgId, ...patch }),
    });
    return await toJson(res);
  },
  async deleteMilestone(orgId, projectId, mid) {
    const url = new URL(`${BASE}/${projectId}/milestones/${mid}`, window.location.origin);
    url.searchParams.set("orgId", String(orgId));
    const res = await fetch(url.toString(), { method: "DELETE", cache: "no-store" });
    return await toJson(res);
  },

  // ===== TAGS =====
  async patchTags(orgId, projectId, { add = [], remove = [] }) {
    const res = await fetch(`${BASE}/${projectId}/tags`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ orgId, add, remove }),
    });
    return await toJson(res);
  },

  // ===== ATTACHMENTS =====
  async listAttachments(orgId, projectId) {
    const url = new URL(`${BASE}/${projectId}/attachments`, window.location.origin);
    url.searchParams.set("orgId", String(orgId));
    const res = await fetch(url.toString(), { cache: "no-store" });
    return await toJson(res);
  },
  async addAttachment(orgId, projectId, attachment) {
    const res = await fetch(`${BASE}/${projectId}/attachments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ orgId, ...attachment }),
    });
    return await toJson(res);
  },
  async removeAttachment(orgId, projectId, aid) {
    const url = new URL(`${BASE}/${projectId}/attachments/${aid}`, window.location.origin);
    url.searchParams.set("orgId", String(orgId));
    const res = await fetch(url.toString(), { method: "DELETE", cache: "no-store" });
    return await toJson(res);
  },

  // ===== STATUS / TIMELINE / PROGRESS =====
  async setStatus(orgId, projectId, { status, reason }) {
    const res = await fetch(`${BASE}/${projectId}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ orgId, status, reason }),
    });
    return await toJson(res);
  },
  async timeline(orgId, projectId) {
    const url = new URL(`${BASE}/${projectId}/timeline`, window.location.origin);
    url.searchParams.set("orgId", String(orgId));
    const res = await fetch(url.toString(), { cache: "no-store" });
    return await toJson(res);
  },
  async recomputeProgress(orgId, projectId) {
    const res = await fetch(`${BASE}/${projectId}/progress/recompute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ orgId }),
    });
    return await toJson(res);
  },

  // ===== ORG-SCOPED =====
  async search(orgId, query) {
    const res = await fetch(`${BASE}/org/${orgId}/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify(query || {}),
    });
    return await toJson(res);
  },
  async bulk(orgId, body) {
    const res = await fetch(`${BASE}/org/${orgId}/bulk`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify(body || {}),
    });
    return await toJson(res);
  },
  async listFavorites(orgId, userId) {
    const res = await fetch(`${BASE}/org/${orgId}/favorites/${userId}`, { cache: "no-store" });
    return await toJson(res);
  },
  async addFavorite(orgId, userId, projectId) {
    const res = await fetch(`${BASE}/projects/${projectId}/org/${orgId}/favorites/${userId}`, {
      method: "POST", cache: "no-store",
    });
    return await toJson(res);
  },
  async removeFavorite(orgId, userId, projectId) {
    const res = await fetch(`${BASE}/org/${orgId}/favorites/${userId}/${projectId}`, {
      method: "DELETE", cache: "no-store",
    });
    return await toJson(res);
  },
};

export default projectModel;
