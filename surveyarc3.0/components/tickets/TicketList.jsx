"use client";
import { useEffect } from "react";
import { Grid, LinearProgress, Stack, Typography } from "@mui/material";
import TicketCard from "./TicketCard";

export default function TicketList({ tickets, loading, onSelect }) {
  return (
    <Stack spacing={1}>
      {loading && <LinearProgress />}
      {(!tickets || tickets.length === 0) && !loading ? (
        <Typography variant="body2" color="text.secondary">No tickets found.</Typography>
      ) : (
        <Grid container spacing={1}>
          {tickets.map((t) => (
            <Grid key={t.ticketId} item xs={12} md={6} lg={4}>
              <TicketCard ticket={t} onClick={onSelect} />
            </Grid>
          ))}
        </Grid>
      )}
    </Stack>
  );
}
