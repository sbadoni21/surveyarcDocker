"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Checkbox,
  Container,
  FormControlLabel,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { usePathname, useRouter } from "next/navigation";

import GroupSelect from "@/components/tickets/GroupSelect";
import AssigneeSelect from "@/components/tickets/AssigneeSelect";
import TeamMultiSelect from "@/components/tickets/TeamMultiSelect";
import AgentMultiSelect from "@/components/tickets/AgentMultiSelect";
import CollaboratorsSelect from "@/components/tickets/CollaboratorsSelect";

import { useTickets } from "@/providers/ticketsProvider";
import { useSLA } from "@/providers/slaProvider";
import { useUser } from "@/providers/postGresPorviders/UserProvider";

const PRIORITIES = ["low", "normal", "high", "urgent"];
const SEVERITIES = ["sev4", "sev3", "sev2", "sev1"];

export default function NewTicketPage() {
  const router = useRouter();
  const path = usePathname();
  // Expecting route like: /post-gres/tickets/<orgId>/new
  const orgId = useMemo(() => path?.split("/")?.[3] ?? "", [path]);

  const { uid: currentUserId } = useUser() || {};
  const requesterId = currentUserId;

  const { create } = useTickets();
  const { listSLAs, slasByOrg } = useSLA();
  const slaOptions = slasByOrg[orgId] || [];

  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    subject: "",
    description: "",
    priority: "normal",
    severity: "sev4",
    queueOwned: true,        // default to queue-owned, can be toggled
    groupId: "",
    teamIds: [],
    agentIds: [],
    assigneeId: "",
    category: "",
    subcategory: "",
    productId: "",
    slaId: "",
    dueAt: "",
    tagsCsv: "",
    collaborators: [],
  });

  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const isQueueOwned = form.queueOwned === true;

  useEffect(() => {
    if (isQueueOwned && form.assigneeId) {
      setForm((f) => ({ ...f, assigneeId: "" }));
    }
  }, [isQueueOwned]); // eslint-disable-line

  // When group changes, reset teamIds & agentIds to enforce "only inside group"
  useEffect(() => {
    setForm((f) => ({ ...f, teamIds: [], agentIds: [] }));
  }, [form.groupId]);

  // Load SLAs on mount for this org
  useEffect(() => {
    if (orgId) listSLAs(orgId).catch(() => {});
  }, [orgId, listSLAs]);

  const subjectOK = form.subject.trim().length > 0;
  const groupOK = !isQueueOwned || (isQueueOwned && form.groupId.trim().length > 0);
  const canSave = subjectOK && groupOK && !!orgId && !!requesterId;

  const handleCancel = () => {
    // go back to tickets list for this org
    router.push(`/post-gres/tickets/${encodeURIComponent(orgId)}`);
  };

  const handleCreate = async () => {
    setSaving(true);
    try {
      const tagIds = form.tagsCsv
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      const payload = {
        orgId,
        requesterId,
        subject: form.subject.trim(),
        description: form.description || "",
        priority: form.priority,
        severity: form.severity,

        groupId: form.groupId || null,

        // “scoped” associations
        teamIds: form.teamIds || [],
        agentIds: form.agentIds || [],

        // direct assignee only if not queue-owned
        assigneeId: isQueueOwned ? null : (form.assigneeId || null),

        // classification
        category: form.category || null,
        subcategory: form.subcategory || null,
        productId: form.productId || null,

        // SLA / due
        slaId: form.slaId || null,
        dueAt: form.dueAt || null,

        // tags
        tags: tagIds.length ? tagIds : undefined,
      };

      const created = await create(payload);

      // OPTIONAL: post collaborators after ticket creation
      // await Promise.all(
      //   (form.collaborators || []).map((uid) =>
      //     fetch(`/api/post-gres-apis/tickets/${encodeURIComponent(created.ticketId)}/collaborators`, {
      //       method: "POST",
      //       headers: { "Content-Type": "application/json" },
      //       body: JSON.stringify({ ticket_id: created.ticketId, user_id: uid, role: "contributor" }),
      //     })
      //   )
      // );

      // Navigate back to the list (or deep-link to the created ticket if your UI supports it)
      router.replace(`/post-gres/tickets/${encodeURIComponent(orgId)}?created=${encodeURIComponent(created.ticketId)}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Container maxWidth="md" sx={{ py: 3 }}>
      <Card variant="outlined" sx={{ borderRadius: 2 }}>
        <CardHeader
          title="New Ticket"
          subheader={orgId ? `Org: ${orgId}` : "Missing orgId in URL"}
        />
        <CardContent>
          <Stack spacing={1.5}>
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
              control={
                <Checkbox
                  checked={isQueueOwned}
                  onChange={(e) => update("queueOwned", e.target.checked)}
                />
              }
              label="Create in a Group Queue (no direct assignee)"
            />

            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
              <Box sx={{ flex: 1, minWidth: 220 }}>
                <GroupSelect
                  orgId={orgId}
                  value={form.groupId}
                  onChange={(v) => update("groupId", v)}
                />
              </Box>
              <Box sx={{ flex: 1, minWidth: 240 }}>
                <AssigneeSelect
                  orgId={orgId}
                  groupId={form.groupId || undefined} // restrict by group
                  value={form.assigneeId}
                  onChange={(v) => update("assigneeId", v)}
                  label="Assignee"
                  placeholder={isQueueOwned ? "Disabled (queue-owned)" : "Select assignee"}
                  disabled={isQueueOwned}
                />
              </Box>
            </Stack>
            {!groupOK && (
              <Typography variant="caption" color="error">
                Group is required when creating a queue-owned ticket.
              </Typography>
            )}

            {/* Teams & Agents — filtered by selected group */}
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
              >
                {PRIORITIES.map((p) => (
                  <MenuItem key={p} value={p}>
                    {p.toUpperCase()}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                label="Severity"
                select
                fullWidth
                value={form.severity}
                onChange={(e) => update("severity", e.target.value)}
              >
                {SEVERITIES.map((s) => (
                  <MenuItem key={s} value={s}>
                    {s.toUpperCase()}
                  </MenuItem>
                ))}
              </TextField>
            </Stack>

            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
              <TextField
                label="Product ID"
                value={form.productId}
                onChange={(e) => update("productId", e.target.value)}
                fullWidth
              />
              <TextField
                select
                label="SLA"
                fullWidth
                value={form.slaId}
                onChange={(e) => update("slaId", e.target.value)}
                helperText={
                  slaOptions.length ? "Choose an SLA policy" : "No SLAs found for this org"
                }
              >
                <MenuItem key="" value="">
                  None
                </MenuItem>
                {slaOptions.map((s) => (
                  <MenuItem key={s.sla_id} value={s.sla_id}>
                    {s.name}{" "}
                    {s.first_response_minutes ? `• FR ${s.first_response_minutes}m` : ""}{" "}
                    {s.resolution_minutes ? `• RES ${s.resolution_minutes}m` : ""}
                  </MenuItem>
                ))}
              </TextField>
            </Stack>

            <TextField
              label="Due at (ISO)"
              value={form.dueAt}
              onChange={(e) => update("dueAt", e.target.value)}
              fullWidth
              placeholder="2025-09-25T17:30:00Z"
            />

            <TextField
              label="Tag IDs (comma-separated)"
              value={form.tagsCsv}
              onChange={(e) => update("tagsCsv", e.target.value)}
              fullWidth
              placeholder="tag_vip,tag_bug"
            />

            {/* Optional: collaborators UI; not submitted unless you wire the API call after create */}
            <CollaboratorsSelect
              orgId={orgId}
              value={form.collaborators}
              onChange={(arr) => update("collaborators", arr)}
            />
          </Stack>

          <Stack direction="row" spacing={1} justifyContent="flex-end" sx={{ mt: 2 }}>
            <Button onClick={handleCancel} disabled={saving}>
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={handleCreate}
              disabled={saving || !canSave}
            >
              {saving ? "Creating…" : "Create Ticket"}
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </Container>
  );
}
