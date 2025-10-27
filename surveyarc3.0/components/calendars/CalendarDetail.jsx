// components/calendars/CalendarDetail.jsx
"use client";
import { useState } from "react";
import {
  Paper,
  Typography,
  Stack,
  Chip,
  Button,
  IconButton,
  Grid,
  Box,
  Alert,
  Card,
  CardContent,
  alpha,
  useTheme,
  Tooltip,
} from "@mui/material";
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Schedule as ScheduleIcon,
  Event as EventIcon,
  AccessTime as AccessTimeIcon,
  Public as PublicIcon,
  CalendarMonth as CalendarIcon,
  ToggleOn as ToggleOnIcon,
  ToggleOff as ToggleOffIcon,
} from "@mui/icons-material";
import BusinessHoursForm from "./BusinessHoursForm";
import BusinessHolidaysForm from "./BusinessHolidaysForm";
import { useBusinessCalendars } from "@/providers/BusinessCalendarsProvider";

const WEEKDAY_NAMES = {
  0: "Monday",
  1: "Tuesday",
  2: "Wednesday",
  3: "Thursday",
  4: "Friday",
  5: "Saturday",
  6: "Sunday",
};

function formatTime(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
}

function BusinessHoursDisplay({ hours }) {
  const theme = useTheme();

  if (!hours || hours.length === 0) {
    return (
      <Alert
        severity="info"
        icon={<ScheduleIcon />}
        sx={{
          borderRadius: 2,
          border: 1,
          borderColor: alpha(theme.palette.info.main, 0.3),
        }}
      >
        No business hours configured. Click "Edit Hours" to set up your schedule.
      </Alert>
    );
  }

  const groupedHours = hours.reduce((acc, hour) => {
    if (!acc[hour.weekday]) acc[hour.weekday] = [];
    acc[hour.weekday].push(hour);
    return acc;
  }, {});

  Object.keys(groupedHours).forEach((weekday) => {
    groupedHours[weekday].sort((a, b) => a.start_min - b.start_min);
  });

  return (
    <Stack spacing={1.5}>
      {Object.entries(groupedHours)
        .sort(([a], [b]) => parseInt(a) - parseInt(b))
        .map(([weekday, dayHours]) => (
          <Box
            key={weekday}
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 2,
              p: 2,
              borderRadius: 2,
              bgcolor: alpha(theme.palette.primary.main, 0.03),
              border: 1,
              borderColor: "divider",
            }}
          >
            <Typography
              variant="body2"
              sx={{
                minWidth: 100,
                fontWeight: 700,
                color: "text.primary",
              }}
            >
              {WEEKDAY_NAMES[weekday]}
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap">
              {dayHours.map((hour, index) => (
                <Chip
                  key={index}
                  icon={<AccessTimeIcon />}
                  label={`${formatTime(hour.start_min)} - ${formatTime(hour.end_min)}`}
                  size="medium"
                  sx={{
                    fontWeight: 600,
                    bgcolor: alpha(theme.palette.primary.main, 0.12),
                    color: "primary.main",
                    borderRadius: 2,
                    "& .MuiChip-icon": {
                      color: "primary.main",
                    },
                  }}
                />
              ))}
            </Stack>
          </Box>
        ))}
    </Stack>
  );
}

