"use client";
import { useEffect, useState } from "react";
import { Box, Chip, MenuItem, Stack, TextField, Typography } from "@mui/material";

export default function CollaboratorsSelect({
  orgId,
  value,
  onChange,
  onlyAgents = true,
  label = "Collaborators",
}) {
  const [users, setUsers] = useState([]);
  const [pick, setPick] = useState(value || []);

  useEffect(() => setPick(value || []), [value]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!orgId) return;
      try {
        const q = onlyAgents ? "?role=agent" : "";
        const res = await fetch(`/api/post-gres-apis/users/${encodeURIComponent(orgId)}${q}`, { cache: "no-store" });
        const data = await res.json().catch(() => []);
        const arr = Array.isArray(data) ? data : data?.items || [];
        const norm = arr.map((u) => ({
          id: u.user_id || u.uid || u.id,
          name: u.display_name || u.name || u.email || u.user_id || u.uid,
          email: u.email || null,
        }));
        if (mounted) setUsers(norm);
      } catch {
        if (mounted) setUsers([]);
      }
    })();
    return () => { mounted = false; };
  }, [orgId, onlyAgents]);

  const toggle = (id) => {
    setPick((p) => {
      const has = p.includes(id);
      const next = has ? p.filter((x) => x !== id) : [...p, id];
      onChange?.(next);
      return next;
    });
  };

  return (
    <Box>
      <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 0.5 }}>
        {label}
      </Typography>
      <Stack spacing={0.75}>
        <TextField
          size="small"
          select
          value=""
          onChange={(e) => { const id = e.target.value; if (id) toggle(id); }}
          displayempty
          SelectProps={{ renderValue: () => "Add collaborator…" }}
        >
          <MenuItem value=""><em>— Select user —</em></MenuItem>
          {users.map((u, idx) => (
            <MenuItem key={u.id || idx} value={u.id}>
              {u.name} {u.email ? `• ${u.email}` : ""}
            </MenuItem>
          ))}
        </TextField>
        {!!pick.length && (
          <Stack direction="row" spacing={0.5} flexWrap="wrap">
            {pick.map((id) => {
              const u = users.find((x) => x.id === id);
              return <Chip key={id} label={u?.name || id} onDelete={() => toggle(id)} size="small" />;
            })}
          </Stack>
        )}
      </Stack>
    </Box>
  );
}
