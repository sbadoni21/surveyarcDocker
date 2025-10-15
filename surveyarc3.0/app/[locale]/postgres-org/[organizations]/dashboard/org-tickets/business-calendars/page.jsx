"use client";
import { useEffect, useState } from "react";
import { 
  Box, 
  Button, 
  Container, 
  Grid, 
  Paper, 
  Stack, 
  Typography, 
  Skeleton,
  Card,
  CardContent,
  alpha,
  useTheme
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import CalendarFilters from "@/components/calendars/CalendarFilters";
import CalendarList from "@/components/calendars/CalendarList";
import CalendarDetail from "@/components/calendars/CalendarDetail";
import CalendarForm from "@/components/calendars/CalendarForm";
import { usePathname } from "next/navigation";
import { useUser } from "@/providers/postGresPorviders/UserProvider";
import { useBusinessCalendars } from "@/providers/BusinessCalendarsProvider";

function StatCard({ label, count, active, onClick, icon: Icon, color = "primary" }) {
  const theme = useTheme();
  
  return (
    <Card
      onClick={onClick}
      sx={{
        cursor: "pointer",
        transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        borderRadius: 3,
        border: active ? 2 : 1,
        borderColor: active ? `${color}.main` : "divider",
        bgcolor: active ? alpha(theme.palette[color].main, 0.08) : "background.paper",
        "&:hover": {
          transform: "translateY(-4px)",
          boxShadow: active ? 6 : 3,
          borderColor: `${color}.main`,
        },
      }}
    >
      <CardContent sx={{ p: 2.5 }}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: 2,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              bgcolor: alpha(theme.palette[color].main, 0.12),
              color: `${color}.main`,
            }}
          >
            <Icon sx={{ fontSize: 28 }} />
          </Box>
          <Box sx={{ flexGrow: 1 }}>
            <Typography
              variant="h4"
              sx={{
                fontWeight: 700,
                color: active ? `${color}.main` : "text.primary",
              }}
            >
              {count}
            </Typography>
            <Typography
              variant="caption"
              sx={{
                fontWeight: 600,
                letterSpacing: 0.5,
                color: "text.secondary",
                textTransform: "uppercase",
              }}
            >
              {label}
            </Typography>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}

function StatCardSkeleton() {
  return (
    <Card sx={{ borderRadius: 3 }}>
      <CardContent sx={{ p: 2.5 }}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <Skeleton variant="rounded" width={48} height={48} />
          <Box sx={{ flexGrow: 1 }}>
            <Skeleton variant="text" width={60} height={40} />
            <Skeleton variant="text" width={80} height={16} />
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}

function CalendarListSkeleton() {
  return (
    <Paper elevation={0} sx={{ p: 2, borderRadius: 3, border: 1, borderColor: "divider" }}>
      <Stack spacing={2}>
        {[1, 2, 3, 4, 5].map((i) => (
          <Box key={i}>
            <Stack spacing={0.5}>
              <Skeleton variant="text" width="80%" height={28} />
              <Skeleton variant="text" width="60%" height={20} />
              <Stack direction="row" spacing={1} mt={0.5}>
                <Skeleton variant="rounded" width={70} height={24} />
                <Skeleton variant="rounded" width={90} height={24} />
              </Stack>
            </Stack>
          </Box>
        ))}
      </Stack>
    </Paper>
  );
}

function CalendarDetailSkeleton() {
  return (
    <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: 1, borderColor: "divider" }}>
      <Stack spacing={3}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Skeleton variant="text" width={220} height={36} />
          <Stack direction="row" spacing={1}>
            <Skeleton variant="rounded" width={90} height={40} />
            <Skeleton variant="rounded" width={90} height={40} />
          </Stack>
        </Stack>
        
        <Skeleton variant="rounded" width={110} height={28} />
        
        <Box>
          <Skeleton variant="text" width={140} height={24} sx={{ mb: 1 }} />
          <Skeleton variant="text" width="100%" height={18} />
          <Skeleton variant="text" width="100%" height={18} />
          <Skeleton variant="text" width="85%" height={18} />
        </Box>

        <Box>
          <Skeleton variant="text" width={160} height={24} sx={{ mb: 1 }} />
          <Stack spacing={1}>
            {[1, 2, 3, 4, 5].map((i) => (
              <Box key={i} sx={{ display: "flex", justifyContent: "space-between" }}>
                <Skeleton variant="text" width={110} height={22} />
                <Skeleton variant="text" width={160} height={22} />
              </Box>
            ))}
          </Stack>
        </Box>
      </Stack>
    </Paper>
  );
}

