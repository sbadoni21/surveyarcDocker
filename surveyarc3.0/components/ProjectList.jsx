"use client";
import React, { useMemo, useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getCookie } from "cookies-next";
import { useOrganisation } from "@/providers/postGresPorviders/organisationProvider";
import { useProject } from "@/providers/postGresPorviders/projectProvider";
import { useUser } from "@/providers/postGresPorviders/UserProvider";

import { ProjectsToolbar } from "./projects/ProjectsToolbar";
import { ProjectsTable } from "./projects/ProjectsTable";
import { MemberManagementDialog } from "./projects/MemberManagementDialog";
import { TimelineDialog } from "./projects/TimelineDialog";
import { Toast } from "@/utils/Toast";
import { descendingComparator, getComparator, getId, getRole   } from "@/utils/projectUtils";

const ITEMS_PER_PAGE = 10;

export default function ProjectsList({ orgId, projects = [], deleteProject, onEditProject }) {
  const router = useRouter();
  const { user, getUsersByIds } = useUser();
  const { organisation } = useOrganisation();
  const {
    updateProject,
    getProjectById,
    addMember,
    removeMember,
    addSurveyId,
    removeSurveyId,
    addMilestone,
    patchMilestone,
    deleteMilestone,
    patchTags,
    addAttachment,
    setStatus,
    getTimeline,
    recomputeProgress,
    bulkProjects,
    listFavorites,
    addFavorite,
    removeFavorite,
  } = useProject();

  // State
  const [order, setOrder] = useState("desc");
  const [orderBy, setOrderBy] = useState("lastActivity");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [onlyMine, setOnlyMine] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [favorites, setFavorites] = useState(new Set());
  const [projectOverrides, setProjectOverrides] = useState({});
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [timelineData, setTimelineData] = useState({ milestones: [], activities: [] });
  const [memberOpen, setMemberOpen] = useState(false);
  const [activeProject, setActiveProject] = useState(null);
  const [activeProjectId, setActiveProjectId] = useState(null);
  const [activeLoading, setActiveLoading] = useState(false);
  const [editingTags, setEditingTags] = useState(null);
  const [tagInput, setTagInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState({ open: false, severity: "info", msg: "" });
  const [memberProfiles, setMemberProfiles] = useState({});

  // Permissions
  const isOwner = useMemo(() => {
    const team = Array.isArray(organisation?.team_members) ? organisation.team_members : [];
    const myId = getId(user) || user?.uid || "";
    return team.some((m) => getId(m) === myId && getRole(m) === "owner");
  }, [organisation, user]);

  const byUid = useCallback((uid) => (uid ? memberProfiles[uid] : undefined), [memberProfiles]);

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

  const orgTeamMembers = useMemo(
    () => (Array.isArray(organisation?.team_members) ? organisation.team_members : []),
    [organisation]
  );

  const unassignedCandidates = useMemo(() => {
    if (!activeProject) return orgTeamMembers;
    const assigned = new Set((activeProject.members || []).map((m) => getId(m)));
    return orgTeamMembers.filter((m) => !assigned.has(getId(m)));
  }, [orgTeamMembers, activeProject]);

  const myUserId = useMemo(
    () => getId(user) || user?.uid || getCookie("currentUserId"),
    [user]
  );

  // Load favorites
  useEffect(() => {
    if (!myUserId) return;
    (async () => {
      try {
        const favs = await listFavorites(myUserId);
        const favSet = new Set((favs?.items || []).map((x) => x.projectId || x.project_id));
        setFavorites(favSet);
      } catch (e) {
        console.error("Failed to load favorites:", e);
      }
    })();
  }, [myUserId, listFavorites]);

  // Load member profiles
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

  const applyProjectPatch = useCallback((pid, patch) => {
    setProjectOverrides((prev) => ({
      ...prev,
      [pid]: { ...(prev[pid] || {}), ...patch },
    }));
  }, []);

  // Filtering and sorting
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

  const openToast = useCallback((msg, severity = "info") => {
    setToast({ open: true, severity, msg });
  }, []);

  const toggleRowSelect = useCallback((pid) => {
    setSelectedIds((prev) => {
      const n = new Set(prev);
      if (n.has(pid)) n.delete(pid);
      else n.add(pid);
      return n;
    });
  }, []);

  const toggleFavorite = useCallback(
    async (pid) => {
      try {
        const isFav = favorites.has(pid);
        if (isFav) {
          await removeFavorite(myUserId, pid);
          setFavorites((prev) => {
            const n = new Set(prev);
            n.delete(pid);
            return n;
          });
          openToast("Removed from favorites", "success");
        } else {
          await addFavorite(myUserId, pid);
          setFavorites((prev) => new Set(prev).add(pid));
          openToast("Added to favorites", "success");
        }
      } catch (e) {
        openToast(String(e?.message || e), "error");
      }
    },
    [favorites, addFavorite, removeFavorite, myUserId, openToast]
  );

  const handleEnter = useCallback(
    (project) => {
      const effective = { ...project, ...(projectOverrides[project.projectId] || {}) };
      if (!canEnter(effective)) {
        openToast("You're not part of this project's team yet.", "warning");
        return;
      }
      router.push(`/postgres-org/${orgId}/dashboard/projects/${project.projectId}`);
    },
    [canEnter, openToast, router, orgId, projectOverrides]
  );

  const handleRequestSort = useCallback(
    (property) => {
      const isAsc = orderBy === property && order === "asc";
      setOrder(isAsc ? "desc" : "asc");
      setOrderBy(property);
    },
    [orderBy, order]
  );

  const handleAddTag = useCallback(
    async (projectId, tag) => {
      const t = (tag || "").trim();
      if (!t) return;
      try {
        await patchTags(projectId, { add: [t] });
        const fresh = await getProjectById(projectId);
        applyProjectPatch(projectId, { tags: fresh?.tags || [] });
        openToast("Tag added", "success");
        setTagInput("");
      } catch (e) {
        openToast(String(e?.message || e), "error");
      }
    },
    [patchTags, openToast, getProjectById, applyProjectPatch]
  );

  const handleRemoveTag = useCallback(
    async (projectId, tag) => {
      try {
        await patchTags(projectId, { remove: [tag] });
        const fresh = await getProjectById(projectId);
        applyProjectPatch(projectId, { tags: fresh?.tags || [] });
        openToast("Tag removed", "success");
      } catch (e) {
        openToast(String(e?.message || e), "error");
      }
    },
    [patchTags, openToast, getProjectById, applyProjectPatch]
  );

  const openMembers = useCallback(
    async (project) => {
      setMemberOpen(true);
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

  const closeMembers = useCallback(() => setMemberOpen(false), []);

  const handleBulkArchive = async () => {
    await bulkProjects({ projectIds: Array.from(selectedIds), op: "archive" });
    setSelectedIds(new Set());
    openToast("Archived selected projects", "success");
  };

  const handleBulkDelete = async () => {
    await bulkProjects({ projectIds: Array.from(selectedIds), op: "delete" });
    setSelectedIds(new Set());
    openToast("Deleted selected", "success");
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <ProjectsToolbar
        search={search}
        onSearchChange={setSearch}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        onlyMine={onlyMine}
        onOnlyMineChange={setOnlyMine}
        selectedCount={selectedIds.size}
        onClearSelection={() => setSelectedIds(new Set())}
        onBulkArchive={handleBulkArchive}
        onBulkDelete={handleBulkDelete}
      />

      <ProjectsTable
        rows={rows}
        order={order}
        orderBy={orderBy}
        onRequestSort={handleRequestSort}
        selectedIds={selectedIds}
        onToggleSelect={toggleRowSelect}
        onSelectAll={(checked) => {
          if (checked) {
            setSelectedIds(new Set(filteredSorted.map((p) => p.projectId)));
          } else {
            setSelectedIds(new Set());
          }
        }}
        favorites={favorites}
        onToggleFavorite={toggleFavorite}
        projectOverrides={projectOverrides}
        canEnter={canEnter}
        canManageProject={canManageProject}
        onEnter={handleEnter}
        editingTags={editingTags}
        tagInput={tagInput}
        onTagInputChange={setTagInput}
        onStartEditTags={setEditingTags}
        onStopEditTags={() => {
          setEditingTags(null);
          setTagInput("");
        }}
        onAddTag={handleAddTag}
        onRemoveTag={handleRemoveTag}
        byUid={byUid}
        onOpenMembers={openMembers}
        onOpenTimeline={async (project) => {
          const data = await getTimeline(project.projectId);
          setTimelineData(data || { milestones: [], activities: [] });
          setTimelineOpen(true);
          setActiveProject(project);
          setActiveProjectId(project.projectId);
        }}
        onEdit={onEditProject}
        onDelete={deleteProject}
        onStatusChanged={async (projectId) => {
          const fresh = await getProjectById(projectId);
          applyProjectPatch(projectId, fresh || {});
        }}
        onRecomputed={async (projectId) => {
          const fresh = await getProjectById(projectId);
          applyProjectPatch(projectId, fresh || {});
        }}
        totalCount={filteredSorted.length}
      />

      {totalPages > 1 && (
        <div className="mt-6 flex justify-center">
          <Pagination
            page={pageSafe}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        </div>
      )}

      <MemberManagementDialog
        open={memberOpen}
        onClose={closeMembers}
        project={activeProject}
        loading={activeLoading}
        candidates={unassignedCandidates}
        byUid={byUid}
        onAddMember={async (uid, email, role) => {
          setBusy(true);
          try {
            await addMember(activeProjectId, { uid, email, role });
            const updated = await getProjectById(activeProjectId);
            setActiveProject(updated);
            applyProjectPatch(activeProjectId, { members: updated.members });
            openToast("Member assigned successfully!", "success");
          } catch (e) {
            openToast(String(e?.message || e), "error");
          } finally {
            setBusy(false);
          }
        }}
        onRemoveMember={async (uid) => {
          setBusy(true);
          try {
            await removeMember(activeProjectId, uid);
            const updated = await getProjectById(activeProjectId);
            setActiveProject(updated);
            applyProjectPatch(activeProjectId, { members: updated.members });
            openToast("Member removed successfully!", "success");
          } catch (e) {
            openToast(String(e?.message || e), "error");
          } finally {
            setBusy(false);
          }
        }}
        busy={busy}
      />

      <TimelineDialog
        open={timelineOpen}
        onClose={() => setTimelineOpen(false)}
        project={activeProject}
        data={timelineData}
        onToggleMilestone={async (milestoneId, done) => {
          await patchMilestone(activeProjectId, milestoneId, { done: !done });
          const updated = await getTimeline(activeProjectId);
          setTimelineData(updated);
        }}
        onDeleteMilestone={async (milestoneId) => {
          await deleteMilestone(activeProjectId, milestoneId);
          const updated = await getTimeline(activeProjectId);
          setTimelineData(updated);
        }}
        onAddMilestone={async (title) => {
          await addMilestone(activeProjectId, { title });
          const updated = await getTimeline(activeProjectId);
          setTimelineData(updated);
        }}
        onAddAttachment={async (name, url) => {
          await addAttachment(activeProjectId, { name, url });
          openToast("Attachment added", "success");
        }}
        onAddSurvey={async (surveyId) => {
          await addSurveyId(activeProjectId, surveyId);
          openToast("Survey added", "success");
        }}
        onRemoveSurvey={async (surveyId) => {
          await removeSurveyId(activeProjectId, surveyId);
          openToast("Survey removed", "success");
        }}
      />

      <Toast
        open={toast.open}
        message={toast.msg}
        severity={toast.severity}
        onClose={() => setToast({ ...toast, open: false })}
      />
    </div>
  );
}

function Pagination({ page, totalPages, onPageChange }) {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => onPageChange(1)}
        disabled={page === 1}
        className="px-3 py-1 rounded border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
      >
        First
      </button>
      <button
        onClick={() => onPageChange(page - 1)}
        disabled={page === 1}
        className="px-3 py-1 rounded border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
      >
        Previous
      </button>
      <span className="px-4 py-1">
        Page {page} of {totalPages}
      </span>
      <button
        onClick={() => onPageChange(page + 1)}
        disabled={page === totalPages}
        className="px-3 py-1 rounded border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
      >
        Next
      </button>
      <button
        onClick={() => onPageChange(totalPages)}
        disabled={page === totalPages}
        className="px-3 py-1 rounded border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
      >
        Last
      </button>
    </div>
  );
}