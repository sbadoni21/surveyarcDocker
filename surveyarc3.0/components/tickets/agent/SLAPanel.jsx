"use client";
import { Shield, PauseCircle, PlayCircle, Clock } from "lucide-react";
import SLAModel from "@/models/slaModel";

function TimerRow({ timer = {}, ticket, dimension }) {
  // Try to get data from ticket object first, fallback to timer prop
  let due, elapsed, paused;
  
  if (dimension === "first_response") {
    due = ticket?.first_response_due_at || timer?.due_at;
    elapsed = ticket?.first_response_elapsed_minutes ?? timer?.elapsed_minutes;
    paused = ticket?.first_response_paused ?? timer?.paused;
  } else if (dimension === "resolution") {
    due = ticket?.resolution_due_at || timer?.due_at;
    elapsed = ticket?.resolution_elapsed_minutes ?? timer?.elapsed_minutes;
    paused = ticket?.resolution_paused ?? timer?.paused;
  } else {
    // Fallback to timer prop only
    due = timer?.due_at;
    elapsed = timer?.elapsed_minutes;
    paused = timer?.paused;
  }

  const dueDisplay = due ? new Date(due).toLocaleString() : "—";
  const elapsedDisplay = typeof elapsed === "number" ? `${elapsed}m elapsed` : "—";
  const pausedDisplay = paused ? "Paused" : "Running";
  
  return (
    <div className="ml-6 text-xs text-gray-600">
      <div>Due: <span className="font-medium text-gray-800">{dueDisplay}</span></div>
      <div>State: <span className="font-medium text-gray-800">{pausedDisplay}</span></div>
      <div>{elapsedDisplay}</div>
    </div>
  );
}

export default function SLAPanel({ ticket, timers, busy, setBusy, onTicketUpdated }) {
  const handlePause = async () => {
    setBusy(true);
    try {
      await SLAModel.pause(ticket.ticketId, { dimension: "resolution", reason: "agent_paused" });
      // Refresh ticket data after pause
      if (onTicketUpdated) {
        const updated = await TicketModel.get(ticket.ticketId);
        onTicketUpdated(updated);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleResume = async () => {
    setBusy(true);
    try {
      await SLAModel.resume(ticket.ticketId, { dimension: "resolution" });
      // Refresh ticket data after resume
      if (onTicketUpdated) {
        const updated = await TicketModel.get(ticket.ticketId);
        onTicketUpdated(updated);
      }
    } finally {
      setBusy(false);
    }
  };

  if (!ticket?.sla_status && !ticket?.slaStatus) {
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

  const { resolution = {}, first_response = {} } = timers || {};

  return (
    <div className="p-4 border-b space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
        <Shield className="h-4 w-4" />
        SLA
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-blue-600" />
          <div className="font-medium text-gray-800">First Response</div>
        </div>
        <TimerRow timer={first_response} ticket={ticket} dimension="first_response" />

        <div className="flex items-center gap-2 mt-2">
          <Clock className="h-4 w-4 text-amber-600" />
          <div className="font-medium text-gray-800">Resolution</div>
        </div>
        <TimerRow timer={resolution} ticket={ticket} dimension="resolution" />
      </div>

      <div className="grid grid-cols-2 gap-2 pt-2">
        <button
          onClick={handlePause}
          disabled={busy}
          className="px-3 py-2 text-xs rounded-md border hover:bg-gray-50 inline-flex items-center justify-center gap-1.5"
        >
          <PauseCircle className="h-3.5 w-3.5" />
          Pause
        </button>
        <button
          onClick={handleResume}
          disabled={busy}
          className="px-3 py-2 text-xs rounded-md border hover:bg-gray-50 inline-flex items-center justify-center gap-1.5"
        >
          <PlayCircle className="h-3.5 w-3.5" />
          Resume
        </button>
      </div>
    </div>
  );
}