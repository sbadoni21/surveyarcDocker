"use client"
import { AlertCircle, Edit, Trash2, UserPlus, X } from "lucide-react";
import { useState, useEffect } from "react";
import CalendarStatusChip from "./CalendarStatusChip";
import BizCalendarModel from "@/models/postGresModels/bizCalendarModel";

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

export default function TeamStatsCard({ 
  team, 
  members, 
  onViewCalendar, 
  onEditTeam, 
  onDeleteTeam, 
  onAddMember, 
  getUserDisplayInfo, 
  onEditMember, 
  onRemoveMember 
}) {
  const [calendar, setCalendar] = useState(team.calendar || null);
  const [loadingCalendar, setLoadingCalendar] = useState(false);

  console.log("=== TeamStatsCard Render ===");
  console.log("team:", team);
  console.log("team.calendarId:", team.calendarId);
  console.log("team.calendar:", team.calendar);
  console.log("members:", members);

  // Fetch calendar if team has calendarId but no calendar object
  useEffect(() => {
    let mounted = true;
    
    const fetchCalendar = async () => {
      // If already have calendar data, use it
      if (team.calendar) {
        setCalendar(team.calendar);
        return;
      }

      // If has calendarId but no calendar object, fetch it
      if (team.calendarId && !calendar) {
        setLoadingCalendar(true);
        try {
          console.log("Fetching calendar for calendarId:", team.calendarId);
          const calendarData = await BizCalendarModel.get(team.calendarId);
          console.log("Fetched calendar data:", calendarData);
          
          if (mounted) {
            setCalendar(calendarData);
          }
        } catch (error) {
          console.error("Error fetching calendar:", error);
          if (mounted) {
            setCalendar(null);
          }
        } finally {
          if (mounted) {
            setLoadingCalendar(false);
          }
        }
      }
    };

    fetchCalendar();

    return () => {
      mounted = false;
    };
  }, [team.calendarId, team.calendar]);

  const totalCapacity = members?.reduce((total, member) => {
    return total + (member.weekly_capacity_minutes || 0);
  }, 0) || 0;

  const activeMembers = members?.filter(m => m.active).length || 0;
  const totalHours = Math.round(totalCapacity / 60);

  console.log("Calculated values:", {
    totalCapacity,
    activeMembers,
    totalHours,
    calendar
  });

  // Validation helper functions
  const validateTeamConstraints = (members) => {
    const teamLeads = members ? members.filter(m => m.role === 'lead') : [];
    const constraints = {
      hasMembers: members && members.length > 0,
      hasTeamLead: teamLeads.length > 0,
      teamLeadCount: teamLeads.length,
      memberCount: members ? members.length : 0
    };
    console.log("Team constraints:", constraints);
    return constraints;
  };

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
      
      {loadingCalendar ? (
        <div className="text-xs text-gray-500 italic flex items-center gap-1">
          <div className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          Loading calendar...
        </div>
      ) : (
        <CalendarStatusChip
          calendar={calendar} 
          onClick={() => {
            console.log("View calendar clicked for team:", team.name, "calendar:", calendar);
            if (calendar) {
              onViewCalendar(team);
            }
          }}
        />
      )}
      
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
          <div className="font-medium text-orange-600">{calendar?.holidays_count || 0}</div>
          <div className="text-gray-500">Holidays</div>
        </div>
      </div>

      <div className="mt-2">
        {Array.isArray(members) && members.length > 0 ? (
          <ul className="divide-y rounded border bg-white">
            {members.slice(0, 5).map((m) => {
              console.log("Processing member:", m);
              
              const u = getUserDisplayInfo(m.userId);
          
              console.log("User display info for", m.userId, ":", u);
              
              const roleBadge =
                m.role === "lead"
                  ? "bg-purple-100 text-purple-700"
                  : m.role === "agent"
                  ? "bg-blue-100 text-blue-700"
                  : "bg-gray-100 text-gray-700";
              
              return (
                <li key={m.userId} className="px-2 py-1.5 text-xs flex items-center gap-2">
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
                    onClick={() => {
                      console.log("Edit member clicked:", m);
                      onEditMember && onEditMember(m);
                    }}
                  >
                    <Edit className="w-3 h-3 text-gray-600" />
                  </button>
                  <button
                    className="shrink-0 p-1 hover:bg-gray-100 rounded text-red-600"
                    title="Remove member"
                    onClick={() => {
                      console.log("Remove member clicked:", m.user_id);
                      onRemoveMember && onRemoveMember(m.user_id);
                    }}
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
        onClick={() => {
          console.log("Add member clicked for team:", team.name);
          onAddMember();
        }}
        className="w-full text-xs text-blue-600 hover:text-blue-700 flex items-center justify-center gap-1 py-1 hover:bg-white rounded transition-colors"
      >
        <UserPlus className="w-3 h-3" />
        Add Member
      </button>
    </div>
  );
}