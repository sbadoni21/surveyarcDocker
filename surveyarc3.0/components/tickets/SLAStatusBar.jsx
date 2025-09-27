// components/tickets/SLAStatusBar.jsx
"use client";
import { Box, Button, Chip, Stack, Tooltip, Typography } from "@mui/material";
import { useSLA } from "@/providers/slaProvider";

function fmt(iso) {
  if (!iso) return "-";
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
}
function minsLeft(iso) {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  const m = Math.round(ms / 60000);
  return m;
}

export default function SLAStatusBar({ ticket }) {
  const { pauseSLA, resumeSLA, markFirstResponse, refreshTicketSLA } = useSLA();
  const s = ticket?.sla_status;

  if (!ticket?.sla_id) return null;

  const frLeft = s?.first_response_due_at ? minsLeft(s.first_response_due_at) : null;
  const resLeft = s?.resolution_due_at ? minsLeft(s.resolution_due_at) : null;

  return (
    <Box sx={{ p: 1, border: "1px solid", borderColor: "divider", borderRadius: 1, mb: 1 }}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems="center" justifyContent="space-between">
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
          <Typography variant="body2"><b>SLA:</b> {ticket.sla?.name || ticket.sla_id}</Typography>
          <Chip size="small" label={`FR due: ${fmt(s?.first_response_due_at)}`} color={s?.breached_first_response ? "error" : "default"} />
          <Chip size="small" label={`RES due: ${fmt(s?.resolution_due_at)}`} color={s?.breached_resolution ? "error" : "default"} />
          {typeof frLeft === "number" && <Chip size="small" label={`FR ${frLeft} min`} color={frLeft < 0 ? "error" : "primary"} />}
          {typeof resLeft === "number" && <Chip size="small" label={`RES ${resLeft} min`} color={resLeft < 0 ? "error" : "primary"} />}
          {s?.paused && <Chip size="small" color="warning" label={`Paused${s?.pause_reason ? `: ${s.pause_reason}` : ""}`} />}
        </Stack>
        <Stack direction="row" spacing={1}>
          {!ticket.first_response_at && (
            <Tooltip title="Mark first public reply happened">
              <Button size="small" onClick={() => markFirstResponse(ticket.ticketId).then(() => refreshTicketSLA(ticket.ticketId))}>
                First Response Done
              </Button>
            </Tooltip>
          )}
          {!s?.paused ? (
            <Button size="small" onClick={() => pauseSLA(ticket.ticketId, { reason: "awaiting_customer", dimension: "resolution" })}>
              Pause (Awaiting Customer)
            </Button>
          ) : (
            <Button size="small" onClick={() => resumeSLA(ticket.ticketId, { dimension: "resolution" })}>
              Resume
            </Button>
          )}
        </Stack>
      </Stack>
    </Box>
  );
}
