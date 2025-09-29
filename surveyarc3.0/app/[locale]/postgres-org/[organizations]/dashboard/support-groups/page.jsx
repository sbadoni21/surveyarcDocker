"use client";
import React, { useState, useEffect, useMemo } from "react";
import {
  Users, Plus, Edit, Trash2, Settings, ChevronDown, ChevronRight,
  UserPlus, Shield, Target, Search, Filter, MoreHorizontal, 
  AlertCircle, CheckCircle, X, Save, Building2, Group, Router,
  Calendar, Clock, Timer, Activity, Award, TrendingUp,
  Calendar1Icon
} from "lucide-react";
import SupportGroupModel from "@/models/postGresModels/supportGroupModel";
import SupportTeamModel from "@/models/postGresModels/supportTeamModel";
import RoutingPolicyModel from "@/models/postGresModels/routingPolicyModel";
import { useUser } from '@/providers/postGresPorviders/UserProvider';
import { useBusinessCalendars } from "@/providers/BusinessCalendarsProvider";
import { useOrganisation } from "@/providers/postGresPorviders/organisationProvider";
import { usePathname } from "next/navigation";

const PROFICIENCY_LEVELS = {
  l1: "Level 1",
  l2: "Level 2", 
  l3: "Level 3",
  specialist: "Specialist"
};

const MEMBER_ROLES = {
  agent: "Agent",
  lead: "Team Lead",
  viewer: "Viewer"
};

const ROUTING_TARGETS = {
  group: "Group",
  team: "Team"
};

// Validation helper functions
const validateGroupConstraints = (members) => {
  return {
    hasMembers: members && members.length > 0,
    memberCount: members ? members.length : 0
  };
};

const validateTeamConstraints = (members) => {
  const teamLeads = members ? members.filter(m => m.role === 'lead') : [];
  return {
    hasMembers: members && members.length > 0,
    hasTeamLead: teamLeads.length > 0,
    teamLeadCount: teamLeads.length,
    memberCount: members ? members.length : 0
  };
};

