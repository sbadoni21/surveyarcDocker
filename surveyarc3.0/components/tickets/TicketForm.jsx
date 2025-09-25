"use client";
import { useEffect, useState } from "react";
import { Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, MenuItem, Stack, TextField, Typography } from "@mui/material";
import AssigneeSelect from "./AssigneeSelect";
import GroupSelect from "./GroupSelect";
import CollaboratorsSelect from "./CollaboratorsSelect";

const PRIORITIES = ["low", "normal", "high", "urgent"];
const SEVERITIES = ["sev4", "sev3", "sev2", "sev1"];

export default function TicketForm({ open, onClose, onSubmit, initial, orgId, requestorId, title = "New Ticket", currentUserId }) {
  const [form, setForm] = useState(() => ({
    subject: initial?.subject || "",
    description: initial?.description || "",
    priority: initial?.priority || "normal",
    severity: initial?.severity || "sev4",
    // ownership
    queueOwned: Boolean(!initial?.assigneeId && initial?.groupId),
    groupId: initial?.groupId || "",
    assigneeId: initial?.assigneeId || "",
    // classification
    category: initial?.category || "",
    subcategory: initial?.subcategory || "",
    productId: initial?.productId || "",
    // SLA / due
    slaId: initial?.slaId || "",
    dueAt: initial?.dueAt || "",
    // tags
    tagsCsv: (initial?.tags || []).map((t) => t.tag_id || t).join(","),
    // collaborators
    collaborators: [],
  }));
  const [saving, setSaving] = useState(false);

  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const isQueueOwned = form.queueOwned === true;

  useEffect(() => {
    if (isQueueOwned && form.assigneeId) setForm((f) => ({ ...f, assigneeId: "" }));
  }, [isQueueOwned]); // eslint-disable-line

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
        assigneeId: isQueueOwned ? null : (form.assigneeId || null),
        category: form.category || null,
        subcategory: form.subcategory || null,
        productId: form.productId || null,
        slaId: form.slaId || null,
        dueAt: form.dueAt || null,
        tags: tagIds.length ? tagIds : undefined,
      };
      const created = await onSubmit(payload);

      // OPTIONAL: immediately add collaborators (if your API is ready)
      // await Promise.all(form.collaborators.map((uid) =>
      //   fetch(`/api/post-gres-apis/tickets/${encodeURIComponent(created.ticketId)}/collaborators`, {
      //     method: "POST", headers: { "Content-Type": "application/json" },
      //     body: JSON.stringify({ ticket_id: created.ticketId, user_id: uid, role: "contributor" }),
      //   })
      // ));

      onClose?.();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={1.5} sx={{ mt: 1 }}>
          <TextField label="Subject" value={form.subject} onChange={(e) => update("subject", e.target.value)} fullWidth required />
          <TextField label="Description" value={form.description} onChange={(e) => update("description", e.target.value)} fullWidth multiline minRows={3} />

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
                value={form.assigneeId}
                onChange={(v) => update("assigneeId", v)}
                onlyAgents
                label="Assignee"
                placeholder={isQueueOwned ? "Disabled (queue-owned)" : "Select assignee"}
                disabled={isQueueOwned}
              />
            </Box>
          </Stack>
          {!groupOK && <Typography variant="caption" color="error">Group is required when creating a queue-owned ticket.</Typography>}

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <TextField label="Category" value={form.category} onChange={(e) => update("category", e.target.value)} fullWidth />
            <TextField label="Subcategory" value={form.subcategory} onChange={(e) => update("subcategory", e.target.value)} fullWidth />
          </Stack>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <TextField label="Priority" select fullWidth value={form.priority} onChange={(e) => update("priority", e.target.value)}>
              {PRIORITIES.map((p) => <MenuItem key={p} value={p}>{p.toUpperCase()}</MenuItem>)}
            </TextField>
            <TextField label="Severity" select fullWidth value={form.severity} onChange={(e) => update("severity", e.target.value)}>
              {SEVERITIES.map((s) => <MenuItem key={s} value={s}>{s.toUpperCase()}</MenuItem>)}
            </TextField>
          </Stack>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <TextField label="Product ID" value={form.productId} onChange={(e) => update("productId", e.target.value)} fullWidth />
            <TextField label="SLA ID" value={form.slaId} onChange={(e) => update("slaId", e.target.value)} fullWidth />
          </Stack>

          <TextField label="Due at (ISO)" value={form.dueAt} onChange={(e) => update("dueAt", e.target.value)} fullWidth placeholder="2025-09-25T17:30:00Z" />

          <TextField label="Tag IDs (comma-separated)" value={form.tagsCsv} onChange={(e) => update("tagsCsv", e.target.value)} fullWidth placeholder="tag_vip,tag_bug" />

          <CollaboratorsSelect orgId={orgId} value={form.collaborators} onChange={(arr) => update("collaborators", arr)} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>Cancel</Button>
        <Button onClick={handleSubmit} variant="contained" disabled={saving || !canSave}>{saving ? "Saving…" : "Save"}</Button>
      </DialogActions>
    </Dialog>
  );
}
