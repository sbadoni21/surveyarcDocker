"use client";
import { useEffect } from "react";
import { MenuItem, TextField, Typography } from "@mui/material";
import { useMakingSLA } from "@/providers/slaMakingProivder";

export default function SLASelect({ orgId, value, onChange, fullWidth = true, label = "SLA" }) {
  const { slas, listSlas } = useMakingSLA();

  useEffect(() => {
    if (orgId) listSlas({ orgId, active: true });
  }, [orgId, listSlas]);

  return (
    <TextField select fullWidth={fullWidth} label={label} value={value || ""} onChange={(e) => onChange(e.target.value)}>
      <MenuItem value="">— none —</MenuItem>
      {(slas || []).map((s) => (
        <MenuItem key={s.sla_id} value={s.sla_id}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span>{s.name}</span>
            <Typography variant="caption" color="text.secondary">
              FR: {s.first_response_minutes ?? "—"} min • RES: {s.resolution_minutes ?? "—"} min
            </Typography>
          </div>
        </MenuItem>
      ))}
    </TextField>
  );
}
