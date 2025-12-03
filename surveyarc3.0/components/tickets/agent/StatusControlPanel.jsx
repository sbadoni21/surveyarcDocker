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
  setBusy,
}) {
  const [newStatus, setNewStatus] = useState(ticket.status);

  useEffect(() => {
    console.log("[StatusControlPanel] ticket changed", ticket);
    setNewStatus(ticket.status);
  }, [ticket.status, ticket]);

  const handleApply = async () => {
    console.log("[StatusControlPanel] Apply clicked", {
      currentStatus: ticket.status,
      newStatus,
      ticket,
      followup: ticket.followup,
    });

    if (newStatus === ticket.status) {
      console.log("[StatusControlPanel] Status unchanged, aborting");
      return;
    }

    const followup = ticket.followup || null;

    // 🔒 Guard: do not allow closing if follow-up is incomplete
    if (newStatus === "closed" && followup) {
      const mode = followup.mode || "inline";
      console.log("[StatusControlPanel] Followup present, checking guard", {
        mode,
        followup,
      });

      // 1️⃣ INLINE QUESTIONS MODE
      if (
        mode === "inline" &&
        Array.isArray(followup.questions) &&
        followup.questions.length > 0
      ) {
        console.log(
          "[StatusControlPanel] Inline followup questions:",
          followup.questions
        );

        const allAnswered = followup.questions.every((q) => {
          const val = (q.answer ?? "").toString().trim();
          console.log("[StatusControlPanel] Check answer", {
            questionId: q.id,
            label: q.label,
            answer: q.answer,
            normalized: val,
          });
          return val.length > 0;
        });

        console.log("[StatusControlPanel] allAnswered =", allAnswered);

        if (!allAnswered) {
          window.alert(
            "You must answer all follow-up questions before closing this ticket."
          );
          return;
        }
      }

      // 2️⃣ SURVEY MODE – must have a response id
      if (mode === "survey") {
        const hasResponseId =
          !!(followup.responseId || followup.response_id);

        console.log("[StatusControlPanel] Survey mode followup", {
          followup,
          hasResponseId,
        });

        if (!hasResponseId) {
          window.alert(
            "This ticket is linked to a follow-up survey. Please submit the survey response before closing the ticket."
          );
          return;
        }
      }
    }

    setBusy(true);
    try {
      console.log("[StatusControlPanel] Sending PATCH to backend", {
        ticketId: ticket.ticketId,
        payload: { status: newStatus },
      });

      const updated = await TicketModel.update(ticket.ticketId, {
        status: newStatus,
      });

      console.log(
        "[StatusControlPanel] Backend responded with updated ticket",
        updated
      );

      onTicketUpdated?.(updated);
    } catch (err) {
      console.error("[StatusControlPanel] Failed to update status", err);
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
          onChange={(e) => {
            console.log(
              "[StatusControlPanel] Status select changed",
              e.target.value
            );
            setNewStatus(e.target.value);
          }}
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
