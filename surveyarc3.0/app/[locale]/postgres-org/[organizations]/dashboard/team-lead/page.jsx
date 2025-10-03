"use client";
/**
 * Team Lead Tickets Screen
 * - Shows groups where current user is a LEAD
 * - Pulls teams under those groups
 * - Lists tickets from those groups
 * - Allows assignment to members of those teams
 */

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useCallback } from "react";
import { Loader2, Users, UserCheck, AlertCircle, Search, Lock, ClipboardList } from "lucide-react";

import { useUser } from "@/providers/postGresPorviders/UserProvider";
import SupportGroupModel from "@/models/postGresModels/supportGroupModel";
import SupportTeamModel from "@/models/postGresModels/supportTeamModel";
import TicketModel from "@/models/ticketModel";

import TeamMultiSelect from "@/components/tickets/TeamMultiSelect";
import AgentMultiSelect from "@/components/tickets/AgentMultiSelect";

/* ========================================= *
 *                PAGE
 * ========================================= */
export default function TeamLeadTicketsPage() {
  const router = useRouter();
  const path = usePathname();
  const orgId = path.split("/")[3];
  const { uid } = useUser();

  const [boot, setBoot] = useState(true);
  const [loading, setLoading] = useState(false);

  // groups where I am LEAD
  const [leadGroups, setLeadGroups] = useState([]); // [{groupId, name, ...}]
  const [teamsByGroup, setTeamsByGroup] = useState({}); // groupId -> teams[]
  const [membersByTeam, setMembersByTeam] = useState({}); // teamId -> members[]

  // tickets view
  const [allTickets, setAllTickets] = useState([]);
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [selectedGroup, setSelectedGroup] = useState("all");
  const [sortBy, setSortBy] = useState("created_at_desc");

  // assign UI
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [ticketForAssign, setTicketForAssign] = useState(null);
  const [assignTeams, setAssignTeams] = useState([]);
  const [assignAgent, setAssignAgent] = useState("");
  const [savingAssign, setSavingAssign] = useState(false);

  // discover groups where I'm a LEAD + fetch their teams and members
  useEffect(() => {
    let aborted = false;
    (async () => {
      if (!orgId || !uid) return;
      try {
        const groups = await SupportGroupModel.list(orgId);
        const leads = [];

        for (const g of groups || []) {
          const gid = g.groupId || g.group_id;
          try {
            const members = await SupportGroupModel.listMembers(gid);
            const me = (members || []).find(
              (m) => m.user_id === uid && m.active !== false && m.role === "lead"
            );
            if (me) leads.push({ ...g, groupId: gid });
          } catch {
            // ignore group membership errors
          }
        }

        const tMap = {};
        const mMap = {};
        for (const g of leads) {
          const gid = g.groupId;
          try {
            const teams = await SupportTeamModel.list({ groupId: gid });
            tMap[gid] = teams || [];
            // fetch members per team
            for (const t of teams || []) {
              try {
                const members = await SupportTeamModel.listMembers(t.teamId);
                mMap[t.teamId] = members || [];
              } catch {
                mMap[t.teamId] = [];
              }
            }
          } catch {
            tMap[gid] = [];
          }
        }

        if (!aborted) {
          setLeadGroups(leads);
          setTeamsByGroup(tMap);
          setMembersByTeam(mMap);
        }
      } finally {
        if (!aborted) setBoot(false);
      }
    })();
    return () => {
      aborted = true;
    };
  }, [orgId, uid]);

  // load tickets for lead groups
  const loadTickets = useCallback(async () => {
    if (!orgId) return;
    if (!leadGroups.length) {
      setAllTickets([]);
      return;
    }
    setLoading(true);
    try {
      const groupsToFetch =
        selectedGroup === "all"
          ? leadGroups
          : leadGroups.filter((g) => g.groupId === selectedGroup);

      const lists = await Promise.all(
        groupsToFetch.map((g) =>
          TicketModel.list({
            orgId,
            groupId: g.groupId,
            status: status || undefined,
            q: q || undefined,
            limit: 200,
            offset: 0,
            sort: sortBy,
          }).catch(() => [])
        )
      );

      const merged = lists.flat().map((t) => ({
        ...t,
        groupId: t.groupId || t.group_id,
        assigneeId: t.assigneeId || t.assignee_id,
        teamIds: t.teamIds || t.team_ids || [],
        agentIds: t.agentIds || t.agent_ids || [],
      }));
      setAllTickets(sortLocal(merged, sortBy));
    } finally {
      setLoading(false);
    }
  }, [orgId, leadGroups, selectedGroup, status, q, sortBy]);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  // derived
  const myLeadTeamIds = useMemo(() => {
    const ids = new Set();
    Object.values(teamsByGroup).forEach((arr) => (arr || []).forEach((t) => ids.add(t.teamId)));
    return ids;
  }, [teamsByGroup]);

  const counts = useMemo(
    () => ({
      total: allTickets.length,
      unassigned: allTickets.filter((t) => !t.assigneeId).length,
      assigned: allTickets.filter((t) => !!t.assigneeId).length,
    }),
    [allTickets]
  );

  // open drawer to assign a ticket
  const openAssignDrawer = (t) => {
    setTicketForAssign(t);
    setAssignTeams(t.teamIds || []);
    setAssignAgent(t.assigneeId || "");
    setDrawerOpen(true);
  };

  // all eligible agents are union of members from currently selected teams (in the drawer)
  const eligibleAgents = useMemo(() => {
    const pool = new Map(); // userId -> member
    for (const teamId of assignTeams) {
      for (const m of membersByTeam[teamId] || []) {
        if (m.active !== false) pool.set(m.userId, m);
      }
    }
    return Array.from(pool.values());
  }, [assignTeams, membersByTeam]);

  // save assignment
  const saveAssignment = async () => {
    if (!ticketForAssign) return;
    const tid = ticketForAssign.ticketId || ticketForAssign.ticket_id;
    setSavingAssign(true);
    try {
      // 1) Replace teams (if changed)
      await TicketModel.patchTeams(tid, assignTeams, "replace");

      // 2) Replace agents array (optional but keeps visibility lists tidy)
      if (assignAgent) {
        await TicketModel.patchAgents(tid, [assignAgent], "replace");
      } else {
        await TicketModel.patchAgents(tid, [], "replace");
      }

      // 3) Set explicit assignee_id for the ticket (who owns it)
      await TicketModel.update(tid, { assigneeId: assignAgent || null });

      // update local state
      setAllTickets((prev) =>
        prev.map((t) =>
          (t.ticketId || t.ticket_id) === tid
            ? {
                ...t,
                teamIds: [...assignTeams],
                agentIds: assignAgent ? [assignAgent] : [],
                assigneeId: assignAgent || null,
              }
            : t
        )
      );

      setDrawerOpen(false);
      setTicketForAssign(null);
      setAssignTeams([]);
      setAssignAgent("");
    } finally {
      setSavingAssign(false);
    }
  };

  if (boot) {
    return (
      <div className="p-8 flex items-center justify-center text-gray-600">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Preparing your lead view…
      </div>
    );
    }

  if (!leadGroups.length) {
    return (
      <div className="p-8">
        <div className="p-6 border rounded-lg bg-rose-50 border-rose-200 text-rose-900">
          <div className="flex items-start gap-3">
            <Lock className="h-5 w-5 mt-0.5" />
            <div>
              <div className="font-semibold">You’re not a lead in any support group.</div>
              <div className="text-sm">Ask an admin to make you a lead, or switch to your “My Group Tickets” view.</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <main className="p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ClipboardList className="h-5 w-5 text-gray-500" />
            <h1 className="text-lg font-semibold">Team Lead — Tickets</h1>
          </div>
          <div className="text-sm text-gray-500">
            Lead of: {leadGroups.map((g) => g.name).join(", ")}
          </div>
          <div className="text-xs text-gray-400 mt-1">
            {Object.values(teamsByGroup).flat().length} team
            {Object.values(teamsByGroup).flat().length !== 1 ? "s" : ""} across{" "}
            {leadGroups.length} group{leadGroups.length !== 1 ? "s" : ""}
          </div>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard label="Total" value={counts.total} />
        <StatCard label="Unassigned" value={counts.unassigned} />
        <StatCard label="Assigned" value={counts.assigned} />
      </div>

      {/* Filters */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <select
            className="border rounded-lg px-3 py-2 text-sm"
            value={selectedGroup}
            onChange={(e) => setSelectedGroup(e.target.value)}
          >
            <option value="all">All Lead Groups</option>
            {leadGroups.map((g) => (
              <option key={g.groupId} value={g.groupId}>
                {g.name}
              </option>
            ))}
          </select>

          <select
            className="border rounded-lg px-3 py-2 text-sm"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">All Statuses</option>
            <option value="new">New</option>
            <option value="open">Open</option>
            <option value="pending">Pending</option>
            <option value="on_hold">On Hold</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>

          <select
            className="border rounded-lg px-3 py-2 text-sm"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="created_at_desc">Newest First</option>
            <option value="created_at_asc">Oldest First</option>
            <option value="updated_at_desc">Recently Updated</option>
            <option value="priority_desc">High Priority First</option>
            <option value="priority_asc">Low Priority First</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="h-4 w-4 absolute left-2 top-2.5 text-gray-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search subject..."
              className="pl-8 pr-3 py-2 border rounded-lg text-sm w-64"
            />
          </div>
          <button
            className="px-3 py-2 text-sm border rounded-lg hover:bg-gray-50"
            onClick={loadTickets}
            disabled={loading}
          >
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Refreshing…
              </span>
            ) : (
              "Refresh"
            )}
          </button>
        </div>
      </div>

      {/* Tickets Table */}
      <div className="bg-white border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="px-4 py-3 text-left">#</th>
                <th className="px-4 py-3 text-left">Subject</th>
                <th className="px-4 py-3 text-left">Group</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Priority</th>
                <th className="px-4 py-3 text-left">Assignee</th>
                <th className="px-4 py-3 text-left">Teams</th>
                <th className="px-4 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-gray-500">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" /> Loading tickets…
                    </div>
                  </td>
                </tr>
              )}
              {!loading && allTickets.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                    <div className="flex flex-col items-center gap-2">
                      <AlertCircle className="h-8 w-8 text-gray-400" />
                      <div className="font-medium">No tickets found</div>
                      <div className="text-sm">Try adjusting your filters.</div>
                    </div>
                  </td>
                </tr>
              )}
              {!loading &&
                allTickets.map((t) => {
                  const id = t.ticketId || t.ticket_id;
                  const groupName =
                    leadGroups.find((g) => g.groupId === t.groupId)?.name || t.groupId;
                  const isAssigneeInMyTeams =
                    !!t.assigneeId &&
                    memberExistsInLeadTeams(t.assigneeId, membersByTeam, myLeadTeamIds);

                  return (
                    <tr key={id} className="border-t hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-600 font-mono text-xs">
                        {t.number || "—"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900 line-clamp-2 max-w-md">
                          {t.subject}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          Req: {t.requesterId || t.requester_id}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm">{groupName}</div>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={t.status} />
                      </td>
                      <td className="px-4 py-3">
                        <PriorityBadge priority={t.priority} />
                      </td>
                      <td className="px-4 py-3">
                        {t.assigneeId ? (
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border ${
                              isAssigneeInMyTeams
                                ? "bg-blue-50 text-blue-700 border-blue-200"
                                : "bg-gray-50 text-gray-600 border-gray-200"
                            }`}
                            title={
                              isAssigneeInMyTeams
                                ? "Assignee is in your teams"
                                : "Assignee is not in your teams"
                            }
                          >
                            <UserCheck className="h-3 w-3" />
                            {t.assigneeId}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-orange-50 text-orange-700 border border-orange-200">
                            <AlertCircle className="h-3 w-3" />
                            Unassigned
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {(t.teamIds || []).length ? (
                          <div className="text-xs text-gray-700">
                            {(t.teamIds || []).length} selected
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">None</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            className="px-3 py-1.5 rounded-lg text-sm border bg-white hover:bg-gray-50 text-gray-700 border-gray-300"
                            onClick={() => openAssignDrawer(t)}
                          >
                            Assign
                          </button>
                          <button
                            className="px-3 py-1.5 rounded-lg text-sm border bg-blue-600 hover:bg-blue-700 text-white"
                            onClick={() => router.push(`/tickets/${id}`)}
                          >
                            Open
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Assignment Drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/40" onClick={() => setDrawerOpen(false)} />
          <div className="w-full max-w-md bg-white h-full shadow-xl p-5 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Assign Ticket</h2>
              <button
                className="text-gray-500 hover:text-gray-700"
                onClick={() => setDrawerOpen(false)}
              >
                ✕
              </button>
            </div>

            <div className="space-y-5">
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="text-sm font-medium text-gray-700">
                  {ticketForAssign?.subject}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Ticket #{ticketForAssign?.number}
                </div>
              </div>

              {/* TEAMS */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Teams (in this ticket’s group)
                </label>
                <TeamMultiSelect
                  key={ticketForAssign?.groupId || "teams"}
                  groupId={ticketForAssign?.groupId}
                  value={assignTeams}
                  onChange={setAssignTeams}
                  label="Select teams"
                />
                <div className="text-xs text-gray-400">
                  Only members from selected teams will be eligible below.
                </div>
              </div>

              {/* AGENT (single owner) */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Assignee (team member)
                </label>
                <AgentDropdown
                  agents={eligibleAgents}
                  value={assignAgent}
                  onChange={setAssignAgent}
                  placeholder="Choose a team member…"
                />
                <div className="text-xs text-gray-400">
                  This sets <span className="font-medium">ticket.assigneeId</span>, and also replaces the ticket’s <span className="font-medium">agentIds</span> with the chosen user for clean ownership.
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t">
                <button
                  className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50"
                  onClick={() => setDrawerOpen(false)}
                  disabled={savingAssign}
                >
                  Cancel
                </button>
                <button
                  className={`px-4 py-2 text-sm rounded-lg text-white ${
                    savingAssign ? "bg-blue-400" : "bg-blue-600 hover:bg-blue-700"
                  }`}
                  onClick={saveAssignment}
                  disabled={savingAssign}
                >
                  {savingAssign ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Saving…
                    </span>
                  ) : (
                    "Save Assignment"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

/* ========================================= *
 *        SMALL PRESENTATIONAL PIECES
 * ========================================= */

function StatCard({ label, value }) {
  return (
    <div className="border rounded-lg p-3 bg-white">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-xl font-semibold">{value}</div>
    </div>
  );
}

function StatusBadge({ status }) {
  const badges = {
    new: "bg-purple-50 text-purple-700 border-purple-200",
    open: "bg-blue-50 text-blue-700 border-blue-200",
    pending: "bg-yellow-50 text-yellow-700 border-yellow-200",
    on_hold: "bg-orange-50 text-orange-700 border-orange-200",
    resolved: "bg-green-50 text-green-700 border-green-200",
    closed: "bg-gray-50 text-gray-700 border-gray-200",
    canceled: "bg-red-50 text-red-700 border-red-200",
  };

  const className = badges[status] || badges.new;
  const label = (status || "new").replace("_", " ").toUpperCase();
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs border ${className}`}>
      {label}
    </span>
  );
}

function PriorityBadge({ priority }) {
  const badges = {
    low: "bg-gray-50 text-gray-600 border-gray-200",
    normal: "bg-green-50 text-green-700 border-green-200",
    high: "bg-orange-50 text-orange-700 border-orange-200",
    urgent: "bg-red-50 text-red-700 border-red-200",
    blocker: "bg-red-100 text-red-800 border-red-300",
  };
  const label = (priority || "normal").charAt(0).toUpperCase() + (priority || "normal").slice(1);
  const className = badges[priority] || badges.normal;

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs border font-medium ${className}`}>
      {label}
    </span>
  );
}

function AgentDropdown({ agents = [], value, onChange, placeholder = "Select…" }) {
  return (
    <select
      className="border rounded-lg px-3 py-2 text-sm w-full"
      value={value || ""}
      onChange={(e) => onChange(e.target.value || "")}
    >
      <option value="">{placeholder}</option>
      {agents.map((a) => (
        <option key={a.userId} value={a.userId}>
          {a.userId} ({a.role})
        </option>
      ))}
    </select>
  );
}

/* ========================================= *
 *                HELPERS
 * ========================================= */

function sortLocal(arr, sortBy) {
  const a = [...arr];
  switch (sortBy) {
    case "created_at_asc":
      return a.sort(
        (x, y) =>
          new Date(x.createdAt || x.created_at) -
          new Date(y.createdAt || y.created_at)
      );
    case "updated_at_desc":
      return a.sort(
        (x, y) =>
          new Date(y.updatedAt || y.updated_at) -
          new Date(x.updatedAt || x.updated_at)
      );
    case "priority_desc":
      return a.sort((x, y) => prioRank(y.priority) - prioRank(x.priority));
    case "priority_asc":
      return a.sort((x, y) => prioRank(x.priority) - prioRank(y.priority));
    case "created_at_desc":
    default:
      return a.sort(
        (x, y) =>
          new Date(y.createdAt || y.created_at) -
          new Date(x.createdAt || x.created_at)
      );
  }
}

function prioRank(p) {
  const ranks = { blocker: 5, urgent: 4, high: 3, normal: 2, low: 1 };
  return ranks[p] || 0;
}

/**
 * Check if a given userId is a member of at least one of the lead’s teams.
 */
function memberExistsInLeadTeams(userId, membersByTeam, teamIdSet) {
  for (const tid of teamIdSet) {
    const members = membersByTeam[tid] || [];
    if (members.find((m) => m.userId === userId && m.active !== false)) {
      return true;
    }
  }
  return false;
}
