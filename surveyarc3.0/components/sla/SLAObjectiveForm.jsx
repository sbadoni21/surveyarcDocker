import React, { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Stack,
  Divider,
  Grid,
  TextField,
  MenuItem,
  FormControlLabel,
  Checkbox,
  Typography,
  Tooltip,
  Paper,
  IconButton,
  Chip,
} from "@mui/material";
import InfoIcon from "@mui/icons-material/Info";

export default function ObjectivesDialog({
  open,
  onClose,
  editingObjective,
  DIMENSIONS,
  BREACH_GRADES,
  ObjectivesTable,
  onEditObjective,
  onDeleteObjective,
  onSaveObjective,
}) {
  const [objectiveForm, setObjectiveForm] = useState({
    objective: "",
    target_minutes: "",
    active: true,
    breach_grades: {},
  });

  const [touched, setTouched] = useState({});

  useEffect(() => {
    if (editingObjective?.obj) {
      const obj = editingObjective.obj;
      setObjectiveForm({
        objective: obj.objective || "",
        target_minutes: obj.target_minutes ?? "",
        active: typeof obj.active === "boolean" ? obj.active : true,
        breach_grades: obj.breach_grades ? { ...obj.breach_grades } : {},
      });
    } else {
      setObjectiveForm({ objective: "", target_minutes: "", active: true, breach_grades: {} });
    }
    setTouched({});
  }, [editingObjective, open]);

  // small helpers to call parent callbacks
  const editObjective = (sla, obj) => { if (onEditObjective) onEditObjective(sla, obj); };
  const deleteObjective = (slaId, objectiveId) => { if (onDeleteObjective) onDeleteObjective(slaId, objectiveId); };

  // validation
  const errors = useMemo(() => {
    const e = {};
    if (!objectiveForm.objective) e.objective = "Choose an objective (what metric this measures).";
    if (objectiveForm.target_minutes === "" || Number(objectiveForm.target_minutes) <= 0) e.target_minutes = "Target minutes must be a positive number.";
    Object.entries(objectiveForm.breach_grades || {}).forEach(([k, v]) => {
      if (v !== undefined && Number.isNaN(Number(v))) e[`breach_${k}`] = "Must be a number.";
      else if (v !== undefined && Number(v) < 0) e[`breach_${k}`] = "Must be 0 or greater.";
    });
    return e;
  }, [objectiveForm]);

  const canSave = Object.keys(errors).length === 0 && objectiveForm.objective && objectiveForm.target_minutes !== "";

  // human friendly label for selected objective
  const selectedObjectiveLabel = useMemo(() => {
    const d = DIMENSIONS?.find((x) => x.value === objectiveForm.objective);
    return d ? d.label : objectiveForm.objective || "—";
  }, [objectiveForm.objective, DIMENSIONS]);

  const saveObjective = async () => {
    setTouched({ objective: true, target_minutes: true, breach: true });
    if (!canSave) return;
    if (onSaveObjective) {
      try {
        await onSaveObjective({
          ...objectiveForm,
          target_minutes: Number(objectiveForm.target_minutes),
          breach_grades: Object.fromEntries(
            Object.entries(objectiveForm.breach_grades || {}).filter(([, v]) => v !== undefined && v !== "")
              .map(([k, v]) => [k, Number(v)])
          ),
        }, editingObjective?.sla);
      } catch (err) {
        console.error("Failed to save objective", err);
      }
    }
    onClose();
  };

  // compact display of breach grades
  const breachPreview = useMemo(() => {
    const items = Object.entries(objectiveForm.breach_grades || {})
      .filter(([, v]) => v !== undefined && v !== "")
      .map(([k, v]) => `${k}: ${v}m`);
    return items;
  }, [objectiveForm.breach_grades]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth aria-labelledby="objective-dialog-title">
      <DialogTitle id="objective-dialog-title">
        {editingObjective?.obj ? "Edit Objective" : "Add Objective"}{" "}
        {editingObjective?.sla ? <Typography component="span" sx={{ color: "text.secondary" }}>• {editingObjective.sla.name}</Typography> : null}
      </DialogTitle>

      <DialogContent dividers>
        <Stack spacing={2}>
          {/* --- Top explanatory panel --- */}
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Stack spacing={1}>
              <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                <Typography variant="subtitle1">What is an Objective?</Typography>
                <Tooltip title="Objectives define the metric and target that the SLA will measure for tickets.">
                  <IconButton size="small"><InfoIcon fontSize="small" /></IconButton>
                </Tooltip>
              </Stack>
              <Typography variant="body2" color="text.secondary">
                An objective ties a measurable metric (like first response or resolution) to a target time. When the target is missed,
                the SLA marks tickets as breached according to the breach thresholds below. Use clear targets to make SLAs enforceable.
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Tip: Keep targets realistic — short targets increase operational pressure, longer targets reduce responsiveness.
              </Typography>
            </Stack>
          </Paper>

          {/* --- Existing objectives table (if SLA provided) --- */}
          {editingObjective?.sla && (
            <Stack spacing={1}>
              <Typography variant="subtitle2">Existing objectives for this SLA</Typography>
              <ObjectivesTable
                slaId={editingObjective.sla.sla_id}
                onEdit={(obj) => editObjective(editingObjective.sla, obj)}
                onDelete={(objectiveId) => deleteObjective(editingObjective.sla.sla_id, objectiveId)}
              />
            </Stack>
          )}

          <Divider />

          {/* --- Form area --- */}
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Stack spacing={1}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography variant="subtitle2">Objective</Typography>
                  <Tooltip title="Choose which metric this objective tracks (first response, resolution, etc.)">
                    <IconButton size="small"><InfoIcon fontSize="small" /></IconButton>
                  </Tooltip>
                </Stack>

                <TextField
                  label="Objective (metric)"
                  select
                  fullWidth
                  autoFocus
                  value={objectiveForm.objective}
                  onChange={(e) => setObjectiveForm((f) => ({ ...f, objective: e.target.value }))}
                  error={!!(touched.objective && errors.objective)}
                  helperText={(touched.objective && errors.objective) || "Select a metric. Example: First Response = time until first reply."}
                  onBlur={() => setTouched((t) => ({ ...t, objective: true }))}
                >
                  <MenuItem value="">
                    <em>Choose objective</em>
                  </MenuItem>
                  {DIMENSIONS.map((d) => (
                    <MenuItem key={d.value} value={d.value}>
                      {d.label}
                    </MenuItem>
                  ))}
                </TextField>

                <Typography variant="caption" color="text.secondary">
                  Selected: <strong>{selectedObjectiveLabel}</strong>
                </Typography>
              </Stack>
            </Grid>

            <Grid item xs={12} md={6}>
              <Stack spacing={1}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography variant="subtitle2">Target</Typography>
                  <Tooltip title="Time in minutes that you expect the metric to meet.">
                    <IconButton size="small"><InfoIcon fontSize="small" /></IconButton>
                  </Tooltip>
                </Stack>

                <TextField
                  label="Target (minutes)"
                  type="number"
                  fullWidth
                  placeholder="e.g. 30"
                  value={objectiveForm.target_minutes}
                  onChange={(e) => setObjectiveForm((f) => ({ ...f, target_minutes: e.target.value }))}
                  error={!!(touched.target_minutes && errors.target_minutes)}
                  helperText={(touched.target_minutes && errors.target_minutes) || "Enter the target time in minutes (positive)."}
                  onBlur={() => setTouched((t) => ({ ...t, target_minutes: true }))}
                />

                <FormControlLabel
                  control={
                    <Checkbox
                      checked={!!objectiveForm.active}
                      onChange={(e) => setObjectiveForm((f) => ({ ...f, active: e.target.checked }))}
                    />
                  }
                  label="Active"
                />
                <Typography variant="caption" color="text.secondary">Toggle whether this objective is currently enforced.</Typography>
              </Stack>
            </Grid>
          </Grid>

          <Divider />

          {/* --- Breach thresholds --- */}
          <Stack spacing={1}>
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Typography variant="subtitle2">Breach thresholds</Typography>
              <Typography variant="caption" color="text.secondary">Minutes beyond target that map to breach severity.</Typography>
            </Stack>

            <Grid container spacing={2}>
              {BREACH_GRADES.map((g) => (
                <Grid key={g} item xs={12} sm={4}>
                  <TextField
                    label={`${g} (minutes)`}
                    type="number"
                    fullWidth
                    value={objectiveForm.breach_grades?.[g] ?? ""}
                    onChange={(e) =>
                      setObjectiveForm((f) => ({ ...f, breach_grades: { ...(f.breach_grades || {}), [g]: e.target.value !== "" ? e.target.value : undefined } }))
                    }
                    onBlur={() => setTouched((t) => ({ ...t, breach: true }))}
                    error={!!errors[`breach_${g}`]}
                    helperText={errors[`breach_${g}`] || "Leave blank to skip this grade."}
                    placeholder="e.g. 15"
                  />
                </Grid>
              ))}
            </Grid>

            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="caption" color="text.secondary">Preview:</Typography>
              {breachPreview.length ? breachPreview.map((b) => <Chip key={b} size="small" label={b} />) : <Typography variant="caption" color="text.secondary">No thresholds set.</Typography>}
            </Stack>
          </Stack>

          <Divider />

          {/* --- Guidance & examples --- */}
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle2">Examples & guidance</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              • <strong>First Response</strong>: Target 15m, minor 30m, major 60m – use for fast customer-facing services.<br />
              • <strong>Resolution</strong>: Target 480m (8h), minor 1440m (24h) – use for full resolution times.<br />
              • Leave a breach grade empty to not use that level.
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
              Pro tip: Keep one objective per metric per SLA to avoid conflicting rules.
            </Typography>
          </Paper>
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={saveObjective} variant="contained" disabled={!canSave}>
          {editingObjective?.obj ? "Save changes" : "Add objective"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
