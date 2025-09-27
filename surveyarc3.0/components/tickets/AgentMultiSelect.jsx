// components/tickets/AgentMultiSelect.jsx
"use client";
import { useEffect, useMemo, useState } from "react";
import { TextField, MenuItem, Chip, Box } from "@mui/material";
import UserModel from "@/models/postGresModels/userModel";
import SupportGroupModel from "@/models/postGresModels/supportGroupModel";

export default function AgentMultiSelect({ orgId, groupId, value = [], onChange, label = "Agents", disabled }) {
  const [options, setOptions] = useState([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (groupId) {
        const members = await SupportGroupModel.listMembers(groupId);
        const users = await Promise.all(
          (members || []).map(async (m) => {
            try { return await UserModel.get(m.user_id); } catch { return { uid: m.user_id, display_name: m.user_id }; }
          })
        );
        if (mounted) setOptions(users.map(u => ({
          uid: u.uid,
          displayName: u.display_name || u.displayName || u.email || u.uid,
        })));
      } else if (orgId) {
        const users = await UserModel.listActiveByOrg({ orgId });
        if (mounted) setOptions(users.map(u => ({
          uid: u.uid,
          displayName: u.display_name || u.displayName || u.email || u.uid,
        })));
      } else {
        if (mounted) setOptions([]);
      }
    })();
    return () => { mounted = false; };
  }, [orgId, groupId]);

  const selected = useMemo(() => new Set(value || []), [value]);

  return (
    <TextField
      select
      fullWidth
      label={label}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange?.(Array.isArray(e.target.value) ? e.target.value : [])}
      SelectProps={{
        multiple: true,
        renderValue: (vals) => (
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
            {(vals || []).map((id) => {
              const u = options.find(o => o.uid === id);
              return <Chip key={id} label={u?.displayName || id} />;
            })}
          </Box>
        ),
      }}
      helperText={!groupId ? "Tip: choose a group to restrict agents" : undefined}
    >
      {options.map((u) => (
        <MenuItem key={u.uid} value={u.uid}>{u.displayName}</MenuItem>
      ))}
    </TextField>
  );
}
