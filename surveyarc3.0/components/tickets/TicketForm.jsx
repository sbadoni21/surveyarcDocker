// components/tickets/TicketForm.jsx
"use client";
import { useEffect, useState, useMemo } from "react";
import { 
  Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, 
  FormControlLabel, MenuItem, Stack, TextField, Typography, Alert, Chip,
  RadioGroup, Radio, FormControl, FormLabel, Divider, Autocomplete, Avatar
} from "@mui/material";
import { AccessTime, CalendarToday, Schedule } from "@mui/icons-material";
import AssigneeSelect from "./AssigneeSelect";
import GroupSelect from "./GroupSelect";
import CollaboratorsSelect from "./CollaboratorsSelect";
import TeamMultiSelect from "./TeamMultiSelect";
import AgentMultiSelect from "./AgentMultiSelect";
import { useSLA } from "@/providers/slaProvider";
import { useBusinessCalendars } from "@/providers/BusinessCalendarsProvider";

const formatMinutes = (minutes) => {
  if (!minutes) return "";
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  return `${Math.floor(minutes / 1440)}d ${Math.floor((minutes % 1440) / 60)}h`;
};

const calculateDueDateWithBusinessHours = (minutes, businessCalendar = null) => {
  if (!minutes) return null;
  
  const now = new Date();
  
  // If no calendar or no working hours defined, use simple calculation
  if (!businessCalendar?.working_hours) {
    return new Date(now.getTime() + (minutes * 60 * 1000)).toISOString();
  }
  
  let remainingMinutes = minutes;
  let currentDate = new Date(now);
  
  const workingHours = businessCalendar.working_hours;
  const workingDays = businessCalendar.working_days || [1, 2, 3, 4, 5]; // Mon-Fri
  const holidays = businessCalendar.holidays || [];
  
  while (remainingMinutes > 0) {
    const dayOfWeek = currentDate.getDay();
    const currentDateStr = currentDate.toISOString().split('T')[0]; // YYYY-MM-DD
    
    // Skip holidays
    if (holidays.some(holiday => holiday.date === currentDateStr)) {
      currentDate.setDate(currentDate.getDate() + 1);
      currentDate.setHours(workingHours.start_hour || 9, workingHours.start_minute || 0, 0, 0);
      continue;
    }
    
    // Skip non-working days
    if (!workingDays.includes(dayOfWeek)) {
      currentDate.setDate(currentDate.getDate() + 1);
      currentDate.setHours(workingHours.start_hour || 9, workingHours.start_minute || 0, 0, 0);
      continue;
    }
    
    const timeOfDay = currentDate.getHours() * 60 + currentDate.getMinutes();
    const workStart = (workingHours.start_hour || 9) * 60 + (workingHours.start_minute || 0);
    const workEnd = (workingHours.end_hour || 17) * 60 + (workingHours.end_minute || 0);
    
    // If before work hours, jump to start of work day
    if (timeOfDay < workStart) {
      currentDate.setHours(workingHours.start_hour || 9, workingHours.start_minute || 0, 0, 0);
      continue;
    }
    
    // If after work hours, jump to next work day
    if (timeOfDay >= workEnd) {
      currentDate.setDate(currentDate.getDate() + 1);
      currentDate.setHours(workingHours.start_hour || 9, workingHours.start_minute || 0, 0, 0);
      continue;
    }
    
    // Calculate minutes available in current work day
    const minutesLeftInWorkDay = workEnd - timeOfDay;
    const minutesToAdd = Math.min(remainingMinutes, minutesLeftInWorkDay);
    
    currentDate.setMinutes(currentDate.getMinutes() + minutesToAdd);
    remainingMinutes -= minutesToAdd;
    
    // If we still have minutes left, move to next work day
    if (remainingMinutes > 0) {
      currentDate.setDate(currentDate.getDate() + 1);
      currentDate.setHours(workingHours.start_hour || 9, workingHours.start_minute || 0, 0, 0);
    }
  }
  
  return currentDate.toISOString();
};

