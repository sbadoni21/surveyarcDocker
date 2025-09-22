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

// Default data structure for a project
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
    const url = new URL(BASE, window.location.origin);
    url.searchParams.set("orgId", String(orgId));
    const res = await fetch(url.toString(), { cache: "no-store" });
    return toJson(res);
  },

  async getById(orgId, projectId) {
    const res = await fetch(`${BASE}/${orgId}/${projectId}`, {
      cache: "no-store",
    });
    return toJson(res);
  },

  async update(orgId, projectId, patch) {
    console.log(patch)
    const res = await fetch(`${BASE}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ orgId, projectId, ...patch }),
    });
    return toJson(res);
  },

  async delete(orgId, projectId) {
    const res = await fetch(`${BASE}/${orgId}/${projectId}`, {
      method: "DELETE",
      cache: "no-store",
    });
    return toJson(res);
  },
};

export default projectModel;
