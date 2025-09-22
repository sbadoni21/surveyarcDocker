"use client";

import React, { useMemo, useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import projectModel from "@/models/postGresModels/projectModel";
import UserModel from "@/models/postGresModels/userModel";
import { timeformater } from "@/utils/timeformater";
import { useUser } from "@/providers/postGresPorviders/UserProvider";
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

const ITEMS_PER_PAGE = 10;

// --- sorting helpers (no hooks) ---
function descendingComparator(a, b, orderBy) {
  const va = orderBy === "members" ? (Array.isArray(a.members) ? a.members.length : 0) : a?.[orderBy];
  const vb = orderBy === "members" ? (Array.isArray(b.members) ? b.members.length : 0) : b?.[orderBy];
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
  // ---- always call hooks at the top, in the same order
  const router = useRouter();
  const { user } = useUser();
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
  const [selectedOrgMember, setSelectedOrgMember] = useState(null); // object from org team_members

  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState({ open: false, severity: "info", msg: "" });

  // ---- derived values (no new hooks)
  const uid = user?.uid || "";
  const isOwner = useMemo(() => {
    const team = organisation?.team_members || [];
    return team.some((m) => m?.uid === uid && m?.role === "owner");
  }, [organisation, uid]);

  const userInProject = useCallback(
    (project) =>
      Array.isArray(project?.members) && project.members.some((m) => m?.uid === uid),
    [uid]
  );

  const canManageProject = useCallback(
    (project) => {
      if (isOwner) return true;
      const me = (project?.members || []).find((m) => m?.uid === uid);
      return me?.role === "editor";
    },
    [isOwner, uid]
  );

  const canEnter = useCallback(
    (project) => isOwner || userInProject(project),
    [isOwner, userInProject]
  );

  // org members (source of truth for assignment)
  const orgTeamMembers = useMemo(
    () => Array.isArray(organisation?.team_members) ? organisation.team_members : [],
    [organisation]
  );

  // exclude already-assigned members from the options (optional; toggle to false if you want to show everyone)
  const unassignedCandidates = useMemo(() => {
    if (!activeProject) return orgTeamMembers;
    const assigned = new Set((activeProject.members || []).map((m) => m.uid));
    return orgTeamMembers.filter((m) => !assigned.has(m.uid));
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
      router.push(`/org/${orgId}/dashboard/projects/${project.project_id}`);
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

  // When user picks from org team list, sync UID/email into hidden fields used by handleAssign
  useEffect(() => {
    if (selectedOrgMember) {
      setNewMemberUid(selectedOrgMember.uid || "");
      setNewMemberEmail(selectedOrgMember.email || "");
    } else {
      setNewMemberUid("");
      setNewMemberEmail("");
    }
  }, [selectedOrgMember]);

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
      const list = Array.isArray(activeProject.members) ? [...activeProject.members] : [];
      const idx = list.findIndex((m) => m?.uid === newMemberUid);
      const isNew = idx === -1;

      let nextMembers;
      if (isNew) {
        nextMembers = [
          ...list,
          {
            uid: newMemberUid,
            role: newMemberRole || "contributor",
            status: "active",
            joined_at: now,
            email: newMemberEmail || "",
          },
        ];
      } else {
        const prev = list[idx] || {};
        nextMembers = [...list];
        nextMembers[idx] = {
          ...prev,
          uid: newMemberUid,
          role: newMemberRole || prev.role || "contributor",
          status: "active",
          joined_at: prev.joined_at || now,
          email: newMemberEmail || prev.email || "",
        };
      }
     console.log(nextMembers)
      // A) update project members
      const updated = await projectModel.update(orgId, activeProject.project_id, {
        members: nextMembers,
        updated_at: now,
      });

      // B) merge org into user.org_ids; rollback A if B fails
      try {
        await UserModel.update(newMemberUid, { org_ids: [String(orgId)] });
      } catch (err) {
        const rolled = nextMembers.filter((m) => m?.uid !== newMemberUid);
        await projectModel.update(orgId, activeProject.project_id, {
          members: rolled,
          updated_at: new Date().toISOString(),
        });
        throw err;
      }

      setActiveProject(updated);
      openToast("Member assigned.", "success");
      setSelectedOrgMember(null);
      setNewMemberUid("");
      setNewMemberEmail("");
      setNewMemberRole("contributor");
    } catch (e) {
      openToast(String(e?.message || e), "error");
    } finally {
      setBusy(false);
    }
  }, [activeProject, newMemberUid, newMemberRole, newMemberEmail, orgId, openToast]);

  const handleRemoveMember = useCallback(
    async (memberUid) => {
      if (!activeProject?.project_id) return;
      setBusy(true);
      try {
        const list = Array.isArray(activeProject.members) ? activeProject.members : [];
        const next = list.filter((m) => m?.uid !== memberUid);

        const updated = await projectModel.update(orgId, activeProject.project_id, {
          members: next,
          updated_at: new Date().toISOString(),
        });
        setActiveProject(updated);
        openToast("Member removed.", "success");
      } catch (e) {
        openToast(String(e?.message || e), "error");
      } finally {
        setBusy(false);
      }
    },
    [activeProject, orgId, openToast]
  );

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
                  sx={{ cursor: "pointer", opacity: allowed ? 1 : 0.95 }}
                  onClick={() => handleEnter(p)}
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
                      {isOwner && (
                        <Tooltip title="Manage members">
                          <span>
                            <IconButton size="small" onClick={() => openMembers(p)}>
                              <GroupIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                      )}
                      {canManage && (
                        <>
                          <Tooltip title="Edit project">
                            <span>
                              <IconButton size="small" onClick={() => onEditProject(p)}>
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </span>
                          </Tooltip>
                          <Tooltip title="Delete project">
                            <span>
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => deleteProject(p.project_id)}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </span>
                          </Tooltip>
                        </>
                      )}
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
          <Pagination count={totalPages} page={page} onChange={(_, v) => setPage(v)} color="primary" />
        </Stack>
      )}

      {/* Member Management (owners only) */}
      <Dialog open={memberOpen} onClose={closeMembers} fullWidth maxWidth="md">
        <DialogTitle>
          Manage Members {activeProject ? `— ${activeProject.name}` : ""}
        </DialogTitle>
        <DialogContent dividers>
          {/* existing members */}
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
                <TableRow key={m.uid}>
                  <TableCell><code style={{ fontSize: 12 }}>{m.uid}</code></TableCell>
                  <TableCell>{m.email || "—"}</TableCell>
                  <TableCell>{m.role || "contributor"}</TableCell>
                  <TableCell>{m.joined_at ? timeformater(m.joined_at) : "—"}</TableCell>
                  <TableCell align="right">
                    <Tooltip title="Remove">
                      <span>
                        <IconButton
                          size="small"
                          color="error"
                          disabled={busy}
                          onClick={() => handleRemoveMember(m.uid)}
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

          {/* assign from organisation team_members */}
          <Stack spacing={2} direction={{ xs: "column", sm: "row" }} alignItems="stretch">
            <Autocomplete
              options={unassignedCandidates}
              getOptionLabel={(opt) => opt?.email || opt?.uid || ""}
              value={selectedOrgMember}
              onChange={(_, val) => setSelectedOrgMember(val)}
              renderInput={(params) => (
                <TextField {...params} size="small" label="Pick org member" placeholder="Search by email/uid" />
              )}
              renderOption={(props, opt) => (
                <li {...props} key={opt.uid}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Avatar sx={{ width: 24, height: 24 }}>{(opt.email || opt.uid || "?").charAt(0).toUpperCase()}</Avatar>
                    <span>{opt.email || "—"}</span>
                    <code style={{ marginLeft: 8, fontSize: 12, opacity: 0.7 }}>{opt.uid}</code>
                    {opt.role && <Chip size="small" sx={{ ml: 1 }} label={opt.role} />}
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
