// ============================================================
// FILE: components/tickets/agent/TicketListPanel.jsx
// ============================================================
"use client";
import { Search, Loader2, AlertCircle, MessageSquare } from "lucide-react";
import TicketListItem from "./TicketListItem";

export default function TicketListPanel({ 
  tickets, 
  loading, 
  selected, 
  onSelect,
  filters,
  onFiltersChange,
  onRefresh 
}) {
  return (
    <section className="lg:col-span-5 xl:col-span-4 border rounded-lg bg-white flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b flex items-center gap-2">
        <MessageSquare className="h-5 w-5 text-gray-600" />
        <h1 className="text-base font-semibold">My Queue</h1>
      </div>

      {/* Filters Bar */}
      <div className="border-b px-3 py-2 flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="h-4 w-4 absolute left-2 top-2.5 text-gray-400" />
          <input
            value={filters.q}
            onChange={(e) => onFiltersChange({ q: e.target.value })}
            placeholder="Search subject…"
            className="pl-8 pr-3 py-2 border rounded-md text-sm w-full"
          />
        </div>
        <select
          className="border rounded-md px-2 py-2 text-sm"
          value={filters.status}
          onChange={(e) => onFiltersChange({ status: e.target.value })}
        >
          <option value="">All</option>
          <option value="new">New</option>
          <option value="open">Open</option>
          <option value="pending">Pending</option>
          <option value="on_hold">On Hold</option>
          <option value="resolved">Resolved</option>
          <option value="closed">Closed</option>
        </select>
        <select
          className="border rounded-md px-2 py-2 text-sm"
          value={filters.sortBy}
          onChange={(e) => onFiltersChange({ sortBy: e.target.value })}
        >
          <option value="updated_at_desc">Recently Updated</option>
          <option value="created_at_desc">Newest First</option>
          <option value="created_at_asc">Oldest First</option>
          <option value="priority_desc">High Priority First</option>
          <option value="priority_asc">Low Priority First</option>
        </select>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="px-3 py-2 text-sm border rounded-md hover:bg-gray-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Refresh"}
        </button>
      </div>

      {/* Ticket List */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="p-6 text-gray-500 flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : tickets.length === 0 ? (
          <div className="p-6 text-gray-500 flex items-center justify-center gap-2">
            <AlertCircle className="h-4 w-4" />
            No assigned tickets.
          </div>
        ) : (
          <ul className="divide-y">
            {tickets.map((ticket) => (
              <TicketListItem
                key={ticket.ticketId}
                ticket={ticket}
                isSelected={selected?.ticketId === ticket.ticketId}
                onSelect={() => onSelect(ticket)}
              />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}