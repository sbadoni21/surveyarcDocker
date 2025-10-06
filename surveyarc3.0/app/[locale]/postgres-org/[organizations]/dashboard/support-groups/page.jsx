// app/(your-path)/SupportGroupsPage.jsx
"use client";
import React, { useState, useEffect, useMemo } from "react";
import {
  Users, Plus, Edit, Trash2, ChevronDown, ChevronRight,
  UserPlus, AlertCircle, CheckCircle, X, Building2, Group,
} from "lucide-react";

import SupportGroupModel from "@/models/postGresModels/supportGroupModel";
import SupportTeamModel from "@/models/postGresModels/supportTeamModel";
import BizCalendarModel from "@/models/postGresModels/bizCalendarModel";

import { useUser } from "@/providers/postGresPorviders/UserProvider";
import { usePathname } from "next/navigation";

import GroupFormModal from "@/components/support-group-page-components/GroupFormModal";
import TeamFormModal from "@/components/support-group-page-components/TeamFormModal";
import MemberFormModal from "@/components/support-group-page-components/MemberFormModal";
import CalendarDetailsModal from "@/components/support-group-page-components/CalendarDetailsModal";
import TeamStatsCard from "@/components/support-group-page-components/TeamStatsCard";

const PROFICIENCY_LEVELS = {
  l1: "Level 1",
  l2: "Level 2",
  l3: "Level 3",
  specialist: "Specialist",
};
const MEMBER_ROLES = {
  agent: "Agent",
  lead: "Team Lead",
  viewer: "Viewer",
};

// ---------- validation helpers ----------
const validateGroupConstraints = (members) => ({
  hasMembers: Array.isArray(members) && members.length > 0,
  memberCount: Array.isArray(members) ? members.length : 0,
});
const validateTeamConstraints = (members) => {
  const list = Array.isArray(members) ? members : [];
  const leads = list.filter((m) => m.role === "lead");
  return {
    hasMembers: list.length > 0,
    hasTeamLead: leads.length > 0,
    teamLeadCount: leads.length,
    memberCount: list.length,
  };
};

