// components/calendars/CalendarList.jsx
"use client";
import { 
  Box, 
  Paper, 
  Stack, 
  Typography, 
  Chip,
  Skeleton,
  alpha,
  useTheme
} from "@mui/material";
import { 
  Schedule as ScheduleIcon,
  AccessTime,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Event,
  Public as TimezoneIcon
} from "@mui/icons-material";

function CalendarListItem({ calendar, selected, onClick }) {
  const theme = useTheme();
  
  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getHoursCount = () => calendar.hours?.length || 0;
  const getHolidaysCount = () => calendar.holidays?.length || 0;

  return (
    <Box
      onClick={() => onClick(calendar)}
      sx={{
        position: "relative",
        mb: 1.5,
        cursor: "pointer",
        transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        "&:hover": {
          transform: "translateY(-2px)",
          "& .calendar-card": {
            boxShadow: selected ? 8 : 4,
            borderColor: "primary.main",
          },
        },
      }}
    >
      <Paper
        className="calendar-card"
        elevation={selected ? 4 : 0}
        sx={{
          p: 2,
          borderRadius: 2.5,
          border: 2,
          borderColor: selected ? "primary.main" : "divider",
          bgcolor: selected 
            ? alpha(theme.palette.primary.main, 0.08) 
            : "background.paper",
          transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
          overflow: "hidden",
          position: "relative",
          "&::before": selected ? {
            content: '""',
            position: "absolute",
            top: 0,
            left: 0,
            width: 4,
            height: "100%",
            bgcolor: "primary.main",
          } : {},
        }}
      >
        <Stack spacing={2}>
          {/* Header Row */}
          <Stack direction="row" alignItems="flex-start" spacing={1.5}>
            {/* Icon */}
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: 2,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                background: calendar.active
                  ? `linear-gradient(135deg, ${alpha(theme.palette.success.main, 0.2)} 0%, ${alpha(theme.palette.success.main, 0.1)} 100%)`
                  : `linear-gradient(135deg, ${alpha(theme.palette.grey[500], 0.2)} 0%, ${alpha(theme.palette.grey[500], 0.1)} 100%)`,
                border: 1,
                borderColor: calendar.active 
                  ? alpha(theme.palette.success.main, 0.3)
                  : alpha(theme.palette.grey[500], 0.3),
                color: calendar.active ? "success.main" : "text.secondary",
              }}
            >
              <ScheduleIcon sx={{ fontSize: 28 }} />
            </Box>

            {/* Title and Timezone */}
            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
              <Typography 
                variant="subtitle1" 
                fontWeight={700}
                sx={{ 
                  mb: 0.5,
                  color: selected ? "primary.main" : "text.primary",
                  lineHeight: 1.3,
                }}
              >
                {calendar.name}
              </Typography>
              <Stack direction="row" spacing={0.5} alignItems="center">
                <TimezoneIcon sx={{ fontSize: 14, color: "text.secondary" }} />
                <Typography variant="caption" color="text.secondary" fontWeight={500}>
                  {calendar.timezone}
                </Typography>
              </Stack>
            </Box>

            {/* Status Badge */}
            <Chip
              icon={calendar.active ? <CheckCircleIcon /> : <CancelIcon />}
              label={calendar.active ? "Active" : "Inactive"}
              size="small"
              color={calendar.active ? "success" : "default"}
              sx={{
                fontWeight: 700,
                fontSize: "0.7rem",
                height: 26,
                borderRadius: 2,
                "& .MuiChip-icon": {
                  fontSize: 16,
                },
              }}
            />
          </Stack>

          {/* Divider */}
          <Box sx={{ height: 1, bgcolor: "divider" }} />

          {/* Stats Row */}
          <Stack direction="row" spacing={2} alignItems="center">
            {/* Hours Count */}
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 0.75,
                px: 1.5,
                py: 0.75,
                borderRadius: 1.5,
                bgcolor: alpha(theme.palette.primary.main, 0.08),
                border: 1,
                borderColor: alpha(theme.palette.primary.main, 0.2),
              }}
            >
              <AccessTime sx={{ fontSize: 16, color: "primary.main" }} />
              <Typography variant="caption" fontWeight={700} color="primary.main">
                {getHoursCount()}
              </Typography>
              <Typography variant="caption" color="text.secondary" fontWeight={500}>
                slots
              </Typography>
            </Box>

            {/* Holidays Count */}
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 0.75,
                px: 1.5,
                py: 0.75,
                borderRadius: 1.5,
                bgcolor: alpha(theme.palette.warning.main, 0.08),
                border: 1,
                borderColor: alpha(theme.palette.warning.main, 0.2),
              }}
            >
              <Event sx={{ fontSize: 16, color: "warning.main" }} />
              <Typography variant="caption" fontWeight={700} color="warning.main">
                {getHolidaysCount()}
              </Typography>
              <Typography variant="caption" color="text.secondary" fontWeight={500}>
                holidays
              </Typography>
            </Box>

            {/* Created Date */}
            <Typography 
              variant="caption" 
              color="text.secondary" 
              sx={{ 
                ml: "auto !important",
                fontWeight: 500,
              }}
            >
              {formatDate(calendar.created_at)}
            </Typography>
          </Stack>
        </Stack>

        {/* Selected Indicator */}
        {selected && (
          <Box
            sx={{
              position: "absolute",
              top: 8,
              right: 8,
              width: 8,
              height: 8,
              borderRadius: "50%",
              bgcolor: "primary.main",
              boxShadow: `0 0 0 3px ${alpha(theme.palette.primary.main, 0.2)}`,
            }}
          />
        )}
      </Paper>
    </Box>
  );
}

export default function CalendarList({ calendars, loading, onSelect, selectedId }) {
  const theme = useTheme();
  const filteredCalendars = calendars || [];

  if (filteredCalendars.length === 0 && !loading) {
    return (
      <Paper
        elevation={0}
        sx={{
          p: 6,
          borderRadius: 3,
          textAlign: "center",
          border: 1,
          borderColor: "divider",
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
          <ScheduleIcon sx={{ fontSize: 48, color: "primary.main" }} />
        </Box>
        <Typography variant="h6" fontWeight={600} gutterBottom>
          No calendars found
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Create your first business calendar to get started
        </Typography>
      </Paper>
    );
  }

  return (
    <Paper
      elevation={0}
      sx={{
        borderRadius: 3,
        border: 1,
        borderColor: "divider",
        bgcolor: "background.paper",
        height: "fit-content",
        maxHeight: "calc(100vh - 300px)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header */}
      <Box
        sx={{
          p: 2.5,
          borderBottom: 1,
          borderColor: "divider",
          bgcolor: alpha(theme.palette.primary.main, 0.02),
        }}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Typography variant="h6" fontWeight={700}>
            Calendars
          </Typography>
          <Chip
            label={filteredCalendars.length}
            size="small"
            color="primary"
            sx={{ fontWeight: 700, borderRadius: 1.5 }}
          />
        </Stack>
      </Box>

      {/* List */}
      <Box
        sx={{
          p: 2,
          overflow: "auto",
          flexGrow: 1,
        }}
      >
        {filteredCalendars.map((calendar) => (
          <CalendarListItem
            key={calendar.calendar_id}
            calendar={calendar}
            selected={calendar.calendar_id === selectedId}
            onClick={onSelect}
          />
        ))}
      </Box>
    </Paper>
  );
}