// ============================================================
// FILE: components/tickets/agent/SidebarActionsPanel.jsx
// ============================================================
"use client";
import StatusControlPanel from "./StatusControlPanel";
import SLAPanel from "./SLAPanel";
import QuickActionsPanel from "./QuickActionsPanel";

export default function SidebarActionsPanel({ 
  ticket, 
  timers, 
  onTicketUpdated,
  busy,
  setBusy 
}) {
  return (
    <>
      <StatusControlPanel
        ticket={ticket}
        onTicketUpdated={onTicketUpdated}
        busy={busy}
        setBusy={setBusy}
      />
      <SLAPanel
        ticket={ticket}
        timers={timers}
        onTimersUpdated={() => {}}
        busy={busy}
        setBusy={setBusy}
      />
      <QuickActionsPanel
        ticket={ticket}
        onTicketUpdated={onTicketUpdated}
        busy={busy}
        setBusy={setBusy}
      />
    </>
  );
}