// ---------- lightweight toast ----------
const Notification = ({ message, type, onClose }) => {
  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [onClose]);
  const tone =
    type === "error" ? "bg-red-500" :
    type === "success" ? "bg-green-500" :
    type === "warning" ? "bg-yellow-500" : "bg-blue-500";

  return (
    <div className="fixed top-4 right-4 z-50 max-w-md">
      <div className={`${tone} text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3`}>
        {type === "success" ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
        <span className="text-sm">{message}</span>
        <button onClick={onClose} className="ml-auto hover:opacity-80">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

// ---------- main ----------
export default function SupportGroupsPage() {
  const path = usePathname();
  const orgId = path?.split("/")?.[3] || "";

  const { getActiveUsersByOrg } = useUser();

  const [groups, setGroups] = useState([]);
  const [teams, setTeams] = useState({});              // { [groupId]: Team[] }
  const [groupMembers, setGroupMembers] = useState({}); // { [groupId]: Member[] }
  const [teamMembers, setTeamMembers] = useState({});   // { [teamId]: Member[] }
  const [expandedGroups, setExpandedGroups] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState(null);

  // UserProvider-powered cache of org users
  const [usersCache, setUsersCache] = useState({});     // { [orgId]: User[] }
  const usersForOrg = usersCache[orgId] || [];

  // modals
  const [groupModal, setGroupModal] = useState({ isOpen: false, group: null });
  const [teamModal, setTeamModal] = useState({ isOpen: false, team: null, groupId: null });
  const [memberModal, setMemberModal] = useState({ isOpen: false, member: null, type: null, parentId: null });
  const [calendarModal, setCalendarModal] = useState({ isOpen: false, team: null, calendarData: null });

  const [searchTerm, setSearchTerm] = useState("");

  // ---------- users (from UserProvider) ----------
  const loadOrgUsers = async () => {
    if (!orgId) return;
    try {
      // Only fetch if missing (or you can always refresh; adjust as you prefer)
      if (!usersCache[orgId]) {
        const users = await getActiveUsersByOrg({ orgId });
        setUsersCache((prev) => ({ ...prev, [orgId]: Array.isArray(users) ? users : [] }));
      }
    } catch (e) {
      console.error("Error loading org users:", e);
    }
  };

  // Use cached users to display names/emails/roles
  const getUserDisplayInfo = (userId) => {
    const u = usersForOrg.find((x) => x?.uid === userId);
        console.log(u)

    if (!u) return { displayName: userId, email: "", role: "unknown" };
    return {
      displayName: u.display_name || u.email || userId,
      email: u.email || "",
      role: u.role || "member",
      avatarUrl: u.photo_url || "",
    };
  };

  // ---------- initial loads ----------
  useEffect(() => {
    if (!orgId) return;
    setLoading(true);
    Promise.all([loadOrgUsers(), loadGroups()])
      .catch((e) => console.error("Initial load failed:", e))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  // ---------- notifications ----------
  const showNotification = (message, type = "info") => setNotification({ message, type });

  // ---------- data loaders ----------
  const loadGroups = async () => {
    if (!orgId) return;
    try {
      const groupsData = await SupportGroupModel.list(orgId);
      setGroups(Array.isArray(groupsData) ? groupsData : []);
    } catch (e) {
      console.error("Error loading groups:", e);
      showNotification("Error loading groups", "error");
    }
  };

  const loadGroupMembers = async (groupId) => {
    try {
      const list = await SupportGroupModel.listMembers(groupId);
      setGroupMembers((prev) => ({ ...prev, [groupId]: Array.isArray(list) ? list : [] }));
    } catch (e) {
      console.error("Error loading group members:", e);
      showNotification("Error loading group members", "error");
    }
  };

  const loadTeams = async (groupId) => {
    try {
      const teamsData = await SupportTeamModel.list({ groupId, includeCalendar: true });
      const arr = Array.isArray(teamsData) ? teamsData : [];
      setTeams((prev) => ({ ...prev, [groupId]: arr }));

      // parallel-load members for each team
      await Promise.all(
        arr.map(async (t) => {
          const tid = t.teamId;
          const members = await SupportTeamModel.listMembers(tid);
          setTeamMembers((prev) => ({ ...prev, [tid]: Array.isArray(members) ? members : [] }));
        })
      );
    } catch (e) {
      console.error("Error loading teams:", e);
      showNotification("Error loading teams", "error");
    }
  };

  const loadTeamMembers = async (teamId) => {
    try {
      const members = await SupportTeamModel.listMembers(teamId);
      setTeamMembers((prev) => ({ ...prev, [teamId]: Array.isArray(members) ? members : [] }));
    } catch (e) {
      console.error("Error loading team members:", e);
      showNotification("Error loading team members", "error");
    }
  };

  // Expand/collapse a group and load its dependent data + org users
  const toggleGroupExpanded = async (groupId) => {
    const next = new Set(expandedGroups);
    if (next.has(groupId)) {
      next.delete(groupId);
      setExpandedGroups(next);
      return;
    }
    next.add(groupId);
    setExpandedGroups(next);

    await Promise.all([loadOrgUsers(), loadTeams(groupId), loadGroupMembers(groupId)]);
  };

  // ---------- calendar ----------
  const handleViewCalendar = async (team) => {
    if (!team?.calendarId) {
      showNotification("No calendar assigned to this team", "info");
      return;
    }
    try {
      const calendarData = await BizCalendarModel.get(team.calendarId);
      setCalendarModal({ isOpen: true, team, calendarData });
    } catch (e) {
      console.error("Error loading calendar details:", e);
      showNotification("Error loading calendar details", "error");
    }
  };

  // ---------- groups ----------
  const handleSaveGroup = async (groupData) => {
    try {
      if (groupModal.group) {
        await SupportGroupModel.update(groupModal.group.groupId, groupData);
        showNotification("Group updated successfully", "success");
      } else {
        await SupportGroupModel.create(groupData);
        showNotification("Group created successfully", "success");
      }
      await loadGroups();
    } catch (e) {
      console.error("Error saving group:", e);
      showNotification("Error saving group", "error");
    }
  };

  const handleDeleteGroup = async (groupId) => {
    const constraints = validateGroupConstraints(groupMembers[groupId]);
    const teamsCount = teams[groupId]?.length || 0;

    if (constraints.hasMembers) {
      showNotification("Cannot delete group: remove all members first", "error");
      return;
    }
    if (teamsCount > 0) {
      showNotification("Cannot delete group: remove all teams first", "error");
      return;
    }
    if (!confirm("Are you sure you want to delete this group?")) return;

    try {
      await SupportGroupModel.remove(groupId);
      showNotification("Group deleted successfully", "success");
      await loadGroups();
    } catch (e) {
      console.error("Error deleting group:", e);
      showNotification("Error deleting group", "error");
    }
  };

  // ---------- teams ----------
  const handleSaveTeam = async (teamData) => {
    try {
      const converted = {
        name: teamData.name,
        description: teamData.description,
        email: teamData.email,
        orgId: teamData.org_id,
        groupId: teamData.group_id,
        targetProficiency: teamData.targetProficiency,
        routingWeight: teamData.routingWeight,
        defaultSlaId: teamData.defaultSlaId,
        calendarId: teamData.calendar_id || null,
      };

      if (teamModal.team) {
        await SupportTeamModel.update(teamModal.team.teamId, converted);
        showNotification("Team updated successfully", "success");
      } else {
        await SupportTeamModel.create(converted);
        showNotification("Team created successfully", "success");
      }
      await loadTeams(teamModal.groupId);
    } catch (e) {
      console.error("Error saving team:", e);
      showNotification("Error saving team", "error");
    }
  };

  const handleDeleteTeam = async (teamId, groupId) => {
    const constraints = validateTeamConstraints(teamMembers[teamId]);
    if (constraints.hasMembers) {
      showNotification("Cannot delete team: remove all members first", "error");
      return;
    }
    if (!confirm("Are you sure you want to delete this team?")) return;

    try {
      await SupportTeamModel.remove(teamId);
      showNotification("Team deleted successfully", "success");
      await loadTeams(groupId);
    } catch (e) {
      console.error("Error deleting team:", e);
      showNotification("Error deleting team", "error");
    }
  };

const handleSaveMember = async (memberData) => {
  try {
    // Normalize the field - accept both userId and user_id
    const userId = memberData.userId || memberData.user_id;
    
    if (!userId) {
      showNotification("Please select a user", "error");
      return;
    }

    if (memberModal.type === "group") {
      const payload = {
        user_id: userId,  // Use normalized userId
        role: memberData.role || "agent",
        proficiency: memberData.proficiency || "l1",
      };
      if (memberModal.member) {
        await SupportGroupModel.updateMember(memberModal.parentId, userId, payload);
      } else {
        await SupportGroupModel.addMember(memberModal.parentId, payload);
      }
      await loadGroupMembers(memberModal.parentId);
    } else {
      const payload = {
        team_id: memberModal.parentId,
        user_id: userId,  // Use normalized userId
        role: memberData.role || "agent",
        proficiency: memberData.proficiency || "l1",
        ...(memberData.weekly_capacity_minutes && {
          weekly_capacity_minutes: parseInt(memberData.weekly_capacity_minutes, 10),
        }),
      };
      if (memberModal.member) {
        await SupportTeamModel.updateMember(memberModal.parentId, userId, payload);
      } else {
        await SupportTeamModel.addMember(memberModal.parentId, payload);
      }
      await loadTeamMembers(memberModal.parentId);
    }

    await loadOrgUsers();

    showNotification(
      `${memberModal.type} member ${memberModal.member ? "updated" : "added"} successfully`,
      "success"
    );
  } catch (e) {
    console.error("Error saving member:", e);
    showNotification(`Error saving member: ${e.message}`, "error");
  }
};

  const handleRemoveMember = async (userId, parentId, type) => {
    const currentMembers = type === "group" ? groupMembers[parentId] : teamMembers[parentId];
    const memberToRemove = (currentMembers || []).find((m) => m.user_id === userId);

    if (type === "group") {
      const gc = validateGroupConstraints(currentMembers);
      if (gc.memberCount <= 1) {
        showNotification("Cannot remove member: group must have at least one member", "error");
        return;
      }
    } else {
      const tc = validateTeamConstraints(currentMembers);
      if (memberToRemove?.role === "lead" && tc.teamLeadCount <= 1) {
        showNotification("Cannot remove member: team must have at least one team lead", "error");
        return;
      }
    }
    if (!confirm("Are you sure you want to remove this member?")) return;

    try {
      if (type === "group") {
        await SupportGroupModel.removeMember(parentId, userId);
        await loadGroupMembers(parentId);
      } else {
        await SupportTeamModel.removeMember(parentId, userId);
        await loadTeamMembers(parentId);
      }
      await loadOrgUsers();
      showNotification("Member removed successfully", "success");
    } catch (e) {
      console.error("Error removing member:", e);
      showNotification("Error removing member", "error");
    }
  };

  // ---------- filtering ----------
  const filteredGroups = useMemo(() => {
    if (!searchTerm) return groups;
    const q = searchTerm.toLowerCase();
    return groups.filter(
      (g) =>
        g.name?.toLowerCase().includes(q) ||
        g.description?.toLowerCase().includes(q) ||
        g.email?.toLowerCase().includes(q)
    );
  }, [groups, searchTerm]);

  // ---------- UI ----------
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading support groups…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {notification && (
        <Notification
          message={notification.message}
          type={notification.type}
          onClose={() => setNotification(null)}
        />
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Support Groups</h1>
              <p className="text-gray-600">Manage support groups, teams, and their members</p>
            </div>
            <button
              onClick={() => setGroupModal({ isOpen: true, group: null })}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Group
            </button>
          </div>

          <div className="mt-4">
            <div className="relative">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
                xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              >
                <path d="m21 21-4.35-4.35" />
                <circle cx="11" cy="11" r="8" />
              </svg>
              <input
                type="text"
                placeholder="Search groups…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 w-64 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Groups */}
        <div className="space-y-4">
          {filteredGroups.map((group) => {
            const constraints = validateGroupConstraints(groupMembers[group.groupId]);
            const groupTeamsCount = teams[group.groupId]?.length || 0;

            return (
              <div key={group.groupId} className="bg-white rounded-lg shadow">
                {/* Group header */}
                <div className="p-4 border-b">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => toggleGroupExpanded(group.groupId)}
                        className="p-1 hover:bg-gray-100 rounded transition-colors"
                      >
                        {expandedGroups.has(group.groupId)
                          ? <ChevronDown className="w-4 h-4" />
                          : <ChevronRight className="w-4 h-4" />}
                      </button>
                      <Building2 className="w-5 h-5 text-blue-600" />
                      <div>
                        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                          {group.name}
                          {!constraints.hasMembers && (
                            <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                              <AlertCircle className="w-2.5 h-2.5" />
                              No Members
                            </span>
                          )}
                        </h3>
                        {group.description && (
                          <p className="text-sm text-gray-600">{group.description}</p>
                        )}
                        {group.email && (
                          <p className="text-xs text-gray-500">{group.email}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">{groupTeamsCount} teams</span>
                      <span className="text-xs text-gray-500">{constraints.memberCount} members</span>
                      <button
                        onClick={() => setGroupModal({ isOpen: true, group })}
                        className="p-2 hover:bg-gray-100 rounded transition-colors"
                        title="Edit group"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteGroup(group.groupId)}
                        className={`p-2 hover:bg-gray-100 rounded transition-colors ${
                          (constraints.hasMembers || groupTeamsCount > 0) ? "text-gray-400" : "text-red-600 hover:text-red-700"
                        }`}
                        title="Delete group"
                        disabled={constraints.hasMembers || groupTeamsCount > 0}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expanded */}
                {expandedGroups.has(group.groupId) && (
                  <div className="p-4 space-y-6">
                    {/* Group members */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-medium text-gray-900 flex items-center gap-2">
                          <Users className="w-4 h-4" />
                          Group Members ({constraints.memberCount})
                          {!constraints.hasMembers && (
                            <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                              Required: At least 1 member
                            </span>
                          )}
                        </h4>
                        <button
                          onClick={() =>
                            setMemberModal({
                              isOpen: true,
                              member: null,
                              type: "group",
                              parentId: group.groupId,
                            })
                          }
                          className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1 transition-colors"
                        >
                          <UserPlus className="w-3 h-3" />
                          Add Member
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {Array.isArray(groupMembers[group.groupId]) &&
                          groupMembers[group.groupId].map((member) => {
                            const info = getUserDisplayInfo(member.user_id);
                            const canRemove = constraints.memberCount > 1;

                            return (
                              <div key={member.user_id} className="p-3 border rounded-lg">
                                <div className="flex items-center justify-between">
                                  <div className="flex-1">
                                    <p className="font-medium text-sm">{info.displayName}</p>
                                    {info.email && info.displayName !== info.email && (
                                      <p className="text-xs text-gray-500">{info.email}</p>
                                    )}
                                    <div className="flex items-center gap-2 mt-1">
                                      <span
                                        className={`text-xs px-2 py-0.5 rounded-full ${
                                          member.role === "lead"
                                            ? "bg-purple-100 text-purple-700"
                                            : member.role === "agent"
                                            ? "bg-blue-100 text-blue-700"
                                            : "bg-gray-100 text-gray-700"
                                        }`}
                                      >
                                        {MEMBER_ROLES[member.role] || member.role}
                                      </span>
                                      <span className="text-xs text-gray-500">
                                        {PROFICIENCY_LEVELS[member.proficiency] || member.proficiency}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={() =>
                                        setMemberModal({
                                          isOpen: true,
                                          member,
                                          type: "group",
                                          parentId: group.groupId,
                                        })
                                      }
                                      className="text-blue-600 hover:text-blue-700 p-1 transition-colors"
                                      title="Edit member"
                                    >
                                      <Edit className="w-3 h-3" />
                                    </button>
                                    <button
                                      onClick={() => handleRemoveMember(member.user_id, group.groupId, "group")}
                                      className={`p-1 transition-colors ${
                                        canRemove ? "text-red-600 hover:text-red-700" : "text-gray-400 cursor-not-allowed"
                                      }`}
                                      title={canRemove ? "Remove member" : "Cannot remove: group must have at least one member"}
                                      disabled={!canRemove}
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </div>

                    {/* Teams */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-medium text-gray-900 flex items-center gap-2">
                          <Group className="w-4 h-4" />
                          Teams ({groupTeamsCount})
                        </h4>
                        <button
                          onClick={() =>
                            setTeamModal({
                              isOpen: true,
                              team: null,
                              groupId: group.groupId,
                            })
                          }
                          className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1 transition-colors"
                        >
                          <Plus className="w-3 h-3" />
                          Add Team
                        </button>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                        {(teams[group.groupId] || []).map((team) => (
                          <TeamStatsCard
                            key={team.teamId}
                            team={team}
                            members={teamMembers[team.teamId]}
                            onViewCalendar={handleViewCalendar}
                            onEditTeam={() => setTeamModal({ isOpen: true, team, groupId: group.groupId })}
                            getUserDisplayInfo={getUserDisplayInfo}
                            onDeleteTeam={() => handleDeleteTeam(team.teamId, group.groupId)}
                            onAddMember={() =>
                              setMemberModal({
                                isOpen: true,
                                member: null,
                                type: "team",
                                parentId: team.teamId,
                              })
                            }
                            onEditMember={(m) =>
                              setMemberModal({
                                isOpen: true,
                                member: m,
                                type: "team",
                                parentId: team.teamId,
                              })
                            }
                            onRemoveMember={(userId) => handleRemoveMember(userId, team.teamId, "team")}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Empty state */}
        {filteredGroups.length === 0 && (
          <div className="text-center py-12">
            <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 mb-4">
              {searchTerm ? "No groups found matching your search" : "No support groups created yet"}
            </p>
            {!searchTerm && (
              <button
                onClick={() => setGroupModal({ isOpen: true, group: null })}
                className="text-blue-600 hover:text-blue-700 transition-colors"
              >
                Create your first support group
              </button>
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      <GroupFormModal
        isOpen={groupModal.isOpen}
        onClose={() => setGroupModal({ isOpen: false, group: null })}
        onSave={handleSaveGroup}
        group={groupModal.group}
        orgId={orgId}
      />

      <TeamFormModal
        isOpen={teamModal.isOpen}
        onClose={() => setTeamModal({ isOpen: false, team: null, groupId: null })}
        onSave={handleSaveTeam}
        team={teamModal.team}
        groupId={teamModal.groupId}
        orgId={orgId}
      />

      <MemberFormModal
        isOpen={memberModal.isOpen}
        onClose={() => setMemberModal({ isOpen: false, member: null, type: null, parentId: null })}
        onSave={handleSaveMember}
        member={memberModal.member}
        type={memberModal.type}
        orgId={orgId}
        currentMembers={
          memberModal.type === "group"
            ? groupMembers[memberModal.parentId]
            : teamMembers[memberModal.parentId]
        }
      />

      <CalendarDetailsModal
        isOpen={calendarModal.isOpen}
        onClose={() => setCalendarModal({ isOpen: false, team: null, calendarData: null })}
        team={calendarModal.team}
        calendarData={calendarModal.calendarData}
      />
    </div>
  );
}
