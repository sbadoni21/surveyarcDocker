// models/postGresModels/slaModel.js
const BASE = "/api/post-gres-apis";

const ok = async (r) => {
  if (!r.ok) throw new Error((await r.text()) || r.statusText);
  return r.json();
};

const SLAEndpoints = {
  list: (orgId) => `${BASE}/slas?org_id=${encodeURIComponent(orgId)}`,
  get: (slaId) => `${BASE}/slas/${encodeURIComponent(slaId)}`,
  // Ticket SLA controls (tickets router exposes these)
  ticket: {
    firstResponse: (ticketId) => `${BASE}/tickets/${encodeURIComponent(ticketId)}/sla/first-response`,
    pause:         (ticketId) => `${BASE}/tickets/${encodeURIComponent(ticketId)}/sla/pause`,
    resume:        (ticketId) => `${BASE}/tickets/${encodeURIComponent(ticketId)}/sla/resume`,
    status:        (ticketId) => `${BASE}/tickets/${encodeURIComponent(ticketId)}`, // TicketOut (includes sla_status)
  },
  // Business calendars (from slas router)
  calendars: {
    list: (orgId) => `${BASE}/slas/business-calendars?org_id=${encodeURIComponent(orgId)}`,
  }
};

const SLAModel = {
  async list(orgId) {
    const r = await fetch(SLAEndpoints.list(orgId));
    return ok(r);
  },
  async get(slaId) {
    const r = await fetch(SLAEndpoints.get(slaId));
    return ok(r);
  },
  // ---- Ticket SLA actions ----
  async markFirstResponse(ticketId, payload = {}) {
    const r = await fetch(SLAEndpoints.ticket.firstResponse(ticketId), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload) // optional { at?: ISO }
    });
    return ok(r);
  },
  async pause(ticketId, payload = {}) {
    const r = await fetch(SLAEndpoints.ticket.pause(ticketId), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload) // { dimension?: "resolution"|"first_response"|"custom", reason?: string }
    });
    return ok(r);
  },
  async resume(ticketId, payload = {}) {
    const r = await fetch(SLAEndpoints.ticket.resume(ticketId), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload) // { dimension?: "resolution"|"first_response"|"custom" }
    });
    return ok(r);
  },
  async getTicketWithSLA(ticketId) {
    const r = await fetch(SLAEndpoints.ticket.status(ticketId));
    return ok(r);
  },
  // ---- Business calendars ----
  async listCalendars(orgId) {
    const r = await fetch(SLAEndpoints.calendars.list(orgId));
    if (!r.ok) return [];
    return r.json();
  }
};

export default SLAModel;
