const BASE = "/en/api/post-gres-apis/tickets";

const ok = async (res) => {
  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText} :: ${msg}`);
  }
  return res.json();
};

const ticketModel = {
  // data = { org_id, survey_id, question_id, subject, description?, created_by, status?, priority?, assigned_to? }
  async create(data) {
    const res = await fetch(`${BASE}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
      cache: "no-store",
    });
    return ok(res);
  },

  async get(ticketId) {
    const res = await fetch(`${BASE}/${encodeURIComponent(ticketId)}`, { cache: "no-store" });
    return ok(res);
  },

  async update(ticketId, patch) {
    const res = await fetch(`${BASE}/${encodeURIComponent(ticketId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
      cache: "no-store",
    });
    return ok(res);
  },

  async remove(ticketId) {
    const res = await fetch(`${BASE}/${encodeURIComponent(ticketId)}`, { method: "DELETE" });
    return ok(res);
  },

  async listByOrg(orgId) {
    const url = `${BASE}?org_id=${encodeURIComponent(orgId)}`;
    const res = await fetch(url, { cache: "no-store" });
    return ok(res);
  },

  async listBySurvey(surveyId) {
    const url = `${BASE}?survey_id=${encodeURIComponent(surveyId)}`;
    const res = await fetch(url, { cache: "no-store" });
    return ok(res);
  },

  async listByQuestion(questionId) {
    const url = `${BASE}?question_id=${encodeURIComponent(questionId)}`;
    const res = await fetch(url, { cache: "no-store" });
    return ok(res);
  },

  async addComment(ticketId, { uid, comment }) {
    const res = await fetch(`${BASE}/${encodeURIComponent(ticketId)}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uid, comment }),
      cache: "no-store",
    });
    return ok(res);
  },
};

export default ticketModel;
