"use client";
import { useEffect, useState } from "react";
import { Box, Button, Container, Grid, Paper, Stack, Typography } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import CalendarFilters from "@/components/calendars/CalendarFilters";
import CalendarList from "@/components/calendars/CalendarList";
import CalendarDetail from "@/components/calendars/CalendarDetail";
import CalendarForm from "@/components/calendars/CalendarForm";
import { usePathname } from "next/navigation";
import { useUser } from "@/providers/postGresPorviders/UserProvider";
import { useBusinessCalendars } from "@/providers/BusinessCalendarsProvider";

const FILTER_TYPES = ["all", "active", "inactive"];

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

export default function BusinessCalendarsPage() {
  const path = usePathname();
  const orgId = path.split("/")[3];
  const { uid: currentUserId } = useUser() || {};

  const { 
    calendars, 
    selectedCalendar, 
    setSelectedCalendar, 
    list, 
    create, 
    update, 
    remove,
    count, 
    loading,
    error 
  } = useBusinessCalendars();

  const [filters, setFilters] = useState({
    orgId,
    active: undefined,
    timezone: "",
    q: "",
  });
  const [counts, setCounts] = useState({});
  const [createOpen, setCreateOpen] = useState(false);

  const refresh = async () => {
    await list({
      orgId,
      active: filters.active,
      q: filters.q || undefined,
    });
  };

  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [filters, orgId]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const [activeResult, inactiveResult, totalResult] = await Promise.all([
        count({ orgId, active: true }),
        count({ orgId, active: false }),
        count({ orgId }),
      ]);
      
      if (mounted) {
        setCounts({
          active: activeResult.count || 0,
          inactive: inactiveResult.count || 0,
          total: totalResult.count || 0,
        });
      }
    })();
    return () => { mounted = false; };
  }, [orgId, count]);

  const handleFilterChange = (type) => {
    setFilters((f) => ({
      ...f,
      active: f.active === type ? undefined : type
    }));
  };

  return (
    <Container maxWidth="xl" sx={{ py: 2 }}>
      <Stack spacing={1.5}>
        <Stack 
          direction={{ xs: "column", sm: "row" }} 
          alignItems={{ xs: "stretch", sm: "center" }} 
          justifyContent="space-between" 
          spacing={1}
        >
          <Typography variant="h5">Business Calendars</Typography>
          <Button 
            startIcon={<AddIcon />} 
            variant="contained" 
            onClick={() => setCreateOpen(true)}
          >
            New Calendar
          </Button>
        </Stack>

        <Grid container spacing={1}>
          <Grid item xs={6} sm={4} md="auto">
            <StatCard
              label="TOTAL"
              count={counts.total ?? 0}
              active={filters.active === undefined}
              onClick={() => handleFilterChange(undefined)}
            />
          </Grid>
          <Grid item xs={6} sm={4} md="auto">
            <StatCard
              label="ACTIVE"
              count={counts.active ?? 0}
              active={filters.active === true}
              onClick={() => handleFilterChange(true)}
            />
          </Grid>
          <Grid item xs={6} sm={4} md="auto">
            <StatCard
              label="INACTIVE"
              count={counts.inactive ?? 0}
              active={filters.active === false}
              onClick={() => handleFilterChange(false)}
            />
          </Grid>
        </Grid>

        <Paper variant="outlined" sx={{ p: 1.25, borderRadius: 2 }}>
          <CalendarFilters
            orgId={orgId}
            state={filters}
            onChange={(st) => setFilters((f) => ({ ...f, ...st }))}
          />
        </Paper>

        {error && (
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, bgcolor: "error.light" }}>
            <Typography color="error.contrastText">{error}</Typography>
          </Paper>
        )}

        <Grid container spacing={1.5}>
          <Grid item xs={12} md={5} lg={4}>
            <CalendarList 
              calendars={calendars} 
              loading={loading} 
              onSelect={(calendar) => setSelectedCalendar(calendar)} 
              selectedId={selectedCalendar?.calendar_id}
            />
          </Grid>
          <Grid item xs={12} md={7} lg={8}>
            {selectedCalendar ? (
              <CalendarDetail
                calendar={selectedCalendar}
                orgId={orgId}
                currentUserId={currentUserId}
                onUpdate={async (id, patch) => {
                  const updated = await update(id, patch);
                  setSelectedCalendar(updated);
                }}
                onDelete={async (id) => {
                  await remove(id);
                  // Update counts after deletion
                  const newCounts = { ...counts };
                  if (selectedCalendar.active) {
                    newCounts.active = Math.max(0, (newCounts.active || 1) - 1);
                  } else {
                    newCounts.inactive = Math.max(0, (newCounts.inactive || 1) - 1);
                  }
                  newCounts.total = Math.max(0, (newCounts.total || 1) - 1);
                  setCounts(newCounts);
                }}
              />
            ) : (
              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                <Typography variant="body1" color="text.secondary">
                  Select a calendar to view its details.
                </Typography>
              </Paper>
            )}
          </Grid>
        </Grid>
      </Stack>

      <CalendarForm
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        orgId={orgId}
        currentUserId={currentUserId}
        onSubmit={async (payload) => {
          const created = await create(payload);
          setCreateOpen(false);
          setSelectedCalendar(created);
          
          // Update counts after creation
          setCounts((c) => ({
            ...c,
            total: (c.total || 0) + 1,
            active: created.active ? (c.active || 0) + 1 : c.active,
            inactive: !created.active ? (c.inactive || 0) + 1 : c.inactive,
          }));
        }}
      />
    </Container>
  );
}