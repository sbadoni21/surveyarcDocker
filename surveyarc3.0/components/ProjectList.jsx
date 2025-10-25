"use client";

import React, { useMemo, useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getCookie } from "cookies-next";
import { useOrganisation } from "@/providers/postGresPorviders/organisationProvider";
import { useProject } from "@/providers/postGresPorviders/projectProvider";
import { useUser } from "@/providers/postGresPorviders/UserProvider";
import { timeformater } from "@/utils/timeformater";

// MUI
import {
  Box, Paper, Stack, Toolbar, Typography, TextField, InputAdornment,
  IconButton, Tooltip, Chip, Table, TableHead, TableRow, TableCell,
  TableBody, TableContainer, TableSortLabel, Pagination, FormControlLabel,
  Checkbox, Select, MenuItem, Dialog, DialogTitle, DialogContent, DialogActions,
  Alert, Snackbar, Avatar, Button, AvatarGroup, Badge, Card, CardContent,
  Divider, LinearProgress,
} from "@mui/material";
import Autocomplete from "@mui/material/Autocomplete";

// Icons
import SearchIcon from "@mui/icons-material/Search";
import GroupIcon from "@mui/icons-material/Group";
import LockIcon from "@mui/icons-material/Lock";
import PersonRemoveIcon from "@mui/icons-material/PersonRemove";
import ClearIcon from "@mui/icons-material/Clear";
import CheckIcon from "@mui/icons-material/Check";
import AddIcon from "@mui/icons-material/Add";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import LocalOfferIcon from "@mui/icons-material/LocalOffer";
import FolderIcon from "@mui/icons-material/Folder";
import StarIcon from "@mui/icons-material/Star";
import StarBorderIcon from "@mui/icons-material/StarBorder";
import ArchiveIcon from "@mui/icons-material/Archive";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import ProjectActionsMenu from "./ProjectActionsMenu";

const ITEMS_PER_PAGE = 10;
// put this near the top of the file (once)
const STATUS_META = {
  planning:   { label: "Planning",    color: "info",    variant: "outlined" },
  in_progress:{ label: "In Progress", color: "primary", variant: "filled"   },
  on_hold:    { label: "On Hold",     color: "warning", variant: "outlined" },
  completed:  { label: "Completed",   color: "success", variant: "filled"   },
  cancelled:  { label: "Cancelled",   color: "error",   variant: "outlined" },
};

// ---------- helpers ----------
const norm = (v) => (typeof v === "string" ? v.toLowerCase().trim() : v);
const getId = (obj) => obj?.uid || obj?.user_id || obj?.id || "";
const getRole = (obj) => norm(obj?.role || obj?.member_role || "");

// sort helpers
function descendingComparator(a, b, orderBy) {
  const va = orderBy === "members"
    ? (Array.isArray(a.members) ? a.members.length : 0)
    : a?.[orderBy];
  const vb = orderBy === "members"
    ? (Array.isArray(b.members) ? b.members.length : 0)
    : b?.[orderBy];

  if (va === undefined || va === null) return 1;
  if (vb === undefined || vb === null) return -1;

  if (orderBy === "name") return vb.toString().localeCompare(va.toString());
  return vb > va ? 1 : vb < va ? -1 : 0;
}
function getComparator(order, orderBy) {
  return order === "desc"
    ? (a, b) => descendingComparator(a, b, orderBy)
    : (a, b) => -descendingComparator(a, b, orderBy);
}

