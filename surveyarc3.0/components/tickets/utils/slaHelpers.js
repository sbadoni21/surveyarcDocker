// ============================================================
// FILE: components/tickets/utils/slaHelpers.js
// ============================================================
export async function readTimersSafe(ticketId) {
  try {
    const r = await fetch(`/api/post-gres-apis/tickets/${encodeURIComponent(ticketId)}/sla/timers`, { 
      cache: "no-store" 
    });
    if (!r.ok) return null;
    return r.json();
  } catch {
    return null;
  }
}