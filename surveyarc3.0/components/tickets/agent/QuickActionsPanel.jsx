
// ============================================================
// FILE: components/tickets/agent/QuickActionsPanel.jsx
// ============================================================
"use client";
import { CheckCircle2, PauseCircle } from "lucide-react";
import TicketModel from "@/models/ticketModel";

export default function QuickActionsPanel({ 
  ticket, 
  onTicketUpdated,
  busy,
  setBusy 
}) {
  const handleResolve = async () => {
    setBusy(true);
    try {
      const updated = await TicketModel.update(ticket.ticketId, { status: "resolved" });
      onTicketUpdated?.(updated);
    } finally {
      setBusy(false);
    }
  };

  const handlePending = async () => {
    setBusy(true);
    try {
      const updated = await TicketModel.update(ticket.ticketId, { status: "pending" });
      onTicketUpdated?.(updated);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-4 space-y-3">
      <div className="text-sm font-medium text-gray-700">Quick actions</div>
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={handleResolve}
          disabled={busy}
          className="px-3 py-2 text-sm rounded-md border hover:bg-gray-50 inline-flex items-center justify-center gap-2"
        >
          <CheckCircle2 className="h-4 w-4" />
          Resolve
        </button>
        <button
          onClick={handlePending}
          disabled={busy}
          className="px-3 py-2 text-sm rounded-md border hover:bg-gray-50 inline-flex items-center justify-center gap-2"
        >
          <PauseCircle className="h-4 w-4" />
          Pending
        </button>
      </div>
    </div>
  );
}
