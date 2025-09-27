"use client";
import { useEffect, useMemo, useState } from "react";
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Grid, IconButton, Paper, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography, MenuItem, FormControlLabel, Checkbox } from "@mui/material";
import { Delete as DeleteIcon, Edit as EditIcon, Add as AddIcon } from "@mui/icons-material";
import { useMakingSLA } from "@/providers/slaMakingProivder";

const PRIORITIES = ["low", "normal", "high", "urgent"];
const SEVERITIES = ["sev4", "sev3", "sev2", "sev1"];

export default function SLAAdminPanel({ orgId }) {
  const { slas, calendars, listSlas, listCalendars, createSla, updateSla, removeSla, createCalendar } = useMakingSLA();

  const [openSla, setOpenSla] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    name: "",
    active: true,
    first_response_minutes: "",
    resolution_minutes: "",
    calendar_id: "",
    // rules (priority/severity maps)
    rules: { priority_map: {}, severity_map: {} },
  });

  const [openCal, setOpenCal] = useState(false);
  const [calForm, setCalForm] = useState({ name: "", timezone: "UTC", active: true });

  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    if (orgId) {
      listSlas({ orgId });
      listCalendars({ orgId });
    }
  }, [orgId, listSlas, listCalendars]);

  const handleOpenCreate = () => {
    setEditing(null);
    setForm({
      name: "",
      active: true,
      first_response_minutes: "",
      resolution_minutes: "",
      calendar_id: "",
      rules: { priority_map: {}, severity_map: {} },
    });
    setOpenSla(true);
  };

  const handleOpenEdit = (s) => {
    setEditing(s);
    setForm({
      name: s.name || "",
      active: !!s.active,
      first_response_minutes: s.first_response_minutes ?? "",
      resolution_minutes: s.resolution_minutes ?? "",
      calendar_id: s.calendar_id || "",
      rules: s.rules || { priority_map: {}, severity_map: {} },
    });
    setOpenSla(true);
  };

  const saveSla = async () => {
    const payload = {
      org_id: orgId,
      name: form.name.trim(),
      active: !!form.active,
      first_response_minutes: form.first_response_minutes ? Number(form.first_response_minutes) : null,
      resolution_minutes: form.resolution_minutes ? Number(form.resolution_minutes) : null,
      calendar_id: form.calendar_id || null,
      rules: form.rules || {},
      meta: {},
    };
    if (editing) {
      await updateSla(editing.sla_id, payload);
    } else {
      await createSla(payload);
    }
    setOpenSla(false);
  };

  const remove = async (s) => {
    if (!confirm(`Delete SLA "${s.name}"?`)) return;
    await removeSla(s.sla_id);
  };

  const saveCalendar = async () => {
    // if you wired a /calendars POST endpoint
    await createCalendar({
      org_id: orgId,
      name: calForm.name.trim(),
      timezone: calForm.timezone || "UTC",
      active: !!calForm.active,
      meta: {},
    });
    setOpenCal(false);
  };

  return (
    <Stack spacing={2}>
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Typography variant="h6">SLA Policies</Typography>
        <Stack direction="row" spacing={1}>
          <Button startIcon={<AddIcon />} variant="outlined" onClick={() => setOpenCal(true)}>
            New Business Calendar
          </Button>
          <Button startIcon={<AddIcon />} variant="contained" onClick={handleOpenCreate}>
            New SLA
          </Button>
        </Stack>
      </Stack>

      <Paper variant="outlined" sx={{ p: 1 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Active</TableCell>
              <TableCell>First Response (min)</TableCell>
              <TableCell>Resolution (min)</TableCell>
              <TableCell>Calendar</TableCell>
              <TableCell>Rules</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(slas || []).map((s) => (
              <TableRow key={s.sla_id}>
                <TableCell>{s.name}</TableCell>
                <TableCell>{s.active ? "Yes" : "No"}</TableCell>
                <TableCell>{s.first_response_minutes ?? "-"}</TableCell>
                <TableCell>{s.resolution_minutes ?? "-"}</TableCell>
                <TableCell>
                  {s.calendar_id
                    ? calendars.find((c) => c.calendar_id === s.calendar_id)?.name || s.calendar_id
                    : "-"}
                </TableCell>
                <TableCell>
                  <Typography variant="caption" color="text.secondary">
                    {Object.keys(s.rules?.priority_map || {}).length
                      ? `Priority map: ${Object.keys(s.rules.priority_map).length}`
                      : "No priority map"}
                    {" • "}
                    {Object.keys(s.rules?.severity_map || {}).length
                      ? `Severity map: ${Object.keys(s.rules.severity_map).length}`
                      : "No severity map"}
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  <IconButton size="small" onClick={() => handleOpenEdit(s)}><EditIcon fontSize="small" /></IconButton>
                  <IconButton size="small" onClick={() => remove(s)}><DeleteIcon fontSize="small" /></IconButton>
                </TableCell>
              </TableRow>
            ))}
            {(!slas || slas.length === 0) && (
              <TableRow>
                <TableCell colSpan={7}>
                  <Typography variant="body2" color="text.secondary">No SLAs yet.</Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>

      {/* SLA dialog */}
      <Dialog open={openSla} onClose={() => setOpenSla(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? "Edit SLA" : "New SLA"}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={1.5} sx={{ mt: 0.5 }}>
            <TextField label="Name" fullWidth value={form.name} onChange={(e) => update("name", e.target.value)} />
            <FormControlLabel
              control={<Checkbox checked={!!form.active} onChange={(e) => update("active", e.target.checked)} />}
              label="Active"
            />
            <Grid container spacing={1}>
              <Grid item xs={6}>
                <TextField
                  label="First Response (minutes)"
                  type="number"
                  fullWidth
                  value={form.first_response_minutes}
                  onChange={(e) => update("first_response_minutes", e.target.value)}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  label="Resolution (minutes)"
                  type="number"
                  fullWidth
                  value={form.resolution_minutes}
                  onChange={(e) => update("resolution_minutes", e.target.value)}
                />
              </Grid>
            </Grid>

            <TextField
              label="Business Calendar"
              select
              fullWidth
              value={form.calendar_id}
              onChange={(e) => update("calendar_id", e.target.value)}
            >
              <MenuItem value="">— none —</MenuItem>
              {(calendars || []).map((c) => (
                <MenuItem key={c.calendar_id} value={c.calendar_id}>{c.name} ({c.timezone})</MenuItem>
              ))}
            </TextField>

            {/* Priority map */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Priority overrides (resolution mins by priority)</Typography>
              <Grid container spacing={1}>
                {PRIORITIES.map((p) => (
                  <Grid key={p} item xs={6}>
                    <TextField
                      label={p.toUpperCase()}
                      type="number"
                      fullWidth
                      value={form.rules?.priority_map?.[p] ?? ""}
                      onChange={(e) =>
                        update("rules", {
                          ...form.rules,
                          priority_map: { ...(form.rules?.priority_map || {}), [p]: e.target.value ? Number(e.target.value) : undefined },
                        })
                      }
                      placeholder="leave blank to ignore"
                    />
                  </Grid>
                ))}
              </Grid>
            </Box>

            {/* Severity map */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Severity overrides (resolution mins by severity)</Typography>
              <Grid container spacing={1}>
                {SEVERITIES.map((s) => (
                  <Grid key={s} item xs={6}>
                    <TextField
                      label={s.toUpperCase()}
                      type="number"
                      fullWidth
                      value={form.rules?.severity_map?.[s] ?? ""}
                      onChange={(e) =>
                        update("rules", {
                          ...form.rules,
                          severity_map: { ...(form.rules?.severity_map || {}), [s]: e.target.value ? Number(e.target.value) : undefined },
                        })
                      }
                      placeholder="leave blank to ignore"
                    />
                  </Grid>
                ))}
              </Grid>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenSla(false)}>Cancel</Button>
          <Button variant="contained" onClick={saveSla}>{editing ? "Save" : "Create"}</Button>
        </DialogActions>
      </Dialog>

      {/* Calendar dialog (minimal) */}
      <Dialog open={openCal} onClose={() => setOpenCal(false)} maxWidth="xs" fullWidth>
        <DialogTitle>New Business Calendar</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={1.5}>
            <TextField label="Name" fullWidth value={calForm.name} onChange={(e) => setCalForm((f) => ({ ...f, name: e.target.value }))} />
            <TextField label="Timezone" fullWidth value={calForm.timezone} onChange={(e) => setCalForm((f) => ({ ...f, timezone: e.target.value }))} placeholder="UTC or IANA zone (e.g. America/New_York)" />
            <FormControlLabel
              control={<Checkbox checked={!!calForm.active} onChange={(e) => setCalForm((f) => ({ ...f, active: e.target.checked }))} />}
              label="Active"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenCal(false)}>Cancel</Button>
          <Button variant="contained" onClick={saveCalendar}>Create</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
