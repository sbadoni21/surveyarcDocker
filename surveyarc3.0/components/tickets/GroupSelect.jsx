"use client";
import { useEffect, useState } from "react";
import { MenuItem, TextField, Typography } from "@mui/material";

export default function GroupSelect({
  orgId,
  value,
  onChange,
  label = "Group",
  helperText = "Choose the team queue",
  disabled = false,
}) {
  const [loading, setLoading] = useState(false);
  const [groups, setGroups] = useState([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!orgId) return;
      setLoading(true);
      try {
        const qs = new URLSearchParams({ org_id: orgId });
        const res = await fetch(`/api/post-gres-apis/support-groups?${qs.toString()}`, { cache: "no-store" });
        const data = await res.json().catch(() => []);
        const list = Array.isArray(data) ? data : data?.items || [];
        if (mounted) setGroups(list);
      } catch {
        if (mounted) setGroups([]);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [orgId]);

  return (
    <TextField
      label={label}
      select
      fullWidth
      size="small"
      value={value || ""}
      onChange={(e) => onChange?.(e.target.value || "")}
      helperText={helperText}
      disabled={disabled}
      InputProps={{
        endAdornment: loading ? <Typography variant="caption">Loading…</Typography> : null,
      }}
    >
      <MenuItem value=""><em>None</em></MenuItem>
      {groups.map((g, idx) => (
        <MenuItem key={g.group_id || g.id || idx} value={g.group_id || g.id}>
          {g.name || g.group_id}
        </MenuItem>
      ))}
    </TextField>
  );
}
