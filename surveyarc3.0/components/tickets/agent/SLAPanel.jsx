// components/tickets/agent/SLAPanel.jsx
"use client";
import { useEffect, useState, useRef } from "react";
import { Shield, PauseCircle, PlayCircle, Clock } from "lucide-react";
import SLAModel from "@/models/slaModel";
import TicketModel from "@/models/ticketModel";

function TimerRow({ data, dimension }) {
  if (!data) {
    return <div className="ml-6 text-xs text-gray-600">No data</div>;
  }

  const due = data.due_at ? new Date(data.due_at).toLocaleString() : "—";
  const paused = data.paused ? "Paused" : "Running";
  const elapsed =
    typeof data.elapsed_minutes === "number"
      ? `${data.elapsed_minutes}m elapsed`
      : "—";
  const completed = data.completed_at ? new Date(data.completed_at).toLocaleString() : null;

  return (
    <div className="ml-6 text-xs text-gray-600">
      <div>
        Due: <span className="font-medium text-gray-800">{due}</span>
      </div>
      <div>
        State:{" "}
        <span className="font-medium text-gray-800">
          {completed ? "Completed" : paused}
        </span>
      </div>
      {completed && (
        <div>
          Completed:{" "}
          <span className="font-medium text-gray-800">{completed}</span>
        </div>
      )}
      <div>{elapsed}</div>
    </div>
  );
}

// 🔵 helper to normalize both camelCase and snake_case from backend
function mapTimersToDimension(data, dim) {
  if (!data) return null;

  if (dim === "first_response") {
    return {
      due_at:
        data.firstResponseDueAt ??
        data.first_response_due_at ??
        null,
      started_at:
        data.firstResponseStartedAt ??
        data.first_response_started_at ??
        null,
      completed_at:
        data.firstResponseCompletedAt ??
        data.first_response_completed_at ??
        null,
      paused:
        data.firstResponsePaused ??
        data.first_response_paused ??
        false,
      paused_at:
        data.firstResponsePausedAt ??
        data.first_response_paused_at ??
        null,
      elapsed_minutes:
        data.elapsedFirstResponseMinutes ??
        data.elapsed_first_response_minutes ??
        null,
      total_paused_minutes:
        data.totalPausedFirstResponseMinutes ??
        data.total_paused_first_response_minutes ??
        null,
      breached:
        data.breachedFirstResponse ??
        data.breached_first_response ??
        false,
    };
  }

  // resolution
  return {
    due_at:
      data.resolutionDueAt ??
      data.resolution_due_at ??
      null,
    started_at:
      data.resolutionStartedAt ??
      data.resolution_started_at ??
      null,
    completed_at:
      data.resolutionCompletedAt ??
      data.resolution_completed_at ??
      null,
    paused:
      data.resolutionPaused ??
      data.resolution_paused ??
      false,
    paused_at:
      data.resolutionPausedAt ??
      data.resolution_paused_at ??
      null,
    elapsed_minutes:
      data.elapsedResolutionMinutes ??
      data.elapsed_resolution_minutes ??
      null,
    total_paused_minutes:
      data.totalPausedResolutionMinutes ??
      data.total_paused_resolution_minutes ??
      null,
    breached:
      data.breachedResolution ??
      data.breached_resolution ??
      false,
  };
}

export default function SLAPanel({ ticket, onTicketUpdated, busy, setBusy }) {
  const [firstResponse, setFirstResponse] = useState(null);
  const [resolution, setResolution] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const currentTicketId = useRef(null);
  const isLoadingRef = useRef(false);

  // ✅ consider SLA present if we have slaId / sla_id OR a status object
  const hasSLA = !!(
    ticket?.sla_id ||
    ticket?.slaId ||
    ticket?.sla_status ||
    ticket?.slaStatus
  );

  // Initial load: when ticket ID changes
  useEffect(() => {
    if (!ticket?.ticketId || !hasSLA) {
      if (!hasSLA) {
        setFirstResponse(null);
        setResolution(null);
      }
      return;
    }

    // Only fetch if ticket ID actually changed
    if (currentTicketId.current === ticket.ticketId) {
      return;
    }
    currentTicketId.current = ticket.ticketId;

    if (isLoadingRef.current) return;

    isLoadingRef.current = true;
    setIsLoading(true);

    SLAModel.getTimers(ticket.ticketId)
      .then((data) => {
        if (data) {
          setFirstResponse(mapTimersToDimension(data, "first_response"));
          setResolution(mapTimersToDimension(data, "resolution"));
        }
      })
      .catch((err) => {
        console.error("[SLAPanel] Failed to load SLA timers:", err);
      })
      .finally(() => {
        setIsLoading(false);
        isLoadingRef.current = false;
      });
  }, [ticket?.ticketId, hasSLA]);

  const refreshSLAData = async () => {
    if (!ticket?.ticketId) return;

    setIsLoading(true);
    try {
      const [updatedTicket, slaData] = await Promise.all([
        TicketModel.get(ticket.ticketId),
        SLAModel.getTimers(ticket.ticketId).catch(() => null),
      ]);

      if (slaData) {
        setFirstResponse(mapTimersToDimension(slaData, "first_response"));
        setResolution(mapTimersToDimension(slaData, "resolution"));
      }

      if (updatedTicket) {
        onTicketUpdated?.(updatedTicket);
      }
    } catch (err) {
      console.error("[SLAPanel] Failed to refresh SLA:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePause = async () => {
    setBusy(true);
    try {
      await SLAModel.pause(ticket.ticketId, {
        dimension: "resolution",
        reason: "agent_paused",
      });
      await refreshSLAData();
    } catch (err) {
      console.error("Failed to pause SLA:", err);
      alert("Failed to pause SLA timer");
    } finally {
      setBusy(false);
    }
  };

  const handleResume = async () => {
    setBusy(true);
    try {
      await SLAModel.resume(ticket.ticketId, { dimension: "resolution" });
      await refreshSLAData();
    } catch (err) {
      console.error("Failed to resume SLA:", err);
      alert("Failed to resume SLA timer");
    } finally {
      setBusy(false);
    }
  };

  if (!hasSLA) {
    return (
      <div className="p-4 border-b space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <Shield className="h-4 w-4" />
          SLA
        </div>
        <div className="text-sm text-gray-500">No SLA attached.</div>
      </div>
    );
  }

  return (
    <div className="p-4 border-b space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <Shield className="h-4 w-4" />
          SLA
        </div>
        {isLoading && (
          <div className="text-xs text-gray-500">Updating...</div>
        )}
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-blue-600" />
          <div className="font-medium text-gray-800">First Response</div>
        </div>
        <TimerRow data={firstResponse} dimension="first_response" />

        <div className="flex items-center gap-2 mt-2">
          <Clock className="h-4 w-4 text-amber-600" />
          <div className="font-medium text-gray-800">Resolution</div>
        </div>
        <TimerRow data={resolution} dimension="resolution" />
      </div>

      <div className="grid grid-cols-2 gap-2 pt-2">
        <button
          onClick={handlePause}
          disabled={busy || isLoading}
          className="px-3 py-2 text-xs rounded-md border hover:bg-gray-50 inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
        >
          <PauseCircle className="h-3.5 w-3.5" />
          Pause
        </button>
        <button
          onClick={handleResume}
          disabled={busy || isLoading}
          className="px-3 py-2 text-xs rounded-md border hover:bg-gray-50 inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
        >
          <PlayCircle className="h-3.5 w-3.5" />
          Resume
        </button>
      </div>
    </div>
  );
}
