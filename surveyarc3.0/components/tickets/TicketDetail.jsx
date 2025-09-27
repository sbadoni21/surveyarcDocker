"use client";
import { useEffect, useMemo, useState } from "react";
import {
  Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
  Divider, IconButton, MenuItem, Paper, Stack, TextField, Typography,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import SaveIcon from "@mui/icons-material/Save";
import ReplayIcon from "@mui/icons-material/Replay";
import AddIcon from "@mui/icons-material/Add";
import AssigneeSelect from "./AssigneeSelect";
import GroupSelect from "./GroupSelect";
import CollaboratorsSelect from "./CollaboratorsSelect";
import WorklogModel from "@/models/postGresModels/worklogModel";
import CollaboratorModel from "@/models/postGresModels/collaboratorModel"; // you created earlier
import SLAStatusBar from "./SLAStatusBar";
import { useSLA } from "@/providers/slaProvider";

const STATUSES = ["new", "open", "pending", "on_hold", "resolved", "closed", "canceled"];
const PRIORITIES = ["low", "normal", "high", "urgent"];
const SEVERITIES = ["sev4", "sev3", "sev2", "sev1"];
const WORK_KINDS = ["analysis", "investigation", "comms", "fix", "review", "other"];

export default function TicketDetail({ ticket, orgId, onUpdate, currentUserId }) {
  const [edit, setEdit] = useState(false);
  const [draft, setDraft] = useState(ticket);

  // worklogs
  const [logs, setLogs] = useState([]);
  const [logOpen, setLogOpen] = useState(false);

  // collaborators
  const [collabs, setCollabs] = useState([]);
  const [addOpen, setAddOpen] = useState(false);
  const { refreshTicketSLA } = useSLA();

  useEffect(() => {
    if (ticket?.ticketId) refreshTicketSLA(ticket.ticketId).catch(() => {});
  }, [ticket?.ticketId, refreshTicketSLA]);
  useEffect(() => setDraft(ticket), [ticket]);

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
    await onUpdate(ticket.ticketId, {
      subject: draft.subject,
      description: draft.description,
      status: draft.status,
      priority: draft.priority,
      severity: draft.severity,
      groupId: draft.groupId || null,        // NEW
      assigneeId: draft.assigneeId || null,
      category: draft.category || null,
      subcategory: draft.subcategory || null,
      productId: draft.productId || null,
      slaId: draft.slaId || null,
      dueAt: draft.dueAt || null,
    });
    setEdit(false);
  };

  const queueOwned = !draft.assigneeId && !!draft.groupId;
  const assigneeBadge = useMemo(() => {
    if (queueOwned) return `Queue: ${draft.groupName || draft.groupId || "—"}`;
    const name = draft.assigneeName || draft.assigneeId || "Unassigned";
    return `Assignee: ${name}`;
  }, [draft, queueOwned]);

  return (
    <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
            <SLAStatusBar ticket={ticket} />

      <Stack spacing={2}>
        {/* Header */}
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

        {/* Quick editors */}
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
          <TextField
            size="small"
            select
            label="Status"
            value={(edit ? draft.status : ticket.status) || "open"}
            onChange={(e) => edit && applyUpdate("status", e.target.value)}
            sx={{ minWidth: 160 }}
          >
            {STATUSES.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
          </TextField>

          <TextField
            size="small" select label="Priority"
            value={(edit ? draft.priority : ticket.priority) || "normal"}
            onChange={(e) => edit && applyUpdate("priority", e.target.value)}
            sx={{ minWidth: 160 }}
          >
            {PRIORITIES.map((p) => <MenuItem key={p} value={p}>{p.toUpperCase()}</MenuItem>)}
          </TextField>

          <TextField
            size="small" select label="Severity"
            value={(edit ? draft.severity : ticket.severity) || "sev4"}
            onChange={(e) => edit && applyUpdate("severity", e.target.value)}
            sx={{ minWidth: 160 }}
          >
            {SEVERITIES.map((s) => <MenuItem key={s} value={s}>{s.toUpperCase()}</MenuItem>)}
          </TextField>

          {/* Group + Assignee */}
          <Box minWidth={220}>
            <GroupSelect
              orgId={orgId}
              value={edit ? draft.groupId : ticket.groupId}
              onChange={(v) => edit && applyUpdate("groupId", v)}
            />
          </Box>
          <Box minWidth={240}>
            <AssigneeSelect
              orgId={orgId}
              value={edit ? draft.assigneeId : ticket.assigneeId}
              onChange={(v) => { if (!edit) setEdit(true); setDraft((d) => ({ ...d, assigneeId: v })); }}
              onlyAgents
              placeholder={(!draft.assigneeId && draft.groupId) ? "Queue-owned (optional)" : "Select assignee"}
            />
          </Box>
        </Stack>

        {/* Participants strip */}
        <Stack direction="row" spacing={1} flexWrap="wrap" alignItems="center">
          <Chip label={assigneeBadge} color="primary" size="small" />
          {!!ticket.tags?.length && ticket.tags.map((tg) => (
            <Chip key={tg.tag_id || tg.name} label={tg.name} size="small" variant="outlined" />
          ))}
          <Chip
            label={`Collaborators: ${collabs.length}`}
            size="small"
            onClick={() => setAddOpen(true)}
            variant="outlined"
          />
        </Stack>

        {/* Collaborators list (compact) */}
        {!!collabs.length && (
          <Stack direction="row" spacing={0.5} flexWrap="wrap">
            {collabs.map((c) => (
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
            ))}
          </Stack>
        )}

        <Divider />

        {/* Description */}
        <Stack spacing={1}>
          <Typography variant="subtitle2" color="text.secondary">Description</Typography>
          {edit ? (
            <TextField fullWidth multiline minRows={4} value={draft.description || ""} onChange={(e) => applyUpdate("description", e.target.value)} />
          ) : (
            <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>{ticket.description || "—"}</Typography>
          )}
        </Stack>

        {/* Category/Subcategory */}
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
          <TextField size="small" label="Category" value={edit ? (draft.category || "") : (ticket.category || "")} onChange={(e) => edit && applyUpdate("category", e.target.value)} fullWidth />
          <TextField size="small" label="Subcategory" value={edit ? (draft.subcategory || "") : (ticket.subcategory || "")} onChange={(e) => edit && applyUpdate("subcategory", e.target.value)} fullWidth />
        </Stack>

        {/* Worklogs */}
        <Stack spacing={1}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography variant="subtitle2" color="text.secondary">Worklogs</Typography>
            <Button size="small" startIcon={<AddIcon />} onClick={() => setLogOpen(true)}>Log work</Button>
          </Stack>
          {logs?.length ? (
            <Stack spacing={0.75}>
              {logs.map((wl) => (
                <Paper key={wl.worklog_id} variant="outlined" sx={{ p: 1, borderRadius: 1.5 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2"><b>{wl.kind}</b> • {wl.minutes}m{wl.note ? ` — ${wl.note}` : ""}</Typography>
                    <Typography variant="caption" color="text.secondary">{new Date(wl.created_at).toLocaleString()}</Typography>
                  </Stack>
                </Paper>
              ))}
            </Stack>
          ) : <Typography variant="body2" color="text.secondary">No work logged yet.</Typography>}
        </Stack>

        {/* Actions */}
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
        orgId={orgId}
        onAdd={async (userIds) => {
          await Promise.all(userIds.map((uid) => CollaboratorModel.add(ticket.ticketId, { userId: uid, role: "contributor" })));
          const list = await CollaboratorModel.list(ticket.ticketId);
          setCollabs(Array.isArray(list) ? list : []);
          setAddOpen(false);
        }}
      />
    </Paper>
  );
}

function WorklogDialog({ open, onClose, ticketId, currentUserId }) {
  const [minutes, setMinutes] = useState(15);
  const [kind, setKind] = useState("analysis");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await WorklogModel.create(ticketId, { userId: currentUserId, minutes: Number(minutes) || 0, kind, note: note?.trim() || undefined });
      onClose?.(true);
    } catch { onClose?.(false); } finally { setSaving(false); }
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
        <Button onClick={save} variant="contained" disabled={saving || !minutes || Number(minutes) <= 0}>{saving ? "Saving…" : "Save"}</Button>
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
