"use client";
import { useEffect, useMemo, useState } from "react";
import {
  Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Divider, FormControlLabel, Checkbox,
  Grid, IconButton, MenuItem, Paper, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Tooltip, Typography
} from "@mui/material";
import { Delete as DeleteIcon, Edit as EditIcon, Add as AddIcon, ContentCopy as CopyIcon, Bolt as BoltIcon } from "@mui/icons-material";
import { useMakingSLA } from "@/providers/slaMakingProivder";

const PRIORITIES = ["low", "normal", "high", "urgent"];
const SEVERITIES = ["sev4", "sev3", "sev2", "sev1"];

const DIMENSIONS = [
  { value: "first_response", label: "First Response" },
  { value: "resolution", label: "Resolution" },
  { value: "update_cadence", label: "Update Cadence" },
  { value: "custom", label: "Custom" },
];

const BREACH_GRADES = ["minor", "major", "critical"];
const CREDIT_UNITS = [
  { value: "percent_fee", label: "% of Fee" },
  { value: "fixed_usd", label: "Fixed USD" },
  { value: "service_days", label: "Service Days" },
];

export default function SLAAdminPanel({ orgId }) {
  const {
    slas, listSlas, createSla, updateSla, removeSla,
    activateSla, deactivateSla, duplicateSla,
    // objectives
    listObjectives, createObjective, updateObjective, removeObjective,
    // credit rules
    listCreditRules, createCreditRule, updateCreditRule, removeCreditRule,
  } = useMakingSLA();

  const [query, setQuery] = useState("");
  const [activeOnly, setActiveOnly] = useState(true);
  const [openSla, setOpenSla] = useState(false);
  const [editing, setEditing] = useState(null);

  const [form, setForm] = useState({
    name: "",
    slug: "",
    description: "",
    active: true,
    first_response_minutes: "",
    resolution_minutes: "",
    // rules overrides
    rules: { priority_map: {}, severity_map: {} },
  });

  // dialogs for objectives / credit rules
  const [openObjective, setOpenObjective] = useState(false);
  const [editingObjective, setEditingObjective] = useState(null);
  const [objectiveForm, setObjectiveForm] = useState({
    objective: "first_response",
    target_minutes: 30,
    match: {},
    breach_grades: {},
    active: true,
  });

  const [openCredit, setOpenCredit] = useState(false);
  const [editingCredit, setEditingCredit] = useState(null);
  const [creditForm, setCreditForm] = useState({
    objective: "resolution",
    grade: "major",
    credit_unit: "percent_fee",
    credit_value: 10,
    cap_per_period: "",
    period_days: "",
    active: true,
  });

  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    if (orgId) listSlas({ orgId, active: activeOnly });
  }, [orgId, activeOnly, listSlas]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let arr = Array.isArray(slas) ? slas : [];
    if (q) arr = arr.filter(s => (s.name || "").toLowerCase().includes(q) || (s.slug || "").toLowerCase().includes(q));
    return arr.sort((a, b) => (a.precedence ?? 100) - (b.precedence ?? 100));
  }, [slas, query]);

  // ---------------- SLA CRUD ----------------
  const handleOpenCreate = () => {
    setEditing(null);
    setForm({
      name: "",
      slug: "",
      description: "",
      active: true,
      first_response_minutes: "",
      resolution_minutes: "",
      rules: { priority_map: {}, severity_map: {} },
    });
    setOpenSla(true);
  };

  const handleOpenEdit = (s) => {
    setEditing(s);
    setForm({
      name: s.name || "",
      slug: s.slug || "",
      description: s.description || "",
      active: !!s.active,
      first_response_minutes: s.first_response_minutes ?? "",
      resolution_minutes: s.resolution_minutes ?? "",
      rules: s.rules || { priority_map: {}, severity_map: {} },
    });
    setOpenSla(true);
  };

  const saveSla = async () => {
    const payload = {
      org_id: orgId,
      name: form.name.trim(),
      slug: form.slug?.trim() || null,
      description: form.description?.trim() || null,
      active: !!form.active,
      first_response_minutes: form.first_response_minutes === "" ? null : Number(form.first_response_minutes),
      resolution_minutes: form.resolution_minutes === "" ? null : Number(form.resolution_minutes),
      rules: form.rules || {},
      // you can expose more advanced fields later (scope, precedence, etc.)
    };
    if (editing) {
      await updateSla(editing.sla_id, payload);
    } else {
      await createSla(payload);
    }
    setOpenSla(false);
  };

  const onDuplicate = async (s) => {
    await duplicateSla(s.sla_id, { name: `${s.name} (Copy)`, slug: "" });
  };

  const onActivateToggle = async (s) => {
    if (s.active) {
      await deactivateSla(s.sla_id);
    } else {
      await activateSla(s.sla_id);
    }
  };

  const onDeleteSLA = async (s) => {
    if (!confirm(`Delete SLA "${s.name}"?`)) return;
    await removeSla(s.sla_id);
  };

  // --------------- Objectives ---------------
  const openObjectiveFor = async (sla) => {
    setEditingObjective({ sla });
    setObjectiveForm({
      objective: "first_response",
      target_minutes: 30,
      match: {},
      breach_grades: {},
      active: true,
    });
    await listObjectives(sla.sla_id);
    setOpenObjective(true);
  };

  const editObjective = (sla, obj) => {
    setEditingObjective({ sla, obj });
    setObjectiveForm({
      objective: obj.objective,
      target_minutes: obj.target_minutes,
      match: obj.match || {},
      breach_grades: obj.breach_grades || {},
      active: obj.active !== false,
    });
    setOpenObjective(true);
  };

  const saveObjective = async () => {
    const { sla, obj } = editingObjective || {};
    const body = {
      objective: objectiveForm.objective,
      target_minutes: Number(objectiveForm.target_minutes),
      match: objectiveForm.match || {},
      breach_grades: objectiveForm.breach_grades || {},
      active: !!objectiveForm.active,
    };
    if (!obj) {
      await createObjective(sla.sla_id, body);
    } else {
      await updateObjective(obj.objective_id, body);
    }
    setOpenObjective(false);
    await listObjectives(sla.sla_id);
  };

  const deleteObjective = async (slaId, objectiveId) => {
    if (!confirm("Delete this objective?")) return;
    await removeObjective(objectiveId);
    await listObjectives(slaId);
  };

  // --------------- Credit Rules ---------------
  const openCreditFor = async (sla) => {
    setEditingCredit({ sla });
    setCreditForm({
      objective: "resolution",
      grade: "major",
      credit_unit: "percent_fee",
      credit_value: 10,
      cap_per_period: "",
      period_days: "",
      active: true,
    });
    await listCreditRules(sla.sla_id);
    setOpenCredit(true);
  };

  const editCredit = (sla, rule) => {
    setEditingCredit({ sla, rule });
    setCreditForm({
      objective: rule.objective,
      grade: rule.grade,
      credit_unit: rule.credit_unit,
      credit_value: rule.credit_value,
      cap_per_period: rule.cap_per_period ?? "",
      period_days: rule.period_days ?? "",
      active: rule.active !== false,
    });
    setOpenCredit(true);
  };

  const saveCredit = async () => {
    const { sla, rule } = editingCredit || {};
    const body = {
      objective: creditForm.objective,
      grade: creditForm.grade,
      credit_unit: creditForm.credit_unit,
      credit_value: Number(creditForm.credit_value),
      cap_per_period: creditForm.cap_per_period === "" ? null : Number(creditForm.cap_per_period),
      period_days: creditForm.period_days === "" ? null : Number(creditForm.period_days),
      active: !!creditForm.active,
    };
    if (!rule) {
      await createCreditRule(sla.sla_id, body);
    } else {
      await updateCreditRule(rule.rule_id, body);
    }
    setOpenCredit(false);
    await listCreditRules(sla.sla_id);
  };

  const deleteCredit = async (slaId, ruleId) => {
    if (!confirm("Delete this credit rule?")) return;
    await removeCreditRule(ruleId);
    await listCreditRules(slaId);
  };

  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ xs: "stretch", sm: "center" }} justifyContent="space-between">
        <Typography variant="h6">SLA Policies</Typography>
        <Stack direction="row" spacing={1}>
          <TextField
            size="small"
            placeholder="Search by name or slug…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <FormControlLabel
            control={<Checkbox checked={activeOnly} onChange={(e) => setActiveOnly(e.target.checked)} />}
            label="Active only"
          />
          <Button startIcon={<AddIcon />} variant="contained" onClick={handleOpenCreate}>
            New SLA
          </Button>
        </Stack>
      </Stack>

      <Paper variant="outlined" sx={{ borderRadius: 2 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ width: 320 }}>Name</TableCell>
              <TableCell>FR (min)</TableCell>
              <TableCell>RES (min)</TableCell>
              <TableCell>Overrides</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right" sx={{ width: 310 }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.map((s) => (
              <TableRow key={s.sla_id} hover>
                <TableCell>
                  <Stack spacing={0}>
                    <Typography variant="subtitle2">{s.name}</Typography>
                    <Typography variant="caption" color="text.secondary">{s.slug || "—"}</Typography>
                  </Stack>
                </TableCell>
                <TableCell>{s.first_response_minutes ?? "—"}</TableCell>
                <TableCell>{s.resolution_minutes ?? "—"}</TableCell>
                <TableCell>
                  <Stack direction="row" spacing={0.5} flexWrap="wrap">
                    {Object.entries(s.rules?.priority_map || {}).filter(([,v]) => v != null && v !== "")
                      .map(([k, v]) => <Chip key={`p-${k}`} label={`P:${k}→${v}`} size="small" />)}
                    {Object.entries(s.rules?.severity_map || {}).filter(([,v]) => v != null && v !== "")
                      .map(([k, v]) => <Chip key={`s-${k}`} label={`S:${k}→${v}`} size="small" />)}
                    {(!s.rules?.priority_map && !s.rules?.severity_map) && <Typography variant="caption" color="text.secondary">—</Typography>}
                  </Stack>
                </TableCell>
                <TableCell>
                  <Chip size="small" color={s.active ? "success" : "default"} label={s.active ? "ACTIVE" : "INACTIVE"} />
                </TableCell>
                <TableCell align="right">
                  <Stack direction="row" spacing={1} justifyContent="flex-end">
                    <Tooltip title="Objectives">
                      <Button variant="outlined" size="small" startIcon={<BoltIcon />} onClick={() => openObjectiveFor(s)}>
                        Objectives
                      </Button>
                    </Tooltip>
                    <Tooltip title="Credit Rules">
                      <Button variant="outlined" size="small" onClick={() => openCreditFor(s)}>
                        Credits
                      </Button>
                    </Tooltip>
                    <Tooltip title="Edit">
                      <IconButton size="small" onClick={() => handleOpenEdit(s)}><EditIcon fontSize="small" /></IconButton>
                    </Tooltip>
                    <Tooltip title={s.active ? "Deactivate" : "Activate"}>
                      <Button size="small" onClick={() => onActivateToggle(s)}>
                        {s.active ? "Deactivate" : "Activate"}
                      </Button>
                    </Tooltip>
                    <Tooltip title="Duplicate">
                      <IconButton size="small" onClick={() => onDuplicate(s)}><CopyIcon fontSize="small" /></IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton size="small" color="error" onClick={() => onDeleteSLA(s)}><DeleteIcon fontSize="small" /></IconButton>
                    </Tooltip>
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={6}>
                  <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>No SLAs found.</Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>

      {/* Create/Edit SLA */}
      <Dialog open={openSla} onClose={() => setOpenSla(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? "Edit SLA" : "New SLA"}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={1.5} sx={{ mt: 0.5 }}>
            <TextField label="Name" fullWidth value={form.name} onChange={(e) => update("name", e.target.value)} />
            <TextField label="Slug (optional, unique in org)" fullWidth value={form.slug} onChange={(e) => update("slug", e.target.value)} />
            <TextField label="Description" fullWidth multiline minRows={2} value={form.description} onChange={(e) => update("description", e.target.value)} />
            <FormControlLabel control={<Checkbox checked={!!form.active} onChange={(e) => update("active", e.target.checked)} />} label="Active" />

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

            <Divider sx={{ my: 1 }} />

            {/* Priority overrides */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Priority overrides (resolution mins)</Typography>
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
                      placeholder="leave blank"
                    />
                  </Grid>
                ))}
              </Grid>
            </Box>

            {/* Severity overrides */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Severity overrides (resolution mins)</Typography>
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
                      placeholder="leave blank"
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

      {/* Objectives dialog */}
      <Dialog open={openObjective} onClose={() => setOpenObjective(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingObjective?.obj ? "Edit Objective" : "Objectives"} {editingObjective?.sla ? `• ${editingObjective.sla.name}` : ""}
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            {/* list current */}
            {editingObjective?.sla && (
              <ObjectivesTable
                slaId={editingObjective.sla.sla_id}
                onEdit={(obj) => editObjective(editingObjective.sla, obj)}
                onDelete={(objectiveId) => deleteObjective(editingObjective.sla.sla_id, objectiveId)}
              />
            )}

            <Divider />

            {/* editor */}
            <Grid container spacing={1}>
              <Grid item xs={12} sm={4}>
                <TextField label="Objective" select fullWidth value={objectiveForm.objective}
                  onChange={(e) => setObjectiveForm((f) => ({ ...f, objective: e.target.value }))}>
                  {DIMENSIONS.map((d) => <MenuItem key={d.value} value={d.value}>{d.label}</MenuItem>)}
                </TextField>
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField label="Target Minutes" type="number" fullWidth value={objectiveForm.target_minutes}
                  onChange={(e) => setObjectiveForm((f) => ({ ...f, target_minutes: e.target.value }))} />
              </Grid>
              <Grid item xs={12} sm={4}>
                <FormControlLabel control={<Checkbox checked={!!objectiveForm.active} onChange={(e) => setObjectiveForm((f) => ({ ...f, active: e.target.checked }))} />} label="Active" />
              </Grid>
            </Grid>

            <Typography variant="subtitle2">Breach thresholds (minutes beyond target)</Typography>
            <Grid container spacing={1}>
              {BREACH_GRADES.map((g) => (
                <Grid key={g} item xs={12} sm={4}>
                  <TextField
                    label={g}
                    type="number"
                    fullWidth
                    value={objectiveForm.breach_grades?.[g] ?? ""}
                    onChange={(e) =>
                      setObjectiveForm((f) => ({
                        ...f,
                        breach_grades: { ...(f.breach_grades || {}), [g]: e.target.value ? Number(e.target.value) : undefined },
                      }))
                    }
                    placeholder="leave blank"
                  />
                </Grid>
              ))}
            </Grid>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenObjective(false)}>Close</Button>
          <Button variant="contained" onClick={saveObjective}>{editingObjective?.obj ? "Save" : "Add Objective"}</Button>
        </DialogActions>
      </Dialog>

      {/* Credit Rules dialog */}
      <Dialog open={openCredit} onClose={() => setOpenCredit(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingCredit?.rule ? "Edit Credit Rule" : "Credit Rules"} {editingCredit?.sla ? `• ${editingCredit.sla.name}` : ""}
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            {/* list current */}
            {editingCredit?.sla && (
              <CreditRulesTable
                slaId={editingCredit.sla.sla_id}
                onEdit={(rule) => editCredit(editingCredit.sla, rule)}
                onDelete={(ruleId) => deleteCredit(editingCredit.sla.sla_id, ruleId)}
              />
            )}

            <Divider />

            {/* editor */}
            <Grid container spacing={1}>
              <Grid item xs={12} sm={4}>
                <TextField label="Objective" select fullWidth value={creditForm.objective}
                  onChange={(e) => setCreditForm((f) => ({ ...f, objective: e.target.value }))}>
                  {DIMENSIONS.map((d) => <MenuItem key={d.value} value={d.value}>{d.label}</MenuItem>)}
                </TextField>
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField label="Grade" select fullWidth value={creditForm.grade}
                  onChange={(e) => setCreditForm((f) => ({ ...f, grade: e.target.value }))}>
                  {BREACH_GRADES.map((g) => <MenuItem key={g} value={g}>{g}</MenuItem>)}
                </TextField>
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField label="Credit Unit" select fullWidth value={creditForm.credit_unit}
                  onChange={(e) => setCreditForm((f) => ({ ...f, credit_unit: e.target.value }))}>
                  {CREDIT_UNITS.map((u) => <MenuItem key={u.value} value={u.value}>{u.label}</MenuItem>)}
                </TextField>
              </Grid>

              <Grid item xs={12} sm={4}>
                <TextField label="Credit Value" type="number" fullWidth value={creditForm.credit_value}
                  onChange={(e) => setCreditForm((f) => ({ ...f, credit_value: e.target.value }))} />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField label="Cap per period" type="number" fullWidth value={creditForm.cap_per_period}
                  onChange={(e) => setCreditForm((f) => ({ ...f, cap_per_period: e.target.value }))} placeholder="optional" />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField label="Period days" type="number" fullWidth value={creditForm.period_days}
                  onChange={(e) => setCreditForm((f) => ({ ...f, period_days: e.target.value }))} placeholder="optional" />
              </Grid>
              <Grid item xs={12}>
                <FormControlLabel control={<Checkbox checked={!!creditForm.active} onChange={(e) => setCreditForm((f) => ({ ...f, active: e.target.checked }))} />} label="Active" />
              </Grid>
            </Grid>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenCredit(false)}>Close</Button>
          <Button variant="contained" onClick={saveCredit}>{editingCredit?.rule ? "Save" : "Add Rule"}</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}

