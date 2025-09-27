// components/tickets/TicketForm.jsx
"use client";
import { useEffect, useState, useMemo } from "react";
import { 
  Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, 
  FormControlLabel, MenuItem, Stack, TextField, Typography, Alert, Chip 
} from "@mui/material";
import { AccessTime } from "@mui/icons-material";
import AssigneeSelect from "./AssigneeSelect";
import GroupSelect from "./GroupSelect";
import CollaboratorsSelect from "./CollaboratorsSelect";
import TeamMultiSelect from "./TeamMultiSelect";
import AgentMultiSelect from "./AgentMultiSelect";
import { useSLA } from "@/providers/slaProvider";

const PRIORITIES = ["low", "normal", "high", "urgent", "blocker"];
const SEVERITIES = ["sev4", "sev3", "sev2", "sev1"];

const formatMinutes = (minutes) => {
  if (!minutes) return "";
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  return `${Math.floor(minutes / 1440)}d ${Math.floor((minutes % 1440) / 60)}h`;
};

const calculateDueDate = (minutes, businessHoursOnly = false) => {
  if (!minutes) return null;
  const now = new Date();
  const dueDate = new Date(now.getTime() + (minutes * 60 * 1000));
  return dueDate.toISOString();
};

// Helper function to get SLA targets from priority/severity maps
const getSLATargets = (sla, priority, severity) => {
  if (!sla) return null;

  const targets = {
    first_response: sla.first_response_minutes,
    resolution: sla.resolution_minutes
  };

  // Check priority_map and severity_map in target_matrix
  if (sla.target_matrix) {
    let priorityResolution = null;
    let severityResolution = null;

    // Get resolution time from priority_map
    if (sla.target_matrix.priority_map && sla.target_matrix.priority_map[priority]) {
      priorityResolution = sla.target_matrix.priority_map[priority];
    }

    // Get resolution time from severity_map  
    if (sla.target_matrix.severity_map && sla.target_matrix.severity_map[severity]) {
      severityResolution = sla.target_matrix.severity_map[severity];
    }

    // Use the most restrictive (shortest) time between priority and severity
    if (priorityResolution && severityResolution) {
      targets.resolution = Math.min(priorityResolution, severityResolution);
    } else if (priorityResolution) {
      targets.resolution = priorityResolution;
    } else if (severityResolution) {
      targets.resolution = severityResolution;
    }
  }

  return targets;
};

// Helper function to get available options from SLA maps
const getAvailableOptionsFromSLA = (sla, type) => {
  if (!sla || !sla.target_matrix) {
    return type === 'priority' ? PRIORITIES : SEVERITIES;
  }

  if (type === 'priority' && sla.target_matrix.priority_map) {
    return Object.keys(sla.target_matrix.priority_map);
  }
  
  if (type === 'severity' && sla.target_matrix.severity_map) {
    return Object.keys(sla.target_matrix.severity_map);
  }

  return type === 'priority' ? PRIORITIES : SEVERITIES;
};

