// components/calendars/CalendarList.jsx
"use client";
import { 
  Box, 
  Paper, 
  Stack, 
  Typography, 
  Chip, 
  Skeleton,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListItemSecondaryAction,
  Divider
} from "@mui/material";
import { 
  Schedule as ScheduleIcon,
  AccessTime as TimeIcon,
  CheckCircle as ActiveIcon,
  Cancel as InactiveIcon 
} from "@mui/icons-material";

function CalendarListItem({ calendar, selected, onClick }) {
  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString();
  };

  const getHoursCount = () => {
    return calendar.hours?.length || 0;
  };

  const getHolidaysCount = () => {
    return calendar.holidays?.length || 0;
  };

  return (
    <>
      <ListItem disablePadding>
        <ListItemButton
          selected={selected}
          onClick={() => onClick(calendar)}
          sx={{ py: 1.5 }}
        >
          <ListItemText
            primary={
              <Stack direction="row" alignItems="center" spacing={1}>
                <Typography variant="subtitle2" noWrap>
                  {calendar.name}
                </Typography>
                <Chip
                  icon={calendar.active ? <ActiveIcon /> : <InactiveIcon />}
                  label={calendar.active ? "Active" : "Inactive"}
                  size="small"
                  color={calendar.active ? "success" : "default"}
                  variant="outlined"
                />
              </Stack>
            }
            secondary={
              <Stack spacing={0.5} sx={{ mt: 0.5 }}>
                <Typography variant="caption" color="text.secondary">
                  <TimeIcon sx={{ fontSize: 12, mr: 0.5 }} />
                  {calendar.timezone}
                </Typography>
                <Stack direction="row" spacing={1}>
                  <Typography variant="caption" color="text.secondary">
                    {getHoursCount()} business hours
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {getHolidaysCount()} holidays
                  </Typography>
                </Stack>
                <Typography variant="caption" color="text.secondary">
                  Created: {formatDate(calendar.created_at)}
                </Typography>
              </Stack>
            }
          />
        </ListItemButton>
      </ListItem>
      <Divider />
    </>
  );
}

function LoadingSkeleton() {
  return (
    <Stack spacing={1} sx={{ p: 2 }}>
      {[...Array(5)].map((_, i) => (
        <Box key={i}>
          <Skeleton variant="text" width="60%" height={24} />
          <Skeleton variant="text" width="40%" height={16} />
          <Skeleton variant="text" width="80%" height={16} />
        </Box>
      ))}
    </Stack>
  );
}

export default function CalendarList({ calendars, loading, onSelect, selectedId }) {
  // Filter calendars based on search and filters
  const filteredCalendars = calendars || [];

  if (loading) {
    return (
      <Paper variant="outlined" sx={{ borderRadius: 2, height: "fit-content" }}>
        <LoadingSkeleton />
      </Paper>
    );
  }

  if (filteredCalendars.length === 0) {
    return (
      <Paper variant="outlined" sx={{ p: 3, borderRadius: 2, textAlign: "center" }}>
        <ScheduleIcon sx={{ fontSize: 48, color: "text.secondary", mb: 1 }} />
        <Typography variant="h6" color="text.secondary" gutterBottom>
          No calendars found
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Create your first business calendar to get started.
        </Typography>
      </Paper>
    );
  }

  return (
    <Paper variant="outlined" sx={{ borderRadius: 2, height: "fit-content" }}>
      <Box sx={{ p: 2, borderBottom: 1, borderColor: "divider" }}>
        <Typography variant="h6">
          Calendars ({filteredCalendars.length})
        </Typography>
      </Box>
      
      <List sx={{ p: 0, maxHeight: 600, overflow: "auto" }}>
        {filteredCalendars.map((calendar) => (
          <CalendarListItem
            key={calendar.calendar_id}
            calendar={calendar}
            selected={calendar.calendar_id === selectedId}
            onClick={onSelect}
          />
        ))}
      </List>
    </Paper>
  );
}