"use client";
import { useEffect, useState } from "react";
import { Box, Stack, Tab, Tabs, TextField, IconButton, ToggleButton, ToggleButtonGroup } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
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

// view modes: all, mine (assignee_id=me), group (group_id), collab (/collaborating)
export default function TicketFilters({ orgId, state, onChange, showAssignee = true, currentUserId }) {
  const [q, setQ] = useState(state.q || "");
  const [mode, setMode] = useState(state.mode || "all"); // "all" | "mine" | "group" | "collab"

  useEffect(() => { setQ(state.q || ""); }, [state.q]);
  useEffect(() => { if (state.mode && state.mode !== mode) setMode(state.mode); /* eslint-disable-next-line */ }, [state.mode]);

  return (
    <Stack spacing={1}>
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Tabs
          value={state.status ?? ""}
          onChange={(_, val) => onChange({ ...state, status: val || undefined })}
          variant="scrollable"
          scrollButtons="auto"
        >
          {STATUS_TABS.map((t) => <Tab key={t.key} value={t.key} label={t.label} />)}
        </Tabs>

        <ToggleButtonGroup
          value={mode}
          exclusive
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
          InputProps={{ endAdornment: <IconButton onClick={() => onChange({ ...state, q: q || undefined })}><SearchIcon /></IconButton> }}
        />

        {/* Assignee filter visible only in All/My modes */}
        {showAssignee && (mode === "all" || mode === "mine") && (
          <Box minWidth={240}>
            <AssigneeSelect
              orgId={orgId}
              value={state.assigneeId || ""}
              onChange={(v) => onChange({ ...state, assigneeId: v || undefined })}
              onlyAgents
            />
          </Box>
        )}

        {/* Group select visible in Group mode */}
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
