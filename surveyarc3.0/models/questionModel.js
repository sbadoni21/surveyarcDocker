const BASE = "/api/post-gres-apis/questions";

const json = async (res) => {
  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText} :: ${msg}`);
  }
  return res.json();
};

const toCamel = (q) => ({
  questionId: q.question_id,
  surveyId: q.survey_id,
  orgId: q.org_id,
  projectId: q.project_id,
  type: q.type,
  label: q.label,
  required: q.required,
  description: q.description,
  config: q.config,
  logic: q.logic,
  createdAt: q.created_at,
  updatedAt: q.updated_at,
});

const QuestionModel = {
  async create(orgId, surveyId, data) {
    const body = {
      org_id: orgId,
      project_id: data.projectId,
      survey_id: surveyId,
      question_id: data.questionId,       // optional
      type: data.type,
      label: data.label,
      required: data.required ?? true,
      description: data.description || "",
      config: data.config || {},
      logic: data.logic || [],
    };
    console.log(body)
    const res = await fetch(`${BASE}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const out = await json(res);
    return toCamel(out);
  },

  async getAll(orgId, surveyId) {
    const res = await fetch(`${BASE}?survey_id=${encodeURIComponent(surveyId)}`, { cache: "no-store" });
    const arr = await json(res);
    return (arr || []).map(toCamel);
  },

  async get(orgId, surveyId, questionId) {
    const res = await fetch(`${BASE}/${encodeURIComponent(surveyId)}/${encodeURIComponent(questionId)}`, { cache: "no-store" });
    const q = await json(res);
    console.log(q)
    return toCamel(q);
  },
async getBulkQuestions(questionIds) {
  const res = await fetch(`${BASE}/bulk-questions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question_ids: questionIds }), // Wrap in object
    cache: "no-store",
  });
  const q = await res.json(); // Fix: use res.json() instead of json(res)
  return q;
},
  async update(orgId, surveyId, questionId, updateData) {
    const res = await fetch(`${BASE}/${encodeURIComponent(surveyId)}/${encodeURIComponent(questionId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updateData),
      cache: "no-store",
    });
    const q = await json(res);
    return toCamel(q);
  },

  async delete(orgId, surveyId, questionId) {
    const res = await fetch(`${BASE}/${encodeURIComponent(surveyId)}/${encodeURIComponent(questionId)}`, {
      method: "DELETE",
      cache: "no-store",
    });
    return json(res);
  },
};

export default QuestionModel;
