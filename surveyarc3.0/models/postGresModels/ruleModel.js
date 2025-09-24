const BASE = "/api/post-gres-apis/rules";

const json = async (res) => {
  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText} :: ${msg}`);
  }
  return res.json();
};

const toCamel = (r) => ({
  ruleId: r.rule_id,
  orgId: r.org_id,
  projectId: r.project_id,
  surveyId: r.survey_id,
  name: r.name,
  blockId: r.block_id,
  enabled: r.enabled,
  priority: r.priority,
  conditions: r.conditions || [],
  actions: r.actions || [],
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const RuleModel = {
  async create(orgId, surveyId, data) {
    const body = {
      org_id: orgId,
      project_id: data.projectId,
      survey_id: surveyId,
      rule_id: data.ruleId,          // optional (you can pre-generate)
      name: data.name || "",
      block_id: data.blockId,
      enabled: data.enabled !== false,
      priority: Number(data.priority || 1),
      conditions: Array.isArray(data.conditions) ? data.conditions : [],
      actions: Array.isArray(data.actions) ? data.actions : [],
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

  async getAll(surveyId) {
    const res = await fetch(`${BASE}?survey_id=${encodeURIComponent(surveyId)}`, { cache: "no-store" });
    const arr = await json(res);
    return (arr || []).map(toCamel);
  },

  async get(surveyId, ruleId) {
    const res = await fetch(`${BASE}/${encodeURIComponent(surveyId)}/${encodeURIComponent(ruleId)}`, { cache: "no-store" });
    const r = await json(res);
    return toCamel(r);
  },

  async update(surveyId, ruleId, updateData) {
    const res = await fetch(`${BASE}/${encodeURIComponent(surveyId)}/${encodeURIComponent(ruleId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updateData), // snake/camel handled server-side
      cache: "no-store",
    });
    const r = await json(res);
    return toCamel(r);
  },

  async delete(surveyId, ruleId) {
    const res = await fetch(`${BASE}/${encodeURIComponent(surveyId)}/${encodeURIComponent(ruleId)}`, {
      method: "DELETE",
      cache: "no-store",
    });
    return json(res);
  },
};

export default RuleModel;
