const BASE = "/api/post-gres-apis/responses";

const json = async (res) => {
  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText} :: ${msg}`);
  }
  return res.json();
};

const toCamel = (r) => ({
  responseId: r.response_id,
  orgId: r.org_id,
  surveyId: r.survey_id,
  respondentId: r.respondent_id,
  status: r.status,
  startedAt: r.started_at,
  completedAt: r.completed_at,
  metaData: r.meta_data || {},
  answers: r.answers || [],              // when server returns aggregated answers
  updatedAt: r.updated_at,
});

const ResponseModel = {
  async create(orgId, surveyId, data) {
    const body = {
      org_id: orgId,
      survey_id: surveyId,
      response_id: data.responseId,           // you can pre-generate, or omit
      respondent_id: data.respondentId,
      status: data.status ?? "started",
      meta_data: data.metaData || {},
      answers: Array.isArray(data.answers) ? data.answers : [], // [{questionId, answer, projectId?}]
    };
    const res = await fetch(`${BASE}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const out = await json(res);
    return toCamel(out);
  },

  async getAllBySurvey(surveyId) {
    const res = await fetch(`${BASE}?survey_id=${encodeURIComponent(surveyId)}`, { cache: "no-store" });
    const arr = await json(res);
    return (arr || []).map(toCamel);
  },

  async get(surveyId, responseId) {
    const res = await fetch(`${BASE}/${encodeURIComponent(surveyId)}/${encodeURIComponent(responseId)}`, { cache: "no-store" });
    const r = await json(res);
    return toCamel(r);
  },

  async update(surveyId, responseId, data) {
    const res = await fetch(`${BASE}/${encodeURIComponent(surveyId)}/${encodeURIComponent(responseId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data), // snake/camel handled server-side
      cache: "no-store",
    });
    const r = await json(res);
    return toCamel(r);
  },

  async delete(surveyId, responseId) {
    const res = await fetch(`${BASE}/${encodeURIComponent(surveyId)}/${encodeURIComponent(responseId)}`, {
      method: "DELETE",
      cache: "no-store",
    });
    return json(res);
  },

  async count(surveyId) {
    const res = await fetch(`${BASE}/count?survey_id=${encodeURIComponent(surveyId)}`, { cache: "no-store" });
    return json(res); // { count: number }
  },
};

export default ResponseModel;
