
// ============================================================
// FILE: components/tickets/agent/StatusControlPanel.jsx
// ============================================================
"use client";
import { useState, useEffect } from "react";
import TicketModel from "@/models/ticketModel";

export default function StatusControlPanel({ 
  ticket, 
  onTicketUpdated,
  busy,
  setBusy 
}) {
  const [newStatus, setNewStatus] = useState(ticket.status);

  useEffect(() => {
    setNewStatus(ticket.status);
  }, [ticket.status]);

  const handleApply = async () => {
    if (newStatus === ticket.status) return;
    setBusy(true);
    try {
      const updated = await TicketModel.update(ticket.ticketId, { status: newStatus });
      onTicketUpdated?.(updated);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-4 border-b space-y-3">
      <div className="text-sm font-medium text-gray-700">Status</div>
      <div className="flex items-center gap-2">
        <select
          className="flex-1 border rounded-md px-3 py-2 text-sm"
          value={newStatus}
          onChange={(e) => setNewStatus(e.target.value)}
        >
          <option value="new">New</option>
          <option value="open">Open</option>
          <option value="pending">Pending</option>
          <option value="on_hold">On Hold</option>
          <option value="resolved">Resolved</option>
          <option value="closed">Closed</option>
        </select>
        <button
          onClick={handleApply}
          disabled={busy || newStatus === ticket.status}
          className="px-4 py-2 text-sm rounded-md bg-gray-900 text-white hover:bg-black disabled:bg-gray-400"
        >
          Apply
        </button>
      </div>
    </div>
  );
}
