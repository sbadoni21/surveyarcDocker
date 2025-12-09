import React from "react";

const STATUS_STYLES = {
  planning: {
    label: "Planning",
    bgColor: "bg-blue-100",
    textColor: "text-blue-700",
    borderColor: "border-blue-200",
  },
  in_progress: {
    label: "In Progress",
    bgColor: "bg-green-100",
    textColor: "text-green-700",
    borderColor: "border-green-200",
  },
  on_hold: {
    label: "On Hold",
    bgColor: "bg-yellow-100",
    textColor: "text-yellow-700",
    borderColor: "border-yellow-200",
  },
  completed: {
    label: "Completed",
    bgColor: "bg-emerald-100",
    textColor: "text-emerald-700",
    borderColor: "border-emerald-200",
  },
  cancelled: {
    label: "Cancelled",
    bgColor: "bg-red-100",
    textColor: "text-red-700",
    borderColor: "border-red-200",
  },
};

export function StatusChip({ status }) {
  const key = String(status || "").toLowerCase();
  const style = STATUS_STYLES[key] || {
    label: status || "Unknown",
    bgColor: "bg-gray-100",
    textColor: "text-gray-700",
    borderColor: "border-gray-200",
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${style.bgColor} ${style.textColor} ${style.borderColor}`}
    >
      {style.label}
    </span>
  );
}