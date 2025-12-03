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
const toSnakeFollowup = (f) => {
  if (!f) return undefined;
  return {
    mode: f.mode,
    survey_id: f.surveyId ?? f.survey_id ?? null,
        response_id: f.responseId ?? f.response_id ?? null,   // 🔹 NEW

    questions: Array.isArray(f.questions)
      ? f.questions.map((q) => ({
          id: q.id ?? undefined,
          type: q.type || "text",
          label: q.label || "",
          options:
            q.type === "mcq"
              ? Array.isArray(q.options)
                ? q.options
                : typeof q.options === "string"
                ? q.options
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean)
                : []
              : undefined,
              answer: q.answer ?? null,
        }))
      : [],
  };
};


const normalizePriority = (p) => (p === "medium" ? "normal" : p);
const omitNullish = (obj) => {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== null && v !== undefined) out[k] = v;
  }
  return out;
};

// 🆕 Helper to convert SLA pause history to camelCase
const toCamelPauseHistory = (ph) => ({
  pauseId: ph.pause_id,
  ticketId: ph.ticket_id,
  dimension: ph.dimension,
  action: ph.action,
  actionAt: ph.action_at,
  actorId: ph.actor_id,
  reason: ph.reason ?? null,
  reasonNote: ph.reason_note ?? null,
  pauseDurationMinutes: ph.pause_duration_minutes ?? null,
  dueDateExtensionMinutes: ph.due_date_extension_minutes ?? null,
  meta: ph.meta || {},
  createdAt: ph.created_at,
});

// 🆕 Helper to convert SLA status to camelCase
const toCamelSLAStatus = (sla) => {
  if (!sla) return null;
  
  return {
    ticketId: sla.ticket_id,
    slaId: sla.sla_id ?? null,
    
    // First Response
    firstResponseDueAt: sla.first_response_due_at ?? null,
    firstResponseStartedAt: sla.first_response_started_at ?? null,
    firstResponseCompletedAt: sla.first_response_completed_at ?? null,
    firstResponsePaused: sla.first_response_paused ?? false,
    firstResponsePausedAt: sla.first_response_paused_at ?? null,
    elapsedFirstResponseMinutes: sla.elapsed_first_response_minutes ?? 0,
    totalPausedFirstResponseMinutes: sla.total_paused_first_response_minutes ?? 0,
    breachedFirstResponse: sla.breached_first_response ?? false,
    lastResumeFirstResponse: sla.last_resume_first_response ?? null,
 
    // Resolution
    
    resolutionDueAt: sla.resolution_due_at ?? null,
    resolutionStartedAt: sla.resolution_started_at ?? null,
    resolutionCompletedAt: sla.resolution_completed_at ?? null,
    resolutionPaused: sla.resolution_paused ?? false,
    resolutionPausedAt: sla.resolution_paused_at ?? null,
    elapsedResolutionMinutes: sla.elapsed_resolution_minutes ?? 0,
    totalPausedResolutionMinutes: sla.total_paused_resolution_minutes ?? 0,
    breachedResolution: sla.breached_resolution ?? false,
    lastResumeResolution: sla.last_resume_resolution ?? null,
    
    // Legacy
    paused: sla.paused ?? false,
    pauseReason: sla.pause_reason ?? null,
    
    // Calendar
    calendarId: sla.calendar_id ?? null,
    
    // Pause history (if included)
    pauseHistory: Array.isArray(sla.pause_history) 
      ? sla.pause_history.map(toCamelPauseHistory)
      : [],
    
    // Meta
    meta: sla.meta || {},
    updatedAt: sla.updated_at ?? null,
  };
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
   followup: t.followup
    ? {
        mode: t.followup.mode || "inline",
        surveyId:
          t.followup.survey_id ??
          t.followup.surveyId ??
          null,
        responseId:
          t.followup.response_id ??           // 🔹 NEW
          t.followup.responseId ??
          null,
        questions: Array.isArray(t.followup.questions)
          ? t.followup.questions.map((q, idx) => ({
              id: q.id ?? `fq_${idx + 1}`,
              type: q.type || "text",
              label: q.label || "",
              options: Array.isArray(q.options)
                ? q.options
                : typeof q.options === "string"
                ? q.options
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean)
                : [],
              answer:
                q.answer ??
                q.value ?? // just in case you used another key
                null,
            }))
          : [],
      }
    : null,
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
  rcaSetBy: t.rca_set_by ?? null,
  rcaSetAt: t.rca_set_at ?? null,

  slaId: t.sla_id ?? null,
  dueAt: t.due_at ?? null,

  createdAt: t.created_at,
  updatedAt: t.updated_at,
  firstResponseAt: t.first_response_at ?? null,
  resolvedAt: t.resolved_at ?? null,
  closedAt: t.closed_at ?? null,
  lastActivityAt: t.last_activity_at ?? null,
  lastPublicCommentAt: t.last_public_comment_at ?? null,

  replyCount: t.reply_count ?? 0,
  followerCount: t.follower_count ?? 0,
  attachmentCount: t.attachment_count ?? 0,
  commentCount: t.comment_count ?? 0,
  number: t.number ?? null,

  tags: t.tags || [],
  custom: t.custom_fields || t.meta || {},
  teamId: t.team_id ?? null,
  agentId: t.agent_id ?? null,
  meta: t.meta || {},

  // 🆕 Enhanced SLA status with pause history
  slaStatus: toCamelSLAStatus(t.sla_status),
  
  // 🆕 SLA-related events (if included)
  slaEvents: Array.isArray(t.sla_events) 
    ? t.sla_events.map(e => ({
        eventId: e.event_id,
        ticketId: e.ticket_id,
        actorId: e.actor_id,
        eventType: e.event_type,
        fromValue: e.from_value || {},
        toValue: e.to_value || {},
        meta: e.meta || {},
        createdAt: e.created_at,
      }))
    : [],
});

const TicketModel = {
  // ---------------- core CRUD ----------------
  async list({
    orgId, status, assigneeId, teamId, agentId, q,
    limit = 50, offset = 0, groupId, categoryId, subcategoryId,
    productId,
    featureId, impactId, rcaId
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
    if (productId) qs.set("product_id", productId);
    if (featureId) qs.set("feature_id", featureId);
    if (impactId) qs.set("impact_id", impactId);
    if (rcaId) qs.set("rca_id", rcaId);
    if (q) qs.set("q", q);
    if (limit != null) qs.set("limit", String(limit));
    if (offset != null) qs.set("offset", String(offset));
    const res = await fetch(`${BASE}?${qs.toString()}`, { cache: "no-store" });
    const arr = await json(res);
    return (arr || []).map(toCamel);
  },

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
   followup:
        data.followup && data.followup.mode !== "none"
          ? toSnakeFollowup(data.followup)
          : undefined,
      sla_processing: {
        first_response_due_at: data.firstResponseDueAt ?? null,
        resolution_due_at: data.resolutionDueAt ?? null,
        sla_mode: data.slaMode ?? null,
        calendar_id: data.calendarId ?? null,
      },
      meta: data.meta ?? {},
    };

    const payload = omitNullish(payloadRaw);
    console.log(payload);
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

      if ("followup" in out && out.followup) {
        // convert camelCase followup to snake_case for backend
        out.followup =
          out.followup.mode && out.followup.mode !== "none"
            ? toSnakeFollowup(out.followup)
            : null;
      }

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
    return json(res);
  },

  async listGroupQueue({
    orgId, groupId, status, q, limit = 50, offset = 0,
    categoryId, subcategoryId, productId, featureId, impactId, rcaId
  }) {
    const qs = new URLSearchParams();
    if (orgId) qs.set("org_id", orgId);
    if (groupId) qs.set("group_id", groupId);
    if (status) qs.set("status", status);
    if (q) qs.set("q", q);
    if (categoryId) qs.set("category_id", categoryId);
    if (subcategoryId) qs.set("subcategory_id", subcategoryId);
    if (productId) qs.set("product_id", productId);
    if (featureId) qs.set("feature_id", featureId);
    if (impactId) qs.set("impact_id", impactId);
    if (rcaId) qs.set("rca_id", rcaId);
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

  // 🆕 ---------------- SLA Management ----------------
  
  /**
   * Pause an SLA timer (first_response or resolution)
   */
  async pauseSLA(ticketId, { dimension, reason, reasonNote }) {
    const res = await fetch(`${BASE}/${encodeURIComponent(ticketId)}/sla/pause`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dimension,
        reason: reason ?? "agent_paused",
        reason_note: reasonNote ?? null,
      }),
      cache: "no-store",
    });
    const slaStatus = await json(res);
    return toCamelSLAStatus(slaStatus);
  },

  /**
   * Resume an SLA timer (first_response or resolution)
   */
  async resumeSLA(ticketId, { dimension }) {
    const res = await fetch(`${BASE}/${encodeURIComponent(ticketId)}/sla/resume`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dimension }),
      cache: "no-store",
    });
    const slaStatus = await json(res);
    return toCamelSLAStatus(slaStatus);
  },

  /**
   * Get detailed SLA timers with pause windows
   */
  async getSLATimers(ticketId) {
    const res = await fetch(`${BASE}/${encodeURIComponent(ticketId)}/sla/timers`, {
      cache: "no-store",
    });
    const timers = await json(res);
    
    // Convert to camelCase
    return {
      ticketId: timers.ticket_id,
      slaId: timers.sla_id ?? null,
      paused: timers.paused ?? false,
      pauseReason: timers.pause_reason ?? null,
      
      firstResponse: timers.first_response ? {
        startedAt: timers.first_response.started_at ?? null,
        dueAt: timers.first_response.due_at ?? null,
        paused: timers.first_response.paused ?? false,
        pausedAt: timers.first_response.paused_at ?? null,
        totalPausedMinutes: timers.first_response.total_paused_minutes ?? 0,
        breached: timers.first_response.breached ?? false,
      } : null,
      
      resolution: timers.resolution ? {
        startedAt: timers.resolution.started_at ?? null,
        dueAt: timers.resolution.due_at ?? null,
        paused: timers.resolution.paused ?? false,
        pausedAt: timers.resolution.paused_at ?? null,
        totalPausedMinutes: timers.resolution.total_paused_minutes ?? 0,
        breached: timers.resolution.breached ?? false,
      } : null,
      
      pauseWindows: Array.isArray(timers.pause_windows)
        ? timers.pause_windows.map(w => ({
            dimension: w.dimension,
            reason: w.reason,
            startedAt: w.started_at,
            endedAt: w.ended_at ?? null,
          }))
        : [],
    };
  },

  /**
   * Set root cause for a resolved ticket
   */
  async setRootCause(ticketId, { rcaId, rcaNote, confirmedBy, confirmedAt }) {
    const res = await fetch(`${BASE}/${encodeURIComponent(ticketId)}/root-cause`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rca_id: rcaId,
        rca_note: rcaNote ?? null,
        confirmed_by: confirmedBy,
        confirmed_at: confirmedAt ?? null,
      }),
      cache: "no-store",
    });
    const t = await json(res);
    return toCamel(t);
  },
};

export default TicketModel;