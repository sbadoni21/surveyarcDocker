// components/sla/SLAInfoCard.jsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Shield,
  AlertTriangle,
  Info,
  Clock,
  Pause,
  CheckCircle,
  History,
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

// ---------------------- Normalize SLA Status Shape ----------------------

/**
 * Backend returns camelCase:
 * - firstResponseStartedAt, firstResponseDueAt, breachedFirstResponse, ...
 * This function normalizes into snake_case the card expects:
 * - first_response_started_at, first_response_due_at, breached_first_response, ...
 */
const normalizeStatus = (raw) => {
  if (!raw || typeof raw !== "object") return raw;

  // If already normalized, return as-is
  if (
    "first_response_started_at" in raw ||
    "resolution_started_at" in raw ||
    "first_response_due_at" in raw ||
    "resolution_due_at" in raw
  ) {
    return raw;
  }

  return {
    // IDs
    sla_id: raw.slaId,
    ticket_id: raw.ticketId,

    // first response
    first_response_started_at: raw.firstResponseStartedAt,
    first_response_due_at: raw.firstResponseDueAt,
    first_response_completed_at: raw.firstResponseCompletedAt,
    first_response_paused: raw.firstResponsePaused,
    first_response_paused_at: raw.firstResponsePausedAt,
    breached_first_response: raw.breachedFirstResponse,
    total_paused_first_response_minutes: raw.totalPausedFirstResponseMinutes,
    last_resume_first_response: raw.lastResumeFirstResponse,

    // resolution
    resolution_started_at: raw.resolutionStartedAt,
    resolution_due_at: raw.resolutionDueAt,
    resolution_completed_at: raw.resolutionCompletedAt,
    resolution_paused: raw.resolutionPaused,
    resolution_paused_at: raw.resolutionPausedAt,
    breached_resolution: raw.breachedResolution,
    total_paused_resolution_minutes: raw.totalPausedResolutionMinutes,
    last_resume_resolution: raw.lastResumeResolution,

    // pause / global
    paused: raw.paused,
    pause_reason: raw.pauseReason,

    // other
    updated_at: raw.updatedAt,
    calendar_id: raw.calendarId,
    meta: raw.meta,
  };
};

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
          className={`h-2.5 ${barColour(
            pct,
            breached
          )} transition-all duration-500`}
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
 *  - ticket: object (may include ticket.sla_status or ticket.slaStatus)
 *  - dimension: "resolution" | "first_response"
 *  - className?: string
 *
 * This version:
 *  - NO objectives
 *  - NO penalties
 *  - Uses only first/response + resolution due times and breach flags
 */
