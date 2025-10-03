"use client";
import { ChevronRight } from "lucide-react";
import { StatusBadge, PriorityBadge } from "../shared/TicketBadges";

export default function TicketListItem({ ticket, isSelected, onSelect }) {
  return (
    <li
      className={`p-3 cursor-pointer hover:bg-gray-50 ${isSelected ? "bg-blue-50/50" : ""}`}
      onClick={onSelect}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span className="font-mono">#{ticket.number ?? "—"}</span>
            <span>•</span>
            <span>{new Date(ticket.updatedAt || ticket.createdAt).toLocaleString()}</span>
          </div>
          <div className="font-medium text-gray-900 line-clamp-2">{ticket.subject}</div>
          <div className="mt-1 flex items-center gap-2 text-xs">
            <StatusBadge status={ticket.status} />
            <PriorityBadge priority={ticket.priority} />
          </div>
        </div>
        <ChevronRight className="h-4 w-4 text-gray-400 mt-1" />
      </div>
    </li>
  );
}