/* ---------- Small embedded tables ---------- */

function ObjectivesTable({ slaId, onEdit, onDelete }) {
  const { objectivesBySla, listObjectives } = useMakingSLA();
  useEffect(() => { if (slaId) listObjectives(slaId); }, [slaId, listObjectives]);
  const rows = objectivesBySla[slaId] || [];

  return (
    <Paper variant="outlined" sx={{ borderRadius: 2 }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Objective</TableCell>
            <TableCell>Target (min)</TableCell>
            <TableCell>Breach thresholds</TableCell>
            <TableCell>Status</TableCell>
            <TableCell align="right" sx={{ width: 120 }}>Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((o) => (
            <TableRow key={o.objective_id} hover>
              <TableCell>{o.objective}</TableCell>
              <TableCell>{o.target_minutes}</TableCell>
              <TableCell>
                <Stack direction="row" spacing={0.5} flexWrap="wrap">
                  {Object.entries(o.breach_grades || {}).map(([k, v]) => <Chip key={k} size="small" label={`${k}:${v}`} />)}
                </Stack>
              </TableCell>
              <TableCell><Chip size="small" color={o.active ? "success" : "default"} label={o.active ? "ACTIVE" : "INACTIVE"} /></TableCell>
              <TableCell align="right">
                <IconButton size="small" onClick={() => onEdit(o)}><EditIcon fontSize="small" /></IconButton>
                <IconButton size="small" color="error" onClick={() => onDelete(o.objective_id)}><DeleteIcon fontSize="small" /></IconButton>
              </TableCell>
            </TableRow>
          ))}
          {rows.length === 0 && (
            <TableRow><TableCell colSpan={5}><Typography variant="body2" color="text.secondary" sx={{ p: 1 }}>No objectives yet.</Typography></TableCell></TableRow>
          )}
        </TableBody>
      </Table>
    </Paper>
  );
}

