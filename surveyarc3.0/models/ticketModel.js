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
  category: t.category,
  subcategory: t.subcategory,
  productId: t.product_id ?? null,
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
});

const TicketModel = {
  async list({ orgId, status, assigneeId, q, limit = 50, offset = 0 } = {}) {
    const qs = new URLSearchParams();
    if (orgId) qs.set("org_id", orgId);
    if (status) qs.set("status", status);
    if (assigneeId) qs.set("assignee_id", assigneeId);
    if (q) qs.set("q", q);
    if (limit != null) qs.set("limit", String(limit));
    if (offset != null) qs.set("offset", String(offset));
    const res = await fetch(`${BASE}?${qs.toString()}`, { cache: "no-store" });
    const arr = await json(res);
    return (arr || []).map(toCamel);
  },

  async get(ticketId) {
    const res = await fetch(`${BASE}/${encodeURIComponent(ticketId)}`, { cache: "no-store" });
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
      severity: data.severity ? data.severity : undefined, // let backend default if undefined
      status: data.status ?? "new",
      category: data.category ?? null,
      subcategory: data.subcategory ?? null,
      product_id: data.productId ?? null,
      sla_id: data.slaId ?? null,
      due_at: data.dueAt ?? null,
      tags: Array.isArray(data.tags) ? data.tags : undefined,
      custom_fields: data.custom ?? {},
    };
    const payload = omitNullish(payloadRaw);
    const res = await fetch(`${BASE}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
    const t = await json(res);
    return toCamel(t);
  },

  async update(ticketId, patch) {
    const map = (p) => {
      const out = { ...p };
      if ("priority" in out) out.priority = normalizePriority(out.priority);
      if ("orgId" in out) { out.org_id = out.orgId; delete out.orgId; }
      if ("requesterId" in out) { out.requester_id = out.requesterId; delete out.requesterId; }
      if ("assigneeId" in out) { out.assignee_id = out.assigneeId; delete out.assigneeId; }
      if ("slaId" in out) { out.sla_id = out.slaId; delete out.slaId; }
      if ("projectId" in out) { out.project_id = out.projectId; delete out.projectId; }
      // FIX: map dueAt -> due_at correctly
      if ("dueAt" in out) { out.due_at = out.dueAt; delete out.dueAt; }
      // remove null/undefined fields
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
    return json(res); // { count: number }
  },
  // ADD to your existing TicketModel:

async listGroupQueue({ orgId, groupId, status, q, limit = 50, offset = 0 }) {
  const qs = new URLSearchParams();
  if (orgId) qs.set("org_id", orgId);
  if (groupId) qs.set("group_id", groupId);
  if (status) qs.set("status", status);
  if (q) qs.set("q", q);
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

};

export default TicketModel;