export default function ProjectsList({
  orgId,
  projects = [],
  onEditProject,
}) {
  const router = useRouter();
  const { user, getUsersByIds } = useUser();
  const { organisation } = useOrganisation();

  const {
    updateProject, getProjectById,deleteProject,
    addMember, updateMember, removeMember,
    addSurveyId, removeSurveyId, patchSurveys,
    addMilestone, patchMilestone, deleteMilestone,
    patchTags, addAttachment, removeAttachment,
    setStatus, getTimeline, recomputeProgress,
    searchProjects, bulkProjects, listFavorites, addFavorite, removeFavorite,
  } = useProject();

  // table state
  const [order, setOrder] = useState("desc");
  const [orderBy, setOrderBy] = useState("lastActivity");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [onlyMine, setOnlyMine] = useState(false);

  // selection / favorites / timeline
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [timelineData, setTimelineData] = useState({ milestones: [], activities: [] });
  const [favorites, setFavorites] = useState(new Set());

  // dialog state
  const [memberOpen, setMemberOpen] = useState(false);
  const [activeProject, setActiveProject] = useState(null);
  const [activeProjectId, setActiveProjectId] = useState(null);
  const [activeLoading, setActiveLoading] = useState(false);

  // tag editor state
  const [editingTags, setEditingTags] = useState(null); // projectId being edited
  const [tagInput, setTagInput] = useState("");

  // assignment form state
  const [selectedOrgMember, setSelectedOrgMember] = useState(null);
  const [newMemberUid, setNewMemberUid] = useState("");
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [newMemberRole, setNewMemberRole] = useState("contributor");

  // quick editors
  const [attachName, setAttachName] = useState("");
  const [attachUrl, setAttachUrl] = useState("");
  const [surveyInput, setSurveyInput] = useState("");

  // ui
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState({ open: false, severity: "info", msg: "" });
  const [memberProfiles, setMemberProfiles] = useState({});

  // ---------- permissions ----------
  const isOwner = useMemo(() => {
    const team = Array.isArray(organisation?.team_members) ? organisation.team_members : [];
    const myId = getId(user) || user?.uid || "";
    return team.some((m) => getId(m) === myId && norm(m?.role) === "owner");
  }, [organisation, user]);

  const byUid = useCallback(
    (uid) => (uid ? memberProfiles[uid] : undefined),
    [memberProfiles]
  );

  const userInProject = useCallback(
    (project) => {
      const myId = getId(user);
      return Array.isArray(project?.members) && project.members.some((m) => getId(m) === myId);
    },
    [user]
  );

  useEffect(() => {
    if (!memberOpen || !activeProject?.members?.length) return;

    const uids = Array.from(
      new Set(
        (activeProject.members || [])
          .map((m) => m?.uid || m?.user_id || m?.id)
          .filter(Boolean)
      )
    );

    if (uids.length === 0) return;
    const missing = uids.filter((id) => !memberProfiles[id]);
    if (missing.length === 0) return;

    (async () => {
      try {
        const users = await getUsersByIds(missing);
        const next = {};
        (users || []).forEach((u) => {
          const key = u?.uid || u?.user_id || u?.id;
          if (key) next[key] = u;
        });
        setMemberProfiles((prev) => ({ ...prev, ...next }));
      } catch (e) {
        console.error("Loading member profiles failed:", e);
      }
    })();
  }, [memberOpen, activeProject, getUsersByIds, memberProfiles]);

  const canManageProject = useCallback(
    (project) => {
      if (isOwner) return true;
      const myId = getId(user);
      const me = (project?.members || []).find((m) => getId(m) === myId);
      const r = getRole(me);
      return ["owner", "admin", "editor"].includes(r);
    },
    [isOwner, user]
  );

  const memberLabel = (m) => {
    const uid = getId(m);
    const prof = byUid(uid);
    return prof?.display_name || prof?.email || m?.email || uid || "—";
  };

  const memberEmail = (m) => {
    const uid = getId(m);
    const prof = byUid(uid);
    const email = prof?.email || m?.email || "";
    return email && email !== memberLabel(m) ? email : "";
  };

  const memberAvatarText = (m) => {
    const nameLike = memberLabel(m);
    return (nameLike || "?").charAt(0).toUpperCase();
  };

  const canEnter = useCallback(
    (project) => isOwner || userInProject(project),
    [isOwner, userInProject]
  );

  const orgTeamMembers = useMemo(
    () => (Array.isArray(organisation?.team_members) ? organisation.team_members : []),
    [organisation]
  );

  const unassignedCandidates = useMemo(() => {
    if (!activeProject) return orgTeamMembers;
    const assigned = new Set((activeProject.members || []).map((m) => getId(m)));
    return orgTeamMembers.filter((m) => !assigned.has(getId(m)));
  }, [orgTeamMembers, activeProject]);

  // Load favorites
  const myUserId = useMemo(() => getId(user) || user?.uid || getCookie("currentUserId"), [user]);

  useEffect(() => {
    if (!myUserId) return;
    (async () => {
      try {
        console.log(myUserId)
        const favs = await listFavorites(myUserId);
        const favSet = new Set((favs?.items || []).map((x) => x.projectId || x.project_id));
        setFavorites(favSet);
      } catch (e) {
        console.error("Failed to load favorites:", e);
      }
    })();
  }, [myUserId, listFavorites]);

  // ---------- filtering/sorting/paging ----------
  const filteredSorted = useMemo(() => {
    const q = search.trim().toLowerCase();
    console.log(q)
    let rows = projects.filter((p) => {
      if (statusFilter !== "all") {
        const isActive = !!p.is_active;
        if (statusFilter === "active" && !isActive) return false;
        if (statusFilter === "dormant" && isActive) return false;
      }
      if (onlyMine && !userInProject(p) && !isOwner) return false;

      if (!q) return true;
      const hay = [p.name, p.projectId, p.status, ...(Array.isArray(p.tags) ? p.tags : [])]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
    return rows.sort(getComparator(order, orderBy));
  }, [projects, search, statusFilter, onlyMine, userInProject, isOwner, order, orderBy]);

  const totalPages = Math.ceil(filteredSorted.length / ITEMS_PER_PAGE) || 1;
  const pageSafe = Math.min(page, totalPages);

  const rows = useMemo(() => {
    const start = (pageSafe - 1) * ITEMS_PER_PAGE;
    return filteredSorted.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredSorted, pageSafe]);

  useEffect(() => {
    if (page !== pageSafe) setPage(pageSafe);
  }, [page, pageSafe]);

  // ---------- utilities ----------
  const openToast = useCallback((msg, severity = "info") => {
    setToast({ open: true, severity, msg });
  }, []);

  const toggleRowSelect = useCallback((pid) => {
    setSelectedIds((prev) => {
      const n = new Set(prev);
      if (n.has(pid)) n.delete(pid); else n.add(pid);
      return n;
    });
  }, []);

  const toggleFavorite = useCallback(async (project) => {
    try {
      const pid = project.projectId;
      const isFav = favorites.has(pid);
      if (isFav) {
        await removeFavorite(myUserId, pid);
        setFavorites((prev) => {
          const n = new Set(prev);
          n.delete(pid);
          return n;
        });
      } else {
        await addFavorite(myUserId, pid);
        setFavorites((prev) => new Set(prev).add(pid));
      }
      openToast(isFav ? "Removed from favorites" : "Added to favorites", "success");
    } catch (e) {
      openToast(String(e?.message || e), "error");
    }
  }, [favorites, addFavorite, removeFavorite, myUserId, openToast]);

  const handleEnter = useCallback(
    (project) => {
      if (!canEnter(project)) {
        openToast("You're not part of this project's team yet.", "warning");
        return;
      }
      router.push(`/postgres-org/${orgId}/dashboard/projects/${project.projectId}`);
    },
    [canEnter, openToast, router, orgId]
  );

  const handleRequestSort = useCallback(
    (property) => {
      const isAsc = orderBy === property && order === "asc";
      setOrder(isAsc ? "desc" : "asc");
      setOrderBy(property);
    },
    [orderBy, order]
  );

  // ---------- tag management ----------
  const handleAddTag = useCallback(
    async (projectId, tag) => {
      if (!tag.trim()) return;
      try {
        await patchTags(projectId, { add: [tag.trim()] });
        openToast("Tag added", "success");
        setTagInput("");
      } catch (e) {
        openToast(String(e?.message || e), "error");
      }
    },
    [patchTags, openToast]
  );

  const handleRemoveTag = useCallback(
    async (projectId, tag) => {
      try {
        await patchTags(projectId, { remove: [tag] });
        openToast("Tag removed", "success");
      } catch (e) {
        openToast(String(e?.message || e), "error");
      }
    },
    [patchTags, openToast]
  );

  // ---------- members dialog ----------
  const openMembers = useCallback(
    async (project) => {
      setMemberOpen(true);
      setSelectedOrgMember(null);
      setNewMemberUid("");
      setNewMemberEmail("");
      setNewMemberRole("contributor");

      const pid = project?.projectId || null;
      setActiveProjectId(pid);

      if (pid) {
        try {
          setActiveLoading(true);
          const fresh = await getProjectById(pid);
          setActiveProject(fresh || project);
        } catch {
          setActiveProject(project || null);
        } finally {
          setActiveLoading(false);
        }
      } else {
        setActiveProject(null);
      }
    },
    [getProjectById]
  );

  const closeMembers = useCallback(() => {
    setMemberOpen(false);
  }, []);

  useEffect(() => {
    if (selectedOrgMember) {
      setNewMemberUid(getId(selectedOrgMember) || "");
      setNewMemberEmail(selectedOrgMember.email || "");
    } else {
      setNewMemberUid("");
      setNewMemberEmail("");
    }
  }, [selectedOrgMember]);

  const handleAssign = useCallback(async () => {
    const projectId = activeProject?.projectId || activeProjectId;
    if (!projectId) return openToast("No active project selected.", "error");
    if (!newMemberUid) return openToast("Pick a member from the organisation.", "error");

    setBusy(true);
    try {
      await addMember(projectId, {
        uid: newMemberUid,
        email: newMemberEmail || "",
        role: newMemberRole || "contributor",
      });
      const updated = await getProjectById(projectId);
      setActiveProject(updated);
      openToast("Member assigned successfully!", "success");
      setSelectedOrgMember(null);
      setNewMemberUid("");
      setNewMemberEmail("");
      setNewMemberRole("contributor");
    } catch (e) {
      openToast(String(e?.message || e), "error");
    } finally {
      setBusy(false);
    }
  }, [activeProject, activeProjectId, newMemberUid, newMemberEmail, newMemberRole, getProjectById, addMember, openToast]);

  const handleRemoveMember = useCallback(
    async (memberUid) => {
      const projectId = activeProject?.projectId || activeProjectId;
      if (!projectId) return openToast("No active project selected.", "error");
      setBusy(true);
      try {
        await removeMember(projectId, memberUid);
        const updated = await getProjectById(projectId);
        setActiveProject(updated);
        openToast("Member removed successfully!", "success");
      } catch (e) {
        openToast(String(e?.message || e), "error");
      } finally {
        setBusy(false);
      }
    },
    [activeProject, activeProjectId, getProjectById, removeMember, openToast]
  );

  return (
    <Box>
      {/* Enhanced Toolbar */}
      <Paper 
        elevation={0}
        sx={{ 
          p: 2.5, 
          mb: 3,
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 2,
        }}
      >
        <Stack spacing={2.5}>
          {/* Header Row */}
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Stack direction="row" alignItems="center" spacing={1.5}>
              <FolderIcon sx={{ color: 'primary.main', fontSize: 28 }} />
              <Typography variant="h5" fontWeight={600}>
                Projects
              </Typography>
              <Chip 
                label={filteredSorted.length} 
                size="small" 
                color="primary" 
                variant="outlined"
              />
            </Stack>

            {/* Bulk Actions */}
            {selectedIds.size > 0 && (
              <Stack direction="row" spacing={1}>
                <Chip
                  label={`${selectedIds.size} selected`}
                  size="small"
                  onDelete={() => setSelectedIds(new Set())}
                  color="primary"
                />
                <Button
                  size="small"
                  startIcon={<ArchiveIcon />}
                  onClick={async () => {
                    await bulkProjects({ projectIds: Array.from(selectedIds), op: "archive" });
                    setSelectedIds(new Set());
                    openToast("Archived selected projects", "success");
                  }}
                >
                  Archive
                </Button>
                <Button
                  size="small"
                  color="error"
                  startIcon={<DeleteOutlineIcon />}
                  onClick={async () => {
                    await bulkProjects({ projectIds: Array.from(selectedIds), op: "delete" });
                    setSelectedIds(new Set());
                    openToast("Deleted selected", "success");
                  }}
                >
                  Delete
                </Button>
              </Stack>
            )}
          </Stack>

          <Divider />

          {/* Filters Row */}
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems="stretch">
            <TextField
              size="small"
              placeholder="Search projects, tags, IDs…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
                endAdornment: search ? (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setSearch("")}>
                      <ClearIcon fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                ) : null,
              }}
              sx={{ flex: 1, minWidth: 280 }}
            />

            <Select
              size="small"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              sx={{ minWidth: 150 }}
            >
              <MenuItem value="all">All Status</MenuItem>
              <MenuItem value="active">Active Only</MenuItem>
              <MenuItem value="dormant">Dormant Only</MenuItem>
            </Select>

            <FormControlLabel
              control={
                <Checkbox 
                  checked={onlyMine} 
                  onChange={(e) => setOnlyMine(e.target.checked)}
                  size="small"
                />
              }
              label="My Projects"
            />
          </Stack>
        </Stack>
      </Paper>

      {/* Enhanced Table */}
      <TableContainer 
        component={Paper} 
        elevation={0}
        sx={{ 
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 2,
        }}
      >
        <Table>
          <TableHead>
            <TableRow sx={{ bgcolor: 'grey.50' }}>
              <TableCell padding="checkbox">
                <Checkbox
                  size="small"
                  indeterminate={selectedIds.size > 0 && selectedIds.size < filteredSorted.length}
                  checked={selectedIds.size === filteredSorted.length && filteredSorted.length > 0}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedIds(new Set(filteredSorted.map((p) => p.projectId)));
                    } else {
                      setSelectedIds(new Set());
                    }
                  }}
                />
              </TableCell>
              <TableCell sortDirection={orderBy === "name" ? order : false}>
                <TableSortLabel
                  active={orderBy === "name"}
                  direction={orderBy === "name" ? order : "asc"}
                  onClick={() => handleRequestSort("name")}
                >
                  <Typography variant="subtitle2" fontWeight={600}>Project</Typography>
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <Typography variant="subtitle2" fontWeight={600}>Tags</Typography>
              </TableCell>
              <TableCell sortDirection={orderBy === "is_active" ? order : false}>
                <TableSortLabel
                  active={orderBy === "is_active"}
                  direction={orderBy === "is_active" ? order : "asc"}
                  onClick={() => handleRequestSort("is_active")}
                >
                  <Typography variant="subtitle2" fontWeight={600}>Status</Typography>
                </TableSortLabel>
              </TableCell>
              <TableCell sortDirection={orderBy === "members" ? order : false}>
                <TableSortLabel
                  active={orderBy === "members"}
                  direction={orderBy === "members" ? order : "asc"}
                  onClick={() => handleRequestSort("members")}
                >
                  <Typography variant="subtitle2" fontWeight={600}>Team</Typography>
                </TableSortLabel>
              </TableCell>
              <TableCell sortDirection={orderBy === "lastActivity" ? order : false}>
                <TableSortLabel
                  active={orderBy === "lastActivity"}
                  direction={orderBy === "lastActivity" ? order : "asc"}
                  onClick={() => handleRequestSort("lastActivity")}
                >
                  <Typography variant="subtitle2" fontWeight={600}>Last Activity</Typography>
                </TableSortLabel>
              </TableCell>
              <TableCell align="right">
                <Typography variant="subtitle2" fontWeight={600}>Actions</Typography>
              </TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {rows.map((p) => {
              const allowed = canEnter(p);
              const memberCount = Array.isArray(p.members) ? p.members.length : 0;
              const canManage = canManageProject(p);
              const pid = p.projectId;
              const isFav = favorites.has(pid);
              const isEditing = editingTags === pid;

              return (
                <TableRow
                  key={pid}
                  hover
                  sx={{ 
                    cursor: allowed ? "pointer" : "default",
                    '&:hover': {
                      bgcolor: allowed ? 'action.hover' : 'transparent',
                    }
                  }}
                  onClick={() => allowed && handleEnter(p)}
                >
                  <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      size="small"
                      checked={selectedIds.has(pid)}
                      onChange={() => toggleRowSelect(pid)}
                    />
                  </TableCell>

                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Stack spacing={0.5}>
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <IconButton
                          size="small"
                          onClick={() => toggleFavorite(p)}
                          sx={{ p: 0.5 }}
                        >
                          {isFav ? (
                            <StarIcon fontSize="small" sx={{ color: 'warning.main' }} />
                          ) : (
                            <StarBorderIcon fontSize="small" sx={{ color: 'action.disabled' }} />
                          )}
                        </IconButton>

                        {!allowed && (
                          <Tooltip title="Not assigned to this project">
                            <LockIcon fontSize="small" sx={{ color: 'action.disabled' }} />
                          </Tooltip>
                        )}

                        <Typography 
                          variant="body2" 
                          fontWeight={600}
                          sx={{ 
                            color: allowed ? 'text.primary' : 'text.disabled',
                          }}
                        >
                          {p.name}
                        </Typography>
                      </Stack>
                      <Typography 
                        variant="caption" 
                        sx={{ 
                          fontFamily: 'monospace',
                          color: 'text.secondary',
                          fontSize: 11,
                        }}
                      >
                        {p.projectId}
                      </Typography>
                    </Stack>
                  </TableCell>

                  <TableCell onClick={(e) => e.stopPropagation()}>
                    {isEditing ? (
                      <Stack direction="row" spacing={0.5} alignItems="center" flexWrap="wrap">
                        {(p.tags || []).map((t) => (
                          <Chip
                            key={t}
                            size="small"
                            label={t}
                            onDelete={() => handleRemoveTag(pid, t)}
                            sx={{ 
                              bgcolor: 'primary.50',
                              '& .MuiChip-deleteIcon': {
                                fontSize: 16,
                              }
                            }}
                          />
                        ))}
                        <TextField
                          size="small"
                          placeholder="Add tag..."
                          value={tagInput}
                          onChange={(e) => setTagInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              handleAddTag(pid, tagInput);
                            } else if (e.key === "Escape") {
                              setEditingTags(null);
                              setTagInput("");
                            }
                          }}
                          onBlur={() => {
                            setEditingTags(null);
                            setTagInput("");
                          }}
                          autoFocus
                          sx={{ width: 140 }}
                          InputProps={{
                            sx: { height: 28, fontSize: 13 }
                          }}
                        />
                      </Stack>
                    ) : (
                      <Stack 
                        direction="row" 
                        spacing={0.5} 
                        alignItems="center" 
                        flexWrap="wrap"
                        onClick={() => canManage && setEditingTags(pid)}
                        sx={{ cursor: canManage ? 'pointer' : 'default' }}
                      >
                        {(p.tags || []).slice(0, 3).map((t) => (
                          <Chip
                            key={t}
                            size="small"
                            label={t}
                            sx={{ 
                              bgcolor: 'primary.50',
                              color: 'primary.main',
                              fontWeight: 500,
                              fontSize: 11,
                            }}
                          />
                        ))}
                        {(p.tags?.length || 0) > 3 && (
                          <Chip
                            size="small"
                            label={`+${p.tags.length - 3}`}
                            sx={{ 
                              bgcolor: 'grey.100',
                              fontSize: 11,
                            }}
                          />
                        )}
                        {canManage && (
                          <Tooltip title="Click to edit tags">
                            <IconButton size="small" sx={{ p: 0.5 }}>
                              <LocalOfferIcon sx={{ fontSize: 16 }} />
                            </IconButton>
                          </Tooltip>
                        )}
                        {(!p.tags || p.tags.length === 0) && (
                          <Typography variant="caption" color="text.disabled">
                            {canManage ? 'Click to add tags' : 'No tags'}
                          </Typography>
                        )}
                      </Stack>
                    )}
                  </TableCell>

<TableCell>
  {(() => {
    const key = String(p.status || "").toLowerCase();
    const meta = STATUS_META[key] || { label: p.status || "Unknown", color: "default", variant: "outlined" };
    return (
      <Chip
        size="small"
        label={meta.label}
        color={meta.color}
        variant={meta.variant}
        sx={{ fontWeight: 500, minWidth: 110, textTransform: "none" }}
      />
    );
  })()}
</TableCell>

                  <TableCell>
                    <Stack direction="row" spacing={1.5} alignItems="center">
                      {memberCount > 0 ? (
                        <AvatarGroup 
                          max={4} 
                          sx={{ 
                            '& .MuiAvatar-root': { 
                              width: 28, 
                              height: 28,
                              fontSize: 12,
                              border: '2px solid white',
                            }
                          }}
                        >
                          {(p.members || []).map((m) => (
                            <Tooltip key={getId(m)} title={memberLabel(m)}>
                              <Avatar sx={{ bgcolor: 'primary.main' }}>
                                {memberAvatarText(m)}
                              </Avatar>
                            </Tooltip>
                          ))}
                        </AvatarGroup>
                      ) : (
                        <Stack direction="row" spacing={0.5} alignItems="center">
                          <GroupIcon fontSize="small" sx={{ color: 'text.disabled' }} />
                          <Typography variant="caption" color="text.disabled">
                            No members
                          </Typography>
                        </Stack>
                      )}
                      <Typography variant="body2" color="text.secondary" fontWeight={500}>
                        {memberCount}
                      </Typography>
                    </Stack>
                  </TableCell>

                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {p.lastActivity ? timeformater(p.lastActivity) : "—"}
                    </Typography>
                  </TableCell>

                  <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                    <ProjectActionsMenu
                      project={p}
                      orgId={orgId}
                      canManage={canManage}
                      canEnter={allowed}
                      toast={openToast}
                      onOpenMembers={() => openMembers(p)}
                      onOpenTimeline={async () => {
                        const data = await getTimeline(p.project_id || p.projectId);
                        setTimelineData(data || { milestones: [], activities: [] });
                        setTimelineOpen(true);
                        setActiveProject(p);
                        setActiveProjectId(p.project_id || p.projectId);
                      }}
                      onEdit={() => onEditProject?.(p)}
                      onDeleted={() => deleteProject?.(p.project_id || p.projectId)}
                    />
                  </TableCell>
                </TableRow>
              );
            })}

            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 8 }}>
                  <Stack alignItems="center" spacing={2}>
                    <FolderIcon sx={{ fontSize: 64, color: 'text.disabled', opacity: 0.3 }} />
                    <Typography variant="h6" color="text.secondary">
                      No projects found
                    </Typography>
                    <Typography variant="body2" color="text.disabled">
                      {search ? "Try adjusting your search or filters" : "Create your first project to get started"}
                    </Typography>
                  </Stack>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Pagination */}
      {totalPages > 1 && (
        <Stack direction="row" justifyContent="center" mt={3}>
          <Pagination
            count={totalPages}
            page={page}
            onChange={(_, v) => setPage(v)}
            color="primary"
            showFirstButton
            showLastButton
          />
        </Stack>
      )}

      {/* Enhanced Member Management Dialog */}
      <Dialog open={memberOpen} onClose={closeMembers} fullWidth maxWidth="md">
        <DialogTitle sx={{ pb: 1 }}>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <GroupIcon color="primary" />
            <Typography variant="h6" fontWeight={600}>
              Team Members
            </Typography>
            {activeProject && (
              <Chip label={activeProject.name} size="small" variant="outlined" />
            )}
          </Stack>
        </DialogTitle>
        
        <DialogContent dividers sx={{ p: 3 }}>
          {activeLoading && <LinearProgress sx={{ mb: 2 }} />}

          {/* Current Members */}
          <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 2 }}>
            Current Members ({(activeProject?.members || []).length})
          </Typography>

          <Stack spacing={1.5} sx={{ mb: 4 }}>
            {(activeProject?.members || []).map((m) => {
              const uid = getId(m);
              const secondaryEmail = memberEmail(m);
              return (
                <Card key={uid} variant="outlined" sx={{ bgcolor: 'grey.50' }}>
                  <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                    <Stack direction="row" alignItems="center" justifyContent="space-between">
                      <Stack direction="row" spacing={2} alignItems="center">
                        <Avatar sx={{ width: 40, height: 40, bgcolor: 'primary.main' }}>
                          {memberAvatarText(m)}
                        </Avatar>
                        <Stack spacing={0.5}>
                          <Typography variant="body1" fontWeight={600}>
                            {memberLabel(m)}
                          </Typography>
                          {secondaryEmail && (
                            <Typography variant="caption" color="text.secondary">
                              {secondaryEmail}
                            </Typography>
                          )}
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Chip 
                              label={getRole(m) || "contributor"} 
                              size="small" 
                              color="primary"
                              variant="outlined"
                              sx={{ height: 20, fontSize: 11 }}
                            />
                            <Typography
                              component="code"
                              sx={{ 
                                fontSize: 10, 
                                opacity: 0.5,
                                fontFamily: 'monospace',
                              }}
                            >
                              {uid}
                            </Typography>
                          </Stack>
                        </Stack>
                      </Stack>

                      <Tooltip title="Remove member">
                        <IconButton
                          size="small"
                          color="error"
                          disabled={busy}
                          onClick={() => handleRemoveMember(uid)}
                        >
                          <PersonRemoveIcon />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </CardContent>
                </Card>
              );
            })}

            {(!activeProject?.members || activeProject.members.length === 0) && (
              <Card variant="outlined">
                <CardContent sx={{ py: 4, textAlign: 'center' }}>
                  <Typography variant="body2" color="text.disabled">
                    No team members yet. Add members below.
                  </Typography>
                </CardContent>
              </Card>
            )}
          </Stack>

          <Divider sx={{ my: 3 }} />

          {/* Add New Member */}
          <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 2 }}>
            Add New Member
          </Typography>

          <Stack spacing={2}>
            <Autocomplete
              options={unassignedCandidates}
              getOptionLabel={(opt) => opt?.email || getId(opt) || ""}
              value={selectedOrgMember}
              onChange={(_, val) => setSelectedOrgMember(val)}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Select Organisation Member"
                  placeholder="Search by email or ID"
                  size="small"
                />
              )}
              renderOption={(props, opt) => (
                <li {...props} key={getId(opt)}>
                  <Stack direction="row" spacing={1.5} alignItems="center" width="100%">
                    <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main' }}>
                      {(opt.email || getId(opt) || "?").charAt(0).toUpperCase()}
                    </Avatar>
                    <Stack flex={1}>
                      <Typography variant="body2" fontWeight={500}>
                        {opt.email || "—"}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                        {getId(opt)}
                      </Typography>
                    </Stack>
                    {getRole(opt) && (
                      <Chip size="small" label={getRole(opt)} variant="outlined" />
                    )}
                  </Stack>
                </li>
              )}
            />

            <Select
              size="small"
              value={newMemberRole}
              onChange={(e) => setNewMemberRole(e.target.value)}
              displayEmpty
            >
              <MenuItem value="contributor">Contributor</MenuItem>
              <MenuItem value="editor">Editor</MenuItem>
              <MenuItem value="viewer">Viewer</MenuItem>
            </Select>
          </Stack>
        </DialogContent>
        
        <DialogActions sx={{ p: 2.5 }}>
          <Button onClick={closeMembers} variant="outlined">
            Close
          </Button>
          <Button
            onClick={handleAssign}
            disabled={busy || activeLoading || !activeProjectId || !newMemberUid}
            variant="contained"
            startIcon={<AddIcon />}
          >
            {busy ? "Adding…" : "Add Member"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Enhanced Timeline Dialog */}
      <Dialog open={timelineOpen} onClose={() => setTimelineOpen(false)} fullWidth maxWidth="md">
        <DialogTitle sx={{ pb: 1 }}>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <Typography variant="h6" fontWeight={600}>
              Project Timeline
            </Typography>
            {activeProject && (
              <Chip label={activeProject.name} size="small" variant="outlined" />
            )}
          </Stack>
        </DialogTitle>
        
        <DialogContent dividers sx={{ p: 3 }}>
          {/* Milestones Section */}
          <Stack spacing={3}>
            <Box>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
                <Typography variant="subtitle1" fontWeight={600}>
                  Milestones
                </Typography>
                <Chip 
                  label={(timelineData.milestones || []).length} 
                  size="small" 
                  color="primary"
                />
              </Stack>

              <Stack spacing={1.5}>
                {(timelineData.milestones || []).map((m) => (
                  <Card key={m.id} variant="outlined">
                    <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                      <Stack direction="row" alignItems="center" justifyContent="space-between">
                        <Stack direction="row" spacing={2} alignItems="center" flex={1}>
                          <Checkbox
                            checked={m.done}
                            onChange={async () => {
                              await patchMilestone(activeProjectId, m.id, { done: !m.done });
                              const updated = await getTimeline(activeProjectId);
                              setTimelineData(updated);
                            }}
                          />
                          <Stack flex={1}>
                            <Typography 
                              variant="body1" 
                              fontWeight={500}
                              sx={{ 
                                textDecoration: m.done ? 'line-through' : 'none',
                                color: m.done ? 'text.disabled' : 'text.primary',
                              }}
                            >
                              {m.title}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Due: {m.due ? timeformater(m.due) : "Not set"}
                            </Typography>
                          </Stack>
                        </Stack>

                        <Button
                          size="small"
                          color="error"
                          onClick={async () => {
                            await deleteMilestone(activeProjectId, m.id);
                            const updated = await getTimeline(activeProjectId);
                            setTimelineData(updated);
                          }}
                        >
                          Delete
                        </Button>
                      </Stack>
                    </CardContent>
                  </Card>
                ))}

                {(!timelineData.milestones || timelineData.milestones.length === 0) && (
                  <Card variant="outlined">
                    <CardContent sx={{ py: 3, textAlign: 'center' }}>
                      <Typography variant="body2" color="text.disabled">
                        No milestones yet. Add one below.
                      </Typography>
                    </CardContent>
                  </Card>
                )}
              </Stack>

              {/* Add Milestone */}
              <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                <TextField
                  size="small"
                  placeholder="New milestone title"
                  value={activeProject?.__new_m_title || ""}
                  onChange={(e) => setActiveProject((p) => ({ ...p, __new_m_title: e.target.value }))}
                  fullWidth
                />
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={async () => {
                    if (!activeProject?.__new_m_title) return;
                    await addMilestone(activeProjectId, { title: activeProject.__new_m_title });
                    const updated = await getTimeline(activeProjectId);
                    setTimelineData(updated);
                    setActiveProject((p) => ({ ...p, __new_m_title: "" }));
                  }}
                  disabled={!activeProject?.__new_m_title}
                >
                  Add
                </Button>
              </Stack>
            </Box>

            <Divider />

            {/* Attachments Section */}
            <Box>
              <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
                Attachments
              </Typography>
              
              <Stack direction="row" spacing={1}>
                <TextField 
                  size="small" 
                  placeholder="Name" 
                  value={attachName} 
                  onChange={(e) => setAttachName(e.target.value)} 
                  sx={{ width: 200 }}
                />
                <TextField 
                  size="small" 
                  placeholder="URL" 
                  value={attachUrl} 
                  onChange={(e) => setAttachUrl(e.target.value)} 
                  fullWidth 
                />
                <Button
                  variant="outlined"
                  startIcon={<UploadFileIcon />}
                  onClick={async () => {
                    if (!attachName || !attachUrl) return;
                    await addAttachment(activeProjectId, { name: attachName, url: attachUrl });
                    setAttachName("");
                    setAttachUrl("");
                    openToast("Attachment added", "success");
                  }}
                  disabled={!attachName || !attachUrl}
                >
                  Add
                </Button>
              </Stack>
            </Box>

            <Divider />

            {/* Surveys Section */}
            <Box>
              <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
                Survey Links
              </Typography>
              
              <Stack direction="row" spacing={1}>
                <TextField
                  size="small"
                  placeholder="Survey ID"
                  value={surveyInput}
                  onChange={(e) => setSurveyInput(e.target.value)}
                  fullWidth
                />
                <Button
                  variant="outlined"
                  onClick={async () => {
                    if (!surveyInput) return;
                    await addSurveyId(activeProjectId, surveyInput);
                    setSurveyInput("");
                    openToast("Survey added", "success");
                  }}
                  disabled={!surveyInput}
                >
                  Add
                </Button>
                <Button
                  color="error"
                  variant="outlined"
                  onClick={async () => {
                    if (!surveyInput) return;
                    await removeSurveyId(activeProjectId, surveyInput);
                    setSurveyInput("");
                    openToast("Survey removed", "success");
                  }}
                  disabled={!surveyInput}
                >
                  Remove
                </Button>
              </Stack>
            </Box>

            <Divider />

            {/* Activity Log */}
            <Box>
              <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
                Recent Activity
              </Typography>
              
              <Stack spacing={1.5} sx={{ maxHeight: 300, overflow: "auto" }}>
                {(timelineData.activities || []).map((a, i) => (
                  <Card key={i} variant="outlined" sx={{ bgcolor: 'grey.50' }}>
                    <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                      <Stack direction="row" spacing={1.5} alignItems="center">
                        <Typography variant="caption" color="text.secondary" sx={{ minWidth: 120 }}>
                          {timeformater(a.timestamp)}
                        </Typography>
                        <Typography variant="body2">
                          {a.activity}
                        </Typography>
                      </Stack>
                    </CardContent>
                  </Card>
                ))}
                
                {(!timelineData.activities || timelineData.activities.length === 0) && (
                  <Typography variant="body2" color="text.disabled" textAlign="center" py={2}>
                    No recent activity
                  </Typography>
                )}
              </Stack>
            </Box>
          </Stack>
        </DialogContent>
        
        <DialogActions sx={{ p: 2.5 }}>
          <Button onClick={() => setTimelineOpen(false)} variant="contained">
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Toast Notification */}
      <Snackbar
        open={toast.open}
        autoHideDuration={3200}
        onClose={() => setToast({ ...toast, open: false })}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          onClose={() => setToast({ ...toast, open: false })}
          severity={toast.severity}
          variant="filled"
          sx={{ width: "100%" }}
        >
          {toast.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
}