function HolidaysDisplay({ holidays }) {
  const theme = useTheme();

  if (!holidays || holidays.length === 0) {
    return (
      <Alert
        severity="info"
        icon={<EventIcon />}
        sx={{
          borderRadius: 2,
          border: 1,
          borderColor: alpha(theme.palette.info.main, 0.3),
        }}
      >
        No holidays configured. Click "Edit Holidays" to add holidays.
      </Alert>
    );
  }

  const sortedHolidays = [...holidays].sort((a, b) =>
    a.date_iso.localeCompare(b.date_iso)
  );
  const currentYear = new Date().getFullYear();
  const thisYear = sortedHolidays.filter((h) =>
    h.date_iso.startsWith(currentYear.toString())
  );
  const otherYears = sortedHolidays.filter(
    (h) => !h.date_iso.startsWith(currentYear.toString())
  );

  const formatDate = (dateStr) => {
    try {
      return new Date(dateStr).toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  const getDaysUntil = (dateStr) => {
    try {
      const holiday = new Date(dateStr);
      const today = new Date();
      const diffTime = holiday.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays < 0) return null;
      if (diffDays === 0) return "Today";
      if (diffDays === 1) return "Tomorrow";
      if (diffDays <= 7) return `In ${diffDays} days`;
      return null;
    } catch {
      return null;
    }
  };

  const HolidayItem = ({ holiday }) => {
    const daysUntil = getDaysUntil(holiday.date_iso);
    return (
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 2,
          p: 2,
          borderRadius: 2,
          bgcolor: daysUntil
            ? alpha(theme.palette.primary.main, 0.05)
            : alpha(theme.palette.grey[500], 0.03),
          border: 1,
          borderColor: daysUntil ? "primary.light" : "divider",
        }}
      >
        <EventIcon sx={{ color: daysUntil ? "primary.main" : "text.secondary" }} />
        <Typography
          variant="body2"
          sx={{ minWidth: 140, fontWeight: 600, color: "text.primary" }}
        >
          {formatDate(holiday.date_iso)}
        </Typography>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ flexGrow: 1 }}
        >
          {holiday.name || "Unnamed Holiday"}
        </Typography>
        {daysUntil && (
          <Chip
            label={daysUntil}
            size="small"
            color={
              daysUntil === "Today"
                ? "error"
                : daysUntil === "Tomorrow"
                ? "warning"
                : "primary"
            }
            sx={{ fontWeight: 600, borderRadius: 1.5 }}
          />
        )}
      </Box>
    );
  };

  return (
    <Stack spacing={3}>
      {thisYear.length > 0 && (
        <Box>
          <Typography
            variant="subtitle1"
            fontWeight={700}
            color="primary"
            gutterBottom
            sx={{ display: "flex", alignItems: "center", gap: 1 }}
          >
            <CalendarIcon fontSize="small" />
            {currentYear} Holidays ({thisYear.length})
          </Typography>
          <Stack spacing={1.5}>
            {thisYear.map((holiday) => (
              <HolidayItem key={holiday.id} holiday={holiday} />
            ))}
          </Stack>
        </Box>
      )}

      {otherYears.length > 0 && (
        <Box>
          <Typography
            variant="subtitle1"
            fontWeight={700}
            color="text.secondary"
            gutterBottom
            sx={{ display: "flex", alignItems: "center", gap: 1 }}
          >
            <CalendarIcon fontSize="small" />
            Other Years ({otherYears.length})
          </Typography>
          <Stack spacing={1.5}>
            {otherYears.map((holiday) => (
              <HolidayItem key={holiday.id} holiday={holiday} />
            ))}
          </Stack>
        </Box>
      )}
    </Stack>
  );
}