// Notification Component
const Notification = ({ message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="fixed top-4 right-4 z-50 max-w-md">
      <div className={`px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 ${
        type === 'error' ? 'bg-red-500 text-white' : 
        type === 'success' ? 'bg-green-500 text-white' : 
        type === 'warning' ? 'bg-yellow-500 text-white' :
        'bg-blue-500 text-white'
      }`}>
        {type === 'error' ? <AlertCircle className="w-4 h-4" /> : 
         type === 'success' ? <CheckCircle className="w-4 h-4" /> : 
         <AlertCircle className="w-4 h-4" />}
        <span className="text-sm">{message}</span>
        <button onClick={onClose} className="ml-auto hover:opacity-75">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

// Calendar Status Display Component
const CalendarStatusChip = ({ calendar, onClick }) => {
  if (!calendar) {
    return (
      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full flex items-center gap-1">
        <Calendar className="w-3 h-3" />
        No Calendar
      </span>
    );
  }

  const hoursCount = calendar.hours_count || 0;
  const holidaysCount = calendar.holidays_count || 0;

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={onClick}
        className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full flex items-center gap-1 hover:bg-blue-200 transition-colors"
        title={`View ${calendar.name} calendar details`}
      >
        <Calendar className="w-3 h-3" />
        {calendar.name}
      </button>
      {hoursCount > 0 && (
        <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full flex items-center gap-1">
          <Clock className="w-2.5 h-2.5" />
          {hoursCount}h
        </span>
      )}
      {holidaysCount > 0 && (
        <span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full flex items-center gap-1">
          <Timer className="w-2.5 h-2.5" />
          {holidaysCount}
        </span>
      )}
    </div>
  );
};

// Team Stats Card Component
const TeamStatsCard = ({ team, members, onViewCalendar, onEditTeam, onDeleteTeam, onAddMember, getUserDisplayInfo, onEditMember, onRemoveMember }) => {
   const totalCapacity = members?.reduce((total, member) => {
    return total + (member.weekly_capacity_minutes || 0);
  }, 0) || 0;

  const activeMembers = members?.filter(m => m.active).length || 0;
  const totalHours = Math.round(totalCapacity / 60);
  const teamConstraints = validateTeamConstraints(members);

  return (
    <div className="bg-gray-50 rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between">
        <h6 className="font-medium text-sm">{team.name}</h6>
        <div className="flex items-center gap-1">
          <button
            onClick={onEditTeam}
            className="p-1 hover:bg-white rounded transition-colors"
            title="Edit team"
          >
            <Edit className="w-3 h-3 text-gray-600" />
          </button>
          <button
            onClick={onDeleteTeam}
            className="p-1 hover:bg-white rounded transition-colors text-red-600"
            title="Delete team"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>
      
      <div className="flex items-center gap-1 flex-wrap">
        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
          Weight: {team.routingWeight}
        </span>
        <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
          {PROFICIENCY_LEVELS[team.targetProficiency]}
        </span>
        {!teamConstraints.hasTeamLead && (
          <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full flex items-center gap-1">
            <AlertCircle className="w-2.5 h-2.5" />
            No Team Lead
          </span>
        )}
      </div>
      
      <CalendarStatusChip 
        calendar={team.calendar} 
        onClick={() => onViewCalendar(team)}
      />
      
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="text-center">
          <div className="font-medium text-blue-600">{activeMembers}</div>
          <div className="text-gray-500">Members</div>
        </div>
        <div className="text-center">
          <div className="font-medium text-green-600">{totalHours}h</div>
          <div className="text-gray-500">Capacity</div>
        </div>
        <div className="text-center">
          <div className="font-medium text-orange-600">{team.calendar?.holidays_count || 0}</div>
          <div className="text-gray-500">Holidays</div>
        </div>
      </div>
<div className="mt-2">
   {Array.isArray(members) && members.length > 0 ? (
     <ul  className="divide-y rounded border bg-white">
       {members.slice(0, 5).map((m) => {
         const u = getUserDisplayInfo ? getUserDisplayInfo(m.user_id) : { displayName: m.user_id, email: "" };
         const roleBadge =
           m.role === "lead"
             ? "bg-purple-100 text-purple-700"
             : m.role === "agent"
             ? "bg-blue-100 text-blue-700"
             : "bg-gray-100 text-gray-700";
         return (
           <li key={m.user_id} className="px-2 py-1.5 text-xs flex items-center gap-2">
             <div className="min-w-0 flex-1">
               <div className="truncate font-medium">{u.displayName}</div>
               {u.email && <div className="truncate text-gray-500">{u.email}</div>}
             </div>
             <span className={`shrink-0 px-2 py-0.5 rounded-full ${roleBadge}`}>
               {MEMBER_ROLES[m.role] || m.role}
             </span>
             <button
               className="shrink-0 p-1 hover:bg-gray-100 rounded"
               title="Edit member"
               onClick={() => onEditMember && onEditMember(m)}
             >
               <Edit className="w-3 h-3 text-gray-600" />
             </button>
             <button
               className="shrink-0 p-1 hover:bg-gray-100 rounded text-red-600"
               title="Remove member"
               onClick={() => onRemoveMember && onRemoveMember(m.user_id)}
             >
               <X className="w-3 h-3" />
             </button>
           </li>
         );
       })}
     </ul>
   ) : (
     <div className="text-xs text-gray-500 italic">No members yet</div>
   )}
   {Array.isArray(members) && members.length > 5 && (
     <div className="text-[11px] text-gray-500 mt-1">+{members.length - 5} more…</div>
   )}
 </div>
      <button
        onClick={onAddMember}
        className="w-full text-xs text-blue-600 hover:text-blue-700 flex items-center justify-center gap-1 py-1 hover:bg-white rounded transition-colors"
      >
        <UserPlus className="w-3 h-3" />
        Add Member
      </button>
    </div>
  );

};

// Enhanced Group Form Modal with UserProvider Integration
const GroupFormModal = ({ isOpen, onClose, onSave, group, orgId }) => {
  const { getActiveUsersByOrg } = useUser();
  const [availableUsers, setAvailableUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    description: ""
  });

  // Load available users when modal opens
  useEffect(() => {
    const loadUsers = async () => {
      if (isOpen && orgId) {
        try {
          setUsersLoading(true);
          const users = await getActiveUsersByOrg({ orgId });
          setAvailableUsers(users || []);
        } catch (error) {
          console.error("Error loading users:", error);
          setAvailableUsers([]);
        } finally {
          setUsersLoading(false);
        }
      }
    };

    loadUsers();
  }, [isOpen, orgId, getActiveUsersByOrg]);

  useEffect(() => {
    if (group) {
      setFormData({
        name: group.name || "",
        email: group.email || "",
        description: group.description || ""
      });
    } else {
      setFormData({ name: "", email: "", description: "" });
    }
  }, [group, isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        org_id: orgId,
        ...(group ? { group_id: group.groupId } : {})
      };
      await onSave(payload);
      onClose();
    } catch (error) {
      console.error("Error saving group:", error);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
        <div className="p-6 border-b">
          <h3 className="text-lg font-semibold">
            {group ? "Edit Support Group" : "Create Support Group"}
          </h3>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Group Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Contact Email (Optional)
            </label>
            
            <div className="space-y-2">
              {usersLoading ? (
                <div className="w-full px-3 py-2 border rounded-lg bg-gray-50 flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                  <span className="text-sm text-gray-600">Loading users...</span>
                </div>
              ) : (
                <select
                  value={availableUsers.find(u => u.email === formData.email)?.uid || ""}
                  onChange={(e) => {
                    const selectedUser = availableUsers.find(u => u.uid === e.target.value);
                    setFormData(prev => ({ 
                      ...prev, 
                      email: selectedUser ? selectedUser.email : ""
                    }));
                  }}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select from organization users...</option>
                  {availableUsers.map((user) => (
                    <option key={user.uid} value={user.uid}>
                      {user.display_name ? `${user.display_name} (${user.email})` : user.email}
                    </option>
                  ))}
                </select>
              )}
              
              <div className="flex items-center">
                <div className="flex-1 border-t border-gray-300"></div>
                <span className="px-3 text-xs text-gray-500 bg-white">OR</span>
                <div className="flex-1 border-t border-gray-300"></div>
              </div>
              
              <input
                type="email"
                placeholder="Enter custom email address..."
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            
            <p className="text-xs text-gray-500 mt-1">
              Choose a user from your organization or enter a custom email
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Description (Optional)</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              rows={3}
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              onClick={(e) => {
                e.preventDefault();
                handleSubmit(e);
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              {group ? "Update" : "Create"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Enhanced Team Form Modal with Calendar Selection
const TeamFormModal = ({ isOpen, onClose, onSave, team, groupId, orgId }) => {
  const { getActiveUsersByOrg } = useUser();
  const { calendars, list: loadCalendars, loading: calendarsLoading } = useBusinessCalendars();
  
  const [availableUsers, setAvailableUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    email: "",
    target_proficiency: "l1",
    routing_weight: 1,
    default_sla_id: "",
    calendar_id: ""
  });

  useEffect(() => {
    const loadUsers = async () => {
      if (isOpen && orgId) {
        try {
          setUsersLoading(true);
          const users = await getActiveUsersByOrg({ orgId });
          setAvailableUsers(users || []);
        } catch (error) {
          console.error("Error loading users:", error);
          setAvailableUsers([]);
        } finally {
          setUsersLoading(false);
        }
      }
    };

    loadUsers();
  }, [isOpen, orgId, getActiveUsersByOrg]);

  useEffect(() => {
    const loadAvailableCalendars = async () => {
      if (isOpen && orgId) {
        try {
          await loadCalendars({ orgId, active: true });
        } catch (error) {
          console.error("Error loading calendars:", error);
        }
      }
    };

    loadAvailableCalendars();
  }, [isOpen, orgId, loadCalendars]);

  useEffect(() => {
    if (team) {
      setFormData({
        name: team.name || "",
        description: team.description || "",
        email: team.email || "",
        target_proficiency: team.targetProficiency || "l1",
        routing_weight: team.routingWeight || 1,
        default_sla_id: team.defaultSlaId || "",
        calendar_id: team.calendarId || ""
      });
    } else {
      setFormData({
        name: "",
        description: "",
        email: "",
        target_proficiency: "l1",
        routing_weight: 1,
        default_sla_id: "",
        calendar_id: ""
      });
    }
  }, [team, isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        org_id: orgId,
        group_id: groupId,
        targetProficiency: formData.target_proficiency,
        routingWeight: formData.routing_weight,
        defaultSlaId: formData.default_sla_id,
        calendarId: formData.calendar_id || null,
        ...(team ? { team_id: team.teamId } : {})
      };
      console.log(payload)
      await onSave(payload);
      onClose();
    } catch (error) {
      console.error("Error saving team:", error);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b">
          <h3 className="text-lg font-semibold">
            {team ? "Edit Team" : "Create Team"}
          </h3>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Team Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Target Proficiency</label>
            <select
              value={formData.target_proficiency}
              onChange={(e) => setFormData(prev => ({ ...prev, target_proficiency: e.target.value }))}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {Object.entries(PROFICIENCY_LEVELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Routing Weight</label>
            <input
              type="number"
              min="1"
              value={formData.routing_weight}
              onChange={(e) => setFormData(prev => ({ ...prev, routing_weight: parseInt(e.target.value) }))}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Calendar Selection */}
          <div>
            <label className="block text-sm font-medium mb-2">
              <span className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Business Calendar (Optional)
              </span>
            </label>
            
            {calendarsLoading ? (
              <div className="w-full px-3 py-2 border rounded-lg bg-gray-50 flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                <span className="text-sm text-gray-600">Loading calendars...</span>
              </div>
            ) : (
              <select
                value={formData.calendar_id}
                onChange={(e) => setFormData(prev => ({ ...prev, calendar_id: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">No calendar assigned</option>
                {calendars
                  .filter(calendar => calendar.active)
                  .map((calendar) => (
                    <option key={calendar.calendar_id} value={calendar.calendar_id}>
                      {calendar.name} ({calendar.timezone})
                    </option>
                  ))}
              </select>
            )}
            
            <p className="text-xs text-gray-500 mt-1">
              Assign a business calendar to define working hours and holidays for this team
            </p>
            
            {/* Calendar Preview */}
            {formData.calendar_id && (
              <div className="mt-2 p-2 bg-blue-50 rounded border">
                {(() => {
                  const selectedCalendar = calendars.find(c => c.calendar_id === formData.calendar_id);
                  if (selectedCalendar) {
                    return (
                      <div className="text-xs text-blue-800">
                        <div className="flex items-center gap-2 mb-1">
                          <Clock className="w-3 h-3" />
                          <span className="font-medium">{selectedCalendar.name}</span>
                        </div>
                        <div className="flex items-center gap-4 text-blue-600">
                          <span>{selectedCalendar.hours?.length || 0} time slots</span>
                          <span>{selectedCalendar.holidays?.length || 0} holidays</span>
                          <span>{selectedCalendar.timezone}</span>
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Contact Email (Optional)
            </label>
            
            <div className="space-y-2">
              {usersLoading ? (
                <div className="w-full px-3 py-2 border rounded-lg bg-gray-50 flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                  <span className="text-sm text-gray-600">Loading users...</span>
                </div>
              ) : (
                <select
                  value={availableUsers.find(u => u.email === formData.email)?.uid || ""}
                  onChange={(e) => {
                    const selectedUser = availableUsers.find(u => u.uid === e.target.value);
                    setFormData(prev => ({ 
                      ...prev, 
                      email: selectedUser ? selectedUser.email : ""
                    }));
                  }}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select from organization users...</option>
                  {availableUsers.map((user) => (
                    <option key={user.uid} value={user.uid}>
                      {user.display_name ? `${user.display_name} (${user.email})` : user.email}
                    </option>
                  ))}
                </select>
              )}
              
              <div className="flex items-center">
                <div className="flex-1 border-t border-gray-300"></div>
                <span className="px-3 text-xs text-gray-500 bg-white">OR</span>
                <div className="flex-1 border-t border-gray-300"></div>
              </div>
              
              <input
                type="email"
                placeholder="Enter custom email address..."
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            
            <p className="text-xs text-gray-500 mt-1">
              Choose a user from your organization or enter a custom email
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                handleSubmit(e);
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              {team ? "Update" : "Create"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Enhanced MemberFormModal with UserProvider Integration and Validation
const MemberFormModal = ({ isOpen, onClose, onSave, member, type, orgId, currentMembers }) => {
  const { getActiveUsersByOrg } = useUser();
  const [availableUsers, setAvailableUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [formData, setFormData] = useState({
    user_id: "",
    role: "agent",
    proficiency: "l1",
    weekly_capacity_minutes: ""
  });

  const teamConstraints = type === "team" ? validateTeamConstraints(currentMembers) : null;

  useEffect(() => {
    const loadUsers = async () => {
      if (isOpen && orgId) {
        try {
          setUsersLoading(true);
          const users = await getActiveUsersByOrg({ orgId });
          setAvailableUsers(users || []);
        } catch (error) {
          console.error("Error loading users:", error);
          setAvailableUsers([]);
        } finally {
          setUsersLoading(false);
        }
      }
    };

    loadUsers();
  }, [isOpen, orgId, getActiveUsersByOrg]);

  useEffect(() => {
    if (member) {
      setFormData({
        user_id: member.user_id || "",
        role: member.role || "agent",
        proficiency: member.proficiency || "l1",
        weekly_capacity_minutes: member.weekly_capacity_minutes || ""
      });
    } else {
      // Default to team lead role if team has no team lead
      const defaultRole = (type === "team" && teamConstraints && !teamConstraints.hasTeamLead) ? "lead" : "agent";
      setFormData({
        user_id: "",
        role: defaultRole, 
        proficiency: "l1",
        weekly_capacity_minutes: ""
      });
    }
  }, [member, isOpen, type, teamConstraints]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // Validation for team constraints
      if (type === "team") {
        if (member && member.role === "lead" && formData.role !== "lead" && teamConstraints.teamLeadCount === 1) {
          alert("Cannot change role: this team must have at least one team lead.");
          return;
        }
      }

      const payload = { ...formData };
      if (type === "team" && formData.weekly_capacity_minutes) {
        payload.weekly_capacity_minutes = parseInt(formData.weekly_capacity_minutes);
      }
      await onSave(payload);
      onClose();
    } catch (error) {
      console.error("Error saving member:", error);
    }
  };

  if (!isOpen) return null;

  const selectedUser = availableUsers.find(user => user.uid === formData.user_id);

  // Check if changing role would violate constraints
  const isRoleChangeRestricted = member && type === "team" && member.role === "lead" && 
                                teamConstraints && teamConstraints.teamLeadCount === 1;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
        <div className="p-6 border-b">
          <h3 className="text-lg font-semibold">
            {member ? `Edit ${type} Member` : `Add ${type} Member`}
          </h3>
          {type === "team" && teamConstraints && !teamConstraints.hasTeamLead && !member && (
            <div className="mt-2 p-2 bg-orange-50 border border-orange-200 rounded text-sm text-orange-800">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                This team needs at least one Team Lead
              </div>
            </div>
          )}
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Select User
              {selectedUser && (
                <span className="ml-2 text-xs text-gray-500">
                  ({selectedUser.email})
                </span>
              )}
            </label>
            
            {usersLoading ? (
              <div className="w-full px-3 py-2 border rounded-lg bg-gray-50 flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                <span className="text-sm text-gray-600">Loading users...</span>
              </div>
            ) : (
              <select
                value={formData.user_id}
                onChange={(e) => setFormData(prev => ({ ...prev, user_id: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
                disabled={!!member}
              >
                <option value="">Select a user...</option>
                {availableUsers
                  .filter(user => !currentMembers?.some(m => m.user_id === user.uid) || (member && member.user_id === user.uid))
                  .map((user) => (
                    <option key={user.uid} value={user.uid}>
                      {user.display_name || user.email} 
                      {user.display_name && user.email && ` (${user.email})`}
                    </option>
                  ))}
              </select>
            )}
            
            {!usersLoading && availableUsers.length === 0 && (
              <p className="text-sm text-gray-500 mt-1">
                No active users found in this organization
              </p>
            )}
            
            {member && (
              <p className="text-xs text-gray-500 mt-1">
                User cannot be changed when editing an existing member
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Role</label>
            <select
              value={formData.role}
              onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value }))}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              disabled={isRoleChangeRestricted}
            >
              {Object.entries(MEMBER_ROLES).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
            {isRoleChangeRestricted && (
              <p className="text-xs text-red-600 mt-1">
                Cannot change role: this team must have at least one team lead
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Proficiency Level</label>
            <select
              value={formData.proficiency}
              onChange={(e) => setFormData(prev => ({ ...prev, proficiency: e.target.value }))}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {Object.entries(PROFICIENCY_LEVELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>

          {type === "team" && (
            <div>
              <label className="block text-sm font-medium mb-2">
                Weekly Capacity (minutes)
              </label>
              <input
                type="number"
                min="0"
                value={formData.weekly_capacity_minutes}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  weekly_capacity_minutes: e.target.value 
                }))}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g. 2400 (40 hours)"
              />
              <p className="text-xs text-gray-500 mt-1">
                Leave empty for unlimited capacity
              </p>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                handleSubmit(e);
              }}
              disabled={!formData.user_id || usersLoading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {member ? "Update" : "Add"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Calendar Details Modal
const CalendarDetailsModal = ({ isOpen, onClose, team, calendarData }) => {
  if (!isOpen || !calendarData) return null;

  const formatTime = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  };

  const WEEKDAY_NAMES = {
    0: "Monday", 1: "Tuesday", 2: "Wednesday", 3: "Thursday",
    4: "Friday", 5: "Saturday", 6: "Sunday"
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
        <div className="p-6 border-b">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">
              Calendar Details - {team?.name}
            </h3>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        
        <div className="p-6 space-y-6">
          {/* Calendar Info */}
          <div>
            <h4 className="font-medium mb-3 flex items-center gap-2">
              <Calendar1Icon />
              {calendarData.name}
            </h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Timezone:</span> {calendarData.timezone}
              </div>
              <div>
                <span className="text-gray-500">Status:</span> 
                <span className={`ml-1 px-2 py-0.5 rounded-full text-xs ${
                  calendarData.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}>
                  {calendarData.active ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
          </div>

          {/* Business Hours */}
          <div>
            <h4 className="font-medium mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Business Hours ({calendarData.hours?.length || 0})
            </h4>
            {calendarData.hours && calendarData.hours.length > 0 ? (
              <div className="space-y-2">
                {calendarData.hours
                  .sort((a, b) => a.weekday - b.weekday || a.start_min - b.start_min)
                  .map((hour, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <span className="font-medium">{WEEKDAY_NAMES[hour.weekday]}</span>
                      <span className="text-blue-600">
                        {formatTime(hour.start_min)} - {formatTime(hour.end_min)}
                      </span>
                    </div>
                  ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">No business hours configured</p>
            )}
          </div>

          {/* Holidays */}
          <div>
            <h4 className="font-medium mb-3 flex items-center gap-2">
              <Timer className="w-4 h-4" />
              Holidays ({calendarData.holidays?.length || 0})
            </h4>
            {calendarData.holidays && calendarData.holidays.length > 0 ? (
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {calendarData.holidays
                  .sort((a, b) => a.date_iso.localeCompare(b.date_iso))
                  .map((holiday, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <span className="font-medium">{holiday.date_iso}</span>
                      <span className="text-gray-600">{holiday.name || 'Unnamed Holiday'}</span>
                    </div>
                  ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">No holidays configured</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Main Component
export default function SupportGroupsPage() {
  const path = usePathname();
  const orgId = path?.split("/")[3];
  const [groups, setGroups] = useState([]);
  const [teams, setTeams] = useState({});
  const [groupMembers, setGroupMembers] = useState({});
  const [teamMembers, setTeamMembers] = useState({});
  const [expandedGroups, setExpandedGroups] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState(null);
  const { getActiveUsersByOrg } = useUser();
  const [usersCache, setUsersCache] = useState({});

  // Modal states
  const [groupModal, setGroupModal] = useState({ isOpen: false, group: null });
  const [teamModal, setTeamModal] = useState({ isOpen: false, team: null, groupId: null });
  const [memberModal, setMemberModal] = useState({ 
    isOpen: false, 
    member: null, 
    type: null, 
    parentId: null 
  });
  const [calendarModal, setCalendarModal] = useState({
    isOpen: false,
    team: null,
    calendarData: null
  });

  const [searchTerm, setSearchTerm] = useState("");

  // Load organization users and cache them
  const loadOrgUsers = async () => {
    try {
      if (!usersCache[orgId] && orgId) {
        const users = await getActiveUsersByOrg({ orgId });
        setUsersCache(prev => ({ ...prev, [orgId]: users || [] }));
      }
    } catch (error) {
      console.error("Error loading org users:", error);
    }
  };

  // Helper function to get user display info
  const getUserDisplayInfo = (userId) => {
    const users = usersCache[orgId] || [];
    const user = users.find(u => u.uid === userId);
    return user ? {
      displayName: user.display_name || user.email,
      email: user.email,
      role: user.role
    } : {
      displayName: userId,
      email: '',
      role: 'unknown'
    };
  };

  useEffect(() => {
    if (orgId) {
      loadOrgUsers();
    }
  }, [orgId]);

  useEffect(() => {
    if (orgId) {
      loadGroups();
    }
  }, [orgId]);

  const showNotification = (message, type = "info") => {
    setNotification({ message, type });
  };

  const loadGroups = async () => {
    try {
      setLoading(true);
      const groupsData = await SupportGroupModel.list(orgId);
      setGroups(groupsData);
    } catch (error) {
      console.error("Error loading groups:", error);
      showNotification("Error loading groups", "error");
    } finally {
      setLoading(false);
    }
  };

  const loadTeams = async (groupId) => {
    try {
      const teamsData = await SupportTeamModel.list({ 
        groupId, 
        includeCalendar: true // Request calendar information
      });
      setTeams(prev => ({ ...prev, [groupId]: teamsData || [] }));

      await Promise.all((teamsData || []).map(async (t) => {
        const tid = t.teamId;
        const members = await SupportTeamModel.listMembers(tid);
        setTeamMembers(prev => ({ ...prev, [tid]: members || [] }));
      }));
    } catch (error) {
      console.error("Error loading teams:", error);
      showNotification("Error loading teams", "error");
    }
  };

  const loadGroupMembers = async (groupId) => {
    try {
      const membersData = await SupportGroupModel.listMembers(groupId);
      setGroupMembers(prev => ({ ...prev, [groupId]: membersData }));
    } catch (error) {
      console.error("Error loading group members:", error);
      showNotification("Error loading group members", "error");
    }
  };

  const toggleGroupExpanded = async (groupId) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupId)) {
      newExpanded.delete(groupId);
    } else {
      newExpanded.add(groupId);
      await loadOrgUsers();
      await Promise.all([
        loadTeams(groupId),
        loadGroupMembers(groupId)
      ]);
    }
    setExpandedGroups(newExpanded);
  };

  const handleViewCalendar = async (team) => {
    if (!team.calendar) {
      showNotification("No calendar assigned to this team", "info");
      return;
    }

    try {
      const calendarData = await SupportTeamModel.getTeamCalendar(team.teamId);
      setCalendarModal({
        isOpen: true,
        team,
        calendarData
      });
    } catch (error) {
      console.error("Error loading calendar details:", error);
      showNotification("Error loading calendar details", "error");
    }
  };

  // Group operations with validation
  const handleSaveGroup = async (groupData) => {
    try {
      if (groupModal.group) {
        showNotification("Group updated successfully", "success");
      } else {
        await SupportGroupModel.create(groupData);
        showNotification("Group created successfully", "success");
      }
      await loadGroups();
    } catch (error) {
      console.error("Error saving group:", error);
      showNotification("Error saving group", "error");
    }
  };

  const handleDeleteGroup = async (groupId) => {
    const groupConstraints = validateGroupConstraints(groupMembers[groupId]);
    const groupTeams = teams[groupId] || [];
    
    if (groupConstraints.hasMembers) {
      showNotification("Cannot delete group: remove all members first", "error");
      return;
    }
    
    if (groupTeams.length > 0) {
      showNotification("Cannot delete group: remove all teams first", "error");
      return;
    }
    
    if (!confirm("Are you sure you want to delete this group?")) return;
    
    try {
      await SupportGroupModel.remove(groupId);
      showNotification("Group deleted successfully", "success");
      await loadGroups();
    } catch (error) {
      console.error("Error deleting group:", error);
      showNotification("Error deleting group", "error");
    }
  };

  // Team operations with validation
  const handleSaveTeam = async (teamData) => {
    try {
      const convertedData = {
        name: teamData.name,
        description: teamData.description,
        email: teamData.email,
        orgId: teamData.org_id,
        groupId: teamData.group_id,
        targetProficiency: teamData.targetProficiency,
        routingWeight: teamData.routingWeight,
        defaultSlaId: teamData.defaultSlaId,
        calendarId: teamData.calendarId || null
      };

      if (teamModal.team) {
        await SupportTeamModel.update(teamModal.team.teamId, convertedData);
        showNotification("Team updated successfully", "success");
      } else {
        await SupportTeamModel.create(convertedData);
        showNotification("Team created successfully", "success");
      }
      await loadTeams(teamModal.groupId);
    } catch (error) {
      console.error("Error saving team:", error);
      showNotification("Error saving team", "error");
    }
  };

  const handleDeleteTeam = async (teamId, groupId) => {
    const teamConstraints = validateTeamConstraints(teamMembers[teamId]);
    
    if (teamConstraints.hasMembers) {
      showNotification("Cannot delete team: remove all members first", "error");
      return;
    }
    
    if (!confirm("Are you sure you want to delete this team?")) return;
    
    try {
      await SupportTeamModel.remove(teamId);
      showNotification("Team deleted successfully", "success");
      await loadTeams(groupId);
    } catch (error) {
      console.error("Error deleting team:", error);
      showNotification("Error deleting team", "error");
    }
  };

  // Member operations with validation
  const handleSaveMember = async (memberData) => {
    try {
      if (!memberData.user_id) {
        showNotification("Please select a user", "error");
        return;
      }

      if (memberModal.type === "group") {
        const groupMemberData = {
          user_id: memberData.user_id,
          role: memberData.role || 'agent',
          proficiency: memberData.proficiency || 'l1'
        };

        if (memberModal.member) {
          await SupportGroupModel.updateMember(memberModal.parentId, memberData.user_id, groupMemberData);
        } else {
          await SupportGroupModel.addMember(memberModal.parentId, groupMemberData);
        }
        await loadGroupMembers(memberModal.parentId);
      } else {
        const teamMemberData = {
          team_id: memberModal.parentId,
          user_id: memberData.user_id,
          role: memberData.role || 'agent',
          proficiency: memberData.proficiency || 'l1',
          ...(memberData.weekly_capacity_minutes && { 
            weekly_capacity_minutes: parseInt(memberData.weekly_capacity_minutes)
          })
        };

        if (memberModal.member) {
          await SupportTeamModel.updateMember(memberModal.parentId, memberData.user_id, teamMemberData);
        } else {
          await SupportTeamModel.addMember(memberModal.parentId, teamMemberData);
        }
        await loadTeamMembers(memberModal.parentId);
      }
      await loadOrgUsers()
      showNotification(`${memberModal.type} member ${memberModal.member ? 'updated' : 'added'} successfully`, "success");
    } catch (error) {
      console.error("Error saving member:", error);
      showNotification(`Error saving member: ${error.message}`, "error");
    }
  };
  const loadTeamMembers = async (teamId) => {
    try {
      const members = await SupportTeamModel.listMembers(teamId);
      setTeamMembers(prev => ({ ...prev, [teamId]: members || [] }));
    } catch (error) {
      console.error("Error loading team members:", error);
      showNotification("Error loading team members", "error");
    }
  };
  const handleRemoveMember = async (userId, parentId, type) => {
    const currentMembers = type === "group" ? groupMembers[parentId] : teamMembers[parentId];
    const memberToRemove = currentMembers?.find(m => m.user_id === userId);
    
    // Validation before removal
    if (type === "group") {
      const groupConstraints = validateGroupConstraints(currentMembers);
      if (groupConstraints.memberCount <= 1) {
        showNotification("Cannot remove member: group must have at least one member", "error");
        return;
      }
    } else {
      const teamConstraints = validateTeamConstraints(currentMembers);
      if (memberToRemove?.role === "lead" && teamConstraints.teamLeadCount <= 1) {
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
      showNotification("Member removed successfully", "success");
    } catch (error) {
      console.error("Error removing member:", error);
      showNotification("Error removing member", "error");
    }
    await loadOrgUsers();
  };

  const filteredGroups = useMemo(() => {
    if (!searchTerm) return groups;
    return groups.filter(group => 
      group.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (group.description && group.description.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [groups, searchTerm]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading support groups...</p>
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

          {/* Search */}
          <div className="mt-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search groups..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 w-64 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Groups List */}
        <div className="space-y-4">
          {filteredGroups.map((group) => {
            const groupConstraints = validateGroupConstraints(groupMembers[group.groupId]);
            const groupTeamsCount = teams[group.groupId]?.length || 0;
            
            return (
              <div key={group.groupId} className="bg-white rounded-lg shadow">
                {/* Group Header */}
                <div className="p-4 border-b">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => toggleGroupExpanded(group.groupId)}
                        className="p-1 hover:bg-gray-100 rounded transition-colors"
                      >
                        {expandedGroups.has(group.groupId) ? 
                          <ChevronDown className="w-4 h-4" /> : 
                          <ChevronRight className="w-4 h-4" />
                        }
                      </button>
                      <Building2 className="w-5 h-5 text-blue-600" />
                      <div>
                        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                          {group.name}
                          {!groupConstraints.hasMembers && (
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
                      <span className="text-xs text-gray-500">
                        {groupTeamsCount} teams
                      </span>
                      <span className="text-xs text-gray-500">
                        {groupConstraints.memberCount} members
                      </span>
                      <button
                        onClick={() => setGroupModal({ isOpen: true, group })}
                        className="p-2 hover:bg-gray-100 rounded transition-colors"
                        title="Edit group"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteGroup(group.groupId)}
                        className="p-2 hover:bg-gray-100 rounded text-red-600 transition-colors"
                        title="Delete group"
                        disabled={groupConstraints.hasMembers || groupTeamsCount > 0}
                      >
                        <Trash2 className={`w-4 h-4 ${(groupConstraints.hasMembers || groupTeamsCount > 0) ? 'opacity-50' : ''}`} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expanded Content */}
                {expandedGroups.has(group.groupId) && (
                  <div className="p-4 space-y-6">
                    {/* Group Members Section */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-medium text-gray-900 flex items-center gap-2">
                          <Users className="w-4 h-4" />
                          Group Members ({groupConstraints.memberCount})
                          {!groupConstraints.hasMembers && (
                            <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                              Required: At least 1 member
                            </span>
                          )}
                        </h4>
                        <button
                          onClick={() => setMemberModal({ 
                            isOpen: true, 
                            member: null, 
                            type: "group", 
                            parentId: group.groupId 
                          })}
                          className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1 transition-colors"
                        >
                          <UserPlus className="w-3 h-3" />
                          Add Member
                        </button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {groupMembers[group.groupId]?.map((member) => {
                          const userInfo = getUserDisplayInfo(member.user_id);
                          const canRemove = groupConstraints.memberCount > 1;
                          
                          return (
                            <div key={member.user_id} className="p-3 border rounded-lg">
                              <div className="flex items-center justify-between">
                                <div className="flex-1">
                                  <p className="font-medium text-sm">{userInfo.displayName}</p>
                                  {userInfo.email && userInfo.displayName !== userInfo.email && (
                                    <p className="text-xs text-gray-500">{userInfo.email}</p>
                                  )}
                                  <div className="flex items-center gap-2 mt-1">
                                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                                      member.role === 'lead' ? 'bg-purple-100 text-purple-700' :
                                      member.role === 'agent' ? 'bg-blue-100 text-blue-700' :
                                      'bg-gray-100 text-gray-700'
                                    }`}>
                                      {MEMBER_ROLES[member.role]}
                                    </span>
                                    <span className="text-xs text-gray-500">
                                      {PROFICIENCY_LEVELS[member.proficiency]}
                                    </span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => setMemberModal({
                                      isOpen: true,
                                      member,
                                      type: "group",
                                      parentId: group.groupId
                                    })}
                                    className="text-blue-600 hover:text-blue-700 p-1 transition-colors"
                                    title="Edit member"
                                  >
                                    <Edit className="w-3 h-3" />
                                  </button>
                                  <button
                                    onClick={() => handleRemoveMember(member.user_id, group.groupId, "group")}
                                    className={`p-1 transition-colors ${canRemove ? 'text-red-600 hover:text-red-700' : 'text-gray-400 cursor-not-allowed'}`}
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

                    {/* Teams Section */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-medium text-gray-900 flex items-center gap-2">
                          <Group className="w-4 h-4" />
                          Teams ({groupTeamsCount})
                        </h4>
                        <button
                          onClick={() => setTeamModal({ 
                            isOpen: true, 
                            team: null, 
                            groupId: group.groupId 
                          })}
                          className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1 transition-colors"
                        >
                          <Plus className="w-3 h-3" />
                          Add Team
                        </button>
                      </div>
                      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                        {teams[group.groupId]?.map((team) => (
                          <TeamStatsCard
                            key={team.teamId}
                            team={team}
                            members={teamMembers[team.teamId]}
                            onViewCalendar={handleViewCalendar}
                            onEditTeam={() => setTeamModal({ 
                              isOpen: true, 
                              team, 
                              groupId: group.groupId 
                            })}
                            getUserDisplayInfo={getUserDisplayInfo}
                            onDeleteTeam={() => handleDeleteTeam(team.teamId, group.groupId)}
                            onAddMember={() => setMemberModal({ 
                              isOpen: true, 
                              member: null, 
                              type: "team", 
                              parentId: team.teamId 
                            })}
                             onEditMember={(m) =>
   setMemberModal({
     isOpen: true,
     member: m,            // prefill the modal
     type: "team",
     parentId: team.teamId
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

        {/* Empty State */}
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
        onClose={() => setMemberModal({ 
          isOpen: false, 
          member: null, 
          type: null, 
          parentId: null 
        })}
        onSave={handleSaveMember}
        member={memberModal.member}
        type={memberModal.type}
        orgId={orgId}
        currentMembers={memberModal.type === "group" ? groupMembers[memberModal.parentId] : teamMembers[memberModal.parentId]}
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