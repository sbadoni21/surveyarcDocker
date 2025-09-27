// models/postGresModels/collaboratorModel.js
const BASE = "/api/post-gres-apis/tickets";

const json = async (res) => {
  if (!res.ok) { const msg = await res.text().catch(() => ""); throw new Error(`${res.status} ${res.statusText} :: ${msg}`); }
  return res.json();
};

const toCamel = (c) => ({
  collabId: c.collab_id, ticketId: c.ticket_id, userId: c.user_id,
  role: c.role, createdAt: c.created_at,
});

const CollaboratorModel = {
  async list(ticketId) {
    const res = await fetch(`${BASE}/${encodeURIComponent(ticketId)}/collaborators`, { cache: "no-store" });
    const arr = await json(res);
    return (arr || []).map(toCamel);
  },
  async add(ticketId, { userId, role = "contributor" }) {
    const payload = { ticket_id: ticketId, user_id: userId, role };
    const res = await fetch(`${BASE}/${encodeURIComponent(ticketId)}/collaborators`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
    });
    return toCamel(await json(res));
  },
  async remove(ticketId, userId) {
    const res = await fetch(`${BASE}/${encodeURIComponent(ticketId)}/collaborators/${encodeURIComponent(userId)}`, { method: "DELETE" });
    if (res.status === 204) return true;
    await json(res); return true;
  },
};
export default CollaboratorModel;
