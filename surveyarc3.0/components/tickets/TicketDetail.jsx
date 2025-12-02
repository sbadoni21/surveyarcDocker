"use client";
import { useEffect, useMemo, useState } from "react";
import {
  Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
  IconButton, MenuItem, Paper, Stack, TextField, Typography,
  Divider, Card, CardContent, Alert, Collapse, Fade, Tooltip,
  InputAdornment, CircularProgress, alpha, Grid
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import SaveIcon from "@mui/icons-material/Save";
import CloseIcon from "@mui/icons-material/Close";
import AddIcon from "@mui/icons-material/Add";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import PersonIcon from "@mui/icons-material/Person";
import GroupIcon from "@mui/icons-material/Group";
import LabelIcon from "@mui/icons-material/Label";
import CategoryIcon from "@mui/icons-material/Category";
import FlagIcon from "@mui/icons-material/Flag";
import HistoryIcon from "@mui/icons-material/History";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";

import AssigneeSelect from "./AssigneeSelect";
import GroupSelect from "./GroupSelect";
// import CollaboratorsSelect from "./CollaboratorsSelect"; // unused for now
import WorklogModel from "@/models/postGresModels/worklogModel";
import CollaboratorModel from "@/models/postGresModels/collaboratorModel";
import SLAStatusBar from "./SLAStatusBar";
import { useSLA } from "@/providers/slaProvider";
import TeamSelect from "./TeamMultiSelect";
import { useUser } from "@/providers/postGresPorviders/UserProvider";
import { useTags } from "@/providers/postGresPorviders/TagProvider";
import { useTicketCategories } from "@/providers/postGresPorviders/TicketCategoryProvider";
// taxonomy + survey questions
import { useTicketTaxonomies } from "@/providers/postGresPorviders/TicketTaxonomyProvider";
import QuestionModel from "@/models/questionModel";

import SupportTeamModel from "@/models/postGresModels/supportTeamModel";

const STATUSES = ["new", "open", "pending", "on_hold", "resolved", "closed", "canceled"];
const PRIORITIES = ["low", "normal", "high", "urgent"];
const SEVERITIES = ["sev4", "sev3", "sev2", "sev1"];
const WORK_KINDS = ["analysis", "investigation", "comms", "fix", "review", "other"];

const STATUS_COLORS = {
  new: "#2196F3",
  open: "#4CAF50",
  pending: "#FF9800",
  on_hold: "#9E9E9E",
  resolved: "#8BC34A",
  closed: "#607D8B",
  canceled: "#F44336"
};

const PRIORITY_COLORS = {
  low: "#4CAF50",
  normal: "#2196F3",
  high: "#FF9800",
  urgent: "#F44336"
};

const pickName = (u) =>
  u?.display_name ??
  u?.displayName ??
  u?.full_name ??
  u?.name ??
  u?.email ??
  u?.user_id ??
  u?.userId ??
  u?.uid;

const nn = (v) => (v === undefined || v === "" ? null : v);

export default function TicketDetail({
  ticket,
  orgId,
  participants,
  currentUserId,
  onAssignGroup,
  onAssignTeam,     // make sure page passes this (earlier you used onPatchTeams)
  onAssignAgent,    // same for agents (onPatchAgents -> onAssignAgent)
  onUpdate,
}) {
  const effectiveOrgId = orgId || ticket?.orgId;

  const { refreshTicketSLA, slasByOrg } = useSLA();
  const { getUsersByIds } = useUser();
  const { listCategories, listSubcategories, listProducts } = useTicketCategories();
  const { getCachedTags } = useTags();
  const {
    features,
    impacts,
    rootCauses,
    listFeatures,
    listImpacts,
    listRootCauses,
  } = useTicketTaxonomies();

  const [edit, setEdit] = useState(false);
  const [draft, setDraft] = useState(ticket);
  const [logs, setLogs] = useState([]);
  const [logOpen, setLogOpen] = useState(false);
  const [collabs, setCollabs] = useState([]);
  const [saving, setSaving] = useState(false);
  const [showWorklogs, setShowWorklogs] = useState(true);
  const [showParticipants, setShowParticipants] = useState(true);

  const [assigneeDisplay, setAssigneeDisplay] = useState(null);
  const [agentDisplay, setAgentDisplay] = useState(null);
  const [collabDisplays, setCollabDisplays] = useState({});
  const [teamName, setTeamName] = useState(participants?.teamName || null);
  const [groupName, setGroupName] = useState(participants?.groupName || null);

  const [cats, setCats] = useState([]);
  const [subs, setSubs] = useState([]);
  const [prods, setProds] = useState([]);

  // taxonomy name mapping
  const [featureName, setFeatureName] = useState("—");
  const [impactName, setImpactName] = useState("—");
  const [rcaName, setRcaName] = useState("—");

  // Survey question meta for submittedAnswers
  const [questionMeta, setQuestionMeta] = useState({}); // { [questionId]: { label, ... } }
  const submittedAnswers = ticket?.meta?.submittedAnswers || null;
  const surveyTitle = ticket?.meta?.title || "Survey Ticket";
  const surveyTimestamp = ticket?.meta?.timestamp || null;
  const surveyMessage = ticket?.meta?.message || null;

  useEffect(() => setDraft(ticket), [ticket]);

  useEffect(() => {
    if (ticket?.ticketId) refreshTicketSLA(ticket.ticketId).catch(() => {});
  }, [ticket?.ticketId, refreshTicketSLA]);

  // Worklogs + collaborators
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!ticket?.ticketId) return;
      try {
        const data = await WorklogModel.list(ticket.ticketId);
        if (mounted) setLogs(Array.isArray(data) ? data : []);
      } catch {
        if (mounted) setLogs([]);
      }
      try {
        const c = await CollaboratorModel.list(ticket.ticketId);
        if (mounted) setCollabs(Array.isArray(c) ? c : []);
      } catch {
        if (mounted) setCollabs([]);
      }
    })();
    return () => { mounted = false; };
  }, [ticket?.ticketId]);

  // Resolve users (assignee, agent, collaborators) via UserProvider
  useEffect(() => {
    let mounted = true;
    (async () => {
      const ids = new Set();
      if (ticket?.assigneeId || draft?.assigneeId) ids.add(draft?.assigneeId ?? ticket?.assigneeId);
      if (ticket?.agentId || draft?.agentId) ids.add(draft?.agentId ?? ticket?.agentId);
      for (const c of collabs || []) ids.add(c.user_id);

      const arrIds = [...ids].filter(Boolean);
      if (!arrIds.length) {
        if (mounted) {
          setAssigneeDisplay(null);
          setAgentDisplay(null);
          setCollabDisplays({});
        }
        return;
      }

      const users = await getUsersByIds(arrIds);
      const byId = Object.fromEntries(
        users.map((u) => {
          const id = u.user_id ?? u.userId ?? u.uid;
          return [id, u];
        })
      );

      if (mounted) {
        const aid = draft?.assigneeId ?? ticket?.assigneeId;
        const agid = draft?.agentId ?? ticket?.agentId;
        setAssigneeDisplay(aid ? pickName(byId[aid]) : null);
        setAgentDisplay(agid ? pickName(byId[agid]) : null);

        const collabMap = {};
        for (const c of collabs || []) {
          const id = c.user_id;
          collabMap[id] = pickName(byId[id]) || id;
        }
        setCollabDisplays(collabMap);
      }
    })();
    return () => { mounted = false; };
  }, [ticket?.assigneeId, ticket?.agentId, draft?.assigneeId, draft?.agentId, collabs, getUsersByIds]);

  // Resolve team name via SupportTeamModel
  useEffect(() => {
    let mounted = true;
    (async () => {
      const tid = draft?.teamId || ticket?.teamId || participants?.teamId;
      if (tid && !participants?.teamName && !teamName) {
        try {
          const t = await SupportTeamModel.get?.(tid);
          if (mounted && t) setTeamName(t.name ?? t.team_name ?? t.display_name ?? tid);
        } catch {
          /* ignore */
        }
      }
    })();
    return () => { mounted = false; };
  }, [draft?.teamId, ticket?.teamId, participants?.teamId, teamName]);

  // Categories / Subcategories / Products
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!effectiveOrgId) return;
      const [c, p] = await Promise.all([
        listCategories(effectiveOrgId),
        listProducts(effectiveOrgId),
      ]);
      if (mounted) {
        setCats(Array.isArray(c) ? c : []);
        setProds(Array.isArray(p) ? p : []);
      }

      const catId =
        draft?.category ||
        ticket?.categoryId ||
        ticket?.category;
      if (catId) {
        const s = await listSubcategories(effectiveOrgId, catId);
        if (mounted) setSubs(Array.isArray(s) ? s : []);
      }
    })();
    return () => { mounted = false; };
  }, [
    effectiveOrgId,
    listCategories,
    listProducts,
    listSubcategories,
    draft?.category,
    ticket?.categoryId,
    ticket?.category,
  ]);

  // load taxonomy lists (features / impacts / root causes)
  useEffect(() => {
    if (!effectiveOrgId) return;
    let mounted = true;

    (async () => {
      try {
        const prodId = draft?.productId || ticket?.productId || null;
        await Promise.all([
          listFeatures(effectiveOrgId, { productId: prodId }),
          listImpacts(effectiveOrgId),
          listRootCauses(effectiveOrgId),
        ]);

        if (!mounted) return;

        const fId = draft?.featureId ?? ticket?.featureId;
        const iId = draft?.impactId ?? ticket?.impactId;
        const rId = draft?.rcaId ?? ticket?.rcaId;

        if (fId) {
          const rec = (features || []).find(
            (f) => f.featureId === fId || f.feature_id === fId
          );
          setFeatureName(rec?.name || rec?.code || fId);
        } else {
          setFeatureName("—");
        }

        if (iId) {
          const rec = (impacts || []).find(
            (i) => i.impactId === iId || i.impact_id === iId
          );
          setImpactName(rec?.name || rec?.code || iId);
        } else {
          setImpactName("—");
        }

        if (rId) {
          const rec = (rootCauses || []).find(
            (r) => r.rcaId === rId || r.rca_id === rId
          );
          setRcaName(rec?.name || rec?.code || rId);
        } else {
          setRcaName("—");
        }
      } catch {
        if (mounted) {
          setFeatureName("—");
          setImpactName("—");
          setRcaName("—");
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, [
    effectiveOrgId,
    listFeatures,
    listImpacts,
    listRootCauses,
    draft?.productId,
    ticket?.productId,
    draft?.featureId,
    ticket?.featureId,
    draft?.impactId,
    ticket?.impactId,
    draft?.rcaId,
    ticket?.rcaId,
    features,
    impacts,
    rootCauses,
  ]);

  // Names from category provider
  const catName = useMemo(() => {
    const id = draft?.category ?? ticket?.categoryId ?? ticket?.category;
    const rec = (cats || []).find(
      (x) =>
        (x.category_id ?? x.categoryId) === id ||
        x.id === id
    );
    return rec?.name ?? rec?.category_name ?? id ?? "—";
  }, [cats, draft?.category, ticket?.categoryId, ticket?.category]);

  const subName = useMemo(() => {
    const id = draft?.subcategory ?? ticket?.subcategoryId ?? ticket?.subcategory;
    const rec = (subs || []).find(
      (x) =>
        (x.subcategory_id ?? x.subcategoryId) === id ||
        x.id === id
    );
    return rec?.name ?? rec?.subcategory_name ?? id ?? "—";
  }, [subs, draft?.subcategory, ticket?.subcategoryId, ticket?.subcategory]);

  const prodName = useMemo(() => {
    const id = draft?.productId ?? ticket?.productId;
    const rec = (prods || []).find(
      (x) =>
        (x.product_id ?? x.productId) === id ||
        x.id === id
    );
    return rec?.name ?? rec?.product_name ?? id ?? "—";
  }, [prods, draft?.productId, ticket?.productId]);

  const slaName = useMemo(() => {
    const byOrg = slasByOrg?.[effectiveOrgId] || [];
    const id = draft?.slaId ?? ticket?.slaId;
    if (!id) return "—";
    const rec = byOrg.find((s) => s.sla_id === id || s.slaId === id);
    return rec?.name || id;
  }, [slasByOrg, effectiveOrgId, draft?.slaId, ticket?.slaId]);

  const tagChips = useMemo(() => {
    const explicit = (ticket.tags || [])
      .map((t) => ({
        id: t.tag_id ?? t.tagId ?? t.id,
        name: t.name ?? t.tag_name ?? t.tagName,
      }))
      .filter((t) => t.name);
    if (explicit.length) return explicit;

    const cached = getCachedTags(effectiveOrgId) || [];
    const tagIds = ticket.tagIds || ticket.tags || [];
    return (Array.isArray(tagIds) ? tagIds : [])
      .map((idLike) => {
        const id =
          typeof idLike === "string"
            ? idLike
            : idLike.tag_id ?? idLike.tagId ?? idLike.id;
        const rec = cached.find((c) => (c.tagId ?? c.tag_id) === id);
        return { id, name: rec?.name ?? rec?.tag_name ?? id };
      })
      .filter((t) => t.name);
  }, [ticket.tags, ticket.tagIds, effectiveOrgId, getCachedTags]);

  const queueOwned = !draft?.assigneeId && !!draft?.groupId;

  // load question metadata for survey submittedAnswers
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!submittedAnswers || typeof submittedAnswers !== "object") {
        if (mounted) setQuestionMeta({});
        return;
      }
      try {
        const questionIds = Object.keys(submittedAnswers);
        if (!questionIds.length) {
          if (mounted) setQuestionMeta({});
          return;
        }
        const res = await QuestionModel.getBulkQuestions(questionIds);
        let map = {};
        if (Array.isArray(res)) {
          res.forEach((q) => {
            const id = q.question_id || q.questionId || q.id;
            if (id) map[id] = q;
          });
        } else if (res && typeof res === "object") {
          map = res;
        }
        if (mounted) setQuestionMeta(map);
      } catch (e) {
        if (mounted) setQuestionMeta({});
      }
    })();
    return () => {
      mounted = false;
    };
  }, [submittedAnswers]);

  const save = async () => {
    setSaving(true);
    try {
      await onUpdate?.(ticket.ticketId, {
        subject: draft.subject,
        description: draft.description,
        status: draft.status,
        priority: draft.priority,
        severity: draft.severity,
        groupId: nn(draft.groupId),
        assigneeId: nn(draft.assigneeId),
        teamId: nn(draft.teamId),
        agentId: nn(draft.agentId),
        category: nn(draft.category),
        subcategory: nn(draft.subcategory),
        productId: nn(draft.productId),
        slaId: nn(draft.slaId),
        dueAt: nn(draft.dueAt),
        featureId: nn(draft.featureId),
        impactId: nn(draft.impactId),
        rcaId: nn(draft.rcaId),
        rcaNote: nn(draft.rcaNote),
      });
      setEdit(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 1400, mx: "auto" }}>
      <Fade in timeout={300}>
        <Paper
          elevation={0}
          sx={{
            borderRadius: 3,
            overflow: "hidden",
            border: "1px solid",
            borderColor: "divider",
          }}
        >
          {/* HEADER */}
          <Box
            sx={{
              background: `linear-gradient(135deg, ${alpha(
                "#1976d2",
                0.05
              )} 0%, ${alpha("#42a5f5", 0.05)} 100%)`,
              p: 3,
              borderBottom: "1px solid",
              borderColor: "divider",
            }}
          >
            <Stack
              direction="row"
              alignItems="flex-start"
              justifyContent="space-between"
              spacing={2}
            >
              <Box flex={1}>
                <Stack
                  direction="row"
                  spacing={1.5}
                  alignItems="center"
                  mb={1}
                  flexWrap="wrap"
                >
                  <Chip
                    label={`#${ticket.number || ticket.ticketId}`}
                    size="small"
                    sx={{ fontWeight: 600, fontFamily: "monospace" }}
                  />
                  <Chip
                    label={draft.status?.toUpperCase() || "OPEN"}
                    size="small"
                    sx={{
                      bgcolor: alpha(
                        STATUS_COLORS[draft.status] || STATUS_COLORS.open,
                        0.1
                      ),
                      color: STATUS_COLORS[draft.status] || STATUS_COLORS.open,
                      fontWeight: 600,
                      borderColor:
                        STATUS_COLORS[draft.status] || STATUS_COLORS.open,
                    }}
                    variant="outlined"
                  />
                  <Chip
                    label={draft.priority?.toUpperCase() || "NORMAL"}
                    size="small"
                    icon={<FlagIcon sx={{ fontSize: 16 }} />}
                    sx={{
                      bgcolor: alpha(
                        PRIORITY_COLORS[draft.priority] ||
                          PRIORITY_COLORS.normal,
                        0.1
                      ),
                      color:
                        PRIORITY_COLORS[draft.priority] ||
                        PRIORITY_COLORS.normal,
                      fontWeight: 600,
                    }}
                  />
                  {ticket.severity && (
                    <Chip
                      label={ticket.severity.toUpperCase()}
                      size="small"
                      sx={{ fontWeight: 600 }}
                    />
                  )}
                </Stack>

                {edit ? (
                  <TextField
                    fullWidth
                    value={draft.subject || ""}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, subject: e.target.value }))
                    }
                    variant="standard"
                    sx={{
                      "& .MuiInputBase-input": {
                        fontSize: "1.5rem",
                        fontWeight: 600,
                        py: 0.5,
                      },
                    }}
                  />
                ) : (
                  <Typography variant="h5" fontWeight={600}>
                    {ticket.subject}
                  </Typography>
                )}

                {/* Quick meta row for management */}
                <Stack
                  direction="row"
                  spacing={2}
                  mt={1}
                  flexWrap="wrap"
                  alignItems="center"
                >
                  <Typography variant="caption" color="text.secondary">
                    Created:{" "}
                    <strong>
                      {ticket.createdAt
                        ? new Date(ticket.createdAt).toLocaleString()
                        : "—"}
                    </strong>
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Last activity:{" "}
                    <strong>
                      {ticket.lastActivityAt
                        ? new Date(ticket.lastActivityAt).toLocaleString()
                        : "—"}
                    </strong>
                  </Typography>
                  {ticket.dueAt && (
                    <Chip
                      size="small"
                      icon={<AccessTimeIcon sx={{ fontSize: 14 }} />}
                      label={`Due: ${new Date(
                        ticket.dueAt
                      ).toLocaleString()}`}
                      variant="outlined"
                    />
                  )}
                </Stack>
              </Box>

              <Stack direction="row" spacing={1}>
                {edit ? (
                  <>
                    <Tooltip title="Save changes">
                      <span>
                        <IconButton
                          color="primary"
                          onClick={save}
                          disabled={saving}
                          sx={{
                            bgcolor: "primary.main",
                            color: "white",
                            "&:hover": { bgcolor: "primary.dark" },
                          }}
                        >
                          {saving ? (
                            <CircularProgress size={20} color="inherit" />
                          ) : (
                            <SaveIcon />
                          )}
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip title="Cancel">
                      <IconButton
                        onClick={() => {
                          setDraft(ticket);
                          setEdit(false);
                        }}
                        disabled={saving}
                      >
                        <CloseIcon />
                      </IconButton>
                    </Tooltip>
                  </>
                ) : (
                  <Tooltip title="Edit ticket">
                    <IconButton
                      onClick={() => setEdit(true)}
                      sx={{
                        bgcolor: alpha("#1976d2", 0.1),
                        "&:hover": { bgcolor: alpha("#1976d2", 0.2) },
                      }}
                    >
                      <EditIcon />
                    </IconButton>
                  </Tooltip>
                )}
              </Stack>
            </Stack>

            <Box mt={2}>
              <SLAStatusBar ticket={ticket} />
            </Box>
          </Box>

          {/* BODY */}
          <Box sx={{ p: 3 }}>
            <Stack spacing={3}>
              {/* CORE PROPERTIES */}
              <Card variant="outlined" sx={{ borderRadius: 2 }}>
                <CardContent>
                  <Typography
                    variant="h6"
                    fontWeight={600}
                    mb={2.5}
                    display="flex"
                    alignItems="center"
                    gap={1}
                  >
                    <CategoryIcon fontSize="small" />
                    Core Properties
                  </Typography>

                  <Stack spacing={2.5}>
                    <Stack direction="row" spacing={3} flexWrap="wrap">
                      <PropertyField
                        label="Status"
                        value={draft.status || "open"}
                        edit={edit}
                        type="select"
                        options={STATUSES.map((s) => ({
                          value: s,
                          label: s.toUpperCase(),
                        }))}
                        onChange={(v) =>
                          setDraft((d) => ({ ...d, status: v }))
                        }
                        icon={<FlagIcon fontSize="small" />}
                      />
                      <PropertyField
                        label="Priority"
                        value={draft.priority || "normal"}
                        edit={edit}
                        type="select"
                        options={PRIORITIES.map((p) => ({
                          value: p,
                          label: p.toUpperCase(),
                        }))}
                        onChange={(v) =>
                          setDraft((d) => ({ ...d, priority: v }))
                        }
                      />
                      <PropertyField
                        label="Severity"
                        value={draft.severity || "sev4"}
                        edit={edit}
                        type="select"
                        options={SEVERITIES.map((s) => ({
                          value: s,
                          label: s.toUpperCase(),
                        }))}
                        onChange={(v) =>
                          setDraft((d) => ({ ...d, severity: v }))
                        }
                      />
                    </Stack>

                    <Divider />

                    {/* GROUP + ASSIGNEE */}
                    <Stack spacing={2}>
                      <Box>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          fontWeight={500}
                          mb={1}
                          display="block"
                        >
                          GROUP
                        </Typography>
                        <Stack
                          direction="row"
                          spacing={1}
                          alignItems="center"
                        >
                          <Box flex={1}>
                            <GroupSelect
                              orgId={effectiveOrgId}
                              value={edit ? draft.groupId : ticket.groupId}
                              onChange={(v) => {
                                if (!edit) setEdit(true);
                                setDraft((d) => ({
                                  ...d,
                                  groupId: v ?? null,
                                  assigneeId:
                                    d.groupId !== v ? null : d.assigneeId,
                                }));
                              }}
                            />
                          </Box>
                          {(draft.groupId || ticket.groupId) && (
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={async () => {
                                if (!edit) setEdit(true);
                                setDraft((d) => ({
                                  ...d,
                                  groupId: null,
                                  assigneeId: null,
                                }));
                                await onAssignGroup?.(ticket.ticketId, null);
                              }}
                            >
                              Clear
                            </Button>
                          )}
                        </Stack>
                        {groupName && (
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            mt={0.5}
                          >
                            {groupName}
                          </Typography>
                        )}
                      </Box>

                      <Box>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          fontWeight={500}
                          mb={1}
                          display="block"
                        >
                          ASSIGNEE
                        </Typography>
                        <Stack
                          direction="row"
                          spacing={1}
                          alignItems="center"
                        >
                          <Box flex={1}>
                            <AssigneeSelect
                              orgId={effectiveOrgId}
                              groupId={draft.groupId || undefined}
                              value={edit ? draft.assigneeId : ticket.assigneeId}
                              onChange={(v) => {
                                if (!edit) setEdit(true);
                                setDraft((d) => ({
                                  ...d,
                                  assigneeId: v ?? null,
                                }));
                              }}
                              onlyAgents
                              placeholder={
                                !draft.assigneeId && draft.groupId
                                  ? "Queue-owned (optional)"
                                  : "Select assignee"
                              }
                            />
                          </Box>
                          {queueOwned && (
                            <Chip
                              label="Queue-owned"
                              size="small"
                              color="info"
                              variant="outlined"
                            />
                          )}
                        </Stack>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          mt={0.5}
                        >
                          {assigneeDisplay || "No assignee"}
                        </Typography>
                      </Box>
                    </Stack>

                    <Divider />

                    <Stack direction="row" spacing={3} flexWrap="wrap">
                      <PropertyField
                        label="Category"
                        value={edit ? draft.category || "" : catName}
                        edit={edit}
                        onChange={(v) =>
                          setDraft((d) => ({ ...d, category: v }))
                        }
                      />
                      <PropertyField
                        label="Subcategory"
                        value={edit ? draft.subcategory || "" : subName}
                        edit={edit}
                        onChange={(v) =>
                          setDraft((d) => ({ ...d, subcategory: v }))
                        }
                      />
                      <PropertyField
                        label="Product"
                        value={edit ? draft.productId || "" : prodName}
                        edit={edit}
                        onChange={(v) =>
                          setDraft((d) => ({ ...d, productId: v }))
                        }
                      />
                    </Stack>

                    <Stack direction="row" spacing={3} flexWrap="wrap">
                      <PropertyField
                        label="SLA"
                        value={edit ? draft.slaId || "" : slaName}
                        edit={edit}
                        onChange={(v) =>
                          setDraft((d) => ({ ...d, slaId: v }))
                        }
                        icon={<AccessTimeIcon fontSize="small" />}
                      />
                      <PropertyField
                        label="Due Date"
                        value={
                          edit
                            ? draft.dueAt || ""
                            : ticket.dueAt
                            ? new Date(ticket.dueAt).toLocaleString()
                            : "—"
                        }
                        edit={edit}
                        onChange={(v) =>
                          setDraft((d) => ({ ...d, dueAt: v }))
                        }
                        placeholder="ISO date"
                      />
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>

              {/* IMPACT & ROOT CAUSE CARD */}
              <Card variant="outlined" sx={{ borderRadius: 2 }}>
                <CardContent>
                  <Typography
                    variant="h6"
                    fontWeight={600}
                    mb={2}
                    display="flex"
                    alignItems="center"
                    gap={1}
                  >
                    Impact & Root Cause
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={4}>
                      <PropertyField
                        label="Feature"
                        value={edit ? draft.featureId || "" : featureName}
                        edit={edit}
                        onChange={(v) =>
                          setDraft((d) => ({ ...d, featureId: v || null }))
                        }
                      />
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <PropertyField
                        label="Impact"
                        value={edit ? draft.impactId || "" : impactName}
                        edit={edit}
                        onChange={(v) =>
                          setDraft((d) => ({ ...d, impactId: v || null }))
                        }
                      />
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <PropertyField
                        label="Root Cause"
                        value={edit ? draft.rcaId || "" : rcaName}
                        edit={edit}
                        onChange={(v) =>
                          setDraft((d) => ({ ...d, rcaId: v || null }))
                        }
                      />
                    </Grid>
                  </Grid>
                  <Box mt={2}>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      fontWeight={500}
                      mb={1}
                      display="block"
                    >
                      RCA NOTES
                    </Typography>
                    {edit ? (
                      <TextField
                        fullWidth
                        multiline
                        minRows={2}
                        value={draft.rcaNote || ""}
                        onChange={(e) =>
                          setDraft((d) => ({ ...d, rcaNote: e.target.value }))
                        }
                      />
                    ) : (
                      <Typography
                        variant="body2"
                        color={
                          ticket.rcaNote ? "text.primary" : "text.secondary"
                        }
                        sx={{ fontStyle: ticket.rcaNote ? "normal" : "italic" }}
                      >
                        {ticket.rcaNote || "No RCA notes recorded"}
                      </Typography>
                    )}
                  </Box>
                </CardContent>
              </Card>

              {/* DESCRIPTION */}
              <Card variant="outlined" sx={{ borderRadius: 2 }}>
                <CardContent>
                  <Typography variant="h6" fontWeight={600} mb={2}>
                    Description
                  </Typography>
                  {edit ? (
                    <TextField
                      fullWidth
                      multiline
                      minRows={6}
                      value={draft.description || ""}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          description: e.target.value,
                        }))
                      }
                      placeholder="Enter ticket description..."
                      variant="outlined"
                    />
                  ) : (
                    <Typography
                      variant="body1"
                      sx={{
                        whiteSpace: "pre-wrap",
                        color: ticket.description
                          ? "text.primary"
                          : "text.secondary",
                        fontStyle: ticket.description ? "normal" : "italic",
                      }}
                    >
                      {ticket.description || "No description provided"}
                    </Typography>
                  )}
                </CardContent>
              </Card>

              {/* SURVEY SNAPSHOT CARD */}
              {submittedAnswers && (
                <Card variant="outlined" sx={{ borderRadius: 2 }}>
                  <CardContent>
                    <Typography
                      variant="h6"
                      fontWeight={600}
                      mb={1}
                      display="flex"
                      alignItems="center"
                      gap={1}
                    >
                      Survey Snapshot
                    </Typography>
                    <Typography
                      variant="subtitle2"
                      color="text.secondary"
                      mb={1}
                    >
                      {surveyTitle}
                    </Typography>

                    <Stack
                      direction="row"
                      spacing={2}
                      flexWrap="wrap"
                      mb={2}
                    >
                      {surveyTimestamp && (
                        <Typography
                          variant="caption"
                          color="text.secondary"
                        >
                          Submitted at:{" "}
                          <strong>
                            {new Date(surveyTimestamp).toLocaleString()}
                          </strong>
                        </Typography>
                      )}
                      {surveyMessage && (
                        <Typography
                          variant="caption"
                          color="text.secondary"
                        >
                          Source: <strong>{surveyMessage}</strong>
                        </Typography>
                      )}
                    </Stack>

                    <Divider sx={{ mb: 2 }} />

                    <Grid container spacing={1.5}>
                      {Object.entries(submittedAnswers).map(
                        ([qid, answer]) => {
                          const meta = questionMeta[qid] || {};
                          const label = meta.label || meta.question_text || qid;
                          const value = Array.isArray(answer)
                            ? answer.join(", ")
                            : String(answer);

                          return (
                            <Grid
                              item
                              xs={12}
                              md={6}
                              key={qid}
                            >
                              <Typography
                                variant="caption"
                                color="text.secondary"
                                fontWeight={500}
                                display="block"
                              >
                                {label}
                              </Typography>
                              <Typography
                                variant="body2"
                                color="text.primary"
                              >
                                {value || "—"}
                              </Typography>
                            </Grid>
                          );
                        }
                      )}
                    </Grid>
                  </CardContent>
                </Card>
              )}

              {/* PARTICIPANTS & TAGS */}
              <Card variant="outlined" sx={{ borderRadius: 2 }}>
                <CardContent>
                  <Stack
                    direction="row"
                    justifyContent="space-between"
                    alignItems="center"
                    sx={{ cursor: "pointer" }}
                    onClick={() => setShowParticipants(!showParticipants)}
                  >
                    <Typography
                      variant="h6"
                      fontWeight={600}
                      display="flex"
                      alignItems="center"
                      gap={1}
                    >
                      <PersonIcon fontSize="small" />
                      Participants & Tags
                    </Typography>
                    <IconButton size="small">
                      {showParticipants ? (
                        <ExpandLessIcon />
                      ) : (
                        <ExpandMoreIcon />
                      )}
                    </IconButton>
                  </Stack>

                  <Collapse in={showParticipants}>
                    <Stack spacing={2.5} mt={2.5}>
                      {/* TEAM */}
                      <Box>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          fontWeight={500}
                          mb={1}
                          display="block"
                        >
                          TEAM
                        </Typography>
                        <Stack
                          direction="row"
                          spacing={1}
                          alignItems="center"
                        >
                          <Box flex={1}>
                            <TeamSelect
                              groupId={draft.groupId}
                              value={draft.teamId}
                              onChange={(v) =>
                                setDraft((d) => ({ ...d, teamId: v }))
                              }
                              label=""
                              disabled={!draft.groupId}
                            />
                          </Box>
                          {draft.teamId && (
                            <>
                              <Button
                                size="small"
                                variant="contained"
                                onClick={() =>
                                  onAssignTeam?.(ticket.ticketId, draft.teamId)
                                }
                              >
                                Assign
                              </Button>
                              <Button
                                size="small"
                                variant="outlined"
                                onClick={() => {
                                  setDraft((d) => ({ ...d, teamId: null }));
                                  onAssignTeam?.(ticket.ticketId, null);
                                }}
                              >
                                Clear
                              </Button>
                            </>
                          )}
                        </Stack>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          mt={0.5}
                        >
                          {teamName || "No team assigned"}
                        </Typography>
                      </Box>

                      <Divider />

                      {/* AGENT */}
                      <Box>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          fontWeight={500}
                          mb={1}
                          display="block"
                        >
                          AGENT
                        </Typography>
                        <Stack
                          direction="row"
                          spacing={1}
                          alignItems="center"
                        >
                          <Box flex={1}>
                            <AssigneeSelect
                              orgId={effectiveOrgId}
                              groupId={draft.groupId}
                              value={draft.agentId}
                              onChange={(v) =>
                                setDraft((d) => ({ ...d, agentId: v }))
                              }
                              label=""
                              placeholder="Select agent"
                              disabled={!draft.groupId}
                            />
                          </Box>
                          {draft.agentId && (
                            <>
                              <Button
                                size="small"
                                variant="contained"
                                onClick={() =>
                                  onAssignAgent?.(ticket.ticketId, draft.agentId)
                                }
                              >
                                Assign
                              </Button>
                              <Button
                                size="small"
                                variant="outlined"
                                onClick={() => {
                                  setDraft((d) => ({ ...d, agentId: null }));
                                  onAssignAgent?.(ticket.ticketId, null);
                                }}
                              >
                                Clear
                              </Button>
                            </>
                          )}
                        </Stack>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          mt={0.5}
                        >
                          {agentDisplay || "No agent assigned"}
                        </Typography>
                      </Box>

                      <Divider />

                      {/* TAGS */}
                      <Box>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          fontWeight={500}
                          mb={1}
                          display="block"
                        >
                          TAGS
                        </Typography>
                        <Stack
                          direction="row"
                          spacing={1}
                          flexWrap="wrap"
                          gap={1}
                        >
                          {tagChips.length ? (
                            tagChips.map((tg) => (
                              <Chip
                                key={tg.id}
                                label={tg.name}
                                size="small"
                                icon={<LabelIcon sx={{ fontSize: 16 }} />}
                                sx={{ borderRadius: 1.5 }}
                              />
                            ))
                          ) : (
                            <Typography
                              variant="body2"
                              color="text.secondary"
                              fontStyle="italic"
                            >
                              No tags
                            </Typography>
                          )}
                        </Stack>
                      </Box>

                      <Divider />

                      {/* COLLABORATORS */}
                      <Box>
                        <Stack
                          direction="row"
                          justifyContent="space-between"
                          alignItems="center"
                          mb={1}
                        >
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            fontWeight={500}
                          >
                            COLLABORATORS
                          </Typography>
                          <Button
                            size="small"
                            startIcon={<AddIcon />}
                            onClick={() => setLogOpen(true)}
                          >
                            Add
                          </Button>
                        </Stack>
                        <Stack
                          direction="row"
                          spacing={1}
                          flexWrap="wrap"
                          gap={1}
                        >
                          {collabs.length ? (
                            collabs.map((c) => (
                              <Chip
                                key={c.user_id}
                                label={`${collabDisplays[c.user_id] ||
                                  c.user_id}${c.role ? ` • ${c.role}` : ""}`}
                                onDelete={async () => {
                                  await CollaboratorModel.remove(
                                    ticket.ticketId,
                                    c.user_id
                                  );
                                  const list = await CollaboratorModel.list(
                                    ticket.ticketId
                                  );
                                  setCollabs(Array.isArray(list) ? list : []);
                                }}
                                size="small"
                                sx={{ borderRadius: 1.5 }}
                              />
                            ))
                          ) : (
                            <Typography
                              variant="body2"
                              color="text.secondary"
                              fontStyle="italic"
                            >
                              No collaborators
                            </Typography>
                          )}
                        </Stack>
                      </Box>
                    </Stack>
                  </Collapse>
                </CardContent>
              </Card>

              {/* WORKLOGS */}
              <Card variant="outlined" sx={{ borderRadius: 2 }}>
                <CardContent>
                  <Stack
                    direction="row"
                    justifyContent="space-between"
                    alignItems="center"
                    sx={{ cursor: "pointer" }}
                    onClick={() => setShowWorklogs(!showWorklogs)}
                  >
                    <Typography
                      variant="h6"
                      fontWeight={600}
                      display="flex"
                      alignItems="center"
                      gap={1}
                    >
                      <HistoryIcon fontSize="small" />
                      Worklogs ({logs.length})
                    </Typography>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Button
                        size="small"
                        startIcon={<AddIcon />}
                        onClick={(e) => {
                          e.stopPropagation();
                          setLogOpen(true);
                        }}
                        variant="contained"
                      >
                        Log Work
                      </Button>
                      <IconButton size="small">
                        {showWorklogs ? (
                          <ExpandLessIcon />
                        ) : (
                          <ExpandMoreIcon />
                        )}
                      </IconButton>
                    </Stack>
                  </Stack>

                  <Collapse in={showWorklogs}>
                    <Box mt={2.5}>
                      {logs?.length ? (
                        <Stack spacing={1.5}>
                          {logs.map((wl) => (
                            <Paper
                              key={wl.worklog_id}
                              variant="outlined"
                              sx={{
                                p: 2,
                                borderRadius: 2,
                                bgcolor: alpha("#1976d2", 0.02),
                                transition: "all 0.2s",
                                "&:hover": {
                                  bgcolor: alpha("#1976d2", 0.05),
                                  borderColor: "primary.main",
                                },
                              }}
                            >
                              <Stack
                                direction="row"
                                justifyContent="space-between"
                                alignItems="flex-start"
                              >
                                <Stack spacing={0.5} flex={1}>
                                  <Stack
                                    direction="row"
                                    spacing={1.5}
                                    alignItems="center"
                                  >
                                    <Chip
                                      label={wl.kind.toUpperCase()}
                                      size="small"
                                      color="primary"
                                      variant="outlined"
                                      sx={{
                                        fontWeight: 600,
                                        fontSize: "0.7rem",
                                      }}
                                    />
                                    <Chip
                                      label={`${wl.minutes} min`}
                                      size="small"
                                      icon={
                                        <AccessTimeIcon sx={{ fontSize: 14 }} />
                                      }
                                      sx={{ fontWeight: 500 }}
                                    />
                                  </Stack>
                                  {wl.note && (
                                    <Typography
                                      variant="body2"
                                      color="text.secondary"
                                      mt={1}
                                    >
                                      {wl.note}
                                    </Typography>
                                  )}
                                </Stack>
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                  sx={{ whiteSpace: "nowrap", ml: 2 }}
                                >
                                  {new Date(
                                    wl.created_at
                                  ).toLocaleDateString()}
                                  <br />
                                  {new Date(
                                    wl.created_at
                                  ).toLocaleTimeString()}
                                </Typography>
                              </Stack>
                            </Paper>
                          ))}
                        </Stack>
                      ) : (
                        <Alert severity="info" sx={{ borderRadius: 2 }}>
                          No work logged yet. Click &quot;Log Work&quot; to add
                          your first entry.
                        </Alert>
                      )}
                    </Box>
                  </Collapse>
                </CardContent>
              </Card>
            </Stack>
          </Box>

          {/* STICKY SAVE BAR */}
          <Collapse in={edit}>
            <Box
              sx={{
                p: 2,
                borderTop: "1px solid",
                borderColor: "divider",
                bgcolor: alpha("#1976d2", 0.03),
              }}
            >
              <Stack direction="row" spacing={2} justifyContent="flex-end">
                <Button
                  onClick={() => {
                    setDraft(ticket);
                    setEdit(false);
                  }}
                  disabled={saving}
                  size="large"
                >
                  Cancel Changes
                </Button>
                <Button
                  variant="contained"
                  onClick={save}
                  disabled={saving}
                  startIcon={
                    saving ? (
                      <CircularProgress size={20} color="inherit" />
                    ) : (
                      <SaveIcon />
                    )
                  }
                  size="large"
                  sx={{ minWidth: 140 }}
                >
                  {saving ? "Saving..." : "Save Changes"}
                </Button>
              </Stack>
            </Box>
          </Collapse>
        </Paper>
      </Fade>

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
    </Box>
  );
}

