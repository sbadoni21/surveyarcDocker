
// ==================== 2. UserRoleManager Component (components/rbac/UserRoleManager.jsx) ====================
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Shield, Plus, Trash2, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { useRBAC } from "@/providers/RBACProvider";

const SCOPES = [
  { value: "org", label: "Organization" },
  { value: "group", label: "Group" },
  { value: "team", label: "Team" },
  { value: "project", label: "Project" },
];

const AVAILABLE_ROLES = [
  { name: "admin", scope: "org", description: "Full organization access" },
  { name: "member", scope: "org", description: "Basic organization access" },
  { name: "billing_admin", scope: "org", description: "Manage billing" },
  { name: "security_admin", scope: "org", description: "Manage security" },
  { name: "manager", scope: "team", description: "Team management" },
  { name: "viewer", scope: "project", description: "View-only access" },
  { name: "contributor", scope: "project", description: "Contribute to projects" },
];

const UserRoleManager = ({ userId, orgId }) => {
  const { loading, userRoles, listUserRoles, assignRole, removeRole } = useRBAC();
  const [roles, setRoles] = useState([]);
  const [isAdding, setIsAdding] = useState(false);
  const [toast, setToast] = useState(null);

  // Form state
  const [selectedRole, setSelectedRole] = useState("");
  const [selectedScope, setSelectedScope] = useState("org");
  const [resourceId, setResourceId] = useState("");

  // Load roles on mount
  useEffect(() => {
    if (userId && orgId) {
      loadRoles();
    }
  }, [userId, orgId]);

  const loadRoles = async () => {
    try {
      const data = await listUserRoles(userId, orgId);
      setRoles(data || []);
    } catch (error) {
      showToast("Failed to load roles", "error");
    }
  };

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleAssignRole = async () => {
    if (!selectedRole || !selectedScope) {
      showToast("Please select a role and scope", "error");
      return;
    }

    if (selectedScope !== "org" && !resourceId) {
      showToast(`Resource ID is required for ${selectedScope} scope`, "error");
      return;
    }

    try {
      await assignRole({
        userId: userId,
        roleName: selectedRole,
        scope: selectedScope,
        resourceId: selectedScope === "org" ? orgId : resourceId,
        orgId: orgId,
      });

      showToast("Role assigned successfully");
      setIsAdding(false);
      setSelectedRole("");
      setResourceId("");
      await loadRoles();
    } catch (error) {
      showToast(error.message || "Failed to assign role", "error");
    }
  };

  const handleRemoveRole = async (role) => {
    if (!confirm(`Remove ${role.role_name} role?`)) return;

    try {
      await removeRole({
        userId: userId,
        roleName: role.role_name,
        scope: role.scope,
        resourceId: role.resource_id,
      });

      showToast("Role removed successfully");
      await loadRoles();
    } catch (error) {
      showToast("Failed to remove role", "error");
    }
  };

  const availableRolesToAssign = AVAILABLE_ROLES.filter(
    (ar) =>
      selectedScope === ar.scope &&
      !roles.some(
        (r) =>
          r.role_name === ar.name &&
          r.scope === selectedScope &&
          r.resource_id === (selectedScope === "org" ? orgId : resourceId)
      )
  );

  return (
    <div className="space-y-4">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 ${
            toast.type === "error"
              ? "bg-red-500 text-white"
              : "bg-green-500 text-white"
          }`}
        >
          {toast.type === "error" ? <AlertCircle size={20} /> : <CheckCircle2 size={20} />}
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Shield className="text-orange-500" size={20} />
          Role Assignments
        </h3>
        <button
          onClick={() => setIsAdding(!isAdding)}
          className="px-3 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 flex items-center gap-2"
        >
          <Plus size={16} />
          Assign Role
        </button>
      </div>

      {/* Add Role Form */}
      {isAdding && (
        <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Scope</label>
            <select
              value={selectedScope}
              onChange={(e) => {
                setSelectedScope(e.target.value);
                setSelectedRole("");
                setResourceId("");
              }}
              className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
            >
              {SCOPES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          {selectedScope !== "org" && (
            <div>
              <label className="block text-sm font-medium mb-1">
                Resource ID ({selectedScope})
              </label>
              <input
                type="text"
                value={resourceId}
                onChange={(e) => setResourceId(e.target.value)}
                placeholder={`Enter ${selectedScope} ID`}
                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">Role</label>
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
            >
              <option value="">Select a role...</option>
              {availableRolesToAssign.map((role) => (
                <option key={role.name} value={role.name}>
                  {role.name} - {role.description}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleAssignRole}
              disabled={loading}
              className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />}
              Assign
            </button>
            <button
              onClick={() => setIsAdding(false)}
              className="px-4 py-2 border rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Roles List */}
      <div className="space-y-2">
        {loading && roles.length === 0 ? (
          <div className="flex justify-center py-8">
            <Loader2 className="animate-spin text-gray-400" size={32} />
          </div>
        ) : roles.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Shield size={48} className="mx-auto mb-2 opacity-20" />
            <p>No roles assigned yet</p>
          </div>
        ) : (
          roles.map((role, idx) => (
            <div
              key={`${role.role_id}-${role.scope}-${role.resource_id}-${idx}`}
              className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{role.role_name}</span>
                  <span className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded">
                    {role.scope}
                  </span>
                </div>
                {role.resource_id && (
                  <p className="text-xs text-gray-500 mt-1">
                    Resource: {role.resource_id}
                  </p>
                )}
              </div>
              <button
                onClick={() => handleRemoveRole(role)}
                disabled={loading}
                className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg disabled:opacity-50"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default UserRoleManager;
