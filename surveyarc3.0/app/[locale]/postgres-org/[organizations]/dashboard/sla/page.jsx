"use client";
import { Container, Paper, Stack, Typography } from "@mui/material";
import SLAAdminPanel from "@/components/sla/SLAAdminPanel";
import { usePathname } from "next/navigation";
import { SLAMakingProvider } from "@/providers/slaMakingProivder";

export default function SLASettingsPage() {
  const path = usePathname();
  const orgId = path.split("/")[3];

  return (
    <SLAMakingProvider>
      <Container maxWidth="lg" sx={{ py: 2 }}>
        <Stack spacing={2}>
          <Typography variant="h5">SLA & Business Calendars</Typography>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <SLAAdminPanel orgId={orgId} />
          </Paper>
        </Stack>
      </Container>
    </SLAMakingProvider>
  );
}