export default function SLAInfoCard({
  slaId,
  ticket,
  dimension = "resolution",
  className = "",
}) {
  const [loading, setLoading] = useState(true);
  const [sla, setSla] = useState(null);
  const [status, setStatus] = useState(
    ticket?.sla_status || ticket?.slaStatus || null
  );
  const path = usePathname();
  const orgId = path.split("/")[3]; // /[locale]/postgres-org/[orgId]/...

  // Pause history state
  const [history, setHistory] = useState([]);
  const [historyScope, setHistoryScope] = useState(dimension); // "resolution" | "first_response" | "all"
  const [historyLoading, setHistoryLoading] = useState(false);

  // ---------- Load SLA ----------
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!slaId) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const s = await SLAModel.get(orgId, slaId);
        if (!mounted) return;
        setSla(s || null);
      } catch (e) {
        console.error("[SLAInfoCard] load SLA failed:", e);
      } finally {
        mounted && setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [slaId, orgId]);

  // ---------- Initialize status from ticket (if present) ----------
  useEffect(() => {
    const provided = ticket?.sla_status || ticket?.slaStatus;
    if (!provided) return;

    const normalized = normalizeStatus(provided);
    setStatus(normalized);
  }, [ticket?.sla_status, ticket?.slaStatus]);

  // ---------- Load status from backend if not on ticket ----------
  useEffect(() => {
    let mounted = true;
    const provided = ticket?.sla_status || ticket?.slaStatus;
    const tid = ticket?.ticket_id || ticket?.ticketId;
    if (!tid || provided || !SlaMakingModel.getTicketStatus) return;

    (async () => {
      try {
        const row = await SlaMakingModel.getTicketStatus(tid);
        if (!mounted) return;
        setStatus(row ? normalizeStatus(row) : null);
      } catch (e) {
        console.warn("[SLAInfoCard] status fetch failed", e);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [ticket?.ticket_id, ticket?.ticketId, ticket?.sla_status, ticket?.slaStatus]);

  // ---------- Load pause history ----------
  const loadHistory = async (scope) => {
    const tid = ticket?.ticket_id || ticket?.ticketId;
    if (!tid || !SlaMakingModel.getTicketPauseHistory) return;
    setHistoryLoading(true);
    try {
      const dimParam = scope === "all" ? undefined : scope;
      const rows = await SlaMakingModel.getTicketPauseHistory(tid, {
        dimension: dimParam,
      });
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
    if (!status) return;

    const dim = dimension === "first_response" ? "first_response" : "resolution";

    const completed = Boolean(status?.[`${dim}_completed_at`]);
    const paused = Boolean(status?.[`${dim}_paused`]);
    const breached =
      dim === "first_response"
        ? Boolean(status?.breached_first_response)
        : Boolean(status?.breached_resolution);

    const shouldPoll = !completed && !paused && !breached;

    if (shouldPoll) {
      pollRef.current = setInterval(async () => {
        try {
          const row = await SlaMakingModel.getTicketStatus(tid);
          if (row) setStatus(normalizeStatus(row));
        } catch {
          // ignore
        }
      }, 60_000);
    }

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
    };
  }, [
    ticket?.ticket_id,
    ticket?.ticketId,
    dimension,
    status?.breached_first_response,
    status?.breached_resolution,
    status?.first_response_completed_at,
    status?.resolution_completed_at,
    status?.first_response_paused,
    status?.resolution_paused,
    status,
  ]);

  // ---------- Simple SLA match check based on rules (priority, severity, etc.) ----------
  const ticketCtx = useMemo(() => {
    const tagIds = (ticket?.tags || [])
      .map((t) => t.tag_id || t.tagId)
      .filter(Boolean);
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
    const oneOf = (a, v) => (Array.isArray(a) ? a.includes(v) : true);
    const anyOverlap = (need, have) =>
      Array.isArray(need) && Array.isArray(have)
        ? need.some((x) => have.includes(x))
        : true;

    if (rulesObj.priority_in && !oneOf(rulesObj.priority_in, ticketCtx.priority))
      return false;
    if (rulesObj.severity_in && !oneOf(rulesObj.severity_in, ticketCtx.severity))
      return false;
    if (rulesObj.group_id_in && !oneOf(rulesObj.group_id_in, ticketCtx.group_id))
      return false;
    if (rulesObj.team_id_in && !oneOf(rulesObj.team_id_in, ticketCtx.team_id))
      return false;
    if (
      rulesObj.product_id_in &&
      !oneOf(rulesObj.product_id_in, ticketCtx.product_id)
    )
      return false;
    if (rulesObj.tag_any && !anyOverlap(rulesObj.tag_any, ticketCtx.tags))
      return false;

    return true;
  };

  const slaApplies = useMemo(
    () => (sla ? matchesRuleBlock(sla.rules) : true),
    [sla, ticketCtx]
  );

  // ---------- Derive display values from status ----------
  const dim = dimension === "first_response" ? "first_response" : "resolution";

  const startedAt = status?.[`${dim}_started_at`] ?? null;
  const dueAt = status?.[`${dim}_due_at`] ?? null; // main due time
  const completedAt = status?.[`${dim}_completed_at`] ?? null;

  const pausedFlag = status?.[`${dim}_paused`] === true;
  const pausedAt = status?.[`${dim}_paused_at`] ?? null;
  const lastResume = status?.[`last_resume_${dim}`] ?? null;

  const breached =
    dim === "first_response"
      ? !!status?.breached_first_response
      : !!status?.breached_resolution;

  const pausedBanner = status?.paused === true; // global paused flag
  const graceMinutes = sla?.grace_minutes ?? 0;

  // Progress uses startedAt → (dueAt + grace) as window
  const baseDue = (() => {
    if (dueAt) return new Date(dueAt);
    return null;
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
  const totalWindowMs =
    started && targetEnd ? Math.max(1, targetEnd - started) : null;
  const rawElapsedMs = started ? referenceTime - started : null;
  const elapsedMs =
    totalWindowMs != null && rawElapsedMs != null
      ? Math.max(0, Math.min(totalWindowMs, rawElapsedMs))
      : null;

  const totalWindowMinutes =
    totalWindowMs != null ? Math.round(totalWindowMs / 60000) : null;
  const effectiveElapsed =
    elapsedMs != null ? Math.floor(elapsedMs / 60000) : null;

  const remainingMinutes =
    started && targetEnd && referenceTime
      ? Math.max(0, Math.ceil((targetEnd - referenceTime) / 60000))
      : null;

  const progressPct =
    totalWindowMs != null && elapsedMs != null
      ? clampPct((elapsedMs / totalWindowMs) * 100)
      : null;

  const eta = (() => {
    if (!targetEnd) return null;
    // if dueAt is already an exact field from backend, we treat that as authoritative
    if (!dueAt) return targetEnd;
    // dueAt exists, so UI just shows dueAt; we use targetEnd only for window
    return null;
  })();

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
        <div className="text-xs text-gray-600 leading-relaxed">
          {sla.description}
        </div>
      )}

      {!slaApplies && (
        <div className="p-2 text-xs rounded bg-yellow-50 border border-yellow-200 text-yellow-700 flex items-center gap-2">
          <Info className="w-4 h-4" />
          This SLA policy does not match this ticket’s attributes (rules filter it
          out).
        </div>
      )}

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

            {typeof effectiveElapsed === "number" &&
              totalWindowMinutes != null && (
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
            <div>
              <span className="font-medium">Started:</span> {fmtDT(startedAt)}
            </div>
            <div>
              <span className="font-medium">Due:</span>{" "}
              {dueAt
                ? fmtDT(dueAt)
                : eta
                ? `${eta.toLocaleString()} (est.)`
                : "—"}
            </div>
            <div>
              <span className="font-medium">Completed:</span>{" "}
              {fmtDT(completedAt)}
            </div>
            <div>
              <span className="font-medium">Remaining:</span>{" "}
              {fmtMinutes(remainingMinutes)}
            </div>

            {pausedFlag && (
              <>
                <div>
                  <span className="font-medium">Paused At:</span>{" "}
                  {fmtDT(pausedAt)}
                </div>
                <div>
                  <span className="font-medium">Last Resume:</span>{" "}
                  {fmtDT(lastResume)}
                </div>
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
            <div className="text-sm font-medium text-gray-800">
              SLA Pause History
            </div>
          </div>

          {/* Scope filter */}
          <div className="flex items-center gap-2">
            <label className="text-[11px] text-gray-600">Filter:</label>
            <select
              className="text-[11px] border rounded px-1.5 py-0.5 text-gray-800 bg-white"
              value={historyScope}
              onChange={(e) => setHistoryScope(e.target.value)}
            >
              <option value={dimension}>
                {dimension === "first_response" ? "First Response" : "Resolution"}
              </option>
              <option
                value={
                  dimension === "first_response" ? "resolution" : "first_response"
                }
              >
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
              <div
                key={h.pause_id}
                className="py-2 text-xs text-gray-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1"
              >
                <div className="flex items-center gap-2">
                  <Chip
                    className={
                      h.action === "pause"
                        ? "bg-yellow-50 text-yellow-800 border-yellow-200"
                        : "bg-emerald-50 text-emerald-700 border-emerald-200"
                    }
                  >
                    {h.action === "pause" ? "Pause" : "Resume"}
                  </Chip>
                  <Chip className="bg-gray-50 text-gray-700">
                    {h.dimension === "first_response"
                      ? "First Response"
                      : "Resolution"}
                  </Chip>
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
                    <Chip className="bg-gray-50 text-gray-600">
                      by {h.actor_id}
                    </Chip>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
