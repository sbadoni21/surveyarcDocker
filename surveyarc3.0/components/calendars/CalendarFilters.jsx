// components/calendars/CalendarFilters.jsx
"use client";
import { 
  Box, 
  TextField, 
  FormControl, 
  InputLabel, 
  Select, 
  MenuItem, 
  Stack,
  Chip
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import { InputAdornment } from "@mui/material";

const COMMON_TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago", 
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Asia/Kolkata",
  "Australia/Sydney",
];

export default function CalendarFilters({ orgId, state, onChange }) {
  const handleSearchChange = (e) => {
    onChange({ q: e.target.value });
  };

  const handleTimezoneChange = (e) => {
    onChange({ timezone: e.target.value });
  };

  const clearFilters = () => {
    onChange({ 
      q: "", 
      timezone: "",
      active: undefined 
    });
  };

  const hasActiveFilters = state.q || state.timezone || state.active !== undefined;

  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems="center">
        <TextField
          placeholder="Search calendars..."
          size="small"
          value={state.q || ""}
          onChange={handleSearchChange}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
          sx={{ minWidth: 250 }}
        />

        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>Timezone</InputLabel>
          <Select
            value={state.timezone || ""}
            label="Timezone"
            onChange={handleTimezoneChange}
          >
            <MenuItem value="">All Timezones</MenuItem>
            {COMMON_TIMEZONES.map((tz) => (
              <MenuItem key={tz} value={tz}>
                {tz}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {hasActiveFilters && (
          <Chip
            label="Clear Filters"
            variant="outlined"
            size="small"
            onClick={clearFilters}
            onDelete={clearFilters}
          />
        )}
      </Stack>

      {hasActiveFilters && (
        <Stack direction="row" spacing={1} flexWrap="wrap">
          {state.q && (
            <Chip
              label={`Search: "${state.q}"`}
              size="small"
              onDelete={() => onChange({ q: "" })}
            />
          )}
          {state.timezone && (
            <Chip
              label={`Timezone: ${state.timezone}`}
              size="small"
              onDelete={() => onChange({ timezone: "" })}
            />
          )}
          {state.active === true && (
            <Chip
              label="Active Only"
              size="small"
              onDelete={() => onChange({ active: undefined })}
            />
          )}
          {state.active === false && (
            <Chip
              label="Inactive Only"
              size="small"
              onDelete={() => onChange({ active: undefined })}
            />
          )}
        </Stack>
      )}
    </Stack>
  );
}