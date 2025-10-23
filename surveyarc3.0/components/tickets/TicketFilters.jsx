"use client";
import { useEffect, useState, useMemo } from "react";
import {
  Box,
  Stack,
  Tab,
  Tabs,
  TextField,
  IconButton,
  ToggleButton,
  ToggleButtonGroup
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import { alpha } from "@mui/material/styles";
import AssigneeSelect from "./AssigneeSelect";
import GroupSelect from "./GroupSelect";

const STATUS_TABS = [
  { key: "", label: "All" },
  { key: "new", label: "New" },
  { key: "open", label: "Open" },
  { key: "pending", label: "Pending" },
  { key: "on_hold", label: "On Hold" },
  { key: "resolved", label: "Resolved" },
  { key: "closed", label: "Closed" },
  { key: "canceled", label: "Canceled" },
];

export default function TicketFilters({ orgId, state, onChange, showAssignee = true, currentUserId }) {
  const [q, setQ] = useState(state.q || "");
  const [mode, setMode] = useState(state.mode || "all"); // "all" | "mine" | "group" | "collab"

  useEffect(() => { setQ(state.q || ""); }, [state.q]);
  useEffect(() => { if (state.mode && state.mode !== mode) setMode(state.mode); /* eslint-disable-next-line */ }, [state.mode]);

  // theme-aware styles for Tabs + ToggleButtons
  const tabsSx = useMemo(() => ({
    minHeight: 40,
    "& .MuiTab-root": {
      minHeight: 40,
      textTransform: "none",
      fontWeight: 600,
      color: "text.secondary",
    },
    "& .MuiTab-root.Mui-selected": {
      color: "text.primary",
    },
    "& .MuiTabs-indicator": {
      height: 3,
      borderRadius: 3,
      backgroundColor: "primary.main",
    },
  }), []);

  const tbgSx = (theme) => ({
    "& .MuiToggleButton-root": {
      textTransform: "none",
      fontWeight: 600,
      borderColor: "divider",
      color: "text.secondary",
      bgcolor: "background.paper",
      "&:hover": {
        backgroundColor: alpha(theme.palette.primary.main, theme.palette.action.hoverOpacity),
      },
    },
    "& .MuiToggleButton-root.Mui-selected": {
      color: theme.palette.primary.contrastText,
      backgroundColor: theme.palette.primary.main,
      borderColor: alpha(theme.palette.primary.main, 0.6),
      "&:hover": {
        backgroundColor: alpha(theme.palette.primary.main, 0.9),
      },
    },
  });

  return (
    <Stack spacing={1}>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{
          px: { xs: 0, sm: 0 },
          bgcolor: "transparent",
        }}
      >
        <Tabs
          value={state.status ?? ""}
          onChange={(_, val) => onChange({ ...state, status: val || undefined })}
          variant="scrollable"
          scrollButtons="auto"
          sx={tabsSx}
        >
          {STATUS_TABS.map((t) => <Tab key={t.key} value={t.key} label={t.label} />)}
        </Tabs>

        <ToggleButtonGroup
          value={mode}
          exclusive
          color="primary"
          onChange={(_, val) => {
            if (!val) return;
            setMode(val);
            const patch = { ...state, mode: val };
            if (val === "mine") {
              patch.assigneeId = currentUserId;
              patch.groupId = undefined;
            } else if (val === "group") {
              patch.assigneeId = undefined;
            } else if (val === "collab") {
              patch.assigneeId = undefined;
              patch.groupId = undefined;
            } else {
              patch.assigneeId = undefined;
              patch.groupId = undefined;
            }
            onChange(patch);
          }}
          size="small"
          sx={tbgSx}
        >
          <ToggleButton value="all">All</ToggleButton>
          <ToggleButton value="mine">My tickets</ToggleButton>
          <ToggleButton value="group">Group queue</ToggleButton>
          <ToggleButton value="collab">Collaborating</ToggleButton>
        </ToggleButtonGroup>
      </Stack>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
        <TextField
          size="small"
          fullWidth
          placeholder="Search subject…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") onChange({ ...state, q: q || undefined }); }}
          InputProps={{
            endAdornment: (
              <IconButton
                onClick={() => onChange({ ...state, q: q || undefined })}
                size="small"
              >
                <SearchIcon fontSize="small" />
              </IconButton>
            ),
          }}
          sx={(theme) => ({
            "& .MuiOutlinedInput-root": {
              borderRadius: 2,
              backgroundColor: "background.paper",
            },
            "& .MuiInputBase-input::placeholder": {
              opacity: 0.8,
            },
            // subtle focus ring that works in dark mode too
            "& .MuiOutlinedInput-root.Mui-focused fieldset": {
              borderColor: alpha(theme.palette.primary.main, 0.8),
              borderWidth: 2,
            },
          })}
        />

        {(showAssignee && (mode === "all" || mode === "mine")) && (
          <Box minWidth={240}>
            <AssigneeSelect
              orgId={orgId}
              value={state.assigneeId || ""}
              onChange={(v) => onChange({ ...state, assigneeId: v || undefined })}
              onlyAgents
            />
          </Box>
        )}

        {mode === "group" && (
          <Box minWidth={220}>
            <GroupSelect
              orgId={orgId}
              value={state.groupId || ""}
              onChange={(v) => onChange({ ...state, groupId: v || undefined })}
            />
          </Box>
        )}
      </Stack>
    </Stack>
  );
}
