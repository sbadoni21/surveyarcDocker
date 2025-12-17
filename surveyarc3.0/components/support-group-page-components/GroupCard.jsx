"use client";

import {
  ChevronDown,
  ChevronRight,
  Building2,
  AlertCircle,
  Group,
  Users,
  Edit,
  Trash2,
  UserPlus,
  X,
  Plus,
} from "lucide-react";
import TeamStatsCard from "./TeamStatsCard";

export default function GroupCard({
  group,
  isExpanded,
  onToggleExpand,
  constraints,
  teamsCount,
  members = [],
  teams = [],
  teamMembers = {},
  MEMBER_ROLES,
  PROFICIENCY_LEVELS,

  // handlers
  onEditGroup,
  onDeleteGroup,
  onAddGroupMember,
  onEditGroupMember,
  onRemoveGroupMember,
  onAddTeam,
  onEditTeam,
  onDeleteTeam,
  onAddTeamMember,
  onEditTeamMember,
  onRemoveTeamMember,
  onViewCalendar,

  getUserDisplayInfo,
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-md hover:border-gray-300 transition-all overflow-hidden">
      {/* ================= Header ================= */}
      <div className="p-5 bg-gray-50">
        <div className="flex items-center gap-4">
          <button
            onClick={onToggleExpand}
            className="p-2 hover:bg-gray-200 rounded-md"
          >
            {isExpanded ? (
              <ChevronDown className="w-5 h-5 text-gray-600" />
            ) : (
              <ChevronRight className="w-5 h-5 text-gray-600" />
            )}
          </button>

          <div className="w-10 h-10 bg-slate-100 rounded-md flex items-center justify-center border">
            <Building2 className="w-5 h-5 text-slate-600" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-gray-900">
                {group.name}
              </h3>

              {!constraints.hasMembers && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 border border-amber-200 text-amber-700 text-xs rounded">
                  <AlertCircle className="w-3 h-3" />
                  No Members
                </span>
              )}
            </div>

            {group.description && (
              <p className="text-sm text-gray-600">{group.description}</p>
            )}
            {group.email && (
              <p className="text-xs text-gray-500">{group.email}</p>
            )}
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right text-sm space-y-1">
              <div className="flex items-center justify-end gap-1">
                <Group className="w-4 h-4 text-gray-500" />
                <span className="font-medium">{teamsCount}</span>
                <span className="text-gray-500">teams</span>
              </div>
              <div className="flex items-center justify-end gap-1">
                <Users className="w-4 h-4 text-gray-500" />
                <span className="font-medium">
                  {constraints.memberCount}
                </span>
                <span className="text-gray-500">members</span>
              </div>
            </div>

            <div className="flex items-center gap-1 border-l pl-4">
              <button
                onClick={onEditGroup}
                className="p-2 hover:bg-gray-200 rounded-md"
              >
                <Edit className="w-4 h-4" />
              </button>

              <button
                onClick={onDeleteGroup}
                disabled={constraints.hasMembers || teamsCount > 0}
                className={`p-2 rounded-md ${
                  constraints.hasMembers || teamsCount > 0
                    ? "text-gray-400 cursor-not-allowed"
                    : "text-red-600 hover:bg-red-50"
                }`}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ================= Expanded Content ================= */}
      {isExpanded && (
        <div className="px-5 pb-5 pt-5 space-y-6 border-t bg-white">
          {/* -------- Members -------- */}
          <section>
            <div className="flex justify-between mb-4">
              <h4 className="font-semibold flex items-center gap-2">
                <Users className="w-4 h-4" />
                Members ({constraints.memberCount})
              </h4>
              <button
                onClick={onAddGroupMember}
                className="px-4 py-2 bg-slate-700 text-white rounded-md flex items-center gap-2"
              >
                <UserPlus className="w-4 h-4" />
                Add Member
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {members.map((member) => {
                const info = getUserDisplayInfo(member.user_id);
                const canRemove = constraints.memberCount > 1;

                return (
                  <div
                    key={member.user_id}
                    className="p-4 bg-gray-50 border rounded-md"
                  >
                    <div className="flex justify-between">
                      <div>
                        <p className="font-medium text-sm">
                          {info.displayName}
                        </p>
                        {info.email && (
                          <p className="text-xs text-gray-500">
                            {info.email}
                          </p>
                        )}

                        <div className="flex gap-2 mt-2 text-xs">
                          <span className="px-2 py-0.5 border rounded">
                            {MEMBER_ROLES[member.role]}
                          </span>
                          <span>
                            {PROFICIENCY_LEVELS[member.proficiency]}
                          </span>
                        </div>
                      </div>

                      <div className="flex gap-1">
                        <button onClick={() => onEditGroupMember(member)}>
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          disabled={!canRemove}
                          onClick={() =>
                            onRemoveGroupMember(member.user_id)
                          }
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* -------- Teams -------- */}
          <section>
            <div className="flex justify-between mb-4">
              <h4 className="font-semibold flex items-center gap-2">
                <Group className="w-4 h-4" />
                Teams ({teamsCount})
              </h4>
              <button
                onClick={onAddTeam}
                className="px-4 py-2 bg-slate-700 text-white rounded-md flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Team
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
              {teams.map((team) => (
                <TeamStatsCard
                  key={team.teamId}
                  team={team}
                  members={teamMembers[team.teamId]}
                  onViewCalendar={() => onViewCalendar(team)}
                  onEditTeam={() => onEditTeam(team)}
                  onDeleteTeam={() => onDeleteTeam(team.teamId)}
                  onAddMember={() => onAddTeamMember(team.teamId)}
                  onEditMember={(m) => onEditTeamMember(m, team.teamId)}
                  onRemoveMember={(uid) =>
                    onRemoveTeamMember(uid, team.teamId)
                  }
                />
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
