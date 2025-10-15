"use client";
/**
 * Team Lead Tickets Screen
 * - Shows tickets from groups where current user is a TEAM LEAD (in any team)
 * - Can toggle to show tickets NOT from those groups
 */

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useCallback } from "react";
import { Loader2, Users, UserCheck, AlertCircle, Search, Lock, ClipboardList, Shield } from "lucide-react";

import { useUser } from "@/providers/postGresPorviders/UserProvider";
import SupportGroupModel from "@/models/postGresModels/supportGroupModel";
import SupportTeamModel from "@/models/postGresModels/supportTeamModel";
import TicketModel from "@/models/ticketModel";

import TeamMultiSelect from "@/components/tickets/TeamMultiSelect";
import AgentMultiSelect from "@/components/tickets/AgentMultiSelect";

export default function TeamLeadTicketsPage() {
  const router = useRouter();
  const path = usePathname();
  const orgId = path.split("/")[3];
  const { uid } = useUser();

  const [boot, setBoot] = useState(true);
  const [loading, setLoading] = useState(false);

  // teams where I am LEAD
  const [leadTeams, setLeadTeams] = useState([]); // teams where user has role="lead"
  const [leadTeamGroups, setLeadTeamGroups] = useState([]); // groups containing those teams
  
  // ALL groups in org (to show non-lead tickets)
  const [allGroups, setAllGroups] = useState([]);
  
  const [teamsByGroup, setTeamsByGroup] = useState({}); // groupId -> teams[]
  const [membersByTeam, setMembersByTeam] = useState({}); // teamId -> members[]

  // VIEW MODE: "lead" (groups with my lead teams) or "non-lead" (other groups)
  const [viewMode, setViewMode] = useState("lead");

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

  // Discover teams where I'm a TEAM LEAD
  useEffect(() => {
    let aborted = false;
    (async () => {
      if (!orgId || !uid) return;
      try {
        const groups = await SupportGroupModel.list(orgId);
        const myLeadTeams = [];
        const groupsWithLeadTeams = [];
        const tMap = {};
        const mMap = {};

        // Check each group's teams to see if I'm a lead in any
        for (const g of groups || []) {
          const gid = g.groupId || g.group_id;
          
          try {
            const teams = await SupportTeamModel.list({ groupId: gid });
            tMap[gid] = teams || [];
            
            let hasLeadTeam = false;
            
            // Check if I'm a lead in any of these teams
            for (const t of teams || []) {
              const tid = t.teamId || t.team_id;
              try {
                const members = await SupportTeamModel.listMembers(tid);
                mMap[tid] = members || [];
                
                // Check if current user is a LEAD in this team
                const me = (members || []).find(
                  (m) => (m.user_id || m.userId) === uid && m.active !== false && m.role === "lead"
                );
                
                if (me) {
                  myLeadTeams.push({ ...t, teamId: tid });
                  hasLeadTeam = true;
                }
              } catch {
                mMap[tid] = [];
              }
            }
            
            // If I'm a lead in any team in this group, add the group
            if (hasLeadTeam) {
              groupsWithLeadTeams.push({ ...g, groupId: gid });
            }
          } catch {
            tMap[gid] = [];
          }
        }

        if (!aborted) {
          setAllGroups(groups || []);
          setLeadTeams(myLeadTeams);
          setLeadTeamGroups(groupsWithLeadTeams);
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

  // Determine which groups to show based on view mode
  const displayGroups = useMemo(() => {
    if (viewMode === "lead") {
      return leadTeamGroups;
    } else {
      // "non-lead" - show groups where I'm NOT a team lead
      const leadGroupIds = new Set(leadTeamGroups.map(g => g.groupId));
      return allGroups.filter(g => !leadGroupIds.has(g.groupId || g.group_id));
    }
  }, [viewMode, leadTeamGroups, allGroups]);

  // load tickets based on current view mode
  const loadTickets = useCallback(async () => {
    if (!orgId) return;
    if (!displayGroups.length) {
      setAllTickets([]);
      return;
    }
    setLoading(true);
    try {
      const groupsToFetch =
        selectedGroup === "all"
          ? displayGroups
          : displayGroups.filter((g) => g.groupId === selectedGroup);

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
  }, [orgId, displayGroups, selectedGroup, status, q, sortBy]);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  // derived - only my lead team IDs
  const myLeadTeamIds = useMemo(() => {
    return new Set(leadTeams.map(t => t.teamId));
  }, [leadTeams]);

  const counts = useMemo(
    () => ({
      total: allTickets.length,
      unassigned: allTickets.filter((t) => !t.assigneeId).length,
      assigned: allTickets.filter((t) => !!t.assigneeId).length,
    }),
    [allTickets]
  );

  // Check if user is TL in any team
  const isTeamLead = leadTeams.length > 0;

  // open drawer to assign a ticket
  const openAssignDrawer = (t) => {
    setTicketForAssign(t);
    setAssignTeams(t.teamIds || []);
    setAssignAgent(t.assigneeId || "");
    setDrawerOpen(true);
  };

  // all eligible agents are union of members from currently selected teams
  const eligibleAgents = useMemo(() => {
    const pool = new Map();
    for (const teamId of assignTeams) {
      for (const m of membersByTeam[teamId] || []) {
        const userId = m.user_id || m.userId;
        if (m.active !== false && userId) pool.set(userId, m);
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
      await TicketModel.patchTeams(tid, assignTeams, "replace");

      if (assignAgent) {
        await TicketModel.patchAgents(tid, [assignAgent], "replace");
      } else {
        await TicketModel.patchAgents(tid, [], "replace");
      }

      await TicketModel.update(tid, { assigneeId: assignAgent || null });

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
      <div className="p-8 flex items-center justify-center text-gray-600 min-h-screen">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Checking your team lead status…
      </div>
    );
  }

  // Not a team lead at all
  if (!isTeamLead) {
    return (
      <div className="p-8">
        <div className="p-6 border rounded-lg bg-rose-50 border-rose-200 text-rose-900">
          <div className="flex items-start gap-3">
            <Lock className="h-5 w-5 mt-0.5" />
            <div>
              <div className="font-semibold">You're not a team lead in any support team.</div>
              <div className="text-sm">Ask an admin to make you a team lead, or switch to your "My Group Tickets" view.</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const nonLeadGroupsCount = allGroups.length - leadTeamGroups.length;

  return (
    <main className="p-4 md:p-6 space-y-4">
      {/* Header with Team Lead Badge */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ClipboardList className="h-5 w-5 text-gray-500" />
            <h1 className="text-lg font-semibold">Team Lead — Tickets</h1>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-purple-100 text-purple-700 border border-purple-200">
              <Shield className="h-3 w-3" />
              Team Lead
            </span>
          </div>
          <div className="text-sm text-gray-500">
            {viewMode === "lead" ? (
              <>Lead of {leadTeams.length} team{leadTeams.length !== 1 ? 's' : ''} across {leadTeamGroups.length} group{leadTeamGroups.length !== 1 ? 's' : ''}</>
            ) : (
              <>Viewing: {nonLeadGroupsCount} group{nonLeadGroupsCount !== 1 ? 's' : ''} where you're not a team lead</>
            )}
          </div>
          <div className="text-xs text-gray-400 mt-1">
            {viewMode === "lead" ? (
              <>Teams: {leadTeams.map(t => t.name || t.teamId).join(", ")}</>
            ) : (
              <>Viewing tickets outside your direct leadership</>
            )}
          </div>
        </div>
      </div>

      {/* View Mode Toggle */}
      <div className="flex items-center gap-2 border-b">
        <button
          onClick={() => {
            setViewMode("lead");
            setSelectedGroup("all");
          }}
          className={`px-4 py-2 -mb-px border-b-2 transition ${
            viewMode === "lead"
              ? "border-purple-600 text-purple-600 font-medium"
              : "border-transparent text-gray-600 hover:text-gray-900"
          }`}
        >
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            My Lead Teams ({leadTeamGroups.length} groups)
          </div>
        </button>
        <button
          onClick={() => {
            setViewMode("non-lead");
            setSelectedGroup("all");
          }}
          className={`px-4 py-2 -mb-px border-b-2 transition ${
            viewMode === "non-lead"
              ? "border-blue-600 text-blue-600 font-medium"
              : "border-transparent text-gray-600 hover:text-gray-900"
          }`}
        >
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Other Groups ({nonLeadGroupsCount})
          </div>
        </button>
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
            <option value="all">
              {viewMode === "lead" ? "All Groups with Lead Teams" : "All Other Groups"}
            </option>
            {displayGroups.map((g) => (
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

      {/* Info Alert for Non-Lead View */}
      {viewMode === "non-lead" && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5" />
            <div className="text-sm text-blue-700">
              <strong>Viewing tickets outside your lead teams.</strong> You can see these tickets but cannot assign them since you're not a team lead in these groups.
            </div>
          </div>
        </div>
      )}

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
                      <div className="text-sm">
                        {viewMode === "non-lead" 
                          ? "No tickets in groups where you're not a team lead"
                          : "Try adjusting your filters"}
                      </div>
                    </div>
                  </td>
                </tr>
              )}
              {!loading &&
                allTickets.map((t) => {
                  const id = t.ticketId || t.ticket_id;
                  const groupName =
                    displayGroups.find((g) => g.groupId === t.groupId)?.name || t.groupId;
                  const isAssigneeInMyTeams =
                    !!t.assigneeId &&
                    memberExistsInLeadTeams(t.assigneeId, membersByTeam, myLeadTeamIds);
                  const hasMyLeadTeam = leadTeamGroups.some(g => g.groupId === t.groupId);

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
                        <div className="flex items-center gap-1">
                          <div className="text-sm">{groupName}</div>
                          {!hasMyLeadTeam && (
                            <span className="text-xs text-gray-400" title="You're not a team lead in this group">
                              •
                            </span>
                          )}
                        </div>
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
                                ? "Assignee is in your lead teams"
                                : "Assignee is not in your lead teams"
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
                            className={`px-3 py-1.5 rounded-lg text-sm border ${
                              hasMyLeadTeam
                                ? "bg-white hover:bg-gray-50 text-gray-700 border-gray-300"
                                : "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                            }`}
                            onClick={() => hasMyLeadTeam && openAssignDrawer(t)}
                            disabled={!hasMyLeadTeam}
                            title={hasMyLeadTeam ? "Assign teams/agent" : "You're not a team lead in this group"}
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

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Teams (in this ticket's group)
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
                  Sets ticket.assigneeId and replaces agentIds with the chosen user.
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

/* Helper Components */
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
      {agents.map((a) => {
        const userId = a.user_id || a.userId;
        return (
          <option key={userId} value={userId}>
            {userId} ({a.role})
          </option>
        );
      })}
    </select>
  );
}

function sortLocal(arr, sortBy) {
  const a = [...arr];
  switch (sortBy) {
    case "created_at_asc":
      return a.sort((x, y) => new Date(x.createdAt || x.created_at) - new Date(y.createdAt || y.created_at));
    case "updated_at_desc":
      return a.sort((x, y) => new Date(y.updatedAt || y.updated_at) - new Date(x.updatedAt || x.updated_at));
    case "priority_desc":
      return a.sort((x, y) => prioRank(y.priority) - prioRank(x.priority));
    case "priority_asc":
      return a.sort((x, y) => prioRank(x.priority) - prioRank(y.priority));
    case "created_at_desc":
    default:
      return a.sort((x, y) => new Date(y.createdAt || y.created_at) - new Date(x.createdAt || x.created_at));
  }
}

function prioRank(p) {
  const ranks = { blocker: 5, urgent: 4, high: 3, normal: 2, low: 1 };
  return ranks[p] || 0;
}

function memberExistsInLeadTeams(userId, membersByTeam, teamIdSet) {
  for (const tid of teamIdSet) {
    const members = membersByTeam[tid] || [];
    const memberId = members.find((m) => {
      const mId = m.user_id || m.userId;
      return mId === userId && m.active !== false;
    });
    if (memberId) return true;
  }
  return false;
}