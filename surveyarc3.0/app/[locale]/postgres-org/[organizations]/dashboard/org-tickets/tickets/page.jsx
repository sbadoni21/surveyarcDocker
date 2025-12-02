// app/(whatever)/tickets/page.jsx
"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Box, Button, Container, Grid, Paper, Stack, Typography } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import TicketFilters from "@/components/tickets/TicketFilters";
import TicketList from "@/components/tickets/TicketList";
import TicketForm from "@/components/tickets/TicketForm";
import { useTickets } from "@/providers/ticketsProvider";
import { useUser } from "@/providers/postGresPorviders/UserProvider";
import { useTags } from "@/providers/postGresPorviders/TagProvider";
import TicketDashboard from "@/components/tickets/Analytics";

const STATUS_FOR_CARDS = ["new", "open", "pending", "on_hold", "resolved"];

function StatCard({ label, count, active, onClick }) {
  return (
    <Paper
      variant={active ? "elevation" : "outlined"}
      sx={{ p: 1.25, borderRadius: 2, cursor: "pointer", ...(active ? { boxShadow: 4 } : {}) }}
      onClick={onClick}
    >
      <Stack spacing={0.25}>
        <Typography variant="caption" color="text.secondary">{label}</Typography>
        <Typography variant="h6">{count}</Typography>
      </Stack>
    </Paper>
  );
}

export default function TicketsPage() {
  const router = useRouter();
  const path = usePathname();
  const orgId = path.split("/")[3];
  const { uid: currentUserId } = useUser() || {};
  const requesterId = currentUserId;
  const { list: listTags, getCachedTags } = useTags();
  const availableTags = getCachedTags(orgId);
  const { tickets, list, create, count, loading } = useTickets();
  console.log(tickets)

  const [filters, setFilters] = useState({
    orgId,
    status: "",
    q: "",
    mode: "all",          // "all" | "mine" | "group" | "collab"
    assigneeId: undefined,
    groupId: undefined,
  });
  const [counts, setCounts] = useState({});
  const [createOpen, setCreateOpen] = useState(false);

  const refresh = async () => {
    await list({
      orgId,
      status: filters.status || undefined,
      assigneeId: filters.mode === "mine" ? (currentUserId || undefined) : filters.assigneeId,
      groupId: filters.mode === "group" ? (filters.groupId || undefined) : undefined,
      q: filters.q || undefined,
    });
  };

  useEffect(() => { 
    refresh(); 
    /* eslint-disable-next-line */ 
  }, [filters, orgId, currentUserId]);

  useEffect(() => {
    if (orgId) listTags({ orgId }).catch(() => {});
  }, [orgId, listTags]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const entries = await Promise.all(
        STATUS_FOR_CARDS.map(async (s) => {
          const r = await count({ orgId, status: s });
          return [s, r.count || 0];
        })
      );
      if (mounted) setCounts(Object.fromEntries(entries));
    })();
    return () => { mounted = false; };
  }, [orgId, count]);

  const handleTicketSelect = (ticket) => {
    // Navigate to the ticket detail page
    router.push(`/postgres-org/${orgId}/dashboard/org-tickets/tickets/${ticket.ticketId}`);
  };

  return (
    <>
 <TicketDashboard  orgId={orgId} currentUserId={requesterId} />


  </>
   
  );
}