export default function BusinessCalendarsPage() {
  const theme = useTheme();
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
  const [countsLoading, setCountsLoading] = useState(true);
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
    setCountsLoading(true);
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
        setCountsLoading(false);
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
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default", pb: 4 }}>
      <Container maxWidth="2xl" sx={{ pt: 3 }}>
        <Stack spacing={3}>
          {/* Header */}
          <Box
            sx={{
              background: `linear-gradient(135deg, ${alpha(
                theme.palette.primary.main,
                0.1
              )} 0%, ${alpha(theme.palette.primary.main, 0.05)} 100%)`,
              borderRadius: 3,
              p: 3,
              border: 1,
              borderColor: "divider",
            }}
          >
            <Stack
              direction={{ xs: "column", sm: "row" }}
              alignItems={{ xs: "stretch", sm: "center" }}
              justifyContent="space-between"
              spacing={2}
            >
              <Stack direction="row" alignItems="center" spacing={2}>
                <Box
                  sx={{
                    width: 56,
                    height: 56,
                    borderRadius: 2,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    bgcolor: "primary.main",
                    color: "white",
                    boxShadow: 3,
                  }}
                >
                  <CalendarMonthIcon sx={{ fontSize: 32 }} />
                </Box>
                <Box>
                  <Typography variant="h4" fontWeight={700} gutterBottom>
                    Business Calendars
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Manage working hours, holidays, and business schedules
                  </Typography>
                </Box>
              </Stack>
              <Button
                startIcon={<AddIcon />}
                variant="contained"
                size="large"
                onClick={() => setCreateOpen(true)}
                disabled={loading}
                sx={{
                  borderRadius: 2,
                  px: 3,
                  py: 1.5,
                  boxShadow: 3,
                  fontWeight: 600,
                  "&:hover": {
                    boxShadow: 6,
                    transform: "translateY(-2px)",
                  },
                  transition: "all 0.3s",
                }}
              >
                New Calendar
              </Button>
            </Stack>
          </Box>

          {/* Stats Cards */}
          <Grid container spacing={2}>
            {countsLoading ? (
              <>
                <Grid item xs={12} sm={4}>
                  <StatCardSkeleton />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <StatCardSkeleton />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <StatCardSkeleton />
                </Grid>
              </>
            ) : (
              <>
                <Grid item xs={12} sm={4}>
                  <StatCard
                    label="Total Calendars"
                    count={counts.total ?? 0}
                    active={filters.active === undefined}
                    onClick={() => handleFilterChange(undefined)}
                    icon={TrendingUpIcon}
                    color="primary"
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <StatCard
                    label="Active"
                    count={counts.active ?? 0}
                    active={filters.active === true}
                    onClick={() => handleFilterChange(true)}
                    icon={CheckCircleIcon}
                    color="success"
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <StatCard
                    label="Inactive"
                    count={counts.inactive ?? 0}
                    active={filters.active === false}
                    onClick={() => handleFilterChange(false)}
                    icon={CancelIcon}
                    color="error"
                  />
                </Grid>
              </>
            )}
          </Grid>

          {/* Filters */}
          <Paper
            elevation={0}
            sx={{
              p: 2.5,
              borderRadius: 3,
              border: 1,
              borderColor: "divider",
              bgcolor: "background.paper",
            }}
          >
            <CalendarFilters
              orgId={orgId}
              state={filters}
              onChange={(st) => setFilters((f) => ({ ...f, ...st }))}
              disabled={loading}
            />
          </Paper>

          {/* Error Display */}
          {error && (
            <Paper
              elevation={0}
              sx={{
                p: 2.5,
                borderRadius: 3,
                bgcolor: alpha(theme.palette.error.main, 0.1),
                border: 1,
                borderColor: "error.main",
              }}
            >
              <Typography color="error" fontWeight={500}>
                {error}
              </Typography>
            </Paper>
          )}

          {/* Main Content */}
          <Grid container spacing={3}>
            <Grid item xs={12} lg={5}>
              {loading ? (
                <CalendarListSkeleton />
              ) : (
                <CalendarList
                  calendars={calendars}
                  loading={loading}
                  onSelect={(calendar) => setSelectedCalendar(calendar)}
                  selectedId={selectedCalendar?.calendar_id}
                />
              )}
            </Grid>
            <Grid item xs={12} lg={7}>
              {loading && !selectedCalendar ? (
                <CalendarDetailSkeleton />
              ) : selectedCalendar ? (
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
                    setSelectedCalendar(null);
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
                <Paper
                  elevation={0}
                  sx={{
                    p: 6,
                    borderRadius: 3,
                    border: 1,
                    borderColor: "divider",
                    textAlign: "center",
                    bgcolor: "background.paper",
                  }}
                >
                  <Box
                    sx={{
                      width: 80,
                      height: 80,
                      borderRadius: "50%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      bgcolor: alpha(theme.palette.primary.main, 0.1),
                      margin: "0 auto 16px",
                    }}
                  >
                    <CalendarMonthIcon
                      sx={{ fontSize: 48, color: "primary.main" }}
                    />
                  </Box>
                  <Typography variant="h6" fontWeight={600} gutterBottom>
                    Select a Calendar
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Choose a calendar from the list to view and edit its details
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
    </Box>
  );
}