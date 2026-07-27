const BASE = "/api/post-gres-apis/surveys";

const json = async (res) => {
  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText} :: ${msg}`);
  }
  return res.json();
};

const normalizeSurvey = (survey) => {
  if (!survey || typeof survey !== "object") return survey;

  const surveyId = survey.survey_id || survey.surveyId || survey.id || null;
  const orgId = survey.org_id || survey.orgId || null;
  const projectId = survey.project_id || survey.projectId || null;
  const createdAt = survey.created_at || survey.createdAt || null;
  const updatedAt = survey.updated_at || survey.updatedAt || null;
  const questionOrder = survey.question_order || survey.questionOrder || [];
  const blockOrder = survey.block_order || survey.blockOrder || [];

  return {
    ...survey,
    survey_id: surveyId,
    surveyId,
    org_id: orgId,
    orgId,
    project_id: projectId,
    projectId,
    created_at: createdAt,
    createdAt,
    updated_at: updatedAt,
    updatedAt,
    question_order: questionOrder,
    questionOrder,
    block_order: blockOrder,
    blockOrder,
  };
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
      question_order: data.questionOrder || data.question_order || [],
      meta_data: data.metaData || data.meta_data || {},
      blocks: data.blocks || [],
      block_order: data.blockOrder || data.block_order || [],
    };
    const res = await fetch(`${BASE}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    return normalizeSurvey(await json(res));
  },

  async get(surveyId) {
    const res = await fetch(`${BASE}/${encodeURIComponent(surveyId)}`, {
      method: "GET",
      cache: "no-store",
    });
    return normalizeSurvey(await json(res));
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
    const data = await json(res);
    return Array.isArray(data) ? data.map(normalizeSurvey) : normalizeSurvey(data);
  },

  async getAllByProject(projectId) {
    const res = await fetch(`${BASE}?project_id=${encodeURIComponent(projectId)}`, {
      method: "GET",
      cache: "no-store",
    });
    const data = await json(res);
    return Array.isArray(data) ? data.map(normalizeSurvey) : normalizeSurvey(data);
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
    return normalizeSurvey(await json(res));
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
