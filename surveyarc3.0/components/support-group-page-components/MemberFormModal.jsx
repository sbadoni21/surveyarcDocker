"use client";
import { useUser } from "@/providers/postGresPorviders/UserProvider";
import { AlertCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

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

export default function MemberFormModal({
  isOpen,
  onClose,
  onSave,
  member,
  type,
  orgId,
  currentMembers,
}) {
  const { getActiveUsersByOrg } = useUser();
  const [availableUsers, setAvailableUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);

  const [formData, setFormData] = useState({
    userId: "",
    role: "agent",
    proficiency: "l1",
    weekly_capacity_minutes: "",
  });

  // ---- helpers
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

  // Memoize to avoid new object identity each render
  const teamConstraints = useMemo(() => {
    return type === "team" ? validateTeamConstraints(currentMembers) : null;
  }, [type, currentMembers]);

  const hasTeamLead = teamConstraints?.hasTeamLead ?? true; // primitive for deps
  const teamLeadCount = teamConstraints?.teamLeadCount ?? 0; // primitive for deps

  // ---- load org users when opened
  useEffect(() => {
    const loadUsers = async () => {
      if (!isOpen || !orgId) return;
      try {
        setUsersLoading(true);
        const users = await getActiveUsersByOrg({ orgId });
        setAvailableUsers(Array.isArray(users) ? users : []);
      } catch (error) {
        console.error("Error loading users:", error);
        setAvailableUsers([]);
      } finally {
        setUsersLoading(false);
      }
    };
    loadUsers();
  }, [isOpen, orgId, getActiveUsersByOrg]);

  // ---- initialize form on open OR when the selected member changes
  useEffect(() => {
    if (!isOpen) return;

    if (member) {
      const next = {
        userId: member.userId || "",
        role: member.role || "agent",
        proficiency: member.proficiency || "l1",
        weekly_capacity_minutes: member.weekly_capacity_minutes ?? "",
      };

      // Only update if values actually changed
      setFormData((prev) =>
        prev.userId === next.userId &&
        prev.role === next.role &&
        prev.proficiency === next.proficiency &&
        String(prev.weekly_capacity_minutes ?? "") === String(next.weekly_capacity_minutes ?? "")
          ? prev
          : next
      );
    } else {
      // Default role: if team has no lead yet, preselect "lead"
      const defaultRole = type === "team" && !hasTeamLead ? "lead" : "agent";
      const next = {
        userId: "",
        role: defaultRole,
        proficiency: "l1",
        weekly_capacity_minutes: "",
      };

      setFormData((prev) =>
        prev.userId === next.userId &&
        prev.role === next.role &&
        prev.proficiency === next.proficiency &&
        String(prev.weekly_capacity_minutes ?? "") === String(next.weekly_capacity_minutes ?? "")
          ? prev
          : next
      );
    }
    // Depend on primitives, not the whole object
  }, [
    isOpen,
    type,
    hasTeamLead, // primitive
    member?.userId,
    member?.role,
    member?.proficiency,
    member?.weekly_capacity_minutes,
  ]);

  const handleSubmit = async () => {
    // Team constraint: don't demote the last lead
    if (
      type === "team" &&
      member &&
      member.role === "lead" &&
      formData.role !== "lead" &&
      teamLeadCount === 1
    ) {
      alert("Cannot change role: this team must have at least one team lead.");
      return;
    }

    const payload = {
      userId: formData.userId,
      role: formData.role,
      proficiency: formData.proficiency,
    };

    if (type === "team" && formData.weekly_capacity_minutes !== "") {
      payload.weekly_capacity_minutes = parseInt(formData.weekly_capacity_minutes, 10) || 0;
    }

    await onSave(payload);
    onClose();
  };

  if (!isOpen) return null;

  const selectedUser = availableUsers.find((u) => u.uid === formData.userId);

  const isRoleChangeRestricted =
    !!member && type === "team" && member.role === "lead" && teamLeadCount === 1;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
        <div className="p-6 border-b">
          <h3 className="text-lg font-semibold">
            {member ? `Edit ${type} Member` : `Add ${type} Member`}
          </h3>

          {type === "team" && !hasTeamLead && !member && (
            <div className="mt-2 p-2 bg-orange-50 border border-orange-200 rounded text-sm text-orange-800">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                This team needs at least one Team Lead
              </div>
            </div>
          )}
        </div>

        <div className="p-6 space-y-4">
          {/* User select */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Select User
              {selectedUser && (
                <span className="ml-2 text-xs text-gray-500">({selectedUser.email})</span>
              )}
            </label>

            {usersLoading ? (
              <div className="w-full px-3 py-2 border rounded-lg bg-gray-50 flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                <span className="text-sm text-gray-600">Loading users...</span>
              </div>
            ) : (
              <select
                value={formData.userId}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, userId: e.target.value }))
                }
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
                disabled={!!member}
              >
                <option value="">Select a user...</option>
                {availableUsers
                  .filter(
                    (u) =>
                      !currentMembers?.some((m) => m.userId === u.uid) ||
                      (member && member.userId === u.uid)
                  )
                  .map((u) => (
                    <option key={u.uid} value={u.uid}>
                      {u.display_name || u.email}
                      {u.display_name && u.email ? ` (${u.email})` : ""}
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

          {/* Role */}
          <div>
            <label className="block text-sm font-medium mb-2">Role</label>
            <select
              value={formData.role}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, role: e.target.value }))
              }
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              disabled={isRoleChangeRestricted}
            >
              {Object.entries(MEMBER_ROLES).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
            {isRoleChangeRestricted && (
              <p className="text-xs text-red-600 mt-1">
                Cannot change role: this team must have at least one team lead
              </p>
            )}
          </div>

          {/* Proficiency */}
          <div>
            <label className="block text-sm font-medium mb-2">Proficiency Level</label>
            <select
              value={formData.proficiency}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, proficiency: e.target.value }))
              }
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {Object.entries(PROFICIENCY_LEVELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* Capacity (team only) */}
          {type === "team" && (
            <div>
              <label className="block text-sm font-medium mb-2">
                Weekly Capacity (minutes)
              </label>
              <input
                type="number"
                min="0"
                value={formData.weekly_capacity_minutes}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    weekly_capacity_minutes: e.target.value,
                  }))
                }
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g. 2400 (40 hours)"
              />
              <p className="text-xs text-gray-500 mt-1">
                Leave empty for unlimited capacity
              </p>
            </div>
          )}

          {/* Actions */}
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
              onClick={handleSubmit}
              disabled={!formData.userId || usersLoading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {member ? "Update" : "Add"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
