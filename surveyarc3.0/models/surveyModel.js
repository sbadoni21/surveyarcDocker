const BASE = "/api/post-gres-apis/surveys";

const json = async (res) => {
  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText} :: ${msg}`);
  }
  return res.json();
};

const SurveyModel = {
  async create(orgId, data) {
    const body = {
      org_id: orgId,
      project_id: data.projectId,
      name: data.name,
      time: data.time,
      status: "draft",
      created_by: data.createdBy,
      updated_by: data.createdBy,
      settings: { anonymous: false },
      question_order: [],
      meta_data: {},
      // optional: start with empty structure
      blocks: [],
      block_order: [],
    };
    const res = await fetch(`${BASE}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    return json(res);
  },

  async get(surveyId) {
    const res = await fetch(`${BASE}/${encodeURIComponent(surveyId)}`, {
      method: "GET",
      cache: "no-store",
    });
    return json(res);
  },
  
  async getAll(orgId) {
    const url = new URL(BASE, window.location.origin);
    if (orgId) {
      url.searchParams.set("org_id", String(orgId));
    }
    const res = await fetch(url.toString(), {
      method: "GET",
      cache: "no-store",
    });
    return json(res);
  },

  async getAllByProject(projectId) {
    const res = await fetch(`${BASE}?project_id=${encodeURIComponent(projectId)}`, {
      method: "GET",
      cache: "no-store",
    });
    return json(res);
  },

  async update(surveyId, data) {
    // 🔹 convert camelCase → snake_case for the API
    const payload = { ...data };
    if ("blockOrder" in payload) {
      payload.block_order = payload.blockOrder;
      delete payload.blockOrder;
    }
    // (questionOrder is already snake? if you use camel, map it too)
    if ("questionOrder" in payload) {
      payload.question_order = payload.questionOrder;
      delete payload.questionOrder;
    }

    const res = await fetch(`${BASE}/${encodeURIComponent(surveyId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
    return json(res);
  },

  async delete(surveyId) {
    const res = await fetch(`${BASE}/${encodeURIComponent(surveyId)}`, {
      method: "DELETE",
      cache: "no-store",
    });
    return json(res);
  },

  async listResponses(surveyId) {
    const res = await fetch(`${BASE}/${encodeURIComponent(surveyId)}/responses`, {
      cache: "no-store",
    });
    return json(res);
  },

  async countResponses(surveyId) {
    const res = await fetch(`${BASE}/${encodeURIComponent(surveyId)}/responses?count=1`, {
      cache: "no-store",
    });
    return json(res);
  },
};

export default SurveyModel;
