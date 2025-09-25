// models/postGresModels/worklogModel.js
const BASE = "/api/post-gres-apis/tickets";

const json = async (res) => {
  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText} :: ${msg}`);
  }
  return res.json();
};

const WorklogModel = {
  async list(ticketId) {
    const res = await fetch(`${BASE}/${encodeURIComponent(ticketId)}/worklogs`, {
      cache: "no-store",
    });
    return json(res); // [{ worklog_id, ticket_id, user_id, minutes, kind, note, created_at }]
  },

  async create(ticketId, { userId, minutes, kind = "other", note }) {
    const res = await fetch(`${BASE}/${encodeURIComponent(ticketId)}/worklogs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: userId,
        minutes,
        kind,
        note,
      }),
    });
    return json(res);
  },
};

export default WorklogModel;
