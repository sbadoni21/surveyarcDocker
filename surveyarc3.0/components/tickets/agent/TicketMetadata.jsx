"use client";

import { Clock, AlertTriangle, CheckCircle, Pause } from "lucide-react";

function MetaField({ label, value, variant = "default" }) {
  const variantStyles = {
    default: "text-gray-800",
    success: "text-emerald-700",
    warning: "text-amber-700",
    danger: "text-red-700",
  };

  return (
    <div className="space-y-1">
      <div className="text-xs text-gray-500">{label}</div>
      <div className={`text-sm font-medium truncate ${variantStyles[variant]}`}>
        {value || "—"}
      </div>
    </div>
  );
}

function formatDateTime(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return "—";
  }
}

function formatMinutes(minutes) {
  if (minutes == null || isNaN(minutes)) return "—";
  const abs = Math.max(0, Math.floor(Math.abs(minutes)));
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
}

function getSLAStatus(slaStatus) {
  if (!slaStatus) return { text: "No SLA", variant: "default", icon: null };
  
  const resolution = {
    paused: slaStatus.resolution_paused || slaStatus.resolutionPaused || false,
    breached: slaStatus.breached_resolution || slaStatus.breachedResolution || false,
    completed: slaStatus.resolution_completed_at || slaStatus.resolutionCompletedAt || null,
    dueAt: slaStatus.resolution_due_at || slaStatus.resolutionDueAt || null,
  };

  const firstResponse = {
    paused: slaStatus.first_response_paused || slaStatus.firstResponsePaused || false,
    breached: slaStatus.breached_first_response || slaStatus.breachedFirstResponse || false,
    completed: slaStatus.first_response_completed_at || slaStatus.firstResponseCompletedAt || null,
  };

  // Priority: Check if breached (highest severity)
  if (resolution.breached) {
    return { 
      text: "Breached", 
      variant: "danger", 
      icon: <AlertTriangle className="w-3 h-3 inline-block mr-1" /> 
    };
  }

  if (firstResponse.breached && !firstResponse.completed) {
    return { 
      text: "FR Breached", 
      variant: "danger", 
      icon: <AlertTriangle className="w-3 h-3 inline-block mr-1" /> 
    };
  }

  // Check if paused
  if (resolution.paused) {
    return { 
      text: "Paused", 
      variant: "warning", 
      icon: <Pause className="w-3 h-3 inline-block mr-1" /> 
    };
  }

  // Check if completed
  if (resolution.completed) {
    return { 
      text: "Resolved", 
      variant: "success", 
      icon: <CheckCircle className="w-3 h-3 inline-block mr-1" /> 
    };
  }

  // Check if approaching due date (within 20% of time)
  if (resolution.dueAt) {
    const now = new Date();
    const due = new Date(resolution.dueAt);
    const timeRemaining = due - now;
    
    if (timeRemaining < 0) {
      // Overdue but not marked as breached yet
      return { 
        text: "Overdue", 
        variant: "danger", 
        icon: <AlertTriangle className="w-3 h-3 inline-block mr-1" /> 
      };
    }
    
    const totalTime = due - new Date(slaStatus.resolution_started_at || slaStatus.resolutionStartedAt);
    const percentRemaining = (timeRemaining / totalTime) * 100;
    
    if (percentRemaining < 20) {
      return { 
        text: "At Risk", 
        variant: "warning", 
        icon: <Clock className="w-3 h-3 inline-block mr-1" /> 
      };
    }
  }

  // Active and on track
  return { 
    text: "Active", 
    variant: "success", 
    icon: <CheckCircle className="w-3 h-3 inline-block mr-1" /> 
  };
}

function getTimeRemaining(slaStatus) {
  if (!slaStatus) return "—";
  
  const dueAt = slaStatus.resolution_due_at || slaStatus.resolutionDueAt;
  const paused = slaStatus.resolution_paused || slaStatus.resolutionPaused;
  const completed = slaStatus.resolution_completed_at || slaStatus.resolutionCompletedAt;
  
  if (completed) return "Completed";
  if (!dueAt) return "—";
  
  const now = new Date();
  const due = new Date(dueAt);
  const diffMs = due - now;
  
  if (paused) {
    // Show remaining time when paused
    const remainingMinutes = Math.ceil(diffMs / 60000);
    return `${formatMinutes(remainingMinutes)} (paused)`;
  }
  
  if (diffMs < 0) {
    // Overdue
    const overdueMinutes = Math.abs(Math.floor(diffMs / 60000));
    return `${formatMinutes(overdueMinutes)} overdue`;
  }
  
  // Time remaining
  const remainingMinutes = Math.ceil(diffMs / 60000);
  return formatMinutes(remainingMinutes);
}

function getTotalPausedTime(slaStatus) {
  if (!slaStatus) return null;
  
  const pausedMinutes = 
    slaStatus.total_paused_resolution_minutes || 
    slaStatus.totalPausedResolutionMinutes || 
    0;
  
  return pausedMinutes > 0 ? formatMinutes(pausedMinutes) : null;
}

export default function TicketMetadata({ ticket }) {
  const slaStatus = ticket?.sla_status || ticket?.slaStatus;
  const hasSLA = !!(ticket?.sla_id || ticket?.slaId);
  
  const status = getSLAStatus(slaStatus);
  const timeRemaining = getTimeRemaining(slaStatus);
  const totalPaused = getTotalPausedTime(slaStatus);
  const dueAt = slaStatus?.resolution_due_at || slaStatus?.resolutionDueAt;
   console.log(ticket)
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-4 border-b">
      {/* Row 1 */}
      <MetaField label="Requester" value={ticket.requesterId} />
      <MetaField label="Group" value={ticket.groupId} />
      <MetaField label="Assignee" value={ticket.assigneeId} />
      
      {/* Row 2 */}
      <MetaField label="Severity" value={(ticket.severity || "").toUpperCase()} />
      
      {hasSLA ? (
        <>
          <MetaField 
            label="SLA Status" 
            value={
              <>
                {status.icon}
                {status.text}
              </>
            }
            variant={status.variant}
          />
          <MetaField 
            label="Time Remaining" 
            value={timeRemaining}
            variant={
              timeRemaining.includes("overdue") ? "danger" : 
              timeRemaining.includes("paused") ? "warning" : 
              "default"
            }
          />
        </>
      ) : (
        <>
          <MetaField label="SLA" value="Not Assigned" />
          <MetaField label="Due" value="—" />
        </>
      )}
      
      {/* Row 3 - Only show if SLA exists */}
      {hasSLA && (
        <>
          <MetaField 
            label="Due Date" 
            value={formatDateTime(dueAt)} 
          />
          <MetaField 
            label="SLA ID" 
            value={ticket.sla_id || ticket.slaId} 
          />
          {totalPaused && (
            <MetaField 
              label="Total Paused" 
              value={totalPaused}
              variant="warning"
            />
          )}
        </>
      )}
    </div>
  );
}