export default function CalendarDetail({
  calendar,
  orgId,
  currentUserId,
  onUpdate,
  onDelete,
}) {
  const theme = useTheme();
  const { setHours, setHolidays } = useBusinessCalendars();
  const [hoursFormOpen, setHoursFormOpen] = useState(false);
  const [holidaysFormOpen, setHolidaysFormOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSetHours = async (hours) => {
    try {
      setLoading(true);
      setError(null);
      await setHours(calendar.calendar_id, hours);
      setHoursFormOpen(false);
      if (onUpdate) await onUpdate(calendar.calendar_id, {});
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSetHolidays = async (holidays) => {
    try {
      setLoading(true);
      setError(null);
      await setHolidays(calendar.calendar_id, holidays);
      setHolidaysFormOpen(false);
      if (onUpdate) await onUpdate(calendar.calendar_id, {});
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async () => {
    try {
      await onUpdate(calendar.calendar_id, { active: !calendar.active });
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async () => {
    if (
      window.confirm(
        `Are you sure you want to delete "${calendar.name}"? This action cannot be undone.`
      )
    ) {
      try {
        await onDelete(calendar.calendar_id);
      } catch (err) {
        setError(err.message);
      }
    }
  };

  const totalHours =
    calendar.hours?.reduce((total, hour) => {
      return total + (hour.end_min - hour.start_min) / 60;
    }, 0) || 0;

  return (
    <Stack spacing={3}>
      {error && (
        <Alert
          severity="error"
          onClose={() => setError(null)}
          sx={{ borderRadius: 2 }}
        >
          {error}
        </Alert>
      )}

      {/* Header Card */}
      <Paper
        elevation={0}
        sx={{
          p: 3,
          borderRadius: 3,
          border: 1,
          borderColor: "divider",
          background: `linear-gradient(135deg, ${alpha(
            theme.palette.primary.main,
            0.05
          )} 0%, ${alpha(theme.palette.primary.main, 0.02)} 100%)`,
        }}
      >
        <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={2}>
          <Stack spacing={2} flexGrow={1}>
            <Stack direction="row" alignItems="center" spacing={2}>
              <Box
                sx={{
                  width: 48,
                  height: 48,
                  borderRadius: 2,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  bgcolor: "primary.main",
                  color: "white",
                }}
              >
                <ScheduleIcon />
              </Box>
              <Box>
                <Typography variant="h5" fontWeight={700} gutterBottom>
                  {calendar.name}
                </Typography>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Chip
                    label={calendar.active ? "Active" : "Inactive"}
                    color={calendar.active ? "success" : "default"}
                    size="small"
                    sx={{ fontWeight: 600, borderRadius: 1.5 }}
                  />
                  <Chip
                    icon={<PublicIcon />}
                    label={calendar.timezone}
                    size="small"
                    variant="outlined"
                    sx={{ borderRadius: 1.5 }}
                  />
                </Stack>
              </Box>
            </Stack>
          </Stack>

          <Stack direction="row" spacing={1}>
            <Tooltip title={calendar.active ? "Deactivate" : "Activate"}>
              <IconButton
                onClick={handleToggleActive}
                sx={{
                  bgcolor: alpha(theme.palette.primary.main, 0.1),
                  "&:hover": {
                    bgcolor: alpha(theme.palette.primary.main, 0.2),
                  },
                }}
              >
                {calendar.active ? <ToggleOnIcon color="success" /> : <ToggleOffIcon />}
              </IconButton>
            </Tooltip>
            <Tooltip title="Delete Calendar">
              <IconButton
                onClick={handleDelete}
                sx={{
                  bgcolor: alpha(theme.palette.error.main, 0.1),
                  "&:hover": {
                    bgcolor: alpha(theme.palette.error.main, 0.2),
                  },
                }}
              >
                <DeleteIcon color="error" />
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>
      </Paper>

      {/* Stats Cards */}
      <Grid container spacing={2}>
        <Grid item xs={12} sm={4}>
          <Card
            sx={{
              borderRadius: 3,
              border: 1,
              borderColor: "divider",
              bgcolor: alpha(theme.palette.success.main, 0.05),
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
                    bgcolor: alpha(theme.palette.success.main, 0.15),
                    color: "success.main",
                  }}
                >
                  <AccessTimeIcon />
                </Box>
                <Box>
                  <Typography variant="h5" fontWeight={700}>
                    {Math.round(totalHours * 10) / 10}h
                  </Typography>
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>
                    Weekly Hours
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card
            sx={{
              borderRadius: 3,
              border: 1,
              borderColor: "divider",
              bgcolor: alpha(theme.palette.primary.main, 0.05),
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
                    bgcolor: alpha(theme.palette.primary.main, 0.15),
                    color: "primary.main",
                  }}
                >
                  <ScheduleIcon />
                </Box>
                <Box>
                  <Typography variant="h5" fontWeight={700}>
                    {calendar.hours?.length || 0}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>
                    Time Slots
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card
            sx={{
              borderRadius: 3,
              border: 1,
              borderColor: "divider",
              bgcolor: alpha(theme.palette.warning.main, 0.05),
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
                    bgcolor: alpha(theme.palette.warning.main, 0.15),
                    color: "warning.main",
                  }}
                >
                  <EventIcon />
                </Box>
                <Box>
                  <Typography variant="h5" fontWeight={700}>
                    {calendar.holidays?.length || 0}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>
                    Holidays
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

  <div className="flex">    {/* Business Hours Section */}
      <Paper
        elevation={0}
        sx={{
          p: 3,
          borderRadius: 3,
          border: 1,
          borderColor: "divider",
        }}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between" mb={3}>
          <Typography variant="h6" fontWeight={700}>
            Business Hours
          </Typography>
          <Button
            startIcon={<ScheduleIcon />}
            variant="contained"
            onClick={() => setHoursFormOpen(true)}
            disabled={loading}
            sx={{
              borderRadius: 2,
              fontWeight: 600,
              boxShadow: 2,
              "&:hover": {
                boxShadow: 4,
              },
            }}
          >
            Edit
          </Button>
        </Stack>
        <BusinessHoursDisplay hours={calendar.hours} />
      </Paper>

      {/* Holidays Section */}
      <Paper
        elevation={0}
        sx={{
          p: 3,
          borderRadius: 3,
          border: 1,
          borderColor: "divider",
        }}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between" mb={3}>
          <Typography variant="h6" fontWeight={700}>
            Holidays
          </Typography>
          <Button
            startIcon={<EventIcon />}
            variant="contained"
            onClick={() => setHolidaysFormOpen(true)}
            disabled={loading}
            sx={{
              borderRadius: 2,
              fontWeight: 600,
              boxShadow: 2,
              "&:hover": {
                boxShadow: 4,
              },
            }}
          >
            Edit
          </Button>
        </Stack>
        <HolidaysDisplay holidays={calendar.holidays} />
      </Paper></div>

      {/* Forms */}
      <BusinessHoursForm
        open={hoursFormOpen}
        onClose={() => setHoursFormOpen(false)}
        calendar={calendar}
        onSubmit={handleSetHours}
      />

      <BusinessHolidaysForm
        open={holidaysFormOpen}
        onClose={() => setHolidaysFormOpen(false)}
        calendar={calendar}
        onSubmit={handleSetHolidays}
      />
    </Stack>
  );
}