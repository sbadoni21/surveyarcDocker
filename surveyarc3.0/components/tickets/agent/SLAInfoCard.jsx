// components/sla/SLAInfoCard.jsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Shield, Target, AlertTriangle, DollarSign, Info, Clock, Pause, CheckCircle, History
} from "lucide-react";
import SlaMakingModel from "@/models/postGresModels/slaMakingModel";
import { usePathname } from "next/navigation";
import SLAModel from "@/models/slaModel";

// ------------------------------- Utilities -------------------------------

const fmtMinutes = (m) => {
  if (m == null || Number.isNaN(m)) return "—";
  const abs = Math.max(0, Math.floor(Math.abs(m)));
  const h = Math.floor(abs / 60);
  const min = abs % 60;
  return h ? `${h}h ${min}m` : `${min}m`;
};

const fmtDT = (iso) => (iso ? new Date(iso).toLocaleString() : "—");

const barColour = (pct, breached) => {
  if (breached) return "bg-red-600";
  if (pct >= 90) return "bg-red-500";
  if (pct >= 70) return "bg-orange-500";
  return "bg-emerald-500";
};

const clampPct = (n) => Math.max(0, Math.min(100, Math.round(n)));

function Chip({ children, className = "" }) {
  return (
    <span className={`text-[11px] px-2 py-0.5 rounded border ${className}`}>
      {children}
    </span>
  );
}

// ------------------------------ Progress Bar ------------------------------

