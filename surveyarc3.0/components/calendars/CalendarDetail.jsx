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
  Divider,
  Alert,
  Card,
  CardContent,
} from "@mui/material";
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Schedule as ScheduleIcon,
  Event as EventIcon,
  AccessTime as AccessTimeIcon,
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
  6: "Sunday"
};

function formatTime(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

function BusinessHoursDisplay({ hours }) {
  if (!hours || hours.length === 0) {
    return (
      <Alert severity="info" sx={{ borderRadius: 2 }}>
        No business hours configured. Click "Edit Hours" to set up your schedule.
      </Alert>
    );
  }

  // Group hours by weekday
  const groupedHours = hours.reduce((acc, hour) => {
    if (!acc[hour.weekday]) acc[hour.weekday] = [];
    acc[hour.weekday].push(hour);
    return acc;
  }, {});

  // Sort hours within each day
  Object.keys(groupedHours).forEach(weekday => {
    groupedHours[weekday].sort((a, b) => a.start_min - b.start_min);
  });

  return (
    <Stack spacing={1}>
      {Object.entries(groupedHours)
        .sort(([a], [b]) => parseInt(a) - parseInt(b))
        .map(([weekday, dayHours]) => (
          <Box key={weekday} sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <Typography variant="body2" sx={{ minWidth: 80, fontWeight: 500 }}>
              {WEEKDAY_NAMES[weekday]}
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap">
              {dayHours.map((hour, index) => (
                <Chip
                  key={index}
                  label={`${formatTime(hour.start_min)} - ${formatTime(hour.end_min)}`}
                  size="small"
                  variant="outlined"
                  color="primary"
                />
              ))}
            </Stack>
          </Box>
        ))}
    </Stack>
  );
}

function HolidaysDisplay({ holidays }) {
  if (!holidays || holidays.length === 0) {
    return (
      <Alert severity="info" sx={{ borderRadius: 2 }}>
        No holidays configured.
      </Alert>
    );
  }

  const sortedHolidays = [...holidays].sort((a, b) => a.date_iso.localeCompare(b.date_iso));
  const currentYear = new Date().getFullYear();
  const thisYear = sortedHolidays.filter(h => h.date_iso.startsWith(currentYear.toString()));
  const otherYears = sortedHolidays.filter(h => !h.date_iso.startsWith(currentYear.toString()));

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

  return (
    <Stack spacing={2}>
      {thisYear.length > 0 && (
        <Box>
          <Typography variant="subtitle2" color="primary" gutterBottom>
            {currentYear} Holidays ({thisYear.length})
          </Typography>
          <Stack spacing={1}>
            {thisYear.map((holiday) => {
              const daysUntil = getDaysUntil(holiday.date_iso);
              return (
                <Box key={holiday.id} sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                  <Typography variant="body2" sx={{ minWidth: 140, fontWeight: 500 }}>
                    {formatDate(holiday.date_iso)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ flexGrow: 1 }}>
                    {holiday.name || "Unnamed Holiday"}
                  </Typography>
                  {daysUntil && (
                    <Chip
                      label={daysUntil}
                      size="small"
                      color={daysUntil === "Today" ? "error" : daysUntil === "Tomorrow" ? "warning" : "primary"}
                      variant="outlined"
                    />
                  )}
                </Box>
              );
            })}
          </Stack>
        </Box>
      )}

      {otherYears.length > 0 && (
        <Box>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            Other Years ({otherYears.length})
          </Typography>
          <Stack spacing={1}>
            {otherYears.map((holiday) => (
              <Box key={holiday.id} sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                <Typography variant="body2" sx={{ minWidth: 140, fontWeight: 500 }}>
                  {formatDate(holiday.date_iso)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {holiday.name || "Unnamed Holiday"}
                </Typography>
              </Box>
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
  onDelete 
}) {
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
      
      // Refresh the calendar data
      if (onUpdate) {
        // This will trigger a refresh of the selected calendar in the provider
        const updatedCalendar = await onUpdate(calendar.calendar_id, {});
        // The provider's setHours method already handles refreshing the selected calendar
      }
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
      
      // Refresh the calendar data
      if (onUpdate) {
        // This will trigger a refresh of the selected calendar in the provider
        const updatedCalendar = await onUpdate(calendar.calendar_id, {});
        // The provider's setHolidays method already handles refreshing the selected calendar
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (window.confirm(`Are you sure you want to delete "${calendar.name}"? This action cannot be undone.`)) {
      try {
        await onDelete(calendar.calendar_id);
      } catch (err) {
        setError(err.message);
      }
    }
  };

  const totalHours = calendar.hours?.reduce((total, hour) => {
    return total + (hour.end_min - hour.start_min) / 60;
  }, 0) || 0;

  return (
    <Stack spacing={2}>
      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ borderRadius: 2 }}>
          {error}
        </Alert>
      )}

      {/* Header */}
      <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
        <Stack direction="row" alignItems="flex-start" justifyContent="space-between">
          <Box>
            <Stack direction="row" alignItems="center" spacing={1} mb={1}>
              <Typography variant="h6">{calendar.name}</Typography>
              <Chip 
                label={calendar.active ? "Active" : "Inactive"} 
                color={calendar.active ? "success" : "default"}
                size="small"
              />
            </Stack>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              ID: {calendar.calendar_id}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Timezone: {calendar.timezone}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            <IconButton size="small" onClick={() => onUpdate(calendar.calendar_id, { active: !calendar.active })}>
              <EditIcon />
            </IconButton>
            <IconButton size="small" color="error" onClick={handleDelete}>
              <DeleteIcon />
            </IconButton>
          </Stack>
        </Stack>
      </Paper>

      {/* Stats */}
      <Grid container spacing={2}>
        <Grid item xs={6} sm={4}>
          <Card variant="outlined" sx={{ borderRadius: 2 }}>
            <CardContent sx={{ p: 1.5, "&:last-child": { pb: 1.5 } }}>
              <Stack direction="row" alignItems="center" spacing={1}>
                <AccessTimeIcon color="primary" fontSize="small" />
                <Box>
                  <Typography variant="h6">{Math.round(totalHours * 10) / 10}h</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Weekly Hours
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={4}>
          <Card variant="outlined" sx={{ borderRadius: 2 }}>
            <CardContent sx={{ p: 1.5, "&:last-child": { pb: 1.5 } }}>
              <Stack direction="row" alignItems="center" spacing={1}>
                <ScheduleIcon color="primary" fontSize="small" />
                <Box>
                  <Typography variant="h6">{calendar.hours?.length || 0}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Time Slots
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={4}>
          <Card variant="outlined" sx={{ borderRadius: 2 }}>
            <CardContent sx={{ p: 1.5, "&:last-child": { pb: 1.5 } }}>
              <Stack direction="row" alignItems="center" spacing={1}>
                <EventIcon color="primary" fontSize="small" />
                <Box>
                  <Typography variant="h6">{calendar.holidays?.length || 0}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Holidays
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Business Hours */}
      <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2}>
          <Typography variant="h6">Business Hours</Typography>
          <Button
            startIcon={<ScheduleIcon />}
            variant="outlined"
            size="small"
            onClick={() => setHoursFormOpen(true)}
            disabled={loading}
          >
            Edit Hours
          </Button>
        </Stack>
        <BusinessHoursDisplay hours={calendar.hours} />
      </Paper>

      {/* Holidays */}
      <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2}>
          <Typography variant="h6">Holidays</Typography>
          <Button
            startIcon={<EventIcon />}
            variant="outlined"
            size="small"
            onClick={() => setHolidaysFormOpen(true)}
            disabled={loading}
          >
            Edit Holidays
          </Button>
        </Stack>
        <HolidaysDisplay holidays={calendar.holidays} />
      </Paper>

      {/* Metadata */}
      {calendar.meta && Object.keys(calendar.meta).length > 0 && (
        <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
          <Typography variant="h6" gutterBottom>Metadata</Typography>
          <pre style={{ fontSize: "0.875rem", margin: 0, color: "#666" }}>
            {JSON.stringify(calendar.meta, null, 2)}
          </pre>
        </Paper>
      )}

      {/* Business Hours Form */}
      <BusinessHoursForm
        open={hoursFormOpen}
        onClose={() => setHoursFormOpen(false)}
        calendar={calendar}
        onSubmit={handleSetHours}
      />

      {/* Business Holidays Form */}
      <BusinessHolidaysForm
        open={holidaysFormOpen}
        onClose={() => setHolidaysFormOpen(false)}
        calendar={calendar}
        onSubmit={handleSetHolidays}
      />
    </Stack>
  );
}