function CreditRulesTable({ slaId, onEdit, onDelete }) {
  const { creditRulesBySla, listCreditRules } = useMakingSLA();
  useEffect(() => { if (slaId) listCreditRules(slaId); }, [slaId, listCreditRules]);
  const rows = creditRulesBySla[slaId] || [];

  return (
    <Paper variant="outlined" sx={{ borderRadius: 2 }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Objective</TableCell>
            <TableCell>Grade</TableCell>
            <TableCell>Credit</TableCell>
            <TableCell>Caps</TableCell>
            <TableCell>Status</TableCell>
            <TableCell align="right" sx={{ width: 120 }}>Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.rule_id} hover>
              <TableCell>{r.objective}</TableCell>
              <TableCell>{r.grade}</TableCell>
              <TableCell>{r.credit_value} {r.credit_unit}</TableCell>
              <TableCell>{(r.cap_per_period ?? "—")} / {(r.period_days ?? "—")}d</TableCell>
              <TableCell><Chip size="small" color={r.active ? "success" : "default"} label={r.active ? "ACTIVE" : "INACTIVE"} /></TableCell>
              <TableCell align="right">
                <IconButton size="small" onClick={() => onEdit(r)}><EditIcon fontSize="small" /></IconButton>
                <IconButton size="small" color="error" onClick={() => onDelete(r.rule_id)}><DeleteIcon fontSize="small" /></IconButton>
              </TableCell>
            </TableRow>
          ))}
          {rows.length === 0 && (
            <TableRow><TableCell colSpan={6}><Typography variant="body2" color="text.secondary" sx={{ p: 1 }}>No credit rules yet.</Typography></TableCell></TableRow>
          )}
        </TableBody>
      </Table>
    </Paper>
  );
}
