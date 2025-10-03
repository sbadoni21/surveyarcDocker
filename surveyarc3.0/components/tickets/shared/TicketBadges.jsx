
// ============================================================
// FILE: components/tickets/shared/TicketBadges.jsx
// ============================================================
"use client";

export function StatusBadge({ status }) {
  const badges = {
    new: "bg-purple-50 text-purple-700 border-purple-200",
    open: "bg-blue-50 text-blue-700 border-blue-200",
    pending: "bg-yellow-50 text-yellow-700 border-yellow-200",
    on_hold: "bg-orange-50 text-orange-700 border-orange-200",
    resolved: "bg-green-50 text-green-700 border-green-200",
    closed: "bg-gray-50 text-gray-700 border-gray-200",
    canceled: "bg-red-50 text-red-700 border-red-200",
  };

  const cls = badges[status] || badges.new;
  const label = (status || "new").replace("_", " ").toUpperCase();
  
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs border ${cls}`}>
      {label}
    </span>
  );
}

export function PriorityBadge({ priority }) {
  const cls = {
    low: "bg-gray-50 text-gray-600 border-gray-200",
    normal: "bg-green-50 text-green-700 border-green-200",
    high: "bg-orange-50 text-orange-700 border-orange-200",
    urgent: "bg-red-50 text-red-700 border-red-200",
    blocker: "bg-red-100 text-red-800 border-red-300",
  }[priority] || "bg-green-50 text-green-700 border-green-200";

  const label = (priority || "normal").charAt(0).toUpperCase() + (priority || "normal").slice(1);
  
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs border font-medium ${cls}`}>
      {label}
    </span>
  );
}

