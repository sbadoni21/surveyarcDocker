// ============================================================
// FILE: components/tickets/agent/TicketHeader.jsx
// ============================================================
"use client";
import { StatusBadge, PriorityBadge } from "../shared/TicketBadges";

export default function TicketHeader({ ticket }) {
  return (
    <div className="border-b px-4 py-3 flex items-center justify-between">
      <div className="min-w-0">
        <div className="text-xs text-gray-500">
          <span className="font-mono">#{ticket.number ?? "—"}</span> •{" "}
          {new Date(ticket.createdAt || ticket.created_at).toLocaleString()}
        </div>
        <h2 className="text-lg font-semibold truncate">{ticket.subject}</h2>
      </div>
      <div className="flex items-center gap-2">
        <StatusBadge status={ticket.status} />
        <PriorityBadge priority={ticket.priority} />
      </div>
    </div>
  );
}