function PropertyField({
  label,
  value,
  edit,
  type = "text",
  options,
  onChange,
  icon,
  placeholder,
}) {
  return (
    <Box sx={{ minWidth: 200, flex: 1 }}>
      <Typography
        variant="caption"
        color="text.secondary"
        fontWeight={500}
        mb={1}
        display="flex"
        alignItems="center"
        gap={0.5}
      >
        {icon}
        {label.toUpperCase()}
      </Typography>
      {edit ? (
        type === "select" ? (
          <TextField
            select
            size="small"
            fullWidth
            value={value}
            onChange={(e) => onChange?.(e.target.value)}
            sx={{
              "& .MuiOutlinedInput-root": {
                borderRadius: 1.5,
              },
            }}
          >
            {options.map((o) => (
              <MenuItem key={o.value} value={o.value}>
                {o.label}
              </MenuItem>
            ))}
          </TextField>
        ) : (
          <TextField
            size="small"
            fullWidth
            value={value}
            onChange={(e) => onChange?.(e.target.value)}
            placeholder={placeholder}
            sx={{
              "& .MuiOutlinedInput-root": {
                borderRadius: 1.5,
              },
            }}
          />
        )
      ) : (
        <Typography variant="body1" fontWeight={500}>
          {value || "—"}
        </Typography>
      )}
    </Box>
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
      await WorklogModel.create(ticketId, {
        userId: currentUserId,
        minutes: Number(minutes) || 0,
        kind,
        note: note?.trim() || undefined,
      });
      onClose?.(true);
      setMinutes(15);
      setKind("analysis");
      setNote("");
    } catch {
      onClose?.(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={() => !saving && onClose?.(false)}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: { borderRadius: 3 },
      }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Stack direction="row" alignItems="center" gap={1}>
          <AccessTimeIcon color="primary" />
          <Typography variant="h6" fontWeight={600}>
            Log Work
          </Typography>
        </Stack>
      </DialogTitle>
      <DialogContent dividers sx={{ pt: 3 }}>
        <Stack spacing={2.5}>
          <TextField
            label="Time Spent (minutes)"
            type="number"
            inputProps={{ min: 1, step: 1 }}
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            fullWidth
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <AccessTimeIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
            sx={{
              "& .MuiOutlinedInput-root": {
                borderRadius: 2,
              },
            }}
          />
          <TextField
            select
            label="Work Type"
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            fullWidth
            sx={{
              "& .MuiOutlinedInput-root": {
                borderRadius: 2,
              },
            }}
          >
            {WORK_KINDS.map((k) => (
              <MenuItem key={k} value={k}>
                {k.charAt(0).toUpperCase() + k.slice(1)}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Notes (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            fullWidth
            multiline
            minRows={3}
            placeholder="Describe what you worked on..."
            sx={{
              "& .MuiOutlinedInput-root": {
                borderRadius: 2,
              },
            }}
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 2.5, gap: 1 }}>
        <Button onClick={() => onClose?.(false)} disabled={saving} size="large">
          Cancel
        </Button>
        <Button
          onClick={save}
          variant="contained"
          disabled={saving || !minutes || Number(minutes) <= 0}
          startIcon={
            saving ? (
              <CircularProgress size={20} color="inherit" />
            ) : (
              <SaveIcon />
            )
          }
          size="large"
          sx={{ minWidth: 120 }}
        >
          {saving ? "Saving..." : "Save Log"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
