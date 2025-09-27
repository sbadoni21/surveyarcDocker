// components/tickets/TeamMultiSelect.jsx
"use client";
import { useEffect, useMemo, useState } from "react";
import { TextField, MenuItem, Chip, Box } from "@mui/material";
import { useSupportTeams } from "@/providers/postGresPorviders/SupportTeamProvider";

export default function TeamMultiSelect({ groupId, value = [], onChange, label = "Teams", disabled }) {
  const { listByGroup } = useSupportTeams();
  const [options, setOptions] = useState([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const arr = groupId ? await listByGroup(groupId) : [];
      if (mounted) setOptions(arr);
    })();
    return () => { mounted = false; };
  }, [groupId, listByGroup]);

  const ids = useMemo(() => new Set(value || []), [value]);

  return (
    <TextField
      select
      fullWidth
      label={label}
      SelectProps={{ multiple: true, renderValue: (selected) => (
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
          {(selected || []).map((id) => {
            const t = options.find(o => o.teamId === id);
            return <Chip key={id} label={t?.name || id} />;
          })}
        </Box>
      )}}
      value={value}
      onChange={(e) => onChange?.(Array.isArray(e.target.value) ? e.target.value : [])}
      disabled={disabled || !groupId}
      helperText={!groupId ? "Select a group first" : undefined}
    >
      {options.map((t) => (
        <MenuItem key={t.teamId} value={t.teamId}>{t.name}</MenuItem>
      ))}
    </TextField>
  );
}
