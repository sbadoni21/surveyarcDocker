// app/(dashboard)/[orgSlug]/[orgId]/tickets/agent/page.jsx
"use client";
import { useEffect, useState, useCallback } from "react";
import { usePathname } from "next/navigation";
import { useUser } from "@/providers/postGresPorviders/UserProvider";
import TicketModel from "@/models/ticketModel";
import { ChevronLeft } from "lucide-react";
import TicketListPanel from "@/components/tickets/agent/TicketListPanel";
import TicketDetailPanel from "@/components/tickets/agent/TicketDetailPanel";
import { sortTickets } from "@/components/tickets/utils/ticketHelpers";

export default function AgentTicketsPage() {
  const path = usePathname();
  const orgId = path.split("/")[3];
  const { uid } = useUser();

  const [loading, setLoading] = useState(true);
  const [tickets, setTickets] = useState([]);
  const [selected, setSelected] = useState(null);
  const [filters, setFilters] = useState({
    q: "",
    status: "",
    sortBy: "updated_at_desc",
  });

  const loadTickets = useCallback(async () => {
    if (!orgId || !uid) return;

    setLoading(true);
    try {
      const list = await TicketModel.list({
        orgId,
        // IMPORTANT: filter by agentId (string), not assigneeId
        agentId: String(uid),
        q: filters.q || undefined,
        status: filters.status || undefined,
        limit: 200,
      }).catch(() => []);

      const normalized = (list || []).map((t) => ({
        ...t,
        ticketId: t.ticketId || t.ticket_id,
        number: t.number,
        subject: t.subject,
        status: t.status,
        priority: t.priority,
        severity: t.severity,
        requesterId: t.requesterId || t.requester_id,
        groupId: t.groupId || t.group_id,
        teamId: t.teamId ?? t.team_id ?? null,
        agentId: t.agentId ?? t.agent_id ?? null,
        updatedAt: t.updatedAt || t.updated_at,
        createdAt: t.createdAt || t.created_at,
        slaStatus: t.sla_status || t.slaStatus || null,
      }));

      setTickets(sortTickets(normalized, filters.sortBy));

      if (selected) {
        const stillExists = normalized.find((x) => x.ticketId === selected.ticketId);
        setSelected(stillExists || null);
      }
    } finally {
      setLoading(false);
    }
  }, [orgId, uid, filters.q, filters.status, filters.sortBy, selected?.ticketId]);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  const handleFiltersChange = (updates) => {
    setFilters((prev) => ({ ...prev, ...updates }));
  };

  const handleTicketChanged = (updatedTicket) => {
    setTickets((prev) =>
      prev.map((t) => (t.ticketId === updatedTicket.ticketId ? { ...t, ...updatedTicket } : t))
    );
    setSelected((cur) => (cur?.ticketId === updatedTicket.ticketId ? { ...cur, ...updatedTicket } : cur));
  };

  const handleTicketSelect = async (ticket) => {
    setSelected(ticket);
    if (ticket.status === "new") {
      try {
        const updated = await TicketModel.update(ticket.ticketId, { status: "open" });
        handleTicketChanged(updated);
      } catch (err) {
        console.error("Failed to update ticket status:", err);
      }
    }
  };

  return (
    <main className="min-h-screen p-4 md:p-6">
      <div className="h-full grid grid-cols-1 lg:grid-cols-12 gap-4">
        <TicketListPanel
          tickets={tickets}
          loading={loading}
          selected={selected}
          onSelect={handleTicketSelect}
          filters={filters}
          onFiltersChange={handleFiltersChange}
          onRefresh={loadTickets}
        />
        <section className="lg:col-span-7 xl:col-span-8 border rounded-lg bg-white min-h-0 flex flex-col">
          {!selected ? (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              <ChevronLeft className="h-5 w-5 mr-2" />
              Select a ticket from the left.
            </div>
          ) : (
            <TicketDetailPanel
              key={selected.ticketId}
              ticket={selected}
              currentUserId={uid}
              onTicketChanged={handleTicketChanged}
            />
          )}
        </section>
      </div>
    </main>
  );
}
