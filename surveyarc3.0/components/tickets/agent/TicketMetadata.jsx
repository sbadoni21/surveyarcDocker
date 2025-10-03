"use client";

function MetaField({ label, value }) {
  return (
    <div className="space-y-1">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-sm font-medium text-gray-800 truncate">{value || "—"}</div>
    </div>
  );
}

function formatDue(slaStatus) {
  if (!slaStatus) return "—";
  const res = slaStatus.resolution_due_at || slaStatus.resolutionDueAt;
  return res ? new Date(res).toLocaleString() : "—";
}

export default function TicketMetadata({ ticket }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-4 border-b">
      <MetaField label="Requester" value={ticket.requesterId} />
      <MetaField label="Group" value={ticket.groupId} />
      <MetaField label="Assignee" value={ticket.assigneeId} />
      <MetaField label="Severity" value={(ticket.severity || "").toUpperCase()} />
      <MetaField label="SLA" value={ticket.sla_id || ticket.slaId} />
      <MetaField label="Due" value={formatDue(ticket?.sla_status || ticket?.slaStatus)} />
    </div>
  );
}