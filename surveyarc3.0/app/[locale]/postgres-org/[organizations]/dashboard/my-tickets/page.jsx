// app/postgres-org/[orgId]/my-tickets/page.jsx
"use client";
import { useParams, useSearchParams, useRouter, usePathname } from "next/navigation";
import { useEffect, useMemo, useState, useCallback } from "react";
import TicketModel from "@/models/ticketModel";
import SupportGroupModel from "@/models/postGresModels/supportGroupModel";
import TeamMultiSelect from "@/components/tickets/TeamMultiSelect";
import AgentMultiSelect from "@/components/tickets/AgentMultiSelect";
import { Loader2, Search, Filter, Clock, ShieldCheck, Users, Lock, UserCheck, AlertCircle } from "lucide-react";
import { useUser } from "@/providers/postGresPorviders/UserProvider";
import SupportTeamModel from "@/models/postGresModels/supportTeamModel";

export default function MyGroupTicketsPage() {
  const router = useRouter();
  const path = usePathname();
  const orgId = path.split("/")[3];
  const { uid } = useUser();
  
  const [boot, setBoot] = useState(true);
  const [myGroups, setMyGroups] = useState([]);
  const [myGroupRoles, setMyGroupRoles] = useState({});
  const [myTeams, setMyTeams] = useState([]); // All teams from my groups
  const [teamsByGroup, setTeamsByGroup] = useState({}); // groupId -> teams[]
  const [allTickets, setAllTickets] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // filters
  const [viewMode, setViewMode] = useState("all"); // "all" | "assigned_to_me" | "unassigned"
  const [status, setStatus] = useState(null);
  const [q, setQ] = useState("");
  const [sortBy, setSortBy] = useState("created_at_desc");
  const [selectedGroup, setSelectedGroup] = useState("all");
  
  // assignment UI
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignTicket, setAssignTicket] = useState(null);
  const [assignTeams, setAssignTeams] = useState([]);
  const [assignAgents, setAssignAgents] = useState([]);
  const [savingAssign, setSavingAssign] = useState(false);
  const [whyDisabled, setWhyDisabled] = useState("");

  // ---- 1) Discover my groups and their teams ----
  useEffect(() => {
    let aborted = false;
    (async () => {
      if (!orgId || !uid) return;
      try {
        const groups = await SupportGroupModel.list(orgId);
        const mine = [];
        const roles = {};
        const teamsMap = {};
        const allTeamsList = [];
        
        await Promise.all(
          (groups || []).map(async (g) => {
            const members = await SupportGroupModel.listMembers(g.groupId || g.group_id);
            const me = (members || []).find(m => m.user_id === uid && m.active !== false);
            if (me) {
              const gid = g.groupId || g.group_id;
              mine.push({ ...g, groupId: gid });
              roles[gid] = me.role;
              
              // Fetch teams for this group
              try {
                const teams = await SupportTeamModel.list({ groupId: gid });
                teamsMap[gid] = teams || [];
                allTeamsList.push(...(teams || []));
              } catch (err) {
                console.error(`Failed to fetch teams for group ${gid}:`, err);
                teamsMap[gid] = [];
              }
            }
          })
        );
        
        if (!aborted) {
          setMyGroups(mine);
          setMyGroupRoles(roles);
          setTeamsByGroup(teamsMap);
          setMyTeams(allTeamsList);
        }
      } finally {
        if (!aborted) setBoot(false);
      }
    })();
    return () => { aborted = true; };
  }, [orgId, uid]);

  // ---- 2) Load all tickets from my groups ----
  const loadTickets = useCallback(async () => {
    if (!orgId || myGroups.length === 0) {
      setAllTickets([]);
      return;
    }
    setLoading(true);
    try {
      const groupsToFetch = selectedGroup === "all" 
        ? myGroups 
        : myGroups.filter(g => g.groupId === selectedGroup);
      
      const lists = await Promise.all(
        groupsToFetch.map(g =>
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
      
      const merged = lists.flat().map(t => ({
        ...t,
        groupId: t.groupId || t.group_id,
        assigneeId: t.assigneeId || t.assignee_id,
      }));
      
      setAllTickets(sortLocal(merged, sortBy));
    } finally {
      setLoading(false);
    }
  }, [orgId, myGroups, selectedGroup, status, q, sortBy]);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  // ---- 3) Filter tickets based on view mode ----
  const filteredTickets = useMemo(() => {
    switch (viewMode) {
      case "assigned_to_me":
        return allTickets.filter(t => t.assigneeId === uid);
      case "unassigned":
        return allTickets.filter(t => !t.assigneeId);
      case "all":
      default:
        return allTickets.filter(t => !t.assigneeId || t.assigneeId === uid);
    }
  }, [allTickets, viewMode, uid]);

  // ---- 4) Counts for tabs ----
  const counts = useMemo(() => ({
    assignedToMe: allTickets.filter(t => t.assigneeId === uid).length,
    unassigned: allTickets.filter(t => !t.assigneeId).length,
    all: allTickets.filter(t => !t.assigneeId || t.assigneeId === uid).length,
  }), [allTickets, uid]);

  // ---- 5) Permission check (pure function, no state updates) ----
  const canAssign = useCallback((t) => {
    const gid = t.groupId;
    
    // If ticket has an assignee, only that assignee can reassign
    if (t.assigneeId) {
      return t.assigneeId === uid;
    }
    
    // If unassigned, anyone in the group can assign teams/agents
    // Check if user is a member of this group
    return myGroupRoles.hasOwnProperty(gid);
  }, [uid, myGroupRoles]);

  // Get reason why assignment is disabled
  const getDisabledReason = useCallback((t) => {
    const gid = t.groupId;
    
    // If ticket has an assignee and it's not the current user
    if (t.assigneeId && t.assigneeId !== uid) {
      return "Only the current assignee can re-assign this ticket.";
    }
    
    // If unassigned but user is not in the group
    if (!t.assigneeId && !myGroupRoles.hasOwnProperty(gid)) {
      return "You are not a member of this group.";
    }
    
    return "";
  }, [uid, myGroupRoles]);

  const openAssign = (t) => {
    setAssignTicket(t);
    setAssignTeams(t.teamIds || t.team_ids || []);
    setAssignAgents(t.agentIds || t.agent_ids || []);
    setWhyDisabled(getDisabledReason(t));
    setAssignOpen(true);
  };

  const saveAssignment = async () => {
    if (!assignTicket || !canAssign(assignTicket)) return;
    setSavingAssign(true);
    try {
      const tid = assignTicket.ticketId || assignTicket.ticket_id;
      
      // Update teams and agents
      await TicketModel.patchTeams(tid, assignTeams, "replace");
      await TicketModel.patchAgents(tid, assignAgents, "replace");
      
      // If ticket was unassigned, assign it to current user
      let newAssigneeId = assignTicket.assigneeId;
      if (!assignTicket.assigneeId) {
        await TicketModel.update(tid, { assigneeId: uid });
        newAssigneeId = uid;
      }
      
      // Update local state
      setAllTickets(prev => prev.map(t =>
        (t.ticketId || t.ticket_id) === tid
          ? { 
              ...t, 
              teamIds: [...assignTeams], 
              agentIds: [...assignAgents],
              assigneeId: newAssigneeId 
            }
          : t
      ));
      setAssignOpen(false);
    } finally {
      setSavingAssign(false);
    }
  };

  if (boot) {
    return (
      <div className="p-8 flex items-center justify-center text-gray-600">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Preparing your tickets…
      </div>
    );
  }

  if (!myGroups.length) {
    return (
      <div className="p-8">
        <div className="p-6 border rounded-lg bg-rose-50 border-rose-200 text-rose-900">
          <div className="flex items-start gap-3">
            <Lock className="h-5 w-5 mt-0.5" />
            <div>
              <div className="font-semibold">You are not a member of any groups in this org.</div>
              <div className="text-sm">Ask an admin to add you to a support group.</div>
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
            <Users className="h-5 w-5 text-gray-500" />
            <h1 className="text-lg font-semibold">My Group Tickets</h1>
          </div>
          <div className="text-sm text-gray-500">
            Member of: {myGroups.map(g => g.name).join(", ")}
          </div>
          <div className="text-xs text-gray-400 mt-1">
            {myTeams.length} team{myTeams.length !== 1 ? 's' : ''} across {myGroups.length} group{myGroups.length !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {/* Groups & Teams Overview */}
      {myGroups.length > 0 && (
        <div className="bg-white border rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Your Groups & Teams</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {myGroups.map(g => {
              const gid = g.groupId;
              const teams = teamsByGroup[gid] || [];
              return (
                <div key={gid} className="p-3 border rounded-lg bg-gray-50">
                  <div className="flex items-start justify-between mb-2">
                    <div className="font-medium text-sm text-gray-900">{g.name}</div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      myGroupRoles[gid] === 'lead' 
                        ? 'bg-blue-100 text-blue-700 border border-blue-200'
                        : 'bg-gray-100 text-gray-600 border border-gray-200'
                    }`}>
                      {myGroupRoles[gid]}
                    </span>
                  </div>
                  {teams.length > 0 ? (
                    <div className="space-y-1">
                      {teams.map(t => (
                        <div key={t.teamId} className="text-xs text-gray-600 flex items-center gap-1">
                          <div className="h-1.5 w-1.5 rounded-full bg-gray-400" />
                          {t.name}
                          {!t.active && <span className="text-gray-400">(inactive)</span>}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-xs text-gray-400">No teams</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* View Mode Tabs */}
      <div className="flex items-center gap-2 border-b">
        <button
          onClick={() => setViewMode("all")}
          className={`px-4 py-2 -mb-px border-b-2 transition ${
            viewMode === "all"
              ? "border-blue-600 text-blue-600 font-medium"
              : "border-transparent text-gray-600 hover:text-gray-900"
          }`}
        >
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            All My Tickets
            <span className="ml-1 px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-700">
              {counts.all}
            </span>
          </div>
        </button>
        <button
          onClick={() => setViewMode("assigned_to_me")}
          className={`px-4 py-2 -mb-px border-b-2 transition ${
            viewMode === "assigned_to_me"
              ? "border-blue-600 text-blue-600 font-medium"
              : "border-transparent text-gray-600 hover:text-gray-900"
          }`}
        >
          <div className="flex items-center gap-2">
            <UserCheck className="h-4 w-4" />
            Assigned to Me
            <span className="ml-1 px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700">
              {counts.assignedToMe}
            </span>
          </div>
        </button>
        <button
          onClick={() => setViewMode("unassigned")}
          className={`px-4 py-2 -mb-px border-b-2 transition ${
            viewMode === "unassigned"
              ? "border-blue-600 text-blue-600 font-medium"
              : "border-transparent text-gray-600 hover:text-gray-900"
          }`}
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            Needs Assignment
            <span className="ml-1 px-2 py-0.5 text-xs rounded-full bg-orange-100 text-orange-700">
              {counts.unassigned}
            </span>
          </div>
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <select
            className="border rounded-lg px-3 py-2 text-sm"
            value={selectedGroup}
            onChange={(e) => setSelectedGroup(e.target.value)}
          >
            <option value="all">All Groups</option>
            {myGroups.map(g => (
              <option key={g.groupId} value={g.groupId}>
                {g.name} ({myGroupRoles[g.groupId]})
              </option>
            ))}
          </select>
          
          <select
            className="border rounded-lg px-3 py-2 text-sm"
            value={status ?? ""}
            onChange={(e) => setStatus(e.target.value || null)}
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
                <th className="px-4 py-3 text-left">Teams/Agents</th>
                <th className="px-4 py-3 text-left">SLA</th>
                <th className="px-4 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={9} className="px-4 py-6 text-center text-gray-500">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" /> Loading tickets…
                    </div>
                  </td>
                </tr>
              )}
              {!loading && filteredTickets.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                    <div className="flex flex-col items-center gap-2">
                      <AlertCircle className="h-8 w-8 text-gray-400" />
                      <div className="font-medium">No tickets found</div>
                      <div className="text-sm">
                        {viewMode === "assigned_to_me" && "You don't have any tickets assigned to you."}
                        {viewMode === "unassigned" && "All tickets in your groups are assigned."}
                        {viewMode === "all" && "No tickets match your filters."}
                      </div>
                    </div>
                  </td>
                </tr>
              )}
              {!loading && filteredTickets.map(t => {
                const id = t.ticketId || t.ticket_id;
                const gid = t.groupId;
                const allowed = canAssign(t);
                const groupName = myGroups.find(g => g.groupId === gid)?.name || gid;
                const isAssignedToMe = t.assigneeId === uid;
                
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
                      <div className="text-xs text-gray-500">
                        {myGroupRoles[gid]}
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
                        <div className="flex items-center gap-1">
                          {isAssignedToMe ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-blue-50 text-blue-700 border border-blue-200">
                              <UserCheck className="h-3 w-3" />
                              You
                            </span>
                          ) : (
                            <span className="text-sm text-gray-700">{t.assigneeId}</span>
                          )}
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-orange-50 text-orange-700 border border-orange-200">
                          <AlertCircle className="h-3 w-3" />
                          Unassigned
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs space-y-1">
                        {(t.teamIds || t.team_ids || []).length > 0 && (
                          <div className="text-gray-700">
                            Teams: {(t.teamIds || t.team_ids).length}
                          </div>
                        )}
                        {(t.agentIds || t.agent_ids || []).length > 0 && (
                          <div className="text-gray-700">
                            Agents: {(t.agentIds || t.agent_ids).length}
                          </div>
                        )}
                        {!(t.teamIds || t.team_ids || []).length && !(t.agentIds || t.agent_ids || []).length && (
                          <span className="text-gray-400">None</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <SLAChips t={t} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          className={`px-3 py-1.5 rounded-lg text-sm border transition ${
                            allowed
                              ? "bg-white hover:bg-gray-50 text-gray-700 border-gray-300"
                              : "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                          }`}
                          onClick={() => allowed && openAssign(t)}
                          title={allowed ? "Assign teams and agents" : whyDisabled}
                          disabled={!allowed}
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
      {assignOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/40" onClick={() => setAssignOpen(false)} />
          <div className="w-full max-w-md bg-white h-full shadow-xl p-5 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Assign Ticket</h2>
              <button
                className="text-gray-500 hover:text-gray-700"
                onClick={() => setAssignOpen(false)}
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-5">
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="text-sm font-medium text-gray-700">
                  {assignTicket?.subject}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Ticket #{assignTicket?.number}
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Teams
                </label>
                <TeamMultiSelect
                  groupId={assignTicket?.groupId}
                  value={assignTeams}
                  onChange={setAssignTeams}
                  label="Select teams"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Agents
                </label>
                <AgentMultiSelect
                  orgId={orgId}
                  groupId={assignTicket?.groupId}
                  value={assignAgents}
                  onChange={setAssignAgents}
                  label="Select agents"
                />
              </div>

              {!canAssign(assignTicket) && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-rose-600 mt-0.5" />
                    <div className="text-sm text-rose-700">{whyDisabled}</div>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t">
                <button
                  className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50"
                  onClick={() => setAssignOpen(false)}
                  disabled={savingAssign}
                >
                  Cancel
                </button>
                <button
                  className={`px-4 py-2 text-sm rounded-lg text-white ${
                    savingAssign ? "bg-blue-400" : "bg-blue-600 hover:bg-blue-700"
                  }`}
                  onClick={saveAssignment}
                  disabled={savingAssign || !canAssign(assignTicket)}
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

/* ---------------- Helper Components ---------------- */
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
  
  const className = badges[priority] || badges.normal;
  const label = (priority || "normal").charAt(0).toUpperCase() + (priority || "normal").slice(1);
  
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs border font-medium ${className}`}>
      {label}
    </span>
  );
}

function SLAChips({ t }) {
  const s = t?.sla_status || t?.slaStatus;
  if (!s) return <span className="text-xs text-gray-400">No SLA</span>;
  
  const fr = s.first_response_due_at || s.firstResponseDueAt;
  const res = s.resolution_due_at || s.resolutionDueAt;
  
  return (
    <div className="flex flex-col gap-1">
      {fr && (
        <span className="inline-flex items-center text-xs px-2 py-0.5 rounded-full border bg-blue-50 text-blue-700 border-blue-200">
          <Clock className="h-3 w-3 mr-1" />
          FR: {new Date(fr).toLocaleTimeString()}
        </span>
      )}
      {res && (
        <span className="inline-flex items-center text-xs px-2 py-0.5 rounded-full border bg-amber-50 text-amber-700 border-amber-200">
          <Clock className="h-3 w-3 mr-1" />
          Res: {new Date(res).toLocaleTimeString()}
        </span>
      )}
    </div>
  );
}

/* ---------------- Helper Functions ---------------- */
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