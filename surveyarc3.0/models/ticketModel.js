// models/postGresModels/ticketModel.js
const BASE = "/api/post-gres-apis/tickets";
const COUNT_BASE = "/api/post-gres-apis/tickets/count";

const json = async (res) => {
  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText} :: ${msg}`);
  }
  return res.json();
};

const normalizePriority = (p) => (p === "medium" ? "normal" : p);
const omitNullish = (obj) => {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== null && v !== undefined) out[k] = v;
  }
  return out;
};

const toCamel = (t) => ({
  ticketId: t.ticket_id,
  orgId: t.org_id,
  projectId: t.project_id ?? null,

  requesterId: t.requester_id,
  assigneeId: t.assignee_id ?? null,

  subject: t.subject,
  description: t.description,
  priority: t.priority,
  severity: t.severity,
  status: t.status,

  // human-readable names
  category: t.category ?? null,
  subcategory: t.subcategory ?? null,

  // ids
  groupId: t.group_id ?? null,
  categoryId: t.category_id ?? null,
  subcategoryId: t.subcategory_id ?? null,
  productId: t.product_id ?? null,

  // 🔵 NEW taxonomy ids
  featureId: t.feature_id ?? null,
  impactId: t.impact_id ?? null,
  rcaId: t.rca_id ?? null,
  rcaNote: t.rca_note ?? null,

  slaId: t.sla_id ?? null,
  dueAt: t.due_at ?? null,

  createdAt: t.created_at,
  updatedAt: t.updated_at,
  resolvedAt: t.resolved_at ?? null,
  closedAt: t.closed_at ?? null,
  lastActivityAt: t.last_activity_at ?? null,
  lastPublicCommentAt: t.last_public_comment_at ?? null,

  replyCount: t.reply_count ?? 0,
  followerCount: t.follower_count ?? 0,
  number: t.number ?? null,

  tags: t.tags || [],
  custom: t.custom_fields || t.meta || {},
  teamId: t.team_id ?? null,
  agentId: t.agent_id ?? null,

  slaStatus: t.sla_status ?? null,
});


const TicketModel = {
  // ---------------- core CRUD ----------------
async list({
  orgId, status, assigneeId, teamId, agentId, q,
  limit = 50, offset = 0, groupId, categoryId, subcategoryId,
  productId,                 // 🔵 optionally expose product filter too
  featureId, impactId, rcaId // 🔵 NEW
} = {}) {
  const qs = new URLSearchParams();
  if (orgId) qs.set("org_id", orgId);
  if (status) qs.set("status", status);
  if (assigneeId) qs.set("assignee_id", assigneeId);
  if (teamId) qs.set("team_id", teamId);
  if (agentId) qs.set("agent_id", agentId);
  if (groupId) qs.set("group_id", groupId);
  if (categoryId) qs.set("category_id", categoryId);
  if (subcategoryId) qs.set("subcategory_id", subcategoryId);
  if (productId) qs.set("product_id", productId);     // 🔵
  if (featureId) qs.set("feature_id", featureId);     // 🔵
  if (impactId) qs.set("impact_id", impactId);        // 🔵
  if (rcaId) qs.set("rca_id", rcaId);                 // 🔵
  if (q) qs.set("q", q);
  if (limit != null) qs.set("limit", String(limit));
  if (offset != null) qs.set("offset", String(offset));
  const res = await fetch(`${BASE}?${qs.toString()}`, { cache: "no-store" });
  const arr = await json(res);
  return (arr || []).map(toCamel);
}
,

  async get(ticketId) {
    const res = await fetch(`${BASE}/${ticketId}`, { cache: "no-store" });
    const t = await json(res);
    return toCamel(t);
  },

async create(data) {
  const payloadRaw = {
    org_id: data.orgId,
    project_id: data.projectId ?? null,
    requester_id: data.requesterId,
    assignee_id: data.assigneeId ?? null,
    subject: data.subject,
    description: data.description ?? "",
    priority: normalizePriority(data.priority ?? "normal"),
    severity: data.severity ? data.severity : undefined,
    status: data.status ?? "new",

    category: data.category ?? null,
    subcategory: data.subcategory ?? null,

    group_id: data.groupId ?? null,
    category_id: data.categoryId ?? null,
    subcategory_id: data.subcategoryId ?? null,
    product_id: data.productId ?? null,
    feature_id: data.featureId ?? null,
    impact_id: data.impactId ?? null,
    rca_id: data.rcaId ?? null,
    rca_note: data.rcaNote ?? null,

    sla_id: data.slaId ?? null,
    due_at: data.dueAt ?? null,

    tags: Array.isArray(data.tags) ? data.tags : undefined,
    custom_fields: data.custom ?? {},

    team_id: data.teamId ?? null,
    agent_id: data.agentId ?? null,

    assignment: data.assignment ?? undefined,

    sla_processing: {
      first_response_due_at: data.firstResponseDueAt ?? null,
      resolution_due_at: data.resolutionDueAt ?? null,
      sla_mode: data.slaMode ?? null,
      calendar_id: data.calendarId ?? null,
    },
  };

  const payload = omitNullish(payloadRaw);
    const res = await fetch(`${BASE}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
    const t = await json(res);
    return toCamel(t);}
