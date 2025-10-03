
// ============================================================
// FILE: components/tickets/agent/WorklogsSection.jsx
// ============================================================
"use client";
import { Clock } from "lucide-react";
import WorklogForm from "./WorklogForm";
import WorklogList from "./WorklogList";

export default function WorklogsSection({
  ticket,
  worklogs,
  currentUserId,
  onWorklogAdded,
  busy,
  setBusy,
}) {
  const totalMinutes = worklogs.reduce((sum, w) => sum + (w.minutes || 0), 0);

  return (
    <div className="border-t">
      <div className="px-4 py-3 flex items-center justify-between bg-gray-50">
        <div className="flex items-center gap-2 text-sm text-gray-700 font-medium">
          <Clock className="h-4 w-4" />
          Worklogs
        </div>
        <div className="text-xs text-gray-600 font-medium">
          Total: {totalMinutes} mins
        </div>
      </div>

      <WorklogForm
        ticket={ticket}
        currentUserId={currentUserId}
        onWorklogAdded={onWorklogAdded}
        busy={busy}
        setBusy={setBusy}
      />

      <WorklogList worklogs={worklogs} />
    </div>
  );
}
