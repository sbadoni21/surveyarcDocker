"use client";
import { useEffect, useMemo, useState } from "react";
import {
  Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
  Divider, IconButton, MenuItem, Paper, Stack, TextField, Typography,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import SaveIcon from "@mui/icons-material/Save";
import ReplayIcon from "@mui/icons-material/Replay";
import AddIcon from "@mui/icons-material/Add";
import AssigneeSelect from "./AssigneeSelect";
import GroupSelect from "./GroupSelect";
import CollaboratorsSelect from "./CollaboratorsSelect";
import WorklogModel from "@/models/postGresModels/worklogModel";
import CollaboratorModel from "@/models/postGresModels/collaboratorModel";
import SLAStatusBar from "./SLAStatusBar";
import { useSLA } from "@/providers/slaProvider";

const STATUSES = ["new", "open", "pending", "on_hold", "resolved", "closed", "canceled"];
const PRIORITIES = ["low", "normal", "high", "urgent"];
const SEVERITIES = ["sev4", "sev3", "sev2", "sev1"];
const WORK_KINDS = ["analysis", "investigation", "comms", "fix", "review", "other"];

export default function TicketDetail({
  ticket,
  orgId,
  participants,
  currentUserId,
  onAssignGroup,
  onPatchTeams,
  onPatchAgents,
  onUpdate,
}) {
  const effectiveOrgId = orgId || ticket?.orgId;
  const { refreshTicketSLA } = useSLA();

  const [edit, setEdit] = useState(false);
  const [draft, setDraft] = useState(ticket);

  const [logs, setLogs] = useState([]);
  const [logOpen, setLogOpen] = useState(false);

  const [collabs, setCollabs] = useState([]);
  const [addOpen, setAddOpen] = useState(false);

  const [teamsCsv, setTeamsCsv] = useState("");
  const [agentsCsv, setAgentsCsv] = useState("");

  const nn = (v) => (v === undefined || v === "" ? null : v);

  useEffect(() => setDraft(ticket), [ticket]);

  useEffect(() => {
    if (ticket?.ticketId) refreshTicketSLA(ticket.ticketId).catch(() => {});
  }, [ticket?.ticketId, refreshTicketSLA]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!ticket?.ticketId) return;
      try {
        const data = await WorklogModel.list(ticket.ticketId);
        if (mounted) setLogs(Array.isArray(data) ? data : []);
      } catch { if (mounted) setLogs([]); }

      try {
        const c = await CollaboratorModel.list(ticket.ticketId);
        if (mounted) setCollabs(Array.isArray(c) ? c : []);
      } catch { if (mounted) setCollabs([]); }
    })();
    return () => { mounted = false; };
  }, [ticket?.ticketId]);

  const applyUpdate = (k, v) => setDraft((d) => ({ ...d, [k]: v }));

  const save = async () => {
    await onUpdate?.(ticket.ticketId, {
      subject: draft.subject,
      description: draft.description,
      status: draft.status,
      priority: draft.priority,
      severity: draft.severity,
      groupId: nn(draft.groupId),
      assigneeId: nn(draft.assigneeId),
      category: nn(draft.category),
      subcategory: nn(draft.subcategory),
      productId: nn(draft.productId),
      slaId: nn(draft.slaId),
      dueAt: nn(draft.dueAt),
    });
    setEdit(false);
  };

  const queueOwned = !draft?.assigneeId && !!draft?.groupId;
  const assigneeBadge = useMemo(() => {
    if (queueOwned) return `Queue: ${draft.groupName || draft.groupId || "—"}`;
    const name = draft.assigneeName || draft.assigneeId || "Unassigned";
    return `Assignee: ${name}`;
  }, [draft, queueOwned]);

  return (
    <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
      <SLAStatusBar ticket={ticket} />

      <Stack spacing={2}>
        {/* Title Bar */}
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Typography variant="h6" noWrap>
            {ticket.subject}{" "}
            <Typography component="span" variant="body2" color="text.secondary">
              #{ticket.number || ticket.ticketId}
            </Typography>
          </Typography>
          <Stack direction="row" spacing={1}>
            {edit ? (
              <>
                <IconButton color="success" onClick={save} aria-label="save"><SaveIcon /></IconButton>
                <IconButton onClick={() => { setDraft(ticket); setEdit(false); }} aria-label="reset">
                  <ReplayIcon />
                </IconButton>
              </>
            ) : (
              <IconButton onClick={() => setEdit(true)} aria-label="edit"><EditIcon /></IconButton>
            )}
          </Stack>
        </Stack>

        {/* Properties Table */}
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: 220 }}>Property</TableCell>
                <TableCell>Value</TableCell>
                <TableCell sx={{ width: 260 }}>Notes</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {/* Status */}
              <RowSelect
                label="Status"
                value={(edit ? draft.status : ticket.status) || "open"}
                disabled={!edit}
                options={STATUSES.map((s) => ({ value: s, label: s }))}
                onChange={(v) => applyUpdate("status", v)}
                hint="Lifecycle state"
              />

              {/* Priority */}
              <RowSelect
                label="Priority"
                value={(edit ? draft.priority : ticket.priority) || "normal"}
                disabled={!edit}
                options={PRIORITIES.map((p) => ({ value: p, label: p.toUpperCase() }))}
                onChange={(v) => applyUpdate("priority", v)}
                hint="Business urgency"
              />

              {/* Severity */}
              <RowSelect
                label="Severity"
                value={(edit ? draft.severity : ticket.severity) || "sev4"}
                disabled={!edit}
                options={SEVERITIES.map((s) => ({ value: s, label: s.toUpperCase() }))}
                onChange={(v) => applyUpdate("severity", v)}
                hint="Impact level"
              />

              {/* Group */}
              <TableRow>
                <TableCell>Group</TableCell>
                <TableCell>
                  <Box minWidth={260}>
                    <GroupSelect
                      orgId={effectiveOrgId}
                      value={edit ? draft.groupId : ticket.groupId}
                      onChange={(v) => {
                        if (!edit) setEdit(true);
                        setDraft((d) => {
                          const nextGroup = v ?? null;
                          return {
                            ...d,
                            groupId: nextGroup,
                            assigneeId: d.groupId !== nextGroup ? null : d.assigneeId,
                          };
                        });
                        // optionally persist immediately:
                        // onAssignGroup?.(ticket.ticketId, v ?? null);
                      }}
                    />
                  </Box>
                </TableCell>
                <TableCell>
                  <Button
                    size="small"
                    onClick={async () => {
                      if (!edit) setEdit(true);
                      setDraft((d) => ({ ...d, groupId: null, assigneeId: null }));
                      await onAssignGroup?.(ticket.ticketId, null);
                    }}
                  >
                    Clear
                  </Button>
                </TableCell>
              </TableRow>

              {/* Assignee */}
              <TableRow>
                <TableCell>Assignee</TableCell>
                <TableCell>
                  <Box minWidth={280}>
                    <AssigneeSelect
                      orgId={effectiveOrgId}
                      groupId={draft.groupId || undefined}
                      value={edit ? draft.assigneeId : ticket.assigneeId}
                      onChange={(v) => {
                        if (!edit) setEdit(true);
                        setDraft((d) => ({ ...d, assigneeId: v ?? null }));
                      }}
                      onlyAgents
                      placeholder={
                        !draft.assigneeId && draft.groupId ? "Queue-owned (optional)" : "Select assignee"
                      }
                    />
                  </Box>
                </TableCell>
                <TableCell>
                  <Chip label={assigneeBadge} size="small" color="primary" />
                </TableCell>
              </TableRow>

              {/* Category/Subcategory */}
              <RowText
                label="Category"
                value={edit ? (draft.category || "") : (ticket.category || "")}
                disabled={!edit}
                onChange={(v) => applyUpdate("category", v)}
                hint="High-level area"
              />
              <RowText
                label="Subcategory"
                value={edit ? (draft.subcategory || "") : (ticket.subcategory || "")}
                disabled={!edit}
                onChange={(v) => applyUpdate("subcategory", v)}
                hint="Specific area"
              />

              {/* Subject */}
              <RowText
                label="Subject"
                value={edit ? (draft.subject || "") : (ticket.subject || "")}
                disabled={!edit}
                onChange={(v) => applyUpdate("subject", v)}
              />

              {/* Due At */}
              <RowText
                label="Due at"
                value={edit ? (draft.dueAt || "") : (ticket.dueAt || "")}
                disabled={!edit}
                onChange={(v) => applyUpdate("dueAt", v)}
                placeholder="ISO date or leave blank"
              />
            </TableBody>
          </Table>
        </TableContainer>

        {/* Description Table */}
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: 220 }}>Description</TableCell>
                <TableCell>Content</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              <TableRow>
                <TableCell sx={{ verticalAlign: "top" }}>Details</TableCell>
                <TableCell>
                  {edit ? (
                    <TextField
                      fullWidth
                      multiline
                      minRows={4}
                      value={draft.description || ""}
                      onChange={(e) => applyUpdate("description", e.target.value)}
                    />
                  ) : (
                    <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                      {ticket.description || "—"}
                    </Typography>
                  )}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>

        {/* Participants Table */}
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: 220 }}>Participants</TableCell>
                <TableCell>Value</TableCell>
                <TableCell sx={{ width: 260 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              <TableRow>
                <TableCell>Group</TableCell>
                <TableCell>{(edit ? draft.groupId : participants?.groupId) || "—"}</TableCell>
                <TableCell>
                  <Button
                    size="small"
                    onClick={async () => {
                      if (!edit) setEdit(true);
                      setDraft((d) => ({ ...d, groupId: null, assigneeId: null }));
                      await onAssignGroup?.(ticket.ticketId, null);
                    }}
                  >
                    Clear Group
                  </Button>
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Teams</TableCell>
                <TableCell>{(participants?.teamIds || []).join(", ") || "—"}</TableCell>
                <TableCell>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <TextField
                      size="small"
                      label="Teams CSV"
                      value={teamsCsv}
                      onChange={(e) => setTeamsCsv(e.target.value)}
                    />
                    <Button
                      size="small"
                      onClick={() =>
                        onPatchTeams?.(
                          ticket.ticketId,
                          teamsCsv.split(",").map((s) => s.trim()).filter(Boolean),
                          "add"
                        )
                      }
                    >
                      Add
                    </Button>
                    <Button
                      size="small"
                      onClick={() =>
                        onPatchTeams?.(
                          ticket.ticketId,
                          teamsCsv.split(",").map((s) => s.trim()).filter(Boolean),
                          "remove"
                        )
                      }
                    >
                      Remove
                    </Button>
                    <Button
                      size="small"
                      onClick={() =>
                        onPatchTeams?.(
                          ticket.ticketId,
                          teamsCsv.split(",").map((s) => s.trim()).filter(Boolean),
                          "replace"
                        )
                      }
                    >
                      Set
                    </Button>
                  </Stack>
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Agents</TableCell>
                <TableCell>{(participants?.agentIds || []).join(", ") || "—"}</TableCell>
                <TableCell>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <TextField
                      size="small"
                      label="Agents CSV"
                      value={agentsCsv}
                      onChange={(e) => setAgentsCsv(e.target.value)}
                    />
                    <Button
                      size="small"
                      onClick={() =>
                        onPatchAgents?.(
                          ticket.ticketId,
                          agentsCsv.split(",").map((s) => s.trim()).filter(Boolean),
                          "add"
                        )
                      }
                    >
                      Add
                    </Button>
                    <Button
                      size="small"
                      onClick={() =>
                        onPatchAgents?.(
                          ticket.ticketId,
                          agentsCsv.split(",").map((s) => s.trim()).filter(Boolean),
                          "remove"
                        )
                      }
                    >
                      Remove
                    </Button>
                    <Button
                      size="small"
                      onClick={() =>
                        onPatchAgents?.(
                          ticket.ticketId,
                          agentsCsv.split(",").map((s) => s.trim()).filter(Boolean),
                          "replace"
                        )
                      }
                    >
                      Set
                    </Button>
                  </Stack>
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Tags</TableCell>
                <TableCell colSpan={2}>
                  <Stack direction="row" spacing={1} flexWrap="wrap">
                    {(ticket.tags || []).map((tg) => (
                      <Chip
                        key={tg.tag_id || tg.name}
                        label={tg.name}
                        size="small"
                        variant="outlined"
                      />
                    ))}
                  </Stack>
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Collaborators</TableCell>
                <TableCell>
                  <Stack direction="row" spacing={0.5} flexWrap="wrap">
                    {collabs.length
                      ? collabs.map((c) => (
                          <Chip
                            key={c.user_id}
                            label={`${c.user_id}${c.role ? ` • ${c.role}` : ""}`}
                            onDelete={async () => {
                              await CollaboratorModel.remove(ticket.ticketId, c.user_id);
                              const list = await CollaboratorModel.list(ticket.ticketId);
                              setCollabs(Array.isArray(list) ? list : []);
                            }}
                            size="small"
                          />
                        ))
                      : "—"}
                  </Stack>
                </TableCell>
                <TableCell>
                  <Button size="small" startIcon={<AddIcon />} onClick={() => setAddOpen(true)}>
                    Add
                  </Button>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>

        {/* Worklogs Table */}
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Worklogs</TableCell>
                <TableCell align="right">
                  <Button size="small" startIcon={<AddIcon />} onClick={() => setLogOpen(true)}>
                    Log work
                  </Button>
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Entry</TableCell>
                <TableCell align="right">Created</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {logs?.length ? (
                logs.map((wl) => (
                  <TableRow key={wl.worklog_id}>
                    <TableCell>
                      <Typography variant="body2">
                        <b>{wl.kind}</b> • {wl.minutes}m{wl.note ? ` — ${wl.note}` : ""}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="caption" color="text.secondary">
                        {new Date(wl.created_at).toLocaleString()}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={2}>
                    <Typography variant="body2" color="text.secondary">
                      No work logged yet.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Footer Actions */}
        {edit && (
          <Stack direction="row" spacing={1} justifyContent="flex-end">
            <Button onClick={() => { setDraft(ticket); setEdit(false); }}>Cancel</Button>
            <Button variant="contained" onClick={save}>Save changes</Button>
          </Stack>
        )}
      </Stack>

      {/* Worklog Dialog */}
      <WorklogDialog
        open={logOpen}
        onClose={async (saved) => {
          setLogOpen(false);
          if (saved) {
            const data = await WorklogModel.list(ticket.ticketId);
            setLogs(Array.isArray(data) ? data : []);
          }
        }}
        ticketId={ticket.ticketId}
        currentUserId={currentUserId}
      />

      {/* Add Collaborators */}
      <AddCollaboratorsDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        orgId={effectiveOrgId}
        onAdd={async (userIds) => {
          await Promise.all(
            userIds.map((uid) => CollaboratorModel.add(ticket.ticketId, { userId: uid, role: "contributor" }))
          );
          const list = await CollaboratorModel.list(ticket.ticketId);
          setCollabs(Array.isArray(list) ? list : []);
          setAddOpen(false);
        }}
      />
    </Paper>
  );
}

/* ---------- Small helpers for table rows ---------- */

function RowSelect({ label, value, onChange, disabled, options, hint }) {
  return (
    <TableRow>
      <TableCell>{label}</TableCell>
      <TableCell>
        <TextField
          select
          size="small"
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          disabled={disabled}
          sx={{ minWidth: 220 }}
        >
          {options.map((o) => (
            <MenuItem key={o.value} value={o.value}>
              {o.label}
            </MenuItem>
          ))}
        </TextField>
      </TableCell>
      <TableCell>{hint || null}</TableCell>
    </TableRow>
  );
}

function RowText({ label, value, onChange, disabled, placeholder, hint }) {
  return (
    <TableRow>
      <TableCell>{label}</TableCell>
      <TableCell>
        <TextField
          size="small"
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          disabled={disabled}
          placeholder={placeholder}
          fullWidth
        />
      </TableCell>
      <TableCell>{hint || null}</TableCell>
    </TableRow>
  );
}

/* ---------- Dialogs ---------- */

function WorklogDialog({ open, onClose, ticketId, currentUserId }) {
  const [minutes, setMinutes] = useState(15);
  const [kind, setKind] = useState("analysis");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await WorklogModel.create(ticketId, {
        userId: currentUserId,
        minutes: Number(minutes) || 0,
        kind,
        note: note?.trim() || undefined,
      });
      onClose?.(true);
    } catch {
      onClose?.(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={() => onClose?.(false)} maxWidth="xs" fullWidth>
      <DialogTitle>Log work</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={1.25} sx={{ mt: 0.5 }}>
          <TextField label="Minutes" type="number" inputProps={{ min: 1, step: 1 }} value={minutes} onChange={(e) => setMinutes(e.target.value)} fullWidth />
          <TextField select label="Kind" value={kind} onChange={(e) => setKind(e.target.value)} fullWidth>
            {WORK_KINDS.map((k) => <MenuItem key={k} value={k}>{k}</MenuItem>)}
          </TextField>
          <TextField label="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} fullWidth multiline minRows={2} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => onClose?.(false)} disabled={saving}>Cancel</Button>
        <Button onClick={save} variant="contained" disabled={saving || !minutes || Number(minutes) <= 0}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function AddCollaboratorsDialog({ open, onClose, orgId, onAdd }) {
  const [pick, setPick] = useState([]);
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Add collaborators</DialogTitle>
      <DialogContent dividers>
        <CollaboratorsSelect orgId={orgId} value={pick} onChange={setPick} />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
        <Button onClick={() => onAdd?.(pick)} variant="contained" disabled={!pick.length}>Add</Button>
      </DialogActions>
    </Dialog>
  );
}
