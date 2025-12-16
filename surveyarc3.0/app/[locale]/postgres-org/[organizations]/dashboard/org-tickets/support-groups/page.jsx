// app/(your-path)/SupportGroupsPage.jsx
"use client";
import React, { useState, useEffect, useMemo } from "react";
import {
  Users, Plus, Edit, Trash2, ChevronDown, ChevronRight,
  UserPlus, AlertCircle, CheckCircle, X, Building2, Group,
  Calendar, Shield, Award, Search, Loader2, TrendingUp,
  XCircle, AlertTriangle
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

// ---------- Improved Notification ----------
const Notification = ({ message, type, onClose }) => {
  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [onClose]);
  
  const config = {
    error: { bg: "bg-red-500", icon: XCircle },
    success: { bg: "bg-green-500", icon: CheckCircle },
    warning: { bg: "bg-yellow-500", icon: AlertTriangle },
    info: { bg: "bg-blue-500", icon: AlertCircle }
  };
  
  const { bg, icon: Icon } = config[type] || config.info;

  return (
    <div className="fixed top-6 right-6 z-50 max-w-md animate-slide-in">
      <div className={`${bg} text-white px-5 py-4 rounded-2xl shadow-2xl flex items-center gap-3 backdrop-blur-sm`}>
        <Icon className="w-5 h-5 flex-shrink-0" />
        <span className="text-sm font-medium flex-1">{message}</span>
        <button 
          onClick={onClose} 
          className="hover:bg-white/20 rounded-lg p-1 transition-all"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

// ---------- Stats Card ----------
const StatsCard = ({ icon: Icon, label, value, color = "blue", loading = false }) => (
  <div className={`bg-gradient-to-br from-${color}-50 to-${color}-100 dark:from-${color}-900/20 dark:to-${color}-800/20 rounded-2xl p-6 border-2 border-${color}-200 dark:border-${color}-700`}>
    <div className="flex items-center gap-4">
      <div className={`w-14 h-14 bg-${color}-600 rounded-xl flex items-center justify-center shadow-lg`}>
        <Icon className="w-7 h-7 text-black" />
      </div>
      <div>
        {loading ? (
          <>
            <div className="h-9 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-1" />
            <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          </>
        ) : (
          <>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">{value}</p>
            <p className="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
              {label}
            </p>
          </>
        )}
      </div>
    </div>
  </div>
);

// ---------- main ----------
export default function SupportGroupsPage() {
  const path = usePathname();
  const orgId = path?.split("/")?.[3] || "";

  const { getActiveUsersByOrg } = useUser();

  const [groups, setGroups] = useState([]);
  const [teams, setTeams] = useState({});
  const [groupMembers, setGroupMembers] = useState({});
  const [teamMembers, setTeamMembers] = useState({});
  const [expandedGroups, setExpandedGroups] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState(null);

  const [usersCache, setUsersCache] = useState({});
  const usersForOrg = usersCache[orgId] || [];

  // modals
  const [groupModal, setGroupModal] = useState({ isOpen: false, group: null });
  const [teamModal, setTeamModal] = useState({ isOpen: false, team: null, groupId: null });
  const [memberModal, setMemberModal] = useState({ isOpen: false, member: null, type: null, parentId: null });
  const [calendarModal, setCalendarModal] = useState({ isOpen: false, team: null, calendarData: null });

  const [searchTerm, setSearchTerm] = useState("");

  // Calculate stats
  const stats = useMemo(() => {
    const totalTeams = Object.values(teams).reduce((sum, arr) => sum + (arr?.length || 0), 0);
    const totalMembers = Object.values(groupMembers).reduce((sum, arr) => sum + (arr?.length || 0), 0);
    return {
      groups: groups.length,
      teams: totalTeams,
      members: totalMembers
    };
  }, [groups, teams, groupMembers]);

  // ---------- users (from UserProvider) ----------
  const loadOrgUsers = async () => {
    if (!orgId) return;
    try {
      if (!usersCache[orgId]) {
        const users = await getActiveUsersByOrg({ orgId });
        setUsersCache((prev) => ({ ...prev, [orgId]: Array.isArray(users) ? users : [] }));
      }
    } catch (e) {
      console.error("Error loading org users:", e);
    }
  };

  const getUserDisplayInfo = (userId) => {
    const u = usersForOrg.find((x) => x?.uid === userId);
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
    
    const loadInitialData = async () => {
      try {
        // Load users first
        await loadOrgUsers();
        
        // Load groups
        const groupsData = await SupportGroupModel.list(orgId);
        const groupsList = Array.isArray(groupsData) ? groupsData : [];
        setGroups(groupsList);
        
        // Load teams and members for all groups in parallel for accurate stats
        await Promise.all(
          groupsList.map(async (group) => {
            await Promise.all([
              loadTeams(group.groupId),
              loadGroupMembers(group.groupId)
            ]);
          })
        );
      } catch (e) {
        console.error("Initial load failed:", e);
        showNotification("Error loading data", "error");
      } finally {
        setLoading(false);
      }
    };
    
    loadInitialData();
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

  const toggleGroupExpanded = async (groupId) => {
    const next = new Set(expandedGroups);
    if (next.has(groupId)) {
      next.delete(groupId);
      setExpandedGroups(next);
      return;
    }
    next.add(groupId);
    setExpandedGroups(next);

    // Only reload if data is missing (in case of fresh additions)
    if (!teams[groupId]) {
      await loadTeams(groupId);
    }
    if (!groupMembers[groupId]) {
      await loadGroupMembers(groupId);
    }
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
        const newGroup = await SupportGroupModel.create(groupData);
        showNotification("Group created successfully", "success");
        if (newGroup?.groupId) {
          setTeams((prev) => ({ ...prev, [newGroup.groupId]: [] }));
          setGroupMembers((prev) => ({ ...prev, [newGroup.groupId]: [] }));
        }
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
      
      // Clean up state
      setTeams((prev) => {
        const { [groupId]: _, ...rest } = prev;
        return rest;
      });
      setGroupMembers((prev) => {
        const { [groupId]: _, ...rest } = prev;
        return rest;
      });
      
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
      
      // Clean up team members state
      setTeamMembers((prev) => {
        const { [teamId]: _, ...rest } = prev;
        return rest;
      });
      
      showNotification("Team deleted successfully", "success");
      await loadTeams(groupId);
    } catch (e) {
      console.error("Error deleting team:", e);
      showNotification("Error deleting team", "error");
    }
  };

  const handleSaveMember = async (memberData) => {
    try {
      const userId = memberData.userId || memberData.user_id;
      
      if (!userId) {
        showNotification("Please select a user", "error");
        return;
      }

      if (memberModal.type === "group") {
        const payload = {
          user_id: userId,
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
          user_id: userId,
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
      <div className="min-h-screen bg-gray-50 dark:bg-[#1A1A1E] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400 font-medium">Loading support groups...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#1A1A1E]">
      {notification && (
        <Notification
          message={notification.message}
          type={notification.type}
          onClose={() => setNotification(null)}
        />
      )}

   <div className="mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
  {/* Header */}
  <div className="bg-white border-b border-gray-200 pb-6">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 bg-slate-700 rounded-md flex items-center justify-center">
          <Users className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            Support Groups
          </h1>
          <p className="text-sm text-gray-600 mt-0.5">
            Manage organizational groups, teams, and personnel
          </p>
        </div>
      </div>
      <button
        onClick={() => setGroupModal({ isOpen: true, group: null })}
        className="flex items-center gap-2 px-5 py-2.5 bg-slate-700 text-white rounded-md hover:bg-slate-800 transition-colors font-medium text-sm"
      >
        <Plus className="w-4 h-4" />
        New Group
      </button>
    </div>
  </div>

  {/* Stats */}
  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
    <StatsCard 
      icon={Building2} 
      label="Groups" 
      value={stats.groups} 
      color="slate" 
      loading={loading} 
    />
    <StatsCard 
      icon={Group} 
      label="Teams" 
      value={stats.teams} 
      color="slate" 
      loading={loading} 
    />
    <StatsCard 
      icon={Users} 
      label="Members" 
      value={stats.members} 
      color="slate" 
      loading={loading} 
    />
  </div>

  {/* Search */}
  <div className="bg-white border border-gray-200 rounded-md p-4">
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
      <input
        type="text"
        placeholder="Search by group name, description, or email address..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="pl-10 pr-4 py-2.5 w-full bg-white border border-gray-300 rounded-md focus:ring-2 focus:ring-slate-500 focus:border-slate-500 text-sm transition-colors"
      />
    </div>
  </div>

  {/* Groups */}
  <div className="space-y-4">
    {filteredGroups.map((group) => {
      const constraints = validateGroupConstraints(groupMembers[group.groupId]);
      const groupTeamsCount = teams[group.groupId]?.length || 0;
      const isExpanded = expandedGroups.has(group.groupId);

      return (
        <div
          key={group.groupId}
          className="bg-white border border-gray-200 rounded-md hover:border-gray-300 transition-all overflow-hidden"
        >
          {/* Group header */}
          <div className="p-5 bg-gray-50">
            <div className="flex items-center gap-4">
              <button
                onClick={() => toggleGroupExpanded(group.groupId)}
                className="p-2 hover:bg-gray-200 rounded-md transition-colors"
              >
                {isExpanded ? (
                  <ChevronDown className="w-5 h-5 text-gray-600" />
                ) : (
                  <ChevronRight className="w-5 h-5 text-gray-600" />
                )}
              </button>

              <div className="w-10 h-10 bg-slate-100 rounded-md flex items-center justify-center border border-slate-200">
                <Building2 className="w-5 h-5 text-slate-600" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {group.name}
                  </h3>
                  {!constraints.hasMembers && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 border border-amber-200 text-amber-700 text-xs font-medium rounded">
                      <AlertCircle className="w-3 h-3" />
                      No Members
                    </span>
                  )}
                </div>
                {group.description && (
                  <p className="text-sm text-gray-600 mb-0.5">
                    {group.description}
                  </p>
                )}
                {group.email && (
                  <p className="text-xs text-gray-500">
                    {group.email}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-4">
                <div className="text-right space-y-1">
                  <div className="flex items-center justify-end gap-1.5 text-sm text-gray-700">
                    <Group className="w-4 h-4 text-gray-500" />
                    <span className="font-medium">{groupTeamsCount}</span>
                    <span className="text-gray-500">teams</span>
                  </div>
                  <div className="flex items-center justify-end gap-1.5 text-sm text-gray-700">
                    <Users className="w-4 h-4 text-gray-500" />
                    <span className="font-medium">{constraints.memberCount}</span>
                    <span className="text-gray-500">members</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 border-l border-gray-300 pl-4">
                  <button
                    onClick={() => setGroupModal({ isOpen: true, group })}
                    className="p-2 text-slate-600 hover:bg-gray-200 rounded-md transition-colors"
                    title="Edit group"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteGroup(group.groupId)}
                    className={`p-2 rounded-md transition-colors ${
                      (constraints.hasMembers || groupTeamsCount > 0)
                        ? "text-gray-400 cursor-not-allowed"
                        : "text-red-600 hover:bg-red-50"
                    }`}
                    title="Delete group"
                    disabled={constraints.hasMembers || groupTeamsCount > 0}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Expanded content */}
          {isExpanded && (
            <div className="px-5 pb-5 space-y-6 border-t border-gray-200 pt-5 bg-white">
              {/* Group members */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-semibold text-base text-gray-900 flex items-center gap-2">
                    <Users className="w-4 h-4 text-slate-600" />
                    Group Members ({constraints.memberCount})
                    {!constraints.hasMembers && (
                      <span className="text-xs bg-red-50 border border-red-200 text-red-700 px-2 py-0.5 rounded font-medium">
                        Required: Minimum 1 member
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
                    className="flex items-center gap-2 px-4 py-2 text-sm bg-slate-700 text-white rounded-md hover:bg-slate-800 transition-colors font-medium"
                  >
                    <UserPlus className="w-4 h-4" />
                    Add Member
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {Array.isArray(groupMembers[group.groupId]) &&
                    groupMembers[group.groupId].map((member) => {
                      const info = getUserDisplayInfo(member.user_id);
                      const canRemove = constraints.memberCount > 1;

                      return (
                        <div
                          key={member.user_id}
                          className="p-4 bg-gray-50 border border-gray-200 rounded-md hover:border-gray-300 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm text-gray-900 truncate">
                                {info.displayName}
                              </p>
                              {info.email && info.displayName !== info.email && (
                                <p className="text-xs text-gray-500 truncate mt-0.5">
                                  {info.email}
                                </p>
                              )}
                              <div className="flex items-center gap-2 mt-2">
                                <span
                                  className={`text-xs px-2 py-0.5 rounded font-medium border ${
                                    member.role === "lead"
                                      ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                                      : member.role === "agent"
                                      ? "bg-blue-50 border-blue-200 text-blue-700"
                                      : "bg-gray-100 border-gray-200 text-gray-700"
                                  }`}
                                >
                                  {MEMBER_ROLES[member.role] || member.role}
                                </span>
                                <span className="text-xs text-gray-600">
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
                                className="p-1.5 text-slate-600 hover:bg-gray-200 rounded transition-colors"
                                title="Edit member"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleRemoveMember(member.user_id, group.groupId, "group")}
                                className={`p-1.5 rounded transition-colors ${
                                  canRemove
                                    ? "text-red-600 hover:bg-red-50"
                                    : "text-gray-400 cursor-not-allowed"
                                }`}
                                title={
                                  canRemove
                                    ? "Remove member"
                                    : "Cannot remove: group requires at least one member"
                                }
                                disabled={!canRemove}
                              >
                                <X className="w-3.5 h-3.5" />
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
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-semibold text-base text-gray-900 flex items-center gap-2">
                    <Group className="w-4 h-4 text-slate-600" />
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
                    className="flex items-center gap-2 px-4 py-2 text-sm bg-slate-700 text-white rounded-md hover:bg-slate-800 transition-colors font-medium"
                  >
                    <Plus className="w-4 h-4" />
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
    <div className="text-center py-20 bg-white border-2 border-dashed border-gray-300 rounded-md">
      <div className="w-16 h-16 bg-gray-100 rounded-md flex items-center justify-center mx-auto mb-4">
        <Building2 className="w-8 h-8 text-gray-400" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-1">
        {searchTerm ? "No groups found" : "No support groups"}
      </h3>
      <p className="text-sm text-gray-600 mb-6">
        {searchTerm
          ? "Adjust your search criteria and try again"
          : "Create your first support group to begin"}
      </p>
      {!searchTerm && (
        <button
          onClick={() => setGroupModal({ isOpen: true, group: null })}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-700 text-white rounded-md hover:bg-slate-800 transition-colors font-medium text-sm"
        >
          <Plus className="w-4 h-4" />
          Create Group
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