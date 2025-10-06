// models/postGresModels/projectModel.js
const BASE = "/api/post-gres-apis/projects";

const toJson = async (res) => {
  const txt = await res.text();
  let data = {};
  try {
    data = txt ? JSON.parse(txt) : {};
  } catch {
    /* ignore parse error */
  }
  if (!res.ok) {
    const msg =
      typeof data === "object" && data?.detail
        ? JSON.stringify(data.detail)
        : txt;
    throw new Error(`${res.status} ${res.statusText} :: ${msg || "Request failed"}`);
  }
  return data;
};

const defaultData = ({ projectId, orgId, name, description = "", ownerUID }) => {
  const now = new Date().toISOString();
  return {
    project_id: projectId,
    org_id: orgId,
    name,
    description,
    owner_uid: ownerUID,
    is_active: true,
    members: [
      { uid: ownerUID, role: "owner", status: "active", joined_at: now },
    ],
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

  // ========== PROJECT OPERATIONS ==========
  
  async create(data) {
    const payload = defaultData({
      projectId: data.projectId,
      orgId: data.orgId,
      name: data.name,
      description: data.description,
      ownerUID: data.ownerUID,
    });
    const res = await fetch(`${BASE}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify(payload),
    });
    return toJson(res);
  },

  async getAll(orgId) {
    const url = new URL(`${BASE}`, window.location.origin);
    url.searchParams.set("orgId", String(orgId));
    const res = await fetch(url.toString(), { cache: "no-store" });
    const txt = await res.text();
    let data;
    try {
      data = txt ? JSON.parse(txt) : [];
    } catch {
      data = [];
    }
    if (!Array.isArray(data)) data = [];
    return data;
  },

  async getById(orgId, projectId) {
    const url = new URL(`${BASE}/${projectId}`, window.location.origin);
    url.searchParams.set("orgId", String(orgId));
    const res = await fetch(url.toString(), { cache: "no-store" });
    return toJson(res);
  },

  async update(orgId, projectId, patch) {
    const res = await fetch(`${BASE}/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ orgId, ...patch }),
    });
    return toJson(res);
  },

  async delete(orgId, projectId) {
    const url = new URL(`${BASE}/${projectId}`, window.location.origin);
    url.searchParams.set("orgId", String(orgId));
    const res = await fetch(url.toString(), { method: "DELETE", cache: "no-store" });
    return toJson(res);
  },

  // ========== MEMBER OPERATIONS ==========
  
  async getMembers(orgId, projectId) {
    const url = new URL(`${BASE}/${projectId}/members`, window.location.origin);
    url.searchParams.set("orgId", String(orgId));
    const res = await fetch(url.toString(), { cache: "no-store" });
    return toJson(res);
  },

  async getMember(orgId, projectId, memberUid) {
    const url = new URL(`${BASE}/${projectId}/members/${memberUid}`, window.location.origin);
    url.searchParams.set("orgId", String(orgId));
    const res = await fetch(url.toString(), { cache: "no-store" });
    return toJson(res);
  },

  async addMember(orgId, projectId, member) {
    const res = await fetch(`${BASE}/${projectId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ orgId, ...member }),
    });
    return toJson(res);
  },

  async updateMember(orgId, projectId, memberUid, memberUpdate) {
    const res = await fetch(`${BASE}/${projectId}/members/${memberUid}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ orgId, ...memberUpdate }),
    });
    return toJson(res);
  },

  async removeMember(orgId, projectId, memberUid) {
    const url = new URL(`${BASE}/${projectId}/members/${memberUid}`, window.location.origin);
    url.searchParams.set("orgId", String(orgId));
    const res = await fetch(url.toString(), { method: "DELETE", cache: "no-store" });
    return toJson(res);
  },

  // ========== SURVEY OPERATIONS ==========
  
  async getSurveys(orgId, projectId) {
    const url = new URL(`${BASE}/${projectId}/surveys`, window.location.origin);
    url.searchParams.set("orgId", String(orgId));
    const res = await fetch(url.toString(), { cache: "no-store" });
    return toJson(res);
  },

  async addSurveyId(orgId, projectId, surveyId) {
    const res = await fetch(`${BASE}/${projectId}/surveys`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ orgId, surveyId }),
    });
    return toJson(res);
  },

  async removeSurveyId(orgId, projectId, surveyId) {
    const url = new URL(`${BASE}/${projectId}/surveys/${surveyId}`, window.location.origin);
    url.searchParams.set("orgId", String(orgId));
    const res = await fetch(url.toString(), { method: "DELETE", cache: "no-store" });
    return toJson(res);
  },
};

export default projectModel;