// components/tickets/agent/SLAPanel.jsx
"use client";
import { useEffect, useState, useRef } from "react";
import { Shield, PauseCircle, PlayCircle, Clock } from "lucide-react";
import SLAModel from "@/models/slaModel";
import TicketModel from "@/models/ticketModel";

function TimerRow({ data, dimension }) {
  if (!data) return <div className="ml-6 text-xs text-gray-600">No data</div>;

  const due = data.due_at ? new Date(data.due_at).toLocaleString() : "—";
  const paused = data.paused ? "Paused" : "Running";
  const elapsed = typeof data.elapsed_minutes === "number" ? `${data.elapsed_minutes}m elapsed` : "—";

  return (
    <div className="ml-6 text-xs text-gray-600">
      <div>
        Due: <span className="font-medium text-gray-800">{due}</span>
      </div>
      <div>
        State: <span className="font-medium text-gray-800">{paused}</span>
      </div>
      <div>{elapsed}</div>
    </div>
  );
}

export default function SLAPanel({ ticket, onTicketUpdated, busy, setBusy }) {
  // Store SLA data independently - never clear once set
  const [firstResponse, setFirstResponse] = useState(null);
  const [resolution, setResolution] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const currentTicketId = useRef(null);
  const isLoadingRef = useRef(false);
  
  const hasSLA = !!(ticket?.sla_status || ticket?.slaStatus);

  // Load SLA data - only when ticket ID changes
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

    if (isLoadingRef.current) {
      return;
    }
    
    isLoadingRef.current = true;
    setIsLoading(true);

    SLAModel.getTimers(ticket.ticketId)
      .then((data) => {
        if (data) {
          // Transform flat structure to nested structure
          const firstResponseData = {
            due_at: data.first_response_due_at,
            started_at: data.first_response_started_at,
            completed_at: data.first_response_completed_at,
            paused: data.first_response_paused,
            paused_at: data.first_response_paused_at,
            elapsed_minutes: data.elapsed_first_response_minutes,
            total_paused_minutes: data.total_paused_first_response_minutes,
            breached: data.breached_first_response,
          };

          const resolutionData = {
            due_at: data.resolution_due_at,
            started_at: data.resolution_started_at,
            completed_at: data.resolution_completed_at,
            paused: data.resolution_paused,
            paused_at: data.resolution_paused_at,
            elapsed_minutes: data.elapsed_resolution_minutes,
            total_paused_minutes: data.total_paused_resolution_minutes,
            breached: data.breached_resolution,
          };

          setFirstResponse(firstResponseData);
          setResolution(resolutionData);
        }
      })
      .catch((err) => {
        console.error("[SLAPanel] Failed to load SLA timers:", err);
        // Don't clear data on error
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

      // Transform and update SLA data
      if (slaData) {
        const firstResponseData = {
          due_at: slaData.first_response_due_at,
          started_at: slaData.first_response_started_at,
          completed_at: slaData.first_response_completed_at,
          paused: slaData.first_response_paused,
          paused_at: slaData.first_response_paused_at,
          elapsed_minutes: slaData.elapsed_first_response_minutes,
          total_paused_minutes: slaData.total_paused_first_response_minutes,
          breached: slaData.breached_first_response,
        };

        const resolutionData = {
          due_at: slaData.resolution_due_at,
          started_at: slaData.resolution_started_at,
          completed_at: slaData.resolution_completed_at,
          paused: slaData.resolution_paused,
          paused_at: slaData.resolution_paused_at,
          elapsed_minutes: slaData.elapsed_resolution_minutes,
          total_paused_minutes: slaData.total_paused_resolution_minutes,
          breached: slaData.breached_resolution,
        };

        setFirstResponse(firstResponseData);
        setResolution(resolutionData);
      }

      // Update parent ticket
      if (updatedTicket) {
        onTicketUpdated?.(updatedTicket);
      }
    } catch (err) {
      console.error("Failed to refresh SLA:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePause = async () => {
    setBusy(true);
    try {
      await SLAModel.pause(ticket.ticketId, { 
        dimension: "resolution", 
        reason: "agent_paused" 
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