export default function TicketForm({ 
  open, onClose, onSubmit, initial, orgId, requestorId, 
  title = "New Ticket", currentUserId, availableTags = []
}) {
  const { listSLAs, slasByOrg } = useSLA();
  const { get: getCalendar } = useBusinessCalendars();
  const allSLAOptions = slasByOrg[orgId] || [];

  const [form, setForm] = useState(() => ({
    subject: initial?.subject || "",
    description: initial?.description || "",
    queueOwned: Boolean(!initial?.assigneeId && initial?.groupId),
    groupId: initial?.groupId || "",
    selectedTeams: initial?.selectedTeams || [], // Array of team objects with calendar_id
    agentIds: initial?.agentIds || [],
    assigneeId: initial?.assigneeId || "",
    
    // classification
    category: initial?.category || "",
    subcategory: initial?.subcategory || "",
    productId: initial?.productId || "",

    // SLA configuration
    slaId: initial?.slaId || "",
    slaMode: "priority", // "priority" or "severity"
    priority: "normal",
    severity: "sev4",
    
    // calculated fields
    dueAt: initial?.dueAt || "",
    firstResponseDueAt: initial?.firstResponseDueAt || "",
    resolutionDueAt: initial?.resolutionDueAt || "",

    // tags
    selectedTags: Array.isArray(initial?.tags)
      ? initial.tags.map((t) =>
          typeof t === "string"
            ? { tag_id: t, tagId: t, name: t } // fallback if only id provided
            : ({ ...t, tagId: t.tag_id ?? t.tagId })
        )
      : [],    
    // collaborators
    collaborators: [],
  }));
  useEffect(() => {
    if (!open) return;
    setForm((f) => {
      const byId = new Map(availableTags.map(t => [t.tagId ?? t.tag_id, t]));
      const hydrated = (f.selectedTags || []).map(t => byId.get(t.tagId ?? t.tag_id) || t);
      return { ...f, selectedTags: hydrated };
    });
  }, [open, availableTags]);
  const [saving, setSaving] = useState(false);
  const [teamCalendar, setTeamCalendar] = useState(null);
  const [calendarLoading, setCalendarLoading] = useState(false);
  
  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const isQueueOwned = form.queueOwned === true;

  // Get available SLAs
  const availableSLAOptions = useMemo(() => {
    return allSLAOptions.filter(sla => {
      if (!sla.active) return false;
      
      // Check group filter if SLA has group restrictions
      if (sla.rules?.applies_to?.group_id_in) {
        if (!form.groupId || !sla.rules.applies_to.group_id_in.includes(form.groupId)) {
          return false;
        }
      }
      
      return true;
    });
  }, [allSLAOptions, form.groupId]);

  // Get current SLA details
  const selectedSLA = availableSLAOptions.find(sla => sla.sla_id === form.slaId);
  
  // Check if SLA has priority or severity maps
  const hasPriorityMap = selectedSLA?.rules?.priority_map && Object.keys(selectedSLA.rules.priority_map).length > 0;
  const hasSeverityMap = selectedSLA?.rules?.severity_map && Object.keys(selectedSLA.rules.severity_map).length > 0;
  
  // Memoize available options to prevent re-render loops
  const availableOptions = useMemo(() => {
    if (!selectedSLA?.rules) return [];
    
    if (form.slaMode === "priority" && hasPriorityMap) {
      return Object.keys(selectedSLA.rules.priority_map);
    } else if (form.slaMode === "severity" && hasSeverityMap) {
      return Object.keys(selectedSLA.rules.severity_map);
    }
    return [];
  }, [selectedSLA?.rules, form.slaMode, hasPriorityMap, hasSeverityMap]);
  
  // Memoize current resolution time calculation
  const currentResolutionTime = useMemo(() => {
    if (!selectedSLA) return null;
    
    if (form.slaMode === "priority" && hasPriorityMap) {
      return selectedSLA.rules.priority_map[form.priority] || selectedSLA.resolution_minutes;
    } else if (form.slaMode === "severity" && hasSeverityMap) {
      return selectedSLA.rules.severity_map[form.severity] || selectedSLA.resolution_minutes;
    }
    
    return selectedSLA.resolution_minutes;
  }, [selectedSLA, form.slaMode, form.priority, form.severity, hasPriorityMap, hasSeverityMap]);
  
  // Debug logging - only when selectedSLA changes
  useEffect(() => {
    if (selectedSLA) {
      console.log('Selected SLA:', selectedSLA);
      console.log('SLA Rules:', selectedSLA?.rules);
      console.log('Has Priority Map:', hasPriorityMap);
      console.log('Has Severity Map:', hasSeverityMap);
      console.log('Priority Map:', selectedSLA?.rules?.priority_map);
      console.log('Severity Map:', selectedSLA?.rules?.severity_map);
    }
  }, [selectedSLA, hasPriorityMap, hasSeverityMap]);
  const firstResponseTime = selectedSLA?.first_response_minutes;

  // Reset SLA mode when SLA changes
  useEffect(() => {
    if (selectedSLA) {
      // Default to priority mode if available, otherwise severity
      const defaultMode = hasPriorityMap ? "priority" : hasSeverityMap ? "severity" : "priority";
      setForm(f => ({ ...f, slaMode: defaultMode }));
    }
  }, [selectedSLA, hasPriorityMap, hasSeverityMap]);

  // Reset selection when SLA mode changes or available options change
  useEffect(() => {
    if (selectedSLA && availableOptions.length > 0) {
      if (form.slaMode === "priority" && !availableOptions.includes(form.priority)) {
        setForm(f => ({ ...f, priority: availableOptions[0] }));
      } else if (form.slaMode === "severity" && !availableOptions.includes(form.severity)) {
        setForm(f => ({ ...f, severity: availableOptions[0] }));
      }
    }
  }, [form.slaMode, selectedSLA?.sla_id, availableOptions.join(','), form.priority, form.severity]);

  // Fetch team calendar when teams change
  useEffect(() => {
    if (form.selectedTeams.length > 0) {
      const getTeamCalendar = async () => {
        setCalendarLoading(true);
        try {
          // Get the first team's calendar (you could implement merging logic for multiple calendars)
          const firstTeam = form.selectedTeams[0];
          
          if (firstTeam?.calendar_id) {
            const calendar = await getCalendar(firstTeam.calendar_id);
            setTeamCalendar(calendar);
          } else {
            setTeamCalendar(null);
          }
        } catch (error) {
          console.error('Failed to fetch team calendar:', error);
          setTeamCalendar(null);
        } finally {
          setCalendarLoading(false);
        }
      };
      
      getTeamCalendar();
    } else {
      setTeamCalendar(null);
    }
  }, [form.selectedTeams, getCalendar]);

  // Calculate due dates when SLA parameters or calendar change
  useEffect(() => {
    if (selectedSLA && (currentResolutionTime || firstResponseTime)) {
      const firstResponseDue = firstResponseTime 
        ? calculateDueDateWithBusinessHours(firstResponseTime, teamCalendar)
        : null;
      const resolutionDue = currentResolutionTime
        ? calculateDueDateWithBusinessHours(currentResolutionTime, teamCalendar)
        : null;
      
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
  }, [selectedSLA, currentResolutionTime, firstResponseTime, teamCalendar]);

  // Reset teams & agentIds when group changes
  useEffect(() => {
    setForm((f) => ({ ...f, selectedTeams: [], agentIds: [] }));
  }, [form.groupId]);

  useEffect(() => {
    if (isQueueOwned && form.assigneeId) setForm((f) => ({ ...f, assigneeId: "" }));
  }, [isQueueOwned]);

  const subjectOK = form.subject.trim().length > 0;
  const groupOK = !isQueueOwned || (isQueueOwned && form.groupId.trim().length > 0);
  const slaConfigOK = !selectedSLA || (selectedSLA && availableOptions.length > 0);
  const canSave = subjectOK && groupOK && slaConfigOK;

  const handleSubmit = async () => {
    setSaving(true);
    try {
     const tagIds = (form.selectedTags || [])
        .map(t => t.tagId ?? t.tag_id)
        .filter(Boolean);      
      // Convert team objects back to IDs for API
      const teamIds = form.selectedTeams.map(team => team.team_id || team);
      
      const payload = {
        orgId,
        requesterId: requestorId,
        subject: form.subject.trim(),
        description: form.description || "",
        priority: form.priority,
        severity: form.severity,

        groupId: form.groupId || null,
        teamIds: teamIds,
        agentIds: form.agentIds || [],
        assigneeId: isQueueOwned ? null : (form.assigneeId || null),

        category: form.category || null,
        subcategory: form.subcategory || null,
        productId: form.productId || null,
        
        // SLA data
        slaId: form.slaId || null,
        dueAt: form.dueAt || null,
        firstResponseDueAt: form.firstResponseDueAt || null,
        resolutionDueAt: form.resolutionDueAt || null,
        
        // Additional SLA context for backend processing
        slaMode: form.slaMode,
        calendarId: teamCalendar?.calendar_id || null,
        
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
        <Stack spacing={2} sx={{ mt: 1 }}>
          {/* Basic Information */}
          <Typography variant="h6" gutterBottom>Basic Information</Typography>
          
          <TextField 
            label="Subject" 
            value={form.subject} 
            onChange={(e) => update("subject", e.target.value)} 
            fullWidth 
            required 
            error={!subjectOK}
            helperText={!subjectOK ? "Subject is required" : ""}
          />
          
          <TextField 
            label="Description" 
            value={form.description} 
            onChange={(e) => update("description", e.target.value)} 
            fullWidth 
            multiline 
            minRows={3} 
            placeholder="Describe the issue or request..."
          />

          <Divider />
          
          {/* Assignment */}
          <Typography variant="h6" gutterBottom>Assignment</Typography>

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
          
          {!groupOK && (
            <Alert severity="error">
              Group is required when creating a queue-owned ticket.
            </Alert>
          )}

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <Box sx={{ flex: 1, minWidth: 220 }}>
              <TeamMultiSelect
                groupId={form.groupId || undefined}
                value={form.selectedTeams}
                onChange={(teams) => update("selectedTeams", teams)}
                label="Teams (within group)"
                disabled={!form.groupId}
                returnFullObjects={true} // Ensure component returns team objects with calendar_id
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

          {/* Calendar Status */}
          {form.selectedTeams.length > 0 && (
            <Box sx={{ p: 1, bgcolor: 'background.paper', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
              <Stack direction="row" alignItems="center" spacing={1}>
                <CalendarToday fontSize="small" />
                <Typography variant="body2">
                  {calendarLoading ? (
                    "Loading calendar..."
                  ) : teamCalendar ? (
                    `Business Calendar: ${teamCalendar.name} (${teamCalendar.timezone || 'UTC'})`
                  ) : (
                    "No business calendar configured for selected teams"
                  )}
                </Typography>
                {teamCalendar && (
                  <Chip 
                    size="small" 
                    label="Business Hours Applied" 
                    color="success" 
                    variant="outlined"
                  />
                )}
              </Stack>
            </Box>
          )}

          <Divider />

          {/* Classification */}
          <Typography variant="h6" gutterBottom>Classification</Typography>
          
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <TextField 
              label="Category" 
              value={form.category} 
              onChange={(e) => update("category", e.target.value)} 
              fullWidth 
              placeholder="e.g., Bug, Feature Request"
            />
            <TextField 
              label="Subcategory" 
              value={form.subcategory} 
              onChange={(e) => update("subcategory", e.target.value)} 
              fullWidth 
              placeholder="e.g., UI Bug, API Issue"
            />
            <TextField 
              label="Product ID" 
              value={form.productId} 
              onChange={(e) => update("productId", e.target.value)} 
              fullWidth 
              placeholder="e.g., web-app, mobile-ios"
            />
          </Stack>

          <Divider />

          {/* SLA Configuration */}
          <Typography variant="h6" gutterBottom>SLA Configuration</Typography>

          {/* SLA Selection */}
          <TextField
            select
            label="SLA Policy"
            fullWidth
            value={form.slaId}
            onChange={(e) => update("slaId", e.target.value)}
            helperText="Choose an SLA policy to set response and resolution targets"
          >
            <MenuItem key="" value="">
              <Typography component="span" color="text.secondary">
                None - No SLA requirements
              </Typography>
            </MenuItem>
            {availableSLAOptions.map((sla) => (
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
                  
                  <Box sx={{ display: 'flex', gap: 1, mt: 0.5, flexWrap: 'wrap' }}>
                    {sla.first_response_minutes && (
                      <Chip 
                        size="small" 
                        icon={<AccessTime />}
                        label={`First Response: ${formatMinutes(sla.first_response_minutes)}`}
                        variant="outlined"
                        color="primary"
                      />
                    )}
                    {sla.resolution_minutes && (
                      <Chip 
                        size="small" 
                        icon={<Schedule />}
                        label={`Base Resolution: ${formatMinutes(sla.resolution_minutes)}`}
                        variant="outlined"
                        color="secondary"
                      />
                    )}
                  </Box>
                </Box>
              </MenuItem>
            ))}
          </TextField>

          {/* Temporary Debug Section - Remove this later */}
          {selectedSLA && (
            <Alert severity="info" sx={{ mt: 2 }}>
              <Typography variant="subtitle2" gutterBottom>Debug Info:</Typography>
              <Typography variant="body2">
                <strong>SLA Name:</strong> {selectedSLA.name}<br/>
                <strong>Has Priority Map:</strong> {hasPriorityMap ? 'Yes' : 'No'}<br/>
                <strong>Has Severity Map:</strong> {hasSeverityMap ? 'Yes' : 'No'}<br/>
                <strong>Rules Object:</strong> {JSON.stringify(selectedSLA.rules, null, 2)}
              </Typography>
            </Alert>
          )}

          {/* Priority/Severity Toggle - Always visible when SLA is selected */}
          {selectedSLA && (
            <FormControl component="fieldset" fullWidth>
              <FormLabel component="legend">SLA Resolution Mode</FormLabel>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Choose how resolution time will be determined for this ticket
              </Typography>
              <RadioGroup
                row
                value={form.slaMode}
                onChange={(e) => update("slaMode", e.target.value)}
                sx={{ mb: 2 }}
              >
                <FormControlLabel 
                  value="priority" 
                  control={<Radio />} 
                  label={`Priority-based ${hasPriorityMap ? '' : '(not available)'}`}
                  disabled={!hasPriorityMap}
                />
                <FormControlLabel 
                  value="severity" 
                  control={<Radio />} 
                  label={`Severity-based ${hasSeverityMap ? '' : '(not available)'}`}
                  disabled={!hasSeverityMap}
                />
              </RadioGroup>
            </FormControl>
          )}

          {/* Priority Selection Field */}
          {selectedSLA && form.slaMode === "priority" && (
            <TextField 
              label="Priority Level" 
              select 
              fullWidth 
              value={form.priority} 
              onChange={(e) => update("priority", e.target.value)}
              disabled={!hasPriorityMap}
              error={!hasPriorityMap}
              helperText={
                hasPriorityMap 
                  ? "Choose priority level - resolution time will be calculated from priority map"
                  : "Priority-based SLA not available for this policy"
              }
            >
              {hasPriorityMap && Object.keys(selectedSLA.rules.priority_map || {}).map((p) => {
                const resolutionTime = selectedSLA.rules.priority_map[p];
                return (
                  <MenuItem key={p} value={p}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                      <Typography component="span">
                        {p.charAt(0).toUpperCase() + p.slice(1)}
                      </Typography>
                      <Chip 
                        size="small" 
                        label={formatMinutes(resolutionTime)}
                        color="primary"
                        variant="outlined"
                      />
                    </Box>
                  </MenuItem>
                );
              })}
            </TextField>
          )}

          {/* Severity Selection Field */}
          {selectedSLA && form.slaMode === "severity" && (
            <TextField 
              label="Severity Level" 
              select 
              fullWidth 
              value={form.severity} 
              onChange={(e) => update("severity", e.target.value)}
              disabled={!hasSeverityMap}
              error={!hasSeverityMap}
              helperText={
                hasSeverityMap 
                  ? "Choose severity level - resolution time will be calculated from severity map"
                  : "Severity-based SLA not available for this policy"
              }
            >
              {hasSeverityMap && Object.keys(selectedSLA.rules.severity_map || {}).map((s) => {
                const resolutionTime = selectedSLA.rules.severity_map[s];
                return (
                  <MenuItem key={s} value={s}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                      <Typography component="span">
                        {s.toUpperCase()}
                      </Typography>
                      <Chip 
                        size="small" 
                        label={formatMinutes(resolutionTime)}
                        color="secondary"
                        variant="outlined"
                      />
                    </Box>
                  </MenuItem>
                );
              })}
            </TextField>
          )}

          {/* Show basic priority/severity when no SLA is selected */}
          {!selectedSLA && (
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
              <TextField 
                label="Priority" 
                select 
                fullWidth 
                value={form.priority} 
                onChange={(e) => update("priority", e.target.value)}
                helperText="Basic priority level (no SLA applied)"
              >
                {["low", "normal", "high", "urgent", "blocker"].map((p) => (
                  <MenuItem key={p} value={p}>
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </MenuItem>
                ))}
              </TextField>
              
              <TextField 
                label="Severity" 
                select 
                fullWidth 
                value={form.severity} 
                onChange={(e) => update("severity", e.target.value)}
                helperText="Basic severity level (no SLA applied)"
              >
                {["sev4", "sev3", "sev2", "sev1"].map((s) => (
                  <MenuItem key={s} value={s}>
                    {s.toUpperCase()}
                  </MenuItem>
                ))}
              </TextField>
            </Stack>
          )}

          {/* SLA Status Display */}
          {selectedSLA && currentResolutionTime && (
            <Alert severity="success">
              <Typography variant="subtitle2" gutterBottom>
                Active SLA: {selectedSLA.name} 
                {(hasPriorityMap || hasSeverityMap) && (
                  <span> ({form.slaMode === "priority" ? form.priority.toUpperCase() : form.severity.toUpperCase()})</span>
                )}
                {teamCalendar && (
                  <Chip size="small" label="Business Hours Applied" color="info" sx={{ ml: 1 }} />
                )}
              </Typography>
              
              <Stack direction="row" spacing={3} flexWrap="wrap" sx={{ mt: 1 }}>
                {firstResponseTime && (
                  <Box>
                    <Typography variant="body2" color="primary">
                      <strong>First Response:</strong> {formatMinutes(firstResponseTime)}
                    </Typography>
                    {form.firstResponseDueAt && (
                      <Typography variant="caption" color="text.secondary">
                        Due: {new Date(form.firstResponseDueAt).toLocaleString()}
                      </Typography>
                    )}
                  </Box>
                )}
                
                {currentResolutionTime && (
                  <Box>
                    <Typography variant="body2" color="secondary">
                      <strong>Resolution:</strong> {formatMinutes(currentResolutionTime)}
                    </Typography>
                    {form.resolutionDueAt && (
                      <Typography variant="caption" color="text.secondary">
                        Due: {new Date(form.resolutionDueAt).toLocaleString()}
                      </Typography>
                    )}
                  </Box>
                )}
              </Stack>

              {/* Show calculation details for transparency */}
              {selectedSLA.rules && form.slaMode === "priority" && hasPriorityMap && (
                <Box sx={{ mt: 1, p: 1, bgcolor: 'rgba(0,0,0,0.02)', borderRadius: 1 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 'medium' }}>
                    Resolution time from Priority Map: {form.priority.toUpperCase()} → {formatMinutes(currentResolutionTime)}
                  </Typography>
                </Box>
              )}
              
              {selectedSLA.rules && form.slaMode === "severity" && hasSeverityMap && (
                <Box sx={{ mt: 1, p: 1, bgcolor: 'rgba(0,0,0,0.02)', borderRadius: 1 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 'medium' }}>
                    Resolution time from Severity Map: {form.severity.toUpperCase()} → {formatMinutes(currentResolutionTime)}
                  </Typography>
                </Box>
              )}
            </Alert>
          )}

          {selectedSLA && !slaConfigOK && (
            <Alert severity="warning">
              <Typography variant="subtitle2" gutterBottom>
                SLA Configuration Required
              </Typography>
              <Typography variant="body2">
                The selected SLA "{selectedSLA.name}" requires priority or severity configuration, but no valid options are available.
              </Typography>
            </Alert>
          )}

          <TextField 
            label="Custom Due Date (ISO)" 
            value={form.dueAt} 
            onChange={(e) => update("dueAt", e.target.value)} 
            fullWidth 
            placeholder="2025-09-25T17:30:00Z" 
            helperText="Optional custom due date (overrides SLA calculations)"
          />

          <Divider />

          {/* Additional Options */}
          <Typography variant="h6" gutterBottom>Additional Options</Typography>
          <Box>
            <Typography variant="h6" gutterBottom>Tags</Typography>
            <Autocomplete
              multiple
              options={availableTags}
              value={form.selectedTags}
              onChange={(_, newValue) => update("selectedTags", newValue)}
              getOptionLabel={(opt) => opt.name || opt.tag_name || opt.tagId || opt.tag_id || ""}
              isOptionEqualToValue={(o, v) => (o.tagId ?? o.tag_id) === (v.tagId ?? v.tag_id)}
              renderTags={(value, getTagProps) =>
                value.map((option, index) => {
                  const color = option.color || option.tag_colour || "#808080";
                  return (
                    <Chip
                      {...getTagProps({ index })}
                      key={(option.tagId ?? option.tag_id) || index}
                      label={option.name || option.tag_name || ""}
                      variant="outlined"
                      sx={{
                        borderColor: color,
                        backgroundColor: `${color}1A`,
                        color,
                      }}
                    />
                  );
                })
              }
              renderOption={(props, option) => {
                const color = option.color || option.tag_colour || "#808080";
                return (
                  <li {...props} key={option.tagId ?? option.tag_id}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Avatar sx={{ width: 18, height: 18, bgcolor: color }} />
                      <Typography>{option.name}</Typography>
                      {option.category && (
                        <Chip size="small" variant="outlined" label={option.category} />
                      )}
                    </Stack>
                  </li>
                );
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Select tags"
                  placeholder="Search tags…"
                  helperText="Pick from the tags you created"
                  fullWidth
                />
              )}
            />
          </Box>

          <CollaboratorsSelect 
            orgId={orgId} 
            value={form.collaborators} 
            onChange={(arr) => update("collaborators", arr)} 
          />
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={saving}>Cancel</Button>
        <Button 
          onClick={handleSubmit} 
          variant="contained" 
          disabled={saving || !canSave}
          color="primary"
        >
          {saving ? "Creating..." : "Create Ticket"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}