
// ============================================================
// FILE: components/tickets/agent/WorklogForm.jsx
// ============================================================
"use client";
import { useState } from "react";
import WorklogModel from "@/models/postGresModels/worklogModel";

export default function WorklogForm({ 
  ticket, 
  currentUserId, 
  onWorklogAdded,
  busy,
  setBusy 
}) {
  const [minutes, setMinutes] = useState("");
  const [kind, setKind] = useState("other");
  const [note, setNote] = useState("");

  const handleAdd = async () => {
    const mins = parseInt(minutes, 10);
    if (!mins || mins <= 0) return;
    
    setBusy(true);
    try {
      const worklog = await WorklogModel.create(ticket.ticketId, {
        userId: currentUserId,
        minutes: mins,
        kind: kind,
        note: note || undefined,
      });
      setMinutes("");
      setNote("");
      onWorklogAdded?.(worklog);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="px-4 py-3 border-b">
      <div className="grid grid-cols-1 md:grid-cols-6 gap-2">
        <input
          type="number"
          min="1"
          value={minutes}
          onChange={(e) => setMinutes(e.target.value)}
          className="border rounded-md px-3 py-2 text-sm md:col-span-2"
          placeholder="Minutes"
        />
        <select
          className="border rounded-md px-3 py-2 text-sm md:col-span-2"
          value={kind}
          onChange={(e) => setKind(e.target.value)}
        >
          <option value="analysis">Analysis</option>
          <option value="investigation">Investigation</option>
          <option value="comms">Communications</option>
          <option value="fix">Fix</option>
          <option value="review">Review</option>
          <option value="other">Other</option>
        </select>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="border rounded-md px-3 py-2 text-sm md:col-span-6"
          placeholder="Note (optional)"
        />
        <div className="md:col-span-6 flex items-center justify-end">
          <button
            onClick={handleAdd}
            disabled={busy || !parseInt(minutes || "0", 10)}
            className="px-4 py-2 text-sm rounded-md text-white bg-gray-800 hover:bg-black disabled:bg-gray-400"
          >
            Add Worklog
          </button>
        </div>
      </div>
    </div>
  );
}