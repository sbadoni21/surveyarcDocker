"use client";

import React, { useMemo, useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import UserModel from "@/models/postGresModels/userModel";
import { timeformater } from "@/utils/timeformater";
import { useOrganisation } from "@/providers/postGresPorviders/organisationProvider";

// MUI
import {
  Box, Paper, Stack, Toolbar, Typography, TextField, InputAdornment,
  IconButton, Tooltip, Button, Chip, Table, TableHead, TableRow, TableCell,
  TableBody, TableContainer, TableSortLabel, Pagination, FormControlLabel,
  Checkbox, Select, MenuItem, Dialog, DialogTitle, DialogContent, DialogActions,
  Alert, Snackbar, Avatar,
} from "@mui/material";
import Autocomplete from "@mui/material/Autocomplete";
import SearchIcon from "@mui/icons-material/Search";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import GroupIcon from "@mui/icons-material/Group";
import LockIcon from "@mui/icons-material/Lock";
import PersonRemoveIcon from "@mui/icons-material/PersonRemove";
import ClearIcon from "@mui/icons-material/Clear";
import { useProject } from "@/providers/postGresPorviders/projectProvider";
import { useUser } from "@/providers/postGresPorviders/UserProvider";

const ITEMS_PER_PAGE = 10;

// --- sorting helpers (no hooks) ---
function descendingComparator(a, b, orderBy) {
  const va =
    orderBy === "members"
      ? (Array.isArray(a.members) ? a.members.length : 0)
      : a?.[orderBy];
  const vb =
    orderBy === "members"
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
  deleteProject,
  onEditProject,
}) {
  // ---- hooks
  const router = useRouter();
  const { user } = useUser();
  const { addMember, removeMember, getProjectById } = useProject();
  const { organisation } = useOrganisation();

  const [order, setOrder] = useState("desc");
  const [orderBy, setOrderBy] = useState("last_activity");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [onlyMine, setOnlyMine] = useState(false);
  const [memberOpen, setMemberOpen] = useState(false);
  const [activeProject, setActiveProject] = useState(null);

  // assignment form state
  const [newMemberUid, setNewMemberUid] = useState("");
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [newMemberRole, setNewMemberRole] = useState("contributor");
  const [selectedOrgMember, setSelectedOrgMember] = useState(null);

  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState({ open: false, severity: "info", msg: "" });

  // ---------- ID/role normalization helpers ----------
  const norm = (v) => (typeof v === "string" ? v.toLowerCase().trim() : v);
  const getId = (obj) => obj?.uid || obj?.user_id || obj?.id || "";
  const getRole = (obj) => norm(obj?.role || obj?.member_role || "");

  // ---------- permissions ----------
  const isOwner = useMemo(() => {
    const team = Array.isArray(organisation?.team_members) ? organisation.team_members : [];
    const myId = getId(user) || user?.uid || "";
    return team.some((m) => getId(m) === myId && norm(m?.role) === "owner");
  }, [organisation, user]);

  const userInProject = useCallback(
    (project) => {
      const myId = getId(user);
      return Array.isArray(project?.members) && project.members.some((m) => getId(m) === myId);
    },
    [user]
  );

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

  const canEnter = useCallback(
    (project) => isOwner || userInProject(project),
    [isOwner, userInProject]
  );

  // org members
  const orgTeamMembers = useMemo(
    () => (Array.isArray(organisation?.team_members) ? organisation.team_members : []),
    [organisation]
  );

  // exclude already-assigned members
  const unassignedCandidates = useMemo(() => {
    const team = orgTeamMembers;
    if (!activeProject) return team;
    const assigned = new Set((activeProject.members || []).map((m) => getId(m)));
    return team.filter((m) => !assigned.has(getId(m)));
  }, [orgTeamMembers, activeProject]);

  // ---- filtering/sorting/paging
  const filteredSorted = useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows = projects.filter((p) => {
      if (statusFilter !== "all") {
        const isActive = !!p.is_active;
        if (statusFilter === "active" && !isActive) return false;
        if (statusFilter === "dormant" && isActive) return false;
      }
      if (onlyMine && !userInProject(p) && !isOwner) return false;

      if (!q) return true;
      const hay = [p.name, p.project_id, p.status, ...(Array.isArray(p.tags) ? p.tags : [])]
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

  // ---- utilities / handlers
  const openToast = useCallback((msg, severity = "info") => {
    setToast({ open: true, severity, msg });
  }, []);

  const handleEnter = useCallback(
    (project) => {
      if (!canEnter(project)) {
        openToast("You're not part of this project's team yet.", "warning");
        return;
      }
      router.push(`/postgres-org/${orgId}/dashboard/projects/${project.project_id}`);
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

  const openMembers = useCallback((project) => {
    setActiveProject(project);
    setSelectedOrgMember(null);
    setNewMemberUid("");
    setNewMemberEmail("");
    setNewMemberRole("contributor");
    setMemberOpen(true);
  }, []);

  const closeMembers = useCallback(() => {
    setMemberOpen(false);
  }, []);

  // When user picks from org team list
  useEffect(() => {
    if (selectedOrgMember) {
      setNewMemberUid(getId(selectedOrgMember) || "");
      setNewMemberEmail(selectedOrgMember.email || "");
    } else {
      setNewMemberUid("");
      setNewMemberEmail("");
    }
  }, [selectedOrgMember]);

  // REFACTORED: Using provider's addMember method
  const handleAssign = useCallback(async () => {
    if (!activeProject?.project_id) {
      openToast("No active project selected.", "error");
      return;
    }
    if (!newMemberUid) {
      openToast("Pick a member from the organisation.", "error");
      return;
    }
    
    setBusy(true);
    try {
      const now = new Date().toISOString();
      
      // Check if member already exists
      const existingMember = (activeProject.members || []).find(
        (m) => getId(m) === newMemberUid
      );
      
      const memberData = {
        uid: newMemberUid,
        role: newMemberRole || "contributor",
        status: "active",
        joined_at: existingMember?.joined_at || now,
        email: newMemberEmail || "",
      };

      await addMember(activeProject.project_id, memberData);
      
      const updated = await getProjectById(activeProject.project_id);
      setActiveProject(updated);
      
      openToast("Member assigned successfully!", "success");
      setSelectedOrgMember(null);
      setNewMemberUid("");
      setNewMemberEmail("");
      setNewMemberRole("contributor");
    } catch (e) {
      console.error("Assignment error:", e);
      openToast(String(e?.message || e), "error");
    } finally {
      setBusy(false);
    }
  }, [
    activeProject, 
    newMemberUid, 
    newMemberRole, 
    newMemberEmail, 
    orgId, 
    openToast, 
    addMember, 
    getProjectById
  ]);

  // REFACTORED: Using provider's removeMember method
  const handleRemoveMember = useCallback(
    async (memberUid) => {
      if (!activeProject?.project_id) return;
      setBusy(true);
      try {
        // Use provider method
        await removeMember(activeProject.project_id, memberUid);
        
        // Refresh the active project data
        const updated = await getProjectById(activeProject.project_id);
        setActiveProject(updated);
        
        openToast("Member removed successfully!", "success");
      } catch (e) {
        console.error("Remove member error:", e);
        openToast(String(e?.message || e), "error");
      } finally {
        setBusy(false);
      }
    },
    [activeProject, removeMember, getProjectById, openToast]
  );
console.log(projects)
  return (
    <Box>
      {/* Toolbar: search / filters */}
      <Paper sx={{ p: 1.5, mb: 2 }}>
        <Toolbar disableGutters sx={{ gap: 1, flexWrap: "wrap" }}>
          <Typography variant="h6" sx={{ flex: "1 1 auto", pr: 2 }}>
            Projects
          </Typography>

          <TextField
            size="small"
            placeholder="Search name, id, tag…"
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
            sx={{ minWidth: 260 }}
          />

          <Select
            size="small"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            sx={{ minWidth: 150 }}
          >
            <MenuItem value="all">All statuses</MenuItem>
            <MenuItem value="active">Active</MenuItem>
            <MenuItem value="dormant">Dormant</MenuItem>
          </Select>

          <FormControlLabel
            control={
              <Checkbox
                checked={onlyMine}
                onChange={(e) => setOnlyMine(e.target.checked)}
              />
            }
            label="Only my projects"
          />
        </Toolbar>
      </Paper>

      {/* Table */}
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sortDirection={orderBy === "name" ? order : false}>
                <TableSortLabel
                  active={orderBy === "name"}
                  direction={orderBy === "name" ? order : "asc"}
                  onClick={() => handleRequestSort("name")}
                >
                  Project
                </TableSortLabel>
              </TableCell>
              <TableCell>ID</TableCell>
              <TableCell sortDirection={orderBy === "is_active" ? order : false}>
                <TableSortLabel
                  active={orderBy === "is_active"}
                  direction={orderBy === "is_active" ? order : "asc"}
                  onClick={() => handleRequestSort("is_active")}
                >
                  Status
                </TableSortLabel>
              </TableCell>
              <TableCell sortDirection={orderBy === "members" ? order : false}>
                <TableSortLabel
                  active={orderBy === "members"}
                  direction={orderBy === "members" ? order : "asc"}
                  onClick={() => handleRequestSort("members")}
                >
                  Members
                </TableSortLabel>
              </TableCell>
              <TableCell sortDirection={orderBy === "last_activity" ? order : false}>
                <TableSortLabel
                  active={orderBy === "last_activity"}
                  direction={orderBy === "last_activity" ? order : "asc"}
                  onClick={() => handleRequestSort("last_activity")}
                >
                  Last Activity
                </TableSortLabel>
              </TableCell>
              <TableCell sortDirection={orderBy === "created_at" ? order : false}>
                <TableSortLabel
                  active={orderBy === "created_at"}
                  direction={orderBy === "created_at" ? order : "asc"}
                  onClick={() => handleRequestSort("created_at")}
                >
                  Created
                </TableSortLabel>
              </TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {rows.map((p) => {
              const allowed = canEnter(p);
              const memberCount = Array.isArray(p.members) ? p.members.length : 0;
              const canManage = canManageProject(p);

              return (
                <TableRow
                  key={p.project_id}
                  hover
                  sx={{ cursor: allowed ? "pointer" : "default", opacity: allowed ? 1 : 0.95 }}
                  onClick={() =>
                    allowed
                      ? handleEnter(p)
                      : openToast("You're not part of this project's team yet.", "warning")
                  }
                >
                  <TableCell sx={{ fontWeight: 600 }}>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      {!allowed && (
                        <Tooltip title="You're not assigned to this project">
                          <LockIcon fontSize="small" color="disabled" />
                        </Tooltip>
                      )}
                      <span>{p.name}</span>
                    </Stack>
                  </TableCell>

                  <TableCell>
                    <code style={{ fontSize: 12 }}>{p.project_id}</code>
                  </TableCell>

                  <TableCell>
                    <Chip
                      size="small"
                      label={p.is_active ? "Active" : "Dormant"}
                      color={p.is_active ? "success" : "default"}
                      variant={p.is_active ? "filled" : "outlined"}
                    />
                  </TableCell>

                  <TableCell>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <GroupIcon fontSize="small" />
                      <span>{memberCount}</span>
                    </Stack>
                  </TableCell>

                  <TableCell>{p.last_activity ? timeformater(p.last_activity) : "—"}</TableCell>
                  <TableCell>{p.created_at ? timeformater(p.created_at) : "—"}</TableCell>

                  <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                    <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                      <Tooltip
                        title={
                          (isOwner || canManage)
                            ? "Manage members"
                            : "You need to be org owner or project owner/admin/editor"
                        }
                      >
                        <span>
                          <IconButton
                            size="small"
                            onClick={() => openMembers(p)}
                            disabled={!(isOwner || canManage)}
                          >
                            <GroupIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>

                      <Tooltip
                        title={
                          canManage
                            ? "Edit project"
                            : "You need owner/admin/editor on this project"
                        }
                      >
                        <span>
                          <IconButton
                            size="small"
                            onClick={() => onEditProject(p)}
                            disabled={!canManage}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>

                      <Tooltip
                        title={
                          canManage
                            ? "Delete project"
                            : "You need owner/admin/editor on this project"
                        }
                      >
                        <span>
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => deleteProject(p.project_id)}
                            disabled={!canManage}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </Stack>
                  </TableCell>
                </TableRow>
              );
            })}

            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 6, color: "text.disabled" }}>
                  No matching results
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Pagination */}
      {totalPages > 1 && (
        <Stack direction="row" justifyContent="center" mt={2}>
          <Pagination
            count={totalPages}
            page={page}
            onChange={(_, v) => setPage(v)}
            color="primary"
          />
        </Stack>
      )}

      {/* Member Management Dialog */}
      <Dialog open={memberOpen} onClose={closeMembers} fullWidth maxWidth="md">
        <DialogTitle>
          Manage Members {activeProject ? `— ${activeProject.name}` : ""}
        </DialogTitle>
        <DialogContent dividers>
          <Table size="small" sx={{ mb: 2 }}>
            <TableHead>
              <TableRow>
                <TableCell>UID</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Role</TableCell>
                <TableCell>Joined</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(activeProject?.members || []).map((m) => (
                <TableRow key={getId(m)}>
                  <TableCell><code style={{ fontSize: 12 }}>{getId(m)}</code></TableCell>
                  <TableCell>{m.email || "—"}</TableCell>
                  <TableCell>{getRole(m) || "contributor"}</TableCell>
                  <TableCell>{m.joined_at ? timeformater(m.joined_at) : "—"}</TableCell>
                  <TableCell align="right">
                    <Tooltip title="Remove">
                      <span>
                        <IconButton
                          size="small"
                          color="error"
                          disabled={busy}
                          onClick={() => handleRemoveMember(getId(m))}
                        >
                          <PersonRemoveIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
              {(!activeProject?.members || activeProject.members.length === 0) && (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ color: "text.disabled" }}>
                    No members yet
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          <Stack spacing={2} direction={{ xs: "column", sm: "row" }} alignItems="stretch">
            <Autocomplete
              options={unassignedCandidates}
              getOptionLabel={(opt) => opt?.email || getId(opt) || ""}
              value={selectedOrgMember}
              onChange={(_, val) => setSelectedOrgMember(val)}
              renderInput={(params) => (
                <TextField
                  {...params}
                  size="small"
                  label="Pick org member"
                  placeholder="Search by email/uid"
                />
              )}
              renderOption={(props, opt) => (
                <li {...props} key={getId(opt)}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Avatar sx={{ width: 24, height: 24 }}>
                      {(opt.email || getId(opt) || "?").charAt(0).toUpperCase()}
                    </Avatar>
                    <span>{opt.email || "—"}</span>
                    <code style={{ marginLeft: 8, fontSize: 12, opacity: 0.7 }}>{getId(opt)}</code>
                    {getRole(opt) && <Chip size="small" sx={{ ml: 1 }} label={getRole(opt)} />}
                  </Stack>
                </li>
              )}
              fullWidth
            />

            <Select
              size="small"
              value={newMemberRole}
              onChange={(e) => setNewMemberRole(e.target.value)}
              fullWidth
              displayEmpty
            >
              <MenuItem value="contributor">Contributor</MenuItem>
              <MenuItem value="editor">Editor</MenuItem>
              <MenuItem value="viewer">Viewer</MenuItem>
            </Select>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeMembers}>Close</Button>
          <Button onClick={handleAssign} disabled={busy} variant="contained">
            {busy ? "Assigning…" : "Assign"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
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