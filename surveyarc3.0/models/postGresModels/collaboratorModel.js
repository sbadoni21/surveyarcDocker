// models/postGresModels/collaboratorModel.js
const BASE = "/api/post-gres-apis/tickets";

const json = async (res) => {
  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText} :: ${msg}`);
  }
  return res.json();
};

const CollaboratorModel = {
  async list(ticketId) {
    const res = await fetch(`${BASE}/${encodeURIComponent(ticketId)}/collaborators`, { cache: "no-store" });
    return json(res); // [{ collab_id, ticket_id, user_id, role, created_at }]
  },

  async add(ticketId, { userId, role = "contributor" }) {
    const body = { ticket_id: ticketId, user_id: userId, role };
    const res = await fetch(`${BASE}/${encodeURIComponent(ticketId)}/collaborators`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    return json(res);
  },

  async remove(ticketId, userId) {
    const res = await fetch(`${BASE}/${encodeURIComponent(ticketId)}/collaborators/${encodeURIComponent(userId)}`, {
      method: "DELETE",
      cache: "no-store",
    });
    if (res.status === 204) return true;
    await json(res);
    return true;
  },
};

export default CollaboratorModel;