,

  async update(ticketId, patch) {

  const map = (p) => {
    const out = { ...p };

    if ("priority" in out) out.priority = normalizePriority(out.priority);
    if ("orgId" in out) { out.org_id = out.orgId; delete out.orgId; }
    if ("requesterId" in out) { out.requester_id = out.requesterId; delete out.requesterId; }
    if ("assigneeId" in out) { out.assignee_id = out.assigneeId; delete out.assigneeId; }
    if ("slaId" in out) { out.sla_id = out.slaId; delete out.slaId; }
    if ("projectId" in out) { out.project_id = out.projectId; delete out.projectId; }
    if ("dueAt" in out) { out.due_at = out.dueAt; delete out.dueAt; }

    if ("groupId" in out) { out.group_id = out.groupId; delete out.groupId; }
    if ("categoryId" in out) { out.category_id = out.categoryId; delete out.categoryId; }
    if ("subcategoryId" in out) { out.subcategory_id = out.subcategoryId; delete out.subcategoryId; }
    if ("productId" in out) { out.product_id = out.productId; delete out.productId; }

    // 🔵 NEW taxonomy ids
    if ("featureId" in out) { out.feature_id = out.featureId; delete out.featureId; }
    if ("impactId" in out) { out.impact_id = out.impactId; delete out.impactId; }
    if ("rcaId" in out) { out.rca_id = out.rcaId; delete out.rcaId; }
    if ("rcaNote" in out) { out.rca_note = out.rcaNote; delete out.rcaNote; }

    if ("teamId" in out) { out.team_id = out.teamId; delete out.teamId; }
    if ("agentId" in out) { out.agent_id = out.agentId; delete out.agentId; }

    return omitNullish(out);
  };





    const res = await fetch(`${BASE}/${encodeURIComponent(ticketId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(map(patch)),
      cache: "no-store",
    });
    const t = await json(res);
    return toCamel(t);
  },

  async remove(ticketId) {
    const res = await fetch(`${BASE}/${encodeURIComponent(ticketId)}`, {
      method: "DELETE",
      cache: "no-store",
    });
    if (res.status === 204) return true;
    await json(res);
    return true;
  },

  async count({ orgId, status } = {}) {
    const qs = new URLSearchParams();
    if (orgId) qs.set("org_id", orgId);
    if (status) qs.set("status", status);
    const res = await fetch(`${COUNT_BASE}?${qs.toString()}`, { cache: "no-store" });
    return json(res); // { count }
  },
async listGroupQueue({
  orgId, groupId, status, q, limit = 50, offset = 0,
  categoryId, subcategoryId, productId, featureId, impactId, rcaId // 🔵
}) {
  const qs = new URLSearchParams();
  if (orgId) qs.set("org_id", orgId);
  if (groupId) qs.set("group_id", groupId);
  if (status) qs.set("status", status);
  if (q) qs.set("q", q);
  if (categoryId) qs.set("category_id", categoryId);
  if (subcategoryId) qs.set("subcategory_id", subcategoryId);
  if (productId) qs.set("product_id", productId);   // 🔵
  if (featureId) qs.set("feature_id", featureId);   // 🔵
  if (impactId) qs.set("impact_id", impactId);      // 🔵
  if (rcaId) qs.set("rca_id", rcaId);               // 🔵
  qs.set("limit", String(limit));
  qs.set("offset", String(offset));
  const res = await fetch(`${BASE}?${qs.toString()}`, { cache: "no-store" });
  const arr = await json(res);
  return (arr || []).map(toCamel);
},


  async listCollaborating({ orgId, userId, status, limit = 50, offset = 0 }) {
    const qs = new URLSearchParams({ org_id: orgId, user_id: userId });
    if (status) qs.set("status", status);
    qs.set("limit", String(limit));
    qs.set("offset", String(offset));
    const res = await fetch(`${BASE}/collaborating?${qs.toString()}`, { cache: "no-store" });
    const arr = await json(res);
    return (arr || []).map(toCamel);
  },

  // ---------------- assignment helpers ----------------
  async assignGroup(ticketId, groupId) {
    const res = await fetch(`${BASE}/${encodeURIComponent(ticketId)}/group`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ group_id: groupId ?? null }),
      cache: "no-store",
    });
    const t = await json(res);
    return toCamel(t);
  },

  async assignTeam(ticketId, teamId) {
    const res = await fetch(`${BASE}/${encodeURIComponent(ticketId)}/team`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ team_id: teamId ?? null }),
      cache: "no-store",
    });
    const t = await json(res);
    return toCamel(t);
  },

  async assignAgent(ticketId, agentId) {
    const res = await fetch(`${BASE}/${encodeURIComponent(ticketId)}/agent`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agent_id: agentId ?? null }),
      cache: "no-store",
    });
    const t = await json(res);
    return toCamel(t);
  },

  async getParticipants(ticketId) {
    const res = await fetch(`${BASE}/${encodeURIComponent(ticketId)}/participants`, { cache: "no-store" });
    const payload = await json(res);
    return {
      ticketId: payload.ticket_id,
      orgId: payload.org_id,
      groupId: payload.group_id ?? null,
      teamId: payload.team_id ?? null,
      agentId: payload.agent_id ?? null,
      assigneeId: payload.assignee_id ?? null,
      updatedAt: payload.updated_at ?? null,
    };
  },
};

export default TicketModel;