export default function TicketForm({ open, onClose, onSubmit, initial, orgId, requestorId, title = "New Ticket", currentUserId }) {
  const { listSLAs, slasByOrg } = useSLA();
  const allSLAOptions = slasByOrg[orgId] || [];

  const [form, setForm] = useState(() => ({
    subject: initial?.subject || "",
    description: initial?.description || "",
    priority: initial?.priority || "normal",
    severity: initial?.severity || "sev4",
    queueOwned: Boolean(!initial?.assigneeId && initial?.groupId),
    groupId: initial?.groupId || "",
    teamIds: initial?.teamIds || [],
    agentIds: initial?.agentIds || [],
    assigneeId: initial?.assigneeId || "",
    // classification
    category: initial?.category || "",
    subcategory: initial?.subcategory || "",
    productId: initial?.productId || "",

    // SLA / due
    slaId: initial?.slaId || "",
    dueAt: initial?.dueAt || "",
    firstResponseDueAt: initial?.firstResponseDueAt || "",
    resolutionDueAt: initial?.resolutionDueAt || "",

    // tags
    tagsCsv: (initial?.tags || []).map((t) => t.tag_id || t).join(","),

    // collaborators
    collaborators: [],
  }));

  const [saving, setSaving] = useState(false);
  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const isQueueOwned = form.queueOwned === true;

  // Get available SLAs (filter by group if needed)
  const availableSLAOptions = useMemo(() => {
    return allSLAOptions.filter(sla => {
      if (!sla.active) return false;
      
      // Check group filter if SLA has group restrictions
      if (sla.rules && sla.rules.applies_to && sla.rules.applies_to.group_id_in) {
        if (!form.groupId || !sla.rules.applies_to.group_id_in.includes(form.groupId)) {
          return false;
        }
      }
      
      return true;
    });
  }, [allSLAOptions, form.groupId]);

  // Get available priorities/severities based on selected SLA
  const getAvailableOptions = (sla, type) => {
    if (!sla || !sla.rules || !sla.rules.applies_to) {
      return type === 'priority' ? PRIORITIES : SEVERITIES;
    }
    
    const applies_to = sla.rules.applies_to;
    if (type === 'priority' && applies_to.priority_in) {
      return applies_to.priority_in;
    }
    if (type === 'severity' && applies_to.severity_in) {
      return applies_to.severity_in;
    }
    
    return type === 'priority' ? PRIORITIES : SEVERITIES;
  };

  // Get current SLA details
  const selectedSLA = availableSLAOptions.find(sla => sla.sla_id === form.slaId);
  const availablePriorities = selectedSLA ? getAvailableOptionsFromSLA(selectedSLA, 'priority') : PRIORITIES;
  const availableSeverities = selectedSLA ? getAvailableOptionsFromSLA(selectedSLA, 'severity') : SEVERITIES;
  const slaTargets = selectedSLA ? getSLATargets(selectedSLA, form.priority, form.severity) : null;

  // Check if current priority/severity is valid for selected SLA
  const isPriorityValid = availablePriorities.includes(form.priority);
  const isSeverityValid = availableSeverities.includes(form.severity);

  // Auto-adjust priority/severity when SLA changes if current selection is invalid
  useEffect(() => {
    if (selectedSLA) {
      if (!isPriorityValid && availablePriorities.length > 0) {
        // Reset to first available priority
        setForm(f => ({ ...f, priority: availablePriorities[0] }));
      }
      if (!isSeverityValid && availableSeverities.length > 0) {
        // Reset to first available severity  
        setForm(f => ({ ...f, severity: availableSeverities[0] }));
      }
    }
  }, [selectedSLA, isPriorityValid, isSeverityValid, availablePriorities, availableSeverities]);

  // Get resolution times for display
  const getPriorityResolutionTime = (priority) => {
    if (!selectedSLA || !selectedSLA.target_matrix || !selectedSLA.target_matrix.priority_map) return null;
    return selectedSLA.target_matrix.priority_map[priority];
  };

  const getSeverityResolutionTime = (severity) => {
    if (!selectedSLA || !selectedSLA.target_matrix || !selectedSLA.target_matrix.severity_map) return null;
    return selectedSLA.target_matrix.severity_map[severity];
  };

  // Update due dates when SLA or priority/severity changes
  useEffect(() => {
    if (selectedSLA && slaTargets) {
      const firstResponseDue = calculateDueDate(slaTargets.first_response);
      const resolutionDue = calculateDueDate(slaTargets.resolution);
      
      setForm(f => ({
        ...f,
        firstResponseDueAt: firstResponseDue || "",
        resolutionDueAt: resolutionDue || ""
      }));
    } else {
      setForm(f => ({
        ...f,
        firstResponseDueAt: "",
        resolutionDueAt: ""
      }));
    }
  }, [selectedSLA, slaTargets]);

  useEffect(() => {
    if (isQueueOwned && form.assigneeId) setForm((f) => ({ ...f, assigneeId: "" }));
  }, [isQueueOwned]);

  // Reset teams & agentIds when group changes
  useEffect(() => {
    setForm((f) => ({ ...f, teamIds: [], agentIds: [] }));
  }, [form.groupId]);

  const subjectOK = form.subject.trim().length > 0;
  const groupOK = !isQueueOwned || (isQueueOwned && form.groupId.trim().length > 0);
  const canSave = subjectOK && groupOK;

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const tagIds = form.tagsCsv.split(",").map((s) => s.trim()).filter(Boolean);
      const payload = {
        orgId,
        requesterId: requestorId,
        subject: form.subject.trim(),
        description: form.description || "",
        priority: form.priority,
        severity: form.severity,

        groupId: form.groupId || null,
        teamIds: form.teamIds || [],
        agentIds: form.agentIds || [],
        assigneeId: isQueueOwned ? null : (form.assigneeId || null),

        category: form.category || null,
        subcategory: form.subcategory || null,
        productId: form.productId || null,
        
        // Enhanced SLA data
        slaId: form.slaId || null,
        dueAt: form.dueAt || null,
        firstResponseDueAt: form.firstResponseDueAt || null,
        resolutionDueAt: form.resolutionDueAt || null,
        
        tags: tagIds.length ? tagIds : undefined,
      };
      const created = await onSubmit(payload);
      onClose?.();
      return created;
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (open && orgId) {
      listSLAs(orgId).catch(() => {});
    }
  }, [open, orgId, listSLAs]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={1.5} sx={{ mt: 1 }}>
          <TextField 
            label="Subject" 
            value={form.subject} 
            onChange={(e) => update("subject", e.target.value)} 
            fullWidth 
            required 
          />
          <TextField 
            label="Description" 
            value={form.description} 
            onChange={(e) => update("description", e.target.value)} 
            fullWidth 
            multiline 
            minRows={3} 
          />

          <FormControlLabel
            control={<Checkbox checked={isQueueOwned} onChange={(e) => update("queueOwned", e.target.checked)} />}
            label="Create in a Group Queue (no direct assignee)"
          />

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <Box sx={{ flex: 1, minWidth: 220 }}>
              <GroupSelect orgId={orgId} value={form.groupId} onChange={(v) => update("groupId", v)} />
            </Box>
            <Box sx={{ flex: 1, minWidth: 240 }}>
              <AssigneeSelect
                orgId={orgId}
                groupId={form.groupId || undefined}
                value={form.assigneeId}
                onChange={(v) => update("assigneeId", v)}
                label="Assignee"
                placeholder={isQueueOwned ? "Disabled (queue-owned)" : "Select assignee"}
                disabled={isQueueOwned}
              />
            </Box>
          </Stack>
          {!groupOK && <Typography variant="caption" color="error">Group is required when creating a queue-owned ticket.</Typography>}

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <Box sx={{ flex: 1, minWidth: 220 }}>
              <TeamMultiSelect
                groupId={form.groupId || undefined}
                value={form.teamIds}
                onChange={(arr) => update("teamIds", arr)}
                label="Teams (within group)"
                disabled={!form.groupId}
              />
            </Box>
            <Box sx={{ flex: 1, minWidth: 240 }}>
              <AgentMultiSelect
                orgId={orgId}
                groupId={form.groupId || undefined}
                value={form.agentIds}
                onChange={(arr) => update("agentIds", arr)}
                label="Agents (within group)"
                disabled={!form.groupId}
              />
            </Box>
          </Stack>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <TextField 
              label="Category" 
              value={form.category} 
              onChange={(e) => update("category", e.target.value)} 
              fullWidth 
            />
            <TextField 
              label="Subcategory" 
              value={form.subcategory} 
              onChange={(e) => update("subcategory", e.target.value)} 
              fullWidth 
            />
          </Stack>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <TextField 
              label="Priority" 
              select 
              fullWidth 
              value={form.priority} 
              onChange={(e) => update("priority", e.target.value)}
              disabled={!selectedSLA}
              error={selectedSLA && !isPriorityValid}
              helperText={
                selectedSLA 
                  ? `Select priority level for ${selectedSLA.name}`
                  : "Select an SLA first to choose priority"
              }
            >
              {availablePriorities.map((p) => {
                const resolutionTime = getPriorityResolutionTime(p);
                return (
                  <MenuItem key={p} value={p}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                      <Typography component="span">
                        {p.toUpperCase()}
                      </Typography>
                      {resolutionTime && (
                        <Chip 
                          size="small" 
                          label={formatMinutes(resolutionTime)}
                          color="primary"
                          variant="outlined"
                        />
                      )}
                    </Box>
                  </MenuItem>
                );
              })}
            </TextField>
            <TextField 
              label="Severity" 
              select 
              fullWidth 
              value={form.severity} 
              onChange={(e) => update("severity", e.target.value)}
              disabled={!selectedSLA}
              error={selectedSLA && !isSeverityValid}
              helperText={
                selectedSLA 
                  ? `Select severity level for ${selectedSLA.name}`
                  : "Select an SLA first to choose severity"
              }
            >
              {availableSeverities.map((s) => {
                const resolutionTime = getSeverityResolutionTime(s);
                return (
                  <MenuItem key={s} value={s}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                      <Typography component="span">
                        {s.toUpperCase()}
                      </Typography>
                      {resolutionTime && (
                        <Chip 
                          size="small" 
                          label={formatMinutes(resolutionTime)}
                          color="secondary"
                          variant="outlined"
                        />
                      )}
                    </Box>
                  </MenuItem>
                );
              })}
            </TextField>
          </Stack>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <TextField 
              label="Product ID" 
              value={form.productId} 
              onChange={(e) => update("productId", e.target.value)} 
              fullWidth 
            />
          </Stack>

          {/* SLA Selection - Move this up to be selected first */}
          <TextField
            select
            label="SLA Policy"
            fullWidth
            value={form.slaId}
            onChange={(e) => update("slaId", e.target.value)}
            helperText="Choose an SLA policy to see available priority and severity options"
          >
            <MenuItem key="" value="">
              <Box>
                <Typography component="span" color="text.secondary">
                  None - No SLA requirements
                </Typography>
              </Box>
            </MenuItem>
            {availableSLAOptions.map((sla) => {
              const priorityOptions = sla.target_matrix?.priority_map ? Object.keys(sla.target_matrix.priority_map) : [];
              const severityOptions = sla.target_matrix?.severity_map ? Object.keys(sla.target_matrix.severity_map) : [];
              
              return (
                <MenuItem key={sla.sla_id} value={sla.sla_id}>
                  <Box sx={{ width: '100%' }}>
                    <Typography component="span" sx={{ fontWeight: 'medium' }}>
                      {sla.name}
                    </Typography>
                    {sla.description && (
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                        {sla.description}
                      </Typography>
                    )}
                    
                    {/* Show baseline times if available */}
                    <Box sx={{ display: 'flex', gap: 1, mt: 0.5, flexWrap: 'wrap' }}>
                      {sla.first_response_minutes && (
                        <Chip 
                          size="small" 
                          icon={<AccessTime />}
                          label={`FR: ${formatMinutes(sla.first_response_minutes)}`}
                          variant="outlined"
                          color="primary"
                        />
                      )}
                      {sla.resolution_minutes && (
                        <Chip 
                          size="small" 
                          icon={<AccessTime />}
                          label={`Base RES: ${formatMinutes(sla.resolution_minutes)}`}
                          variant="outlined"
                          color="secondary"
                        />
                      )}
                    </Box>

                    {/* Show available priorities and severities */}
                    {(priorityOptions.length > 0 || severityOptions.length > 0) && (
                      <Box sx={{ mt: 1 }}>
                        {priorityOptions.length > 0 && (
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                            <strong>Priorities:</strong> {priorityOptions.map(p => p.toUpperCase()).join(', ')}
                          </Typography>
                        )}
                        {severityOptions.length > 0 && (
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                            <strong>Severities:</strong> {severityOptions.map(s => s.toUpperCase()).join(', ')}
                          </Typography>
                        )}
                      </Box>
                    )}
                  </Box>
                </MenuItem>
              );
            })}
          </TextField>

          {/* SLA Status and Real-time Calculation */}
          {selectedSLA && isPriorityValid && isSeverityValid && (
            <Alert severity="success" sx={{ mt: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Active SLA: {selectedSLA.name} ({form.priority.toUpperCase()}/{form.severity.toUpperCase()})
              </Typography>
              
              <Stack direction="row" spacing={3} flexWrap="wrap" sx={{ mt: 1 }}>
                {slaTargets && slaTargets.first_response && (
                  <Box>
                    <Typography variant="body2" color="primary">
                      <strong>First Response:</strong> {formatMinutes(slaTargets.first_response)}
                    </Typography>
                    {form.firstResponseDueAt && (
                      <Typography variant="caption" color="text.secondary">
                        Due: {new Date(form.firstResponseDueAt).toLocaleString()}
                      </Typography>
                    )}
                  </Box>
                )}
                
                {slaTargets && slaTargets.resolution && (
                  <Box>
                    <Typography variant="body2" color="secondary">
                      <strong>Resolution:</strong> {formatMinutes(slaTargets.resolution)}
                    </Typography>
                    {form.resolutionDueAt && (
                      <Typography variant="caption" color="text.secondary">
                        Due: {new Date(form.resolutionDueAt).toLocaleString()}
                      </Typography>
                    )}
                  </Box>
                )}
              </Stack>

              {/* Show breakdown of how resolution time was calculated */}
              {selectedSLA.target_matrix && (
                <Box sx={{ mt: 2, p: 1, bgcolor: 'rgba(0,0,0,0.02)', borderRadius: 1 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 'medium' }}>
                    Resolution Time Calculation:
                  </Typography>
                  <Stack direction="row" spacing={2} sx={{ mt: 0.5 }}>
                    {getPriorityResolutionTime(form.priority) && (
                      <Typography variant="caption" color="text.secondary">
                        Priority {form.priority.toUpperCase()}: {formatMinutes(getPriorityResolutionTime(form.priority))}
                      </Typography>
                    )}
                    {getSeverityResolutionTime(form.severity) && (
                      <Typography variant="caption" color="text.secondary">
                        Severity {form.severity.toUpperCase()}: {formatMinutes(getSeverityResolutionTime(form.severity))}
                      </Typography>
                    )}
                    {getPriorityResolutionTime(form.priority) && getSeverityResolutionTime(form.severity) && (
                      <Typography variant="caption" color="primary" sx={{ fontWeight: 'medium' }}>
                        → Using shortest: {formatMinutes(slaTargets.resolution)}
                      </Typography>
                    )}
                  </Stack>
                </Box>
              )}
            </Alert>
          )}

          {selectedSLA && (!isPriorityValid || !isSeverityValid) && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Invalid SLA Configuration
              </Typography>
              <Typography variant="body2">
                The selected SLA "{selectedSLA.name}" doesn't support the current priority/severity combination.
              </Typography>
              <Box sx={{ mt: 1 }}>
                <Typography variant="body2">
                  <strong>Available Priorities:</strong> {availablePriorities.map(p => p.toUpperCase()).join(', ')}
                </Typography>
                <Typography variant="body2">
                  <strong>Available Severities:</strong> {availableSeverities.map(s => s.toUpperCase()).join(', ')}
                </Typography>
              </Box>
            </Alert>
          )}

          {!selectedSLA && (
            <Alert severity="info" sx={{ mt: 2 }}>
              <Typography variant="body2">
                <strong>Select an SLA Policy above</strong> to set automatic response and resolution targets based on priority and severity levels.
              </Typography>
            </Alert>
          )}

          <TextField 
            label="Custom Due Date (ISO)" 
            value={form.dueAt} 
            onChange={(e) => update("dueAt", e.target.value)} 
            fullWidth 
            placeholder="2025-09-25T17:30:00Z" 
            helperText="Optional custom due date (overrides SLA)"
          />

          <TextField 
            label="Tag IDs (comma-separated)" 
            value={form.tagsCsv} 
            onChange={(e) => update("tagsCsv", e.target.value)} 
            fullWidth 
            placeholder="tag_vip,tag_bug" 
          />

          <CollaboratorsSelect 
            orgId={orgId} 
            value={form.collaborators} 
            onChange={(arr) => update("collaborators", arr)} 
          />
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={saving}>Cancel</Button>
        <Button onClick={handleSubmit} variant="contained" disabled={saving || !canSave}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}