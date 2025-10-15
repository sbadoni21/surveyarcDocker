"use client";
import { useEffect, useMemo, useState } from "react";
import {
  Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Divider,
  FormControlLabel, Checkbox, Grid, IconButton, LinearProgress, Link,
  MenuItem, Paper, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField,
  Tooltip, Typography
} from "@mui/material";
import {
  Delete as DeleteIcon, Edit as EditIcon, Add as AddIcon, ContentCopy as CopyIcon, Bolt as BoltIcon,
  LibraryAdd as BulkIcon, UploadFile as ImportIcon, Download as ExportIcon,
  PublishedWithChanges as PublishIcon, Archive as ArchiveIcon,
  Science as TestIcon, Update as VersionIcon, Info as InfoIcon, CleaningServices as CleanupIcon
} from "@mui/icons-material";
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
    // state
    slas, listSlas,
    // SLA ops
    createSla, updateSla, removeSla, activateSla, deactivateSla, duplicateSla,
    publishSla, archiveSla, validateSla, createNewVersion, listVersions, dependencies,
    // bulk
    bulkUpsert, bulkDelete,
    // objectives
    listObjectives, createObjective, updateObjective, removeObjective,
    // credit rules
    listCreditRules, createCreditRule, updateCreditRule, removeCreditRule,
    // org tools
    match, simulate, effective, stats, compliance, exportSlas, importSlas, cleanup,
  } = useMakingSLA();

  const [busy, setBusy] = useState(false);
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
    rules: { priority_map: {}, severity_map: {} },
  });
  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  // dialogs: objectives / credits (CRUD)
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

  // dialogs: import/export/bulk/test/stats/versions/dep/cleanup
  const [openImport, setOpenImport] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [openBulk, setOpenBulk] = useState(false);
  const [bulkJson, setBulkJson] = useState("[\n  {\"org_id\":\"" + orgId + "\",\"name\":\"Sample SLA\",\"slug\":\"sample\",\"active\":true}\n]");
  const [openTest, setOpenTest] = useState(false);
  const [testMode, setTestMode] = useState("match"); // match | simulate | effective
  const [testInput, setTestInput] = useState({ priority: "", severity: "", tags: "" });
  const [testOutput, setTestOutput] = useState(null);
  const [openStats, setOpenStats] = useState(false);
  const [statsData, setStatsData] = useState(null);
  const [complianceRange, setComplianceRange] = useState({ from: "", to: "" });
  const [complianceData, setComplianceData] = useState(null);
  const [openVersions, setOpenVersions] = useState(false);
  const [versionsOf, setVersionsOf] = useState({ sla: null, list: [] });
  const [openDeps, setOpenDeps] = useState(false);
  const [depsInfo, setDepsInfo] = useState(null);
  const [openCleanup, setOpenCleanup] = useState(false);
  const [cleanupOpts, setCleanupOpts] = useState({ days: 90, dry: true });
  const [cleanupResult, setCleanupResult] = useState(null);

  // load
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
    setBusy(true);
    const payload = {
      org_id: orgId,
      name: form.name.trim(),
      slug: form.slug?.trim() || null,
      description: form.description?.trim() || null,
      active: !!form.active,
      first_response_minutes: form.first_response_minutes === "" ? null : Number(form.first_response_minutes),
      resolution_minutes: form.resolution_minutes === "" ? null : Number(form.resolution_minutes),
      rules: form.rules || {},
    };
    if (editing) await updateSla(editing.sla_id, payload);
    else await createSla(payload);
    setBusy(false);
    setOpenSla(false);
  };
  const onDuplicate = async (s) => { await duplicateSla(s.sla_id, { name: `${s.name} (Copy)`, slug: "" }); };
  const onActivateToggle = async (s) => { s.active ? await deactivateSla(s.sla_id) : await activateSla(s.sla_id); };
  const onDeleteSLA = async (s) => { if (confirm(`Delete SLA "${s.name}"?`)) await removeSla(s.sla_id); };

  // --------------- Publish/Archive/Validate/Versions/Deps ---------------
  const doPublish = async (s) => { await publishSla(s.sla_id, {}); };
  const doArchive = async (s) => { await archiveSla(s.sla_id); };
  const doValidate = async (s) => {
    const res = await validateSla(s.sla_id);
    alert(`${res.valid ? "VALID ✅" : "INVALID ❌"}\n\nErrors: ${res.errors?.join(", ") || "—"}\nWarnings: ${res.warnings?.join(", ") || "—"}`);
  };
  const openVersionList = async (s) => {
    const list = await listVersions(s.sla_id);
    setVersionsOf({ sla: s, list });
    setOpenVersions(true);
  };
  const makeNewVersion = async (s) => {
    const v = await createNewVersion(s.sla_id, {});
    setVersionsOf({ sla: v, list: await listVersions(v.sla_id) });
    setOpenVersions(true);
  };
  const openDepsDialog = async (s) => {
    setDepsInfo(await dependencies(s.sla_id, { limit: 100 }));
    setOpenDeps(true);
  };

  // --------------- Objectives ---------------
  const openObjectiveFor = async (sla) => {
    setEditingObjective({ sla });
    setObjectiveForm({ objective: "first_response", target_minutes: 30, match: {}, breach_grades: {}, active: true });
    await listObjectives(sla.sla_id);
    setOpenObjective(true);
  };
  const editObjective = (sla, obj) => {
    setEditingObjective({ sla, obj });
    setObjectiveForm({
      objective: obj.objective, target_minutes: obj.target_minutes,
      match: obj.match || {}, breach_grades: obj.breach_grades || {}, active: obj.active !== false,
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
    if (!obj) await createObjective(sla.sla_id, body);
    else await updateObjective(obj.objective_id, body);
    await listObjectives(sla.sla_id);
    setOpenObjective(false);
  };
  const deleteObjective = async (slaId, objectiveId) => {
    if (!confirm("Delete this objective?")) return;
    await removeObjective(objectiveId);
    await listObjectives(slaId);
  };

  // --------------- Credit Rules ---------------
  const openCreditFor = async (sla) => {
    setEditingCredit({ sla });
    setCreditForm({ objective: "resolution", grade: "major", credit_unit: "percent_fee", credit_value: 10, cap_per_period: "", period_days: "", active: true });
    await listCreditRules(sla.sla_id);
    setOpenCredit(true);
  };
  const editCredit = (sla, rule) => {
    setEditingCredit({ sla, rule });
    setCreditForm({
      objective: rule.objective, grade: rule.grade, credit_unit: rule.credit_unit, credit_value: rule.credit_value,
      cap_per_period: rule.cap_per_period ?? "", period_days: rule.period_days ?? "", active: rule.active !== false,
    });
    setOpenCredit(true);
  };
  const saveCredit = async () => {
    const { sla, rule } = editingCredit || {};
    const body = {
      objective: creditForm.objective, grade: creditForm.grade, credit_unit: creditForm.credit_unit,
      credit_value: Number(creditForm.credit_value),
      cap_per_period: creditForm.cap_per_period === "" ? null : Number(creditForm.cap_per_period),
      period_days: creditForm.period_days === "" ? null : Number(creditForm.period_days),
      active: !!creditForm.active,
    };
    if (!rule) await createCreditRule(sla.sla_id, body);
    else await updateCreditRule(rule.rule_id, body);
    await listCreditRules(sla.sla_id);
    setOpenCredit(false);
  };
  const deleteCredit = async (slaId, ruleId) => {
    if (!confirm("Delete this credit rule?")) return;
    await removeCreditRule(ruleId);
    await listCreditRules(slaId);
  };

  // --------------- Export / Import / Bulk / Cleanup ---------------
  const doExport = async () => {
    const { blob, filename } = await exportSlas(orgId, { includeObjectives: true, includeCreditRules: true });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename || "slas.json"; a.click();
    URL.revokeObjectURL(url);
  };
  const doImport = async () => {
    if (!importFile) return;
    setBusy(true);
    await importSlas(orgId, importFile, { updateExisting: true });
    setBusy(false);
    setOpenImport(false);
    await listSlas({ orgId, active: activeOnly });
  };
  const doBulkUpsert = async () => {
    const payload = JSON.parse(bulkJson || "[]");
    await bulkUpsert(payload, { updateExisting: true });
    setOpenBulk(false);
    await listSlas({ orgId, active: activeOnly });
  };
  const doBulkDelete = async () => {
    const payload = JSON.parse(bulkJson || "[]"); // support array of ids or objects
    const ids = Array.isArray(payload) ? payload.map((x) => (typeof x === "string" ? x : x.sla_id)).filter(Boolean) : [];
    await bulkDelete(ids, { force: false });
    setOpenBulk(false);
    await listSlas({ orgId, active: activeOnly });
  };
  const doCleanup = async () => {
    const res = await cleanup(orgId, { olderThanDays: Number(cleanupOpts.days || 90), dryRun: !!cleanupOpts.dry });
    setCleanupResult(res);
  };

  // --------------- Match / Simulate / Effective / Stats / Compliance ---------------
  const runTest = async () => {
    setBusy(true);
    try {
      if (testMode === "match") {
        const criteria = {
          priority: testInput.priority || undefined,
          severity: testInput.severity || undefined,
          tags: (testInput.tags || "").split(",").map(t => t.trim()).filter(Boolean),
        };
        setTestOutput(await match(orgId, criteria));
      } else if (testMode === "simulate") {
        const criteria = {
          priority: testInput.priority || undefined,
          severity: testInput.severity || undefined,
          tags: (testInput.tags || "").split(",").map(t => t.trim()).filter(Boolean),
        };
        setTestOutput(await simulate(orgId, criteria));
      } else {
        const at = testInput.at_time ? new Date(testInput.at_time) : undefined;
        setTestOutput(await effective(orgId, { at_time: at }));
      }
    } finally { setBusy(false); }
  };
  const openStatsDialog = async () => {
    setStatsData(await stats(orgId));
    setOpenStats(true);
  };
  const loadCompliance = async () => {
    const from = complianceRange.from ? new Date(complianceRange.from) : undefined;
    const to = complianceRange.to ? new Date(complianceRange.to) : undefined;
    setComplianceData(await compliance(orgId, { from_date: from, to_date: to }));
  };

  return (
    <Stack spacing={2}>
      {/* top toolbar */}
      <Stack direction={{ xs: "column", md: "row" }} spacing={1} alignItems={{ xs: "stretch", md: "center" }} justifyContent="space-between">
        <Typography variant="h6">SLA Policies</Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap">
          <TextField size="small" placeholder="Search by name or slug…" value={query} onChange={(e) => setQuery(e.target.value)} />
          <FormControlLabel control={<Checkbox checked={activeOnly} onChange={(e) => setActiveOnly(e.target.checked)} />} label="Active only" />
          <Button startIcon={<AddIcon />} variant="contained" onClick={handleOpenCreate}>New SLA</Button>
          <Button startIcon={<ExportIcon />} onClick={doExport}>Export</Button>
          <Button startIcon={<ImportIcon />} onClick={() => setOpenImport(true)}>Import</Button>
          <Button startIcon={<BulkIcon />} onClick={() => setOpenBulk(true)}>Bulk</Button>
          <Button startIcon={<TestIcon />} onClick={() => setOpenTest(true)}>Test</Button>
          <Button startIcon={<InfoIcon />} onClick={openStatsDialog}>Stats</Button>
          <Button startIcon={<CleanupIcon />} color="warning" onClick={() => setOpenCleanup(true)}>Cleanup</Button>
        </Stack>
      </Stack>

      {busy && <LinearProgress />}

      {/* table */}
      <Paper variant="outlined" sx={{ borderRadius: 2 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ width: 320 }}>Name</TableCell>
              <TableCell>FR (min)</TableCell>
              <TableCell>RES (min)</TableCell>
              <TableCell>Overrides</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right" sx={{ width: 560 }}>Actions</TableCell>
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
                <TableCell><Chip size="small" color={s.active ? "success" : "default"} label={s.active ? "ACTIVE" : "INACTIVE"} /></TableCell>
                <TableCell align="right">
                  <Stack direction="row" spacing={1} justifyContent="flex-end" flexWrap="wrap">
                    <Tooltip title="Objectives"><Button variant="outlined" size="small" startIcon={<BoltIcon />} onClick={() => openObjectiveFor(s)}>Objectives</Button></Tooltip>
                    <Tooltip title="Credit Rules"><Button variant="outlined" size="small" onClick={() => openCreditFor(s)}>Credits</Button></Tooltip>
                    <Tooltip title="Edit"><IconButton size="small" onClick={() => handleOpenEdit(s)}><EditIcon fontSize="small" /></IconButton></Tooltip>
                    <Tooltip title={s.active ? "Deactivate" : "Activate"}><Button size="small" onClick={() => onActivateToggle(s)}>{s.active ? "Deactivate" : "Activate"}</Button></Tooltip>
                    <Tooltip title="Publish"><IconButton size="small" onClick={() => doPublish(s)}><PublishIcon fontSize="small" /></IconButton></Tooltip>
                    <Tooltip title="Archive"><IconButton size="small" onClick={() => doArchive(s)}><ArchiveIcon fontSize="small" /></IconButton></Tooltip>
                    <Tooltip title="Validate"><Button size="small" onClick={() => doValidate(s)}>Validate</Button></Tooltip>
                    <Tooltip title="Duplicate"><IconButton size="small" onClick={() => onDuplicate(s)}><CopyIcon fontSize="small" /></IconButton></Tooltip>
                    <Tooltip title="Versions"><Button size="small" startIcon={<VersionIcon />} onClick={() => openVersionList(s)}>Versions</Button></Tooltip>
                    <Tooltip title="New Version"><Button size="small" onClick={() => makeNewVersion(s)}>+Version</Button></Tooltip>
                    <Tooltip title="Dependencies"><Button size="small" onClick={() => openDepsDialog(s)}>Deps</Button></Tooltip>
                    <Tooltip title="Delete"><IconButton size="small" color="error" onClick={() => onDeleteSLA(s)}><DeleteIcon fontSize="small" /></IconButton></Tooltip>
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={6}><Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>No SLAs found.</Typography></TableCell></TableRow>
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
              <Grid item xs={6}><TextField label="First Response (minutes)" type="number" fullWidth value={form.first_response_minutes} onChange={(e) => update("first_response_minutes", e.target.value)} /></Grid>
              <Grid item xs={6}><TextField label="Resolution (minutes)" type="number" fullWidth value={form.resolution_minutes} onChange={(e) => update("resolution_minutes", e.target.value)} /></Grid>
            </Grid>
            <Divider sx={{ my: 1 }} />
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Priority overrides (resolution mins)</Typography>
              <Grid container spacing={1}>
                {PRIORITIES.map((p) => (
                  <Grid key={p} item xs={6}>
                    <TextField
                      label={p.toUpperCase()} type="number" fullWidth
                      value={form.rules?.priority_map?.[p] ?? ""}
                      onChange={(e) => update("rules", { ...form.rules, priority_map: { ...(form.rules?.priority_map || {}), [p]: e.target.value ? Number(e.target.value) : undefined } })}
                      placeholder="leave blank" />
                  </Grid>
                ))}
              </Grid>
            </Box>
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Severity overrides (resolution mins)</Typography>
              <Grid container spacing={1}>
                {SEVERITIES.map((s) => (
                  <Grid key={s} item xs={6}>
                    <TextField
                      label={s.toUpperCase()} type="number" fullWidth
                      value={form.rules?.severity_map?.[s] ?? ""}
                      onChange={(e) => update("rules", { ...form.rules, severity_map: { ...(form.rules?.severity_map || {}), [s]: e.target.value ? Number(e.target.value) : undefined } })}
                      placeholder="leave blank" />
                  </Grid>
                ))}
              </Grid>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenSla(false)}>Cancel</Button>
          <Button variant="contained" onClick={saveSla} disabled={busy}>{editing ? "Save" : "Create"}</Button>
        </DialogActions>
      </Dialog>

      {/* Objectives dialog */}
      <Dialog open={openObjective} onClose={() => setOpenObjective(false)} maxWidth="md" fullWidth>
        <DialogTitle>{editingObjective?.obj ? "Edit Objective" : "Objectives"} {editingObjective?.sla ? `• ${editingObjective.sla.name}` : ""}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            {editingObjective?.sla && (
              <ObjectivesTable
                slaId={editingObjective.sla.sla_id}
                onEdit={(obj) => editObjective(editingObjective.sla, obj)}
                onDelete={(objectiveId) => deleteObjective(editingObjective.sla.sla_id, objectiveId)}
              />
            )}
            <Divider />
            <Grid container spacing={1}>
              <Grid item xs={12} sm={4}>
                <TextField label="Objective" select fullWidth value={objectiveForm.objective} onChange={(e) => setObjectiveForm((f) => ({ ...f, objective: e.target.value }))}>
                  {DIMENSIONS.map((d) => <MenuItem key={d.value} value={d.value}>{d.label}</MenuItem>)}
                </TextField>
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField label="Target Minutes" type="number" fullWidth value={objectiveForm.target_minutes} onChange={(e) => setObjectiveForm((f) => ({ ...f, target_minutes: e.target.value }))} />
              </Grid>
              <Grid item xs={12} sm={4}>
                <FormControlLabel control={<Checkbox checked={!!objectiveForm.active} onChange={(e) => setObjectiveForm((f) => ({ ...f, active: e.target.checked }))} />} label="Active" />
              </Grid>
            </Grid>
            <Typography variant="subtitle2">Breach thresholds (minutes beyond target)</Typography>
            <Grid container spacing={1}>
              {BREACH_GRADES.map((g) => (
                <Grid key={g} item xs={12} sm={4}>
                  <TextField label={g} type="number" fullWidth value={objectiveForm.breach_grades?.[g] ?? ""}
                    onChange={(e) => setObjectiveForm((f) => ({ ...f, breach_grades: { ...(f.breach_grades || {}), [g]: e.target.value ? Number(e.target.value) : undefined } }))} placeholder="leave blank" />
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
        <DialogTitle>{editingCredit?.rule ? "Edit Credit Rule" : "Credit Rules"} {editingCredit?.sla ? `• ${editingCredit.sla.name}` : ""}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            {editingCredit?.sla && (
              <CreditRulesTable
                slaId={editingCredit.sla.sla_id}
                onEdit={(rule) => editCredit(editingCredit.sla, rule)}
                onDelete={(ruleId) => deleteCredit(editingCredit.sla.sla_id, ruleId)}
              />
            )}
            <Divider />
            <Grid container spacing={1}>
              <Grid item xs={12} sm={4}>
                <TextField label="Objective" select fullWidth value={creditForm.objective} onChange={(e) => setCreditForm((f) => ({ ...f, objective: e.target.value }))}>
                  {DIMENSIONS.map((d) => <MenuItem key={d.value} value={d.value}>{d.label}</MenuItem>)}
                </TextField>
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField label="Grade" select fullWidth value={creditForm.grade} onChange={(e) => setCreditForm((f) => ({ ...f, grade: e.target.value }))}>
                  {BREACH_GRADES.map((g) => <MenuItem key={g} value={g}>{g}</MenuItem>)}
                </TextField>
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField label="Credit Unit" select fullWidth value={creditForm.credit_unit} onChange={(e) => setCreditForm((f) => ({ ...f, credit_unit: e.target.value }))}>
                  {CREDIT_UNITS.map((u) => <MenuItem key={u.value} value={u.value}>{u.label}</MenuItem>)}
                </TextField>
              </Grid>
              <Grid item xs={12} sm={4}><TextField label="Credit Value" type="number" fullWidth value={creditForm.credit_value} onChange={(e) => setCreditForm((f) => ({ ...f, credit_value: e.target.value }))} /></Grid>
              <Grid item xs={12} sm={4}><TextField label="Cap per period" type="number" fullWidth value={creditForm.cap_per_period} onChange={(e) => setCreditForm((f) => ({ ...f, cap_per_period: e.target.value }))} placeholder="optional" /></Grid>
              <Grid item xs={12} sm={4}><TextField label="Period days" type="number" fullWidth value={creditForm.period_days} onChange={(e) => setCreditForm((f) => ({ ...f, period_days: e.target.value }))} placeholder="optional" /></Grid>
              <Grid item xs={12}><FormControlLabel control={<Checkbox checked={!!creditForm.active} onChange={(e) => setCreditForm((f) => ({ ...f, active: e.target.checked }))} />} label="Active" /></Grid>
            </Grid>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenCredit(false)}>Close</Button>
          <Button variant="contained" onClick={saveCredit}>{editingCredit?.rule ? "Save" : "Add Rule"}</Button>
        </DialogActions>
      </Dialog>

      {/* Import */}
      <Dialog open={openImport} onClose={() => setOpenImport(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Import SLAs (JSON)</DialogTitle>
        <DialogContent dividers>
          <Alert severity="info" sx={{ mb: 2 }}>Uploads expect the same structure as the Export.</Alert>
          <input type="file" accept="application/json" onChange={(e) => setImportFile(e.target.files?.[0] || null)} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenImport(false)}>Close</Button>
          <Button variant="contained" onClick={doImport} disabled={!importFile}>Import</Button>
        </DialogActions>
      </Dialog>

      {/* Bulk */}
      <Dialog open={openBulk} onClose={() => setOpenBulk(false)} maxWidth="md" fullWidth>
        <DialogTitle>Bulk Upsert / Delete</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" sx={{ mb: 1 }}>
            Paste JSON array. For delete, you can paste <code>["sla_x","sla_y"]</code> (ids) or full objects containing <code>sla_id</code>.
          </Typography>
          <TextField multiline minRows={10} fullWidth value={bulkJson} onChange={(e) => setBulkJson(e.target.value)} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenBulk(false)}>Close</Button>
          <Button onClick={doBulkDelete} color="error">Bulk Delete</Button>
          <Button variant="contained" onClick={doBulkUpsert}>Bulk Upsert</Button>
        </DialogActions>
      </Dialog>

      {/* Test (match/simulate/effective) */}
      <Dialog open={openTest} onClose={() => setOpenTest(false)} maxWidth="md" fullWidth>
        <DialogTitle>Test SLAs</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={1.5}>
            <Stack direction="row" spacing={1}>
              <TextField select label="Mode" value={testMode} onChange={(e) => setTestMode(e.target.value)}>
                <MenuItem value="match">Match</MenuItem>
                <MenuItem value="simulate">Simulate</MenuItem>
                <MenuItem value="effective">Effective</MenuItem>
              </TextField>
              {testMode === "effective" ? (
                <TextField type="datetime-local" label="At time" value={testInput.at_time || ""} onChange={(e) => setTestInput((f) => ({ ...f, at_time: e.target.value }))} />
              ) : (
                <>
                  <TextField label="Priority" placeholder="low/normal/high/urgent" value={testInput.priority} onChange={(e) => setTestInput((f) => ({ ...f, priority: e.target.value }))} />
                  <TextField label="Severity" placeholder="sev4–sev1" value={testInput.severity} onChange={(e) => setTestInput((f) => ({ ...f, severity: e.target.value }))} />
                  <TextField label="Tags (comma)" value={testInput.tags} onChange={(e) => setTestInput((f) => ({ ...f, tags: e.target.value }))} fullWidth />
                </>
              )}
            </Stack>
            <Button variant="contained" onClick={runTest} startIcon={<TestIcon />}>Run</Button>
            {testOutput && (
              <Paper variant="outlined" sx={{ p: 2, whiteSpace: "pre-wrap", fontFamily: "monospace", fontSize: 12 }}>
                {JSON.stringify(testOutput, null, 2)}
              </Paper>
            )}
          </Stack>
        </DialogContent>
        <DialogActions><Button onClick={() => setOpenTest(false)}>Close</Button></DialogActions>
      </Dialog>

      {/* Stats & Compliance */}
      <Dialog open={openStats} onClose={() => setOpenStats(false)} maxWidth="md" fullWidth>
        <DialogTitle>Org Stats & Compliance</DialogTitle>
        <DialogContent dividers>
          {statsData ? (
            <Stack spacing={2}>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle2">Counts</Typography>
                <Typography variant="body2">Total: {statsData.total_slas} • Active: {statsData.active_slas}</Typography>
                <Typography variant="body2">By scope: {JSON.stringify(statsData.by_scope || {})}</Typography>
                <Typography variant="body2">By aggregation: {JSON.stringify(statsData.by_aggregation || {})}</Typography>
                <Typography variant="body2">With objectives: {statsData.with_objectives} • With credit rules: {statsData.with_credit_rules}</Typography>
              </Paper>
              <Divider />
              <Stack direction="row" spacing={1}>
                <TextField type="date" label="From" InputLabelProps={{ shrink: true }} value={complianceRange.from} onChange={(e) => setComplianceRange((f) => ({ ...f, from: e.target.value }))} />
                <TextField type="date" label="To" InputLabelProps={{ shrink: true }} value={complianceRange.to} onChange={(e) => setComplianceRange((f) => ({ ...f, to: e.target.value }))} />
                <Button onClick={loadCompliance}>Load Compliance</Button>
              </Stack>
              {Array.isArray(complianceData) && (
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>Compliance</Typography>
                  <Table size="small">
                    <TableHead><TableRow><TableCell>SLA</TableCell><TableCell>Total</TableCell><TableCell>Met</TableCell><TableCell>Breached</TableCell><TableCell>In Progress</TableCell><TableCell>Rate %</TableCell></TableRow></TableHead>
                    <TableBody>
                      {complianceData.map((r) => (
                        <TableRow key={r.sla_id}>
                          <TableCell>{r.sla_name}</TableCell>
                          <TableCell>{r.total_tickets}</TableCell>
                          <TableCell>{r.met}</TableCell>
                          <TableCell>{r.breached}</TableCell>
                          <TableCell>{r.in_progress}</TableCell>
                          <TableCell>{r.compliance_rate}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Paper>
              )}
            </Stack>
          ) : <LinearProgress />}
        </DialogContent>
        <DialogActions><Button onClick={() => setOpenStats(false)}>Close</Button></DialogActions>
      </Dialog>

      {/* Versions */}
      <Dialog open={openVersions} onClose={() => setOpenVersions(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Versions {versionsOf.sla ? `• ${versionsOf.sla.name}` : ""}</DialogTitle>
        <DialogContent dividers>
          {Array.isArray(versionsOf.list) && versionsOf.list.length ? (
            <Table size="small">
              <TableHead><TableRow><TableCell>Version</TableCell><TableCell>Active</TableCell><TableCell>Effective</TableCell></TableRow></TableHead>
              <TableBody>
                {versionsOf.list.map((v) => (
                  <TableRow key={v.sla_id}><TableCell>{v.version}</TableCell><TableCell>{v.active ? "Yes" : "No"}</TableCell><TableCell>{v.effective_from || "—"}</TableCell></TableRow>
                ))}
              </TableBody>
            </Table>
          ) : <Typography variant="body2" color="text.secondary">No versions found.</Typography>}
        </DialogContent>
        <DialogActions><Button onClick={() => setOpenVersions(false)}>Close</Button></DialogActions>
      </Dialog>

      {/* Dependencies */}
      <Dialog open={openDeps} onClose={() => setOpenDeps(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Dependencies</DialogTitle>
        <DialogContent dividers>
          {depsInfo ? (
            <Stack spacing={1}>
              <Typography variant="body2">Active tickets: <b>{depsInfo.active_tickets}</b></Typography>
              <Typography variant="body2">Can delete: <b>{depsInfo.can_delete ? "Yes" : "No"}</b></Typography>
              <Typography variant="subtitle2" sx={{ mt: 1 }}>Sample Ticket IDs</Typography>
              <Paper variant="outlined" sx={{ p: 1, fontFamily: "monospace", fontSize: 12 }}>
                {depsInfo.affected_ticket_ids?.join("\n") || "—"}
              </Paper>
            </Stack>
          ) : <LinearProgress />}
        </DialogContent>
        <DialogActions><Button onClick={() => setOpenDeps(false)}>Close</Button></DialogActions>
      </Dialog>

      {/* Cleanup */}
      <Dialog open={openCleanup} onClose={() => setOpenCleanup(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Cleanup old inactive SLAs</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={1.5}>
            <Stack direction="row" spacing={1}>
              <TextField label="Older than days" type="number" value={cleanupOpts.days} onChange={(e) => setCleanupOpts((f) => ({ ...f, days: e.target.value }))} />
              <FormControlLabel control={<Checkbox checked={!!cleanupOpts.dry} onChange={(e) => setCleanupOpts((f) => ({ ...f, dry: e.target.checked }))} />} label="Dry run" />
              <Button onClick={doCleanup} startIcon={<CleanupIcon />}>Run</Button>
            </Stack>
            {cleanupResult && (
              <Paper variant="outlined" sx={{ p: 2 }}>
                <pre style={{ margin: 0, fontFamily: "monospace", fontSize: 12 }}>{JSON.stringify(cleanupResult, null, 2)}</pre>
              </Paper>
            )}
          </Stack>
        </DialogContent>
        <DialogActions><Button onClick={() => setOpenCleanup(false)}>Close</Button></DialogActions>
      </Dialog>
    </Stack>
  );
}

/* ---------- small tables (reused) ---------- */
function ObjectivesTable({ slaId, onEdit, onDelete }) {
  const { objectivesBySla, listObjectives } = useMakingSLA();
  useEffect(() => { if (slaId) listObjectives(slaId); }, [slaId, listObjectives]);
  const rows = objectivesBySla[slaId] || [];
  return (
    <Paper variant="outlined" sx={{ borderRadius: 2 }}>
      <Table size="small">
        <TableHead><TableRow><TableCell>Objective</TableCell><TableCell>Target (min)</TableCell><TableCell>Breach thresholds</TableCell><TableCell>Status</TableCell><TableCell align="right" sx={{ width: 120 }}>Actions</TableCell></TableRow></TableHead>
        <TableBody>
          {rows.map((o) => (
            <TableRow key={o.objective_id} hover>
              <TableCell>{o.objective}</TableCell>
              <TableCell>{o.target_minutes}</TableCell>
              <TableCell><Stack direction="row" spacing={0.5} flexWrap="wrap">{Object.entries(o.breach_grades || {}).map(([k, v]) => <Chip key={k} size="small" label={`${k}:${v}`} />)}</Stack></TableCell>
              <TableCell><Chip size="small" color={o.active ? "success" : "default"} label={o.active ? "ACTIVE" : "INACTIVE"} /></TableCell>
              <TableCell align="right">
                <IconButton size="small" onClick={() => onEdit(o)}><EditIcon fontSize="small" /></IconButton>
                <IconButton size="small" color="error" onClick={() => onDelete(o.objective_id)}><DeleteIcon fontSize="small" /></IconButton>
              </TableCell>
            </TableRow>
          ))}
          {rows.length === 0 && (<TableRow><TableCell colSpan={5}><Typography variant="body2" color="text.secondary" sx={{ p: 1 }}>No objectives yet.</Typography></TableCell></TableRow>)}
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
        <TableHead><TableRow><TableCell>Objective</TableCell><TableCell>Grade</TableCell><TableCell>Credit</TableCell><TableCell>Caps</TableCell><TableCell>Status</TableCell><TableCell align="right" sx={{ width: 120 }}>Actions</TableCell></TableRow></TableHead>
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
          {rows.length === 0 && (<TableRow><TableCell colSpan={6}><Typography variant="body2" color="text.secondary" sx={{ p: 1 }}>No credit rules yet.</Typography></TableCell></TableRow>)}
        </TableBody>
      </Table>
    </Paper>
  );
}
