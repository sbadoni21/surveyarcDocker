"use client";
import { useEffect, useMemo, useState } from "react";
import UserModel from "@/models/postGresModels/userModel";
import {
  Avatar, Box, CircularProgress, MenuItem, Stack, TextField, Typography,
} from "@mui/material";

export default function AssigneeSelect({
  orgId,
  value,
  onChange,
  label = "Assignee",
  placeholder = "Select assignee",
  onlyAgents = false,
}) {
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState([]);

  // normalize incoming value to string ("" for unassigned)
  const normalizedValue = value ? String(value) : "";

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!orgId) return;
      setLoading(true);
      try {
        const list = await UserModel.listByOrg({ orgId, role: onlyAgents ? "agent" : undefined });
        const safe = Array.isArray(list) ? list : [];
        if (mounted) setUsers(safe.filter((u) => u.isActive !== false));
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [orgId, onlyAgents]);

  return (
    <TextField
      fullWidth
      select
      size="small"
      label={label}
      value={normalizedValue}
      onChange={(e) => {
        const v = e.target.value;              // always a string
        onChange?.(v === "" ? null : v);       // parent state gets updated
      }}
      placeholder={placeholder}
      InputProps={{
        startAdornment: loading ? <CircularProgress size={18} sx={{ mr: 1 }} /> : null,
      }}
    >
      <MenuItem key="__none" value=""><em>Unassigned</em></MenuItem>
      {users.map((u, idx) => {
        const id = u.userId ? String(u.userId) : u.email || `idx_${idx}`;
        return (
          <MenuItem key={id} value={id}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Avatar sx={{ width: 24, height: 24 }} src={u.avatarUrl || undefined}>
                {u.name?.[0]?.toUpperCase() || "U"}
              </Avatar>
              <Box>
                <Typography variant="body2" noWrap>{u.name}</Typography>
                {u.email && (
                  <Typography variant="caption" color="text.secondary" noWrap>
                    {u.email}
                  </Typography>
                )}
              </Box>
            </Stack>
          </MenuItem>
        );
      })}
    </TextField>
  );
}
