// app/(whatever)/tickets/[ticketId]/page.jsx
"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Box, Button, Container, Stack, CircularProgress, Alert } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import TicketDetail from "@/components/tickets/TicketDetail";
import { useTickets } from "@/providers/ticketsProvider";
import { useUser } from "@/providers/postGresPorviders/UserProvider";

export default function TicketDetailPage({ params }) {
  const router = useRouter();
  const path = usePathname();
  const orgId = path.split("/")[3];
  const ticketId = path.split("/")[7];
  
  const { uid: currentUserId } = useUser() || {};
  const {
    selectedTicket,
    setSelectedTicket,
    get,
    update,
    assignGroup,
    patchTeams,
    patchAgents,
    getParticipants,
  } = useTickets();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [participants, setParticipants] = useState(null);

  // Fetch ticket on mount
  useEffect(() => {
    let mounted = true;
    const fetchTicket = async () => {
      if (!ticketId) return;
      
      setLoading(true);
      setError(null);
      
      try {
        const ticket = await get(ticketId);
        if (mounted) {
          setSelectedTicket(ticket);
          setLoading(false);
        }
      } catch (err) {
        if (mounted) {
          setError(err.message || "Failed to load ticket");
          setLoading(false);
        }
      }
    };

    fetchTicket();
    return () => { mounted = false; };
  }, [ticketId, get, setSelectedTicket]);

  // Fetch participants when ticket changes
  useEffect(() => {
    if (!selectedTicket?.ticketId) {
      setParticipants(null);
      return;
    }
    
    let mounted = true;
    getParticipants(selectedTicket.ticketId)
      .then((p) => mounted && setParticipants(p))
      .catch(() => mounted && setParticipants(null));
    
    return () => { mounted = false; };
  }, [selectedTicket?.ticketId, getParticipants]);

  // Handler functions
  const handleAssignGroup = async (ticketId, groupIdOrNull) => {
    const updated = await assignGroup(ticketId, groupIdOrNull);
    setSelectedTicket(updated);
    const snap = await getParticipants(ticketId);
    setParticipants(snap);
    return updated;
  };

  const handlePatchTeams = async (ticketId, teamIds, mode = "add") => {
    const updated = await patchTeams(ticketId, teamIds, mode);
    setSelectedTicket(updated);
    const snap = await getParticipants(ticketId);
    setParticipants(snap);
    return updated;
  };

  const handlePatchAgents = async (ticketId, agentIds, mode = "add") => {
    const updated = await patchAgents(ticketId, agentIds, mode);
    setSelectedTicket(updated);
    const snap = await getParticipants(ticketId);
    setParticipants(snap);
    return updated;
  };

  const handleUpdate = async (id, patch) => {
    const updated = await update(id, patch);
    setSelectedTicket(updated);
    const snap = await getParticipants(id);
    setParticipants(snap);
  };

  if (loading) {
    return (
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
          <CircularProgress size={48} />
        </Box>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Stack spacing={2}>
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={() => router.push(`/postgres-org/${orgId}/dashboard/tickets`)}
          >
            Back to Tickets
          </Button>
          <Alert severity="error">{error}</Alert>
        </Stack>
      </Container>
    );
  }

  if (!selectedTicket) {
    return (
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Stack spacing={2}>
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={() => router.push(`/postgres-org/${orgId}/dashboard/org-tickets/tickets`)}
          >
            Back to Tickets
          </Button>
          <Alert severity="warning">Ticket not found</Alert>
        </Stack>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: 2 }}>
      <Stack spacing={2}>
        <Button
          startIcon={<ArrowBackIcon />}
            onClick={() => router.push(`/postgres-org/${orgId}/dashboard/org-tickets/tickets`)}
          sx={{ alignSelf: "flex-start" }}
        >
          Back to Tickets
        </Button>

        <TicketDetail
          ticket={selectedTicket}
          orgId={orgId}
          currentUserId={currentUserId}
          participants={participants}
          onUpdate={handleUpdate}
          onAssignGroup={handleAssignGroup}
          onPatchTeams={handlePatchTeams}
          onPatchAgents={handlePatchAgents}
        />
      </Stack>
    </Container>
  );
}