function SLAProgressBar({ percent = 0, breached = false, label }) {
  const pct = clampPct(percent);
  return (
    <div className="w-full">
      <div className="flex justify-between text-[11px] text-gray-600 mb-1">
        <span>{label || "Progress"}</span>
        <span>{pct}%</span>
      </div>
      <div className="h-2.5 w-full rounded bg-gray-100 overflow-hidden">
        <div
          className={`h-2.5 ${barColour(pct, breached)} transition-all duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ------------------------------- Main Card --------------------------------

/**
 * SLAInfoCard
 * Props:
 *  - slaId: string
 *  - ticket: object (may include ticket.sla_status)
 *  - dimension: "resolution" | "first_response"
 *  - className?: string
 */
export default function SLAInfoCard({ slaId, ticket, dimension = "resolution", className = "" }) {
  const [loading, setLoading] = useState(true);
  const [sla, setSla] = useState(null);
  const [objectives, setObjectives] = useState([]);
  const [creditRules, setCreditRules] = useState([]);
  const [status, setStatus] = useState(ticket?.sla_status || ticket?.slaStatus || null);
  const path = usePathname();
  const orgId = path.split("/")[3]; // /[locale]/postgres-org/[organizations]/...

  // Pause history state
  const [history, setHistory] = useState([]);
  const [historyScope, setHistoryScope] = useState(dimension); // "resolution" | "first_response" | "all"
  const [historyLoading, setHistoryLoading] = useState(false);

  // ---------- Load SLA & parts ----------
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!slaId) { setLoading(false); return; }
      try {
        setLoading(true);
        const [s, objs, rules] = await Promise.all([
          SLAModel.get(orgId,slaId),
          SlaMakingModel.listObjectives(orgId,slaId),
          SlaMakingModel.listCreditRules(orgId,slaId),
        ]);
        if (!mounted) return;
        setSla(s || null);
        setObjectives(Array.isArray(objs) ? objs : []);
        setCreditRules(Array.isArray(rules) ? rules : []);
      } catch (e) {
        console.error("[SLAInfoCard] load SLA failed:", e);
      } finally {
        mounted && setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [slaId]);

  // ---------- Load status if not present on ticket ----------
  useEffect(() => {
    let mounted = true;
    const provided = ticket?.sla_status || ticket?.slaStatus;
    if (provided) { setStatus(provided); return; }
    const tid = ticket?.ticket_id || ticket?.ticketId;
    if (!tid) return;
    (async () => {
      try {
        const row = await SlaMakingModel.getTicketStatus?.(tid);
        if (mounted) setStatus(row || null);
      } catch (e) {
        console.warn("[SLAInfoCard] status fetch failed", e);
      }
    })();
    return () => { mounted = false; };
  }, [ticket?.ticket_id, ticket?.ticketId, ticket?.sla_status, ticket?.slaStatus]);

  // ---------- Load pause history ----------
  const loadHistory = async (scope) => {
    const tid = ticket?.ticket_id || ticket?.ticketId;
    if (!tid || !SlaMakingModel.getTicketPauseHistory) return;
    setHistoryLoading(true);
    try {
      const dimParam = scope === "all" ? undefined : scope;
      const rows = await SlaMakingModel.getTicketPauseHistory(tid, { dimension: dimParam });
      setHistory(Array.isArray(rows) ? rows : []);
    } catch (e) {
      console.warn("[SLAInfoCard] pause history fetch failed", e);
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    loadHistory(historyScope);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyScope, ticket?.ticket_id, ticket?.ticketId]);

  // ---------- Optional polling (every 60s) while active ----------
  const pollRef = useRef(null);
  useEffect(() => {
    const tid = ticket?.ticket_id || ticket?.ticketId;
    if (!tid || !SlaMakingModel.getTicketStatus) return;

    const dim = dimension === "first_response" ? "first_response" : "resolution";
    const completed = Boolean(status?.[`${dim}_completed_at`]);
    const paused = Boolean(status?.[`${dim}_paused`]);
    const breached = dimension === "first_response"
      ? Boolean(status?.breached_first_response)
      : Boolean(status?.breached_resolution);

    const shouldPoll = !completed && !paused && !breached;

    if (shouldPoll) {
      pollRef.current = setInterval(async () => {
        try {
          const row = await SlaMakingModel.getTicketStatus(tid);
          if (row) setStatus(row);
        } catch {}
      }, 60_000);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
    };
  }, [ticket?.ticket_id, ticket?.ticketId, dimension, status?.breached_first_response, status?.breached_resolution, status?.first_response_completed_at, status?.resolution_completed_at, status?.first_response_paused, status?.resolution_paused]);

  // ---------- Matching logic ----------
  const ticketCtx = useMemo(() => {
    const tagIds = (ticket?.tags || []).map(t => t.tag_id || t.tagId).filter(Boolean);
    return {
      priority: ticket?.priority,
      severity: ticket?.severity,
      group_id: ticket?.group_id ?? ticket?.groupId ?? null,
      team_id: ticket?.team_id ?? ticket?.teamId ?? null,
      product_id: ticket?.product_id ?? ticket?.productId ?? null,
      tags: tagIds,
    };
  }, [ticket]);

  const matchesRuleBlock = (rulesObj) => {
    if (!rulesObj || typeof rulesObj !== "object") return true;
    const oneOf = (a, v) => Array.isArray(a) ? a.includes(v) : true;
    const anyOverlap = (need, have) =>
      Array.isArray(need) && Array.isArray(have) ? need.some(x => have.includes(x)) : true;

    if (rulesObj.priority_in && !oneOf(rulesObj.priority_in, ticketCtx.priority)) return false;
    if (rulesObj.severity_in && !oneOf(rulesObj.severity_in, ticketCtx.severity)) return false;
    if (rulesObj.group_id_in && !oneOf(rulesObj.group_id_in, ticketCtx.group_id)) return false;
    if (rulesObj.team_id_in && !oneOf(rulesObj.team_id_in, ticketCtx.team_id)) return false;
    if (rulesObj.product_id_in && !oneOf(rulesObj.product_id_in, ticketCtx.product_id)) return false;
    if (rulesObj.tag_any && !anyOverlap(rulesObj.tag_any, ticketCtx.tags)) return false;

    return true;
  };

  const slaApplies = useMemo(() => matchesRuleBlock(sla?.rules), [sla, ticketCtx]);

  const objective = useMemo(() => {
    if (!slaApplies) return null;
    const candidates = (objectives || []).filter(o => o.objective === (dimension || "resolution") && o.active !== false);
    const matched = candidates.find(o => matchesRuleBlock(o.match));
    return matched || candidates[0] || null;
  }, [objectives, dimension, slaApplies, ticketCtx]);

  const rulesForDimension = useMemo(() => {
    if (!slaApplies) return [];
    return (creditRules || []).filter(r => r.objective === (dimension || "resolution") && r.active !== false);
  }, [creditRules, dimension, slaApplies]);

  // ---------- Derive display values ----------
  const dim = dimension === "first_response" ? "first_response" : "resolution";

  const startedAt   = status?.[`${dim}_started_at`]   || null;
  const dueAt       = status?.[`${dim}_due_at`]       || null; // authoritative end from SLA
  const completedAt = status?.[`${dim}_completed_at`] || null;

  const pausedFlag  = status?.[`${dim}_paused`] === true;
  const pausedAt    = status?.[`${dim}_paused_at`] || null;
  const lastResume  = status?.[`last_resume_${dim}`] || null;

  const breached    = dim === "first_response"
    ? !!status?.breached_first_response
    : !!status?.breached_resolution;

  const pausedBanner = status?.paused === true; // legacy/global

  const targetMinutes   = objective?.target_minutes ?? null;  // informational
  const graceMinutes    = sla?.grace_minutes ?? 0;

  // Progress uses due_at + grace as the end of the window
  const baseDue = (() => {
    if (dueAt) return new Date(dueAt);
    if (!startedAt || targetMinutes == null) return null;
    const d = new Date(startedAt);
    d.setMinutes(d.getMinutes() + targetMinutes);
    return d;
  })();

  const targetEnd = (() => {
    if (!baseDue) return null;
    const d = new Date(baseDue);
    if (graceMinutes) d.setMinutes(d.getMinutes() + graceMinutes);
    return d;
  })();

  const referenceTime = (() => {
    if (completedAt) return new Date(completedAt);
    if (pausedFlag && pausedAt) return new Date(pausedAt);
    return new Date();
  })();

  const started = startedAt ? new Date(startedAt) : null;
  const totalWindowMs = (started && targetEnd) ? Math.max(1, targetEnd - started) : null;
  const rawElapsedMs  = (started) ? (referenceTime - started) : null;
  const elapsedMs     = (totalWindowMs != null && rawElapsedMs != null)
    ? Math.max(0, Math.min(totalWindowMs, rawElapsedMs))
    : null;

  const totalWindowMinutes = (totalWindowMs != null) ? Math.round(totalWindowMs / 60000) : null;
  const effectiveElapsed   = (elapsedMs != null) ? Math.floor(elapsedMs / 60000) : null;

  const remainingMinutes = (started && targetEnd && referenceTime)
    ? Math.max(0, Math.ceil((targetEnd - referenceTime) / 60000))
    : null;

  const progressPct = (totalWindowMs != null && elapsedMs != null)
    ? clampPct((elapsedMs / totalWindowMs) * 100)
    : null;

  const eta = (() => {
    if (dueAt) return null;
    if (!targetEnd) return null;
    return targetEnd;
  })();

  const penaltyText = (rule) => {
    if (!rule) return "";
    if (rule.credit_unit === "percent_fee") return `${rule.credit_value}% of fee`;
    if (rule.credit_unit === "fixed_usd") return `$${rule.credit_value}`;
    if (rule.credit_unit === "service_days") return `${rule.credit_value} service days`;
    return `${rule.credit_value}`;
  };

  // ------------------------------- Render ---------------------------------

  if (loading) {
    return (
      <div className={`p-4 border rounded-lg bg-white ${className}`}>
        <div className="animate-pulse space-y-2">
          <div className="h-4 bg-gray-200 rounded w-1/3"></div>
          <div className="h-3 bg-gray-200 rounded w-2/3"></div>
          <div className="h-3 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  if (!slaId || !sla) {
    return (
      <div className={`p-4 border rounded-lg bg-white ${className}`}>
        <div className="text-sm text-gray-500">No SLA assigned.</div>
      </div>
    );
  }

  return (
    <div className={`p-4 border rounded-lg bg-white space-y-3 ${className}`}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <Shield className="w-4 h-4 text-gray-700" />
        <div className="text-sm font-semibold text-gray-800">{sla.name}</div>
        {sla.scope && (
          <span className="ml-2 text-[11px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-700">
            scope: {sla.scope}
          </span>
        )}
        {sla.aggregation && (
          <span className="text-[11px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-700">
            agg: {sla.aggregation}
          </span>
        )}
      </div>

      {sla.description && (
        <div className="text-xs text-gray-600 leading-relaxed">{sla.description}</div>
      )}

      {!slaApplies && (
        <div className="p-2 text-xs rounded bg-yellow-50 border border-yellow-200 text-yellow-700 flex items-center gap-2">
          <Info className="w-4 h-4" />
          This SLA policy does not match this ticket’s attributes (rules filter it out).
        </div>
      )}

      {/* Objective (informational) */}
      <div className="border rounded-md p-3">
        <div className="flex items-center gap-2 mb-1">
          <Target className="w-4 h-4 text-gray-700" />
          <div className="text-sm font-medium text-gray-800">
            {dimension === "first_response" ? "First Response" : "Resolution"} Objective
          </div>
        </div>

        {!objective ? (
          <div className="text-xs text-gray-500">
            No active objective found for this dimension{slaApplies ? "" : " (SLA not applicable)"}.
          </div>
        ) : (
          <>
            <div className="text-xs text-gray-700 flex flex-wrap items-center gap-x-3 gap-y-1">
              <span><span className="font-medium">Target (mins):</span> {fmtMinutes(targetMinutes)}</span>
              {graceMinutes ? (
                <span className="text-gray-600">(+ grace {fmtMinutes(graceMinutes)})</span>
              ) : null}
              {totalWindowMinutes != null && (
                <span>
                  <span className="font-medium">Window (start → due+grace):</span>{" "}
                  {fmtMinutes(totalWindowMinutes)}
                </span>
              )}
            </div>

            {objective.breach_grades && Object.keys(objective.breach_grades).length > 0 && (
              <div className="mt-2 grid grid-cols-3 gap-2">
                {objective.breach_grades.minor != null && (
                  <div className="text-[11px] text-gray-700 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
                    Minor: {fmtMinutes(objective.breach_grades.minor)} overdue
                  </div>
                )}
                {objective.breach_grades.major != null && (
                  <div className="text-[11px] text-gray-700 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                    Major: {fmtMinutes(objective.breach_grades.major)} overdue
                  </div>
                )}
                {objective.breach_grades.critical != null && (
                  <div className="text-[11px] text-gray-700 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-red-600"></span>
                    Critical: {fmtMinutes(objective.breach_grades.critical)} overdue
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Live-timer */}
      {status ? (
        <div className="border rounded-md p-3">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-gray-700" />
            <div className="text-sm font-medium text-gray-800">
              Live Timer ({dim.replace("_", " ")})
            </div>
          </div>

          {/* Chips */}
          <div className="flex flex-wrap items-center gap-2 mb-3">
            {pausedBanner && (
              <Chip className="bg-yellow-100 text-yellow-800 border-yellow-300">
                <Pause className="w-3 h-3 inline-block mr-1" />
                Paused{status?.pause_reason ? `: ${status.pause_reason}` : ""}
              </Chip>
            )}

            {pausedFlag && (
              <Chip className="bg-yellow-50 text-yellow-800 border-yellow-200">
                <Pause className="w-3 h-3 inline-block mr-1" />
                {dimension === "first_response" ? "FR" : "Resolution"} Paused
              </Chip>
            )}

            {breached ? (
              <Chip className="bg-red-100 text-red-700 border-red-300">
                <AlertTriangle className="w-3 h-3 inline-block mr-1" />
                Breached
              </Chip>
            ) : (
              <Chip className="bg-emerald-100 text-emerald-700 border-emerald-300">
                <CheckCircle className="w-3 h-3 inline-block mr-1" />
                Within Target
              </Chip>
            )}

            {typeof effectiveElapsed === "number" && totalWindowMinutes != null && (
              <Chip className="bg-gray-100 text-gray-700">
                {effectiveElapsed}m elapsed / {totalWindowMinutes}m window
              </Chip>
            )}
          </div>

          {/* Progress bar */}
          {progressPct != null && (
            <SLAProgressBar
              percent={progressPct}
              breached={breached}
              label="Time used"
            />
          )}

          {/* Timestamps & counters */}
          <div className="mt-3 text-xs text-gray-800 grid grid-cols-2 gap-2">
            <div><span className="font-medium">Started:</span> {fmtDT(startedAt)}</div>
            <div>
              <span className="font-medium">Due:</span>{" "}
              {dueAt ? fmtDT(dueAt) : (eta ? `${eta.toLocaleString()} (est.)` : "—")}
            </div>
            <div><span className="font-medium">Completed:</span> {fmtDT(completedAt)}</div>
            <div><span className="font-medium">Remaining:</span> {fmtMinutes(remainingMinutes)}</div>

            {pausedFlag && (
              <>
                <div><span className="font-medium">Paused At:</span> {fmtDT(pausedAt)}</div>
                <div><span className="font-medium">Last Resume:</span> {fmtDT(lastResume)}</div>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="p-2 text-xs rounded bg-gray-50 border text-gray-600 flex items-center gap-2">
          <Info className="w-4 h-4 text-gray-500" />
          No live SLA status found for this ticket.
        </div>
      )}

      {/* SLA Pause History */}
      <div className="border rounded-md p-3">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-gray-700" />
            <div className="text-sm font-medium text-gray-800">SLA Pause History</div>
          </div>

          {/* Scope filter */}
          <div className="flex items-center gap-2">
            <label className="text-[11px] text-gray-600">Filter:</label>
            <select
              className="text-[11px] border rounded px-1.5 py-0.5 text-gray-800 bg-white"
              value={historyScope}
              onChange={(e) => setHistoryScope(e.target.value)}
            >
              <option value={dimension}>{dimension === "first_response" ? "First Response" : "Resolution"}</option>
              <option value={dimension === "first_response" ? "resolution" : "first_response"}>
                {dimension === "first_response" ? "Resolution" : "First Response"}
              </option>
              <option value="all">All</option>
            </select>
          </div>
        </div>

        {historyLoading ? (
          <div className="text-xs text-gray-500">Loading history…</div>
        ) : history.length === 0 ? (
          <div className="text-xs text-gray-500">No pause/resume events.</div>
        ) : (
          <div className="divide-y">
            {history.map((h) => (
              <div key={h.pause_id} className="py-2 text-xs text-gray-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                <div className="flex items-center gap-2">
                  <Chip className={h.action === "pause" ? "bg-yellow-50 text-yellow-800 border-yellow-200" : "bg-emerald-50 text-emerald-700 border-emerald-200"}>
                    {h.action === "pause" ? "Pause" : "Resume"}
                  </Chip>
                  <Chip className="bg-gray-50 text-gray-700">{h.dimension === "first_response" ? "First Response" : "Resolution"}</Chip>
                  <span className="text-gray-600">{fmtDT(h.action_at)}</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {h.reason && (
                    <Chip className="bg-gray-100 text-gray-700">
                      reason: {String(h.reason)}
                    </Chip>
                  )}
                  {h.reason_note && (
                    <Chip className="bg-gray-100 text-gray-700">
                      note: {h.reason_note}
                    </Chip>
                  )}
                  {typeof h.pause_duration_minutes === "number" && (
                    <Chip className="bg-gray-100 text-gray-700">
                      paused: {fmtMinutes(h.pause_duration_minutes)}
                    </Chip>
                  )}
                  {typeof h.due_date_extension_minutes === "number" && (
                    <Chip className="bg-gray-100 text-gray-700">
                      due +{fmtMinutes(h.due_date_extension_minutes)}
                    </Chip>
                  )}
                  {h.actor_id && (
                    <Chip className="bg-gray-50 text-gray-600">by {h.actor_id}</Chip>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Penalties */}
      {rulesForDimension.length > 0 ? (
        <div className="border rounded-md p-3">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="w-4 h-4 text-gray-700" />
            <div className="text-sm font-medium text-gray-800">Penalty Schedule</div>
          </div>
          <div className="space-y-1">
            {rulesForDimension.map((r) => (
              <div key={r.rule_id} className="text-[11px] text-gray-700 flex items-center gap-2">
                <span
                  className={`px-1.5 py-0.5 rounded text-white ${
                    r.grade === "critical" ? "bg-red-600"
                    : r.grade === "major" ? "bg-orange-500"
                    : "bg-yellow-500"
                  }`}
                >
                  {r.grade}
                </span>
                <span>{penaltyText(r)}</span>
                {r.cap_per_period && r.period_days && (
                  <span className="text-gray-500">
                    (cap {r.cap_per_period} per {r.period_days} days)
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="p-2 text-xs rounded bg-gray-50 border text-gray-600 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-gray-500" />
          No penalty rules configured for this dimension.
        </div>
      )}
    </div>
  );
}
