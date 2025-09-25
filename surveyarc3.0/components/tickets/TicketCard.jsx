"use client";
import { Card, CardActionArea, CardContent, Chip, Stack, Typography } from "@mui/material";

const statusColor = (s) => {
  switch (s) {
    case "new": return "info";
    case "open": return "success";
    case "pending": return "warning";
    case "on_hold": return "default";
    case "resolved": return "primary";
    case "closed": return "default";
    case "canceled": return "error";
    default: return "default";
  }
};

export default function TicketCard({ ticket, onClick }) {
  const queueOwned = !ticket.assigneeId && !!ticket.groupId;
  return (
    <Card variant="outlined" sx={{ borderRadius: 2 }}>
      <CardActionArea onClick={() => onClick?.(ticket)}>
        <CardContent>
          <Stack spacing={0.5}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="subtitle1" noWrap>{ticket.subject}</Typography>
              <Chip size="small" label={ticket.status} color={statusColor(ticket.status)} />
            </Stack>

            <Typography variant="body2" color="text.secondary" noWrap>
              #{ticket.number || ticket.ticketId}
              {" • "}Priority: {ticket.priority?.toUpperCase?.() || ticket.priority}
              {" • "}
              {queueOwned ? `Queue: ${ticket.groupName || ticket.groupId || "—"}` :
                (ticket.assigneeName || ticket.assigneeId ? `Assignee: ${ticket.assigneeName || ticket.assigneeId}` : "Unassigned")}
            </Typography>

            {ticket.sla_status?.breached_resolution && (
              <Chip size="small" color="error" label="SLA Breach" sx={{ width: "fit-content" }} />
            )}

            {ticket.tags?.length > 0 && (
              <Stack direction="row" spacing={0.5} flexWrap="wrap">
                {ticket.tags.slice(0, 3).map((tg) => (
                  <Chip key={tg.tag_id || tg.tagId || tg.name} label={tg.name || tg.tag_id} size="small" />
                ))}
              </Stack>
            )}
          </Stack>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}
