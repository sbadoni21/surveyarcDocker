"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Loader2,
  X,
  Link2,
  Check,
  ChevronDown,
  ChevronUp,
  Shield,
  Search,
  Plus,
  Trash2,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Info,
  Zap,
  Package,
  Edit,
  CheckSquare,
  Square,
} from "lucide-react";

// Toast Notification Component
const Toast = ({ message, type = "success", onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const styles = {
    success: "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-800 dark:text-green-200",
    error: "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200",
    info: "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200",
  };

  const icons = {
    success: <CheckCircle size={20} />,
    error: <AlertCircle size={20} />,
    info: <Info size={20} />,
  };

  return (
    <div className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-lg border shadow-lg animate-slide-in ${styles[type]}`}>
      {icons[type]}
      <p className="text-sm font-medium">{message}</p>
      <button onClick={onClose} className="ml-2 hover:opacity-70">
        <X size={16} />
      </button>
    </div>
  );
};

// Confirmation Modal Component
const ConfirmModal = ({ isOpen, onClose, onConfirm, title, message, confirmText = "Confirm", isDestructive = false }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl max-w-md w-full animate-scale-in">
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            {title}
          </h3>
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            {message}
          </p>
        </div>
        <div className="flex gap-3 px-6 py-4 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 rounded-b-xl">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors font-medium"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`flex-1 px-4 py-2.5 rounded-lg transition-colors font-medium ${
              isDestructive
                ? "bg-red-500 hover:bg-red-600 text-white"
                : "bg-orange-500 hover:bg-orange-600 text-white"
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

// Statistics Card Component
const StatCard = ({ icon: Icon, label, value, color = "orange" }) => {
  const colors = {
    orange: "bg-orange-100 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400",
    blue: "bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400",
    green: "bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400",
    purple: "bg-purple-100 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400",
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-center gap-3">
        <div className={`p-3 rounded-lg ${colors[color]}`}>
          <Icon size={24} />
        </div>
        <div>
          <p className="text-sm text-gray-600 dark:text-gray-400">{label}</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
        </div>
      </div>
    </div>
  );
};

export function MappingsTab({ orgId, userId, data, setData }) {
  const { 
    roles = [], 
    permissions = [], 
    rolePermissions = {}, 
    loading = true, 
    hasLoaded = false 
  } = data || {};
  
  const [selectedRole, setSelectedRole] = useState(null);
  const [addingMode, setAddingMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterModule, setFilterModule] = useState("all");
  const [filterAssigned, setFilterAssigned] = useState("all");
  const [selectedPermissions, setSelectedPermissions] = useState(new Set());
  const [toast, setToast] = useState(null);
  const [confirmModal, setConfirmModal] = useState({ isOpen: false });

  // Load all data
  const loadData = useCallback(async () => {
    if (!orgId || !userId) return;

    setData(prev => ({ ...prev, loading: true }));
    try {
      const [rolesRes, permsRes, roleMappingsRes] = await Promise.all([
        fetch(`/api/post-gres-apis/rbac/roles?org_id=${orgId}&user=${userId}`, { cache: "no-store" }),
        fetch(`/api/post-gres-apis/rbac/permissions?user=${userId}&orgId=${orgId}`, { cache: "no-store" }),
        fetch(`/api/post-gres-apis/rbac/permissions/roles/batch?user=${userId}&org_id=${orgId}`, { cache: "no-store" }),
      ]);

      const rolesData = await rolesRes.json();
      const permsText = await permsRes.text();
      const permsData = permsText ? JSON.parse(permsText) : [];
      const mappings = await roleMappingsRes.json();

      setData({
        roles: rolesData || [],
        permissions: Array.isArray(permsData) ? permsData : [],
        rolePermissions: mappings || {},
        loading: false,
        hasLoaded: true,
      });
    } catch (error) {
      console.error("Error loading data:", error);
      showToast("Failed to load data", "error");
      setData({
        roles: [],
        permissions: [],
        rolePermissions: {},
        loading: false,
        hasLoaded: true,
      });
    }
  }, [orgId, userId, setData]);

  useEffect(() => {
    if (orgId && userId && !hasLoaded) {
      loadData();
    }
  }, [orgId, userId, hasLoaded, loadData]);

  // Toast helper
  const showToast = (message, type = "success") => {
    setToast({ message, type });
  };

  // Bulk add permissions
// Bulk add permissions - UPDATED
const addSelectedPermissions = async () => {
  if (!selectedRole || selectedPermissions.size === 0) return;

  setSaving(true);
  try {
    // ✅ Single bulk API call instead of multiple Promise.all
    const res = await fetch(
      `/api/post-gres-apis/rbac/permissions/roles/${selectedRole.id}/permissions/bulk`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          permission_ids: Array.from(selectedPermissions),
          user_id: userId,
        }),
      }
    );

    const result = await res.json();

    if (res.ok) {
      await loadData();
      
      const { added_count, skipped_count } = result;
      
      if (skipped_count > 0) {
        showToast(
          `Added ${added_count} permission${added_count !== 1 ? 's' : ''} (${skipped_count} already assigned)`,
          "info"
        );
      } else {
        showToast(
          `${added_count} permission${added_count !== 1 ? 's' : ''} added successfully`
        );
      }
      
      setSelectedPermissions(new Set());
    } else {
      showToast(result.detail || "Failed to add permissions", "error");
    }
  } catch (error) {
    console.error("Error adding permissions:", error);
    showToast("Error adding permissions", "error");
  }
  setSaving(false);
};

  // Remove permission
  const removePermissionFromRole = async (roleId, permissionId, permCode) => {
    setConfirmModal({
      isOpen: true,
      title: "Remove Permission",
      message: `Are you sure you want to remove "${permCode}" from this role? This may affect user access.`,
      confirmText: "Remove",
      isDestructive: true,
      onConfirm: async () => {
        setSaving(true);
        try {
          await fetch(
            `/api/post-gres-apis/rbac/permissions/roles/${roleId}/permissions/${permissionId}`,
            {
              method: "DELETE",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ user_id: userId }),
            }
          );
          await loadData();
          showToast("Permission removed successfully");
        } catch (error) {
          showToast("Error removing permission", "error");
        }
        setSaving(false);
      }
    });
  };

  const handleRefresh = () => {
    setData(prev => ({ ...prev, hasLoaded: false }));
    showToast("Refreshing data...", "info");
  };

  // Toggle permission selection
  const togglePermissionSelection = (permId) => {
    const newSelected = new Set(selectedPermissions);
    if (newSelected.has(permId)) {
      newSelected.delete(permId);
    } else {
      newSelected.add(permId);
    }
    setSelectedPermissions(newSelected);
  };

  // Select all unassigned permissions in current filter
  const selectAllUnassigned = () => {
    const rolePerms = rolePermissions[selectedRole?.id] || [];
    const rolePermIds = new Set(rolePerms.map((p) => p.id));
    
    const unassignedPerms = filteredPermissions.filter(p => !rolePermIds.has(p.id));
    setSelectedPermissions(new Set(unassignedPerms.map(p => p.id)));
  };

  // Clear all selections
  const clearSelection = () => {
    setSelectedPermissions(new Set());
  };

  // Handle role click
  const handleRoleClick = (role) => {
    setSelectedRole(role);
    setAddingMode(false);
    setSelectedPermissions(new Set());
  };

  // Group permissions by module
  const permissionsByModule = (permissions || []).reduce((acc, perm) => {
    if (!acc[perm.module]) acc[perm.module] = [];
    acc[perm.module].push(perm);
    return acc;
  }, {});

  const modules = Object.keys(permissionsByModule);

  // Filter permissions
  const filteredPermissions = (permissions || []).filter((p) => {
    const matchesSearch = searchTerm === "" ||
      p.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.description?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesModule = filterModule === "all" || p.module === filterModule;
    
    let matchesAssigned = true;
    if (selectedRole && filterAssigned !== "all") {
      const rolePerms = rolePermissions[selectedRole.id] || [];
      const isAssigned = rolePerms.some(rp => rp.id === p.id);
      matchesAssigned = filterAssigned === "assigned" ? isAssigned : !isAssigned;
    }
    
    return matchesSearch && matchesModule && matchesAssigned;
  });

  const filteredPermissionsByModule = filteredPermissions.reduce((acc, perm) => {
    if (!acc[perm.module]) acc[perm.module] = [];
    acc[perm.module].push(perm);
    return acc;
  }, {});

  const getScopeBadgeColor = (scope) => {
    const colors = {
      org: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
      group: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
      team: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
      project: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    };
    return colors[scope] || colors.org;
  };

  // Calculate statistics
  const totalPermissions = permissions.length;
  const totalRoles = roles.length;
  const totalAssignments = Object.values(rolePermissions).reduce((sum, perms) => sum + perms.length, 0);
  const avgPermissionsPerRole = totalRoles > 0 ? (totalAssignments / totalRoles).toFixed(1) : 0;

  // Count unassigned permissions for current filter
  const unassignedCount = selectedRole ? filteredPermissions.filter(p => {
    const rolePerms = rolePermissions[selectedRole.id] || [];
    return !rolePerms.some(rp => rp.id === p.id);
  }).length : 0;

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="text-center">
          <Loader2 className="animate-spin text-orange-500 mx-auto mb-4" size={40} />
          <p className="text-gray-600 dark:text-gray-400">Loading role permissions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Toast Notifications */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ isOpen: false })}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText}
        isDestructive={confirmModal.isDestructive}
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Role Permission Mappings</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Click on a role to view and manage its permissions
          </p>
        </div>
        <button
          onClick={handleRefresh}
          className="px-4 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center gap-2"
          disabled={loading}
        >
          {loading ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <RefreshCw size={18} />
          )}
          <span>Refresh</span>
        </button>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Shield}
          label="Total Roles"
          value={totalRoles}
          color="blue"
        />
        <StatCard
          icon={Package}
          label="Total Permissions"
          value={totalPermissions}
          color="purple"
        />
        <StatCard
          icon={Link2}
          label="Total Assignments"
          value={totalAssignments}
          color="green"
        />
        <StatCard
          icon={Zap}
          label="Avg per Role"
          value={avgPermissionsPerRole}
          color="orange"
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Left: Roles List */}
        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
              Roles
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Click a role to view its permissions
            </p>
          </div>

          {roles.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-12 text-center">
              <Shield size={48} className="mx-auto mb-4 text-gray-400 dark:text-gray-600" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                No roles found
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Create roles first to assign permissions
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {roles.map((role) => {
                const rolePerms = rolePermissions[role.id] || [];
                const isSelected = selectedRole?.id === role.id;

                return (
                  <button
                    key={role.id}
                    onClick={() => handleRoleClick(role)}
                    className={`w-full bg-white dark:bg-gray-800 rounded-lg border-2 overflow-hidden transition-all text-left ${
                      isSelected
                        ? "border-orange-500 shadow-lg"
                        : "border-gray-200 dark:border-gray-700 hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600"
                    }`}
                  >
                    <div className="px-5 py-4 flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <div className="text-left">
                          <div className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                            {role.name}
                            {isSelected && (
                              <span className="px-2 py-0.5 text-xs bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-full">
                                Selected
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                            {rolePerms.length} permission{rolePerms.length !== 1 ? 's' : ''}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-3 py-1 text-xs font-medium rounded-full ${getScopeBadgeColor(role.scope)}`}>
                          {role.scope.charAt(0).toUpperCase() + role.scope.slice(1)}
                        </span>
                        {role.is_system && (
                          <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600">
                            System
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Role Permissions View */}
        <div className="lg:sticky lg:top-4 lg:h-fit">
          {selectedRole ? (
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden shadow-lg">
              {/* Header */}
              <div className="bg-gradient-to-r from-orange-500 to-orange-600 px-6 py-5">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                      <Shield size={20} />
                      {selectedRole.name}
                    </h3>
                    <p className="text-orange-100 text-sm mt-1">
                      {rolePermissions[selectedRole.id]?.length || 0} permissions assigned
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedRole(null);
                      setAddingMode(false);
                      setSelectedPermissions(new Set());
                    }}
                    className="p-2 hover:bg-white/20 rounded-lg transition-colors text-white"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              {/* Tab Switcher */}
              <div className="flex border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                <button
                  onClick={() => {
                    setAddingMode(false);
                    setSelectedPermissions(new Set());
                  }}
                  className={`flex-1 px-4 py-3 font-medium transition-colors ${
                    !addingMode
                      ? "border-b-2 border-orange-500 text-orange-600 dark:text-orange-400 bg-white dark:bg-gray-800"
                      : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
                  }`}
                >
                  Current Permissions
                </button>
                {!selectedRole.is_system && (
                  <button
                    onClick={() => {
                      setAddingMode(true);
                      setSelectedPermissions(new Set());
                    }}
                    className={`flex-1 px-4 py-3 font-medium transition-colors ${
                      addingMode
                        ? "border-b-2 border-orange-500 text-orange-600 dark:text-orange-400 bg-white dark:bg-gray-800"
                        : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
                    }`}
                  >
                    Add Permissions
                  </button>
                )}
              </div>

              {/* Content */}
              {!addingMode ? (
                // Current Permissions View
                <div className="p-5 max-h-[600px] overflow-y-auto">
                  {rolePermissions[selectedRole.id]?.length > 0 ? (
                    <div className="space-y-2">
                      {rolePermissions[selectedRole.id].map((perm) => (
                        <div
                          key={perm.id}
                          className="group flex justify-between items-center bg-gray-50 dark:bg-gray-900/50 px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-all"
                        >
                          <div className="flex-1">
                            <code className="text-sm font-mono text-gray-900 dark:text-white font-semibold">
                              {perm.code}
                            </code>
                            {perm.description && (
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                {perm.description}
                              </p>
                            )}
                          </div>
                          {!selectedRole.is_system && (
                            <button
                              onClick={() => removePermissionFromRole(selectedRole.id, perm.id, perm.code)}
                              disabled={saving}
                              className="ml-3 p-2 opacity-0 group-hover:opacity-100 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-red-600 dark:text-red-400 disabled:opacity-50 transition-all"
                              title="Remove permission"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-16">
                      <Package size={48} className="mx-auto mb-4 text-gray-400 dark:text-gray-600 opacity-50" />
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                        No permissions assigned
                      </h3>
                      <p className="text-gray-600 dark:text-gray-400 mb-6">
                        This role doesn't have any permissions yet
                      </p>
                      {!selectedRole.is_system && (
                        <button
                          onClick={() => setAddingMode(true)}
                          className="px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors font-medium inline-flex items-center gap-2"
                        >
                          <Plus size={18} />
                          Add Permissions
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                // Add Permissions View
                <>
                  {/* Selection Actions Bar */}
                  {selectedPermissions.size > 0 && (
                    <div className="sticky top-0 z-10 p-4 bg-orange-50 dark:bg-orange-900/10 border-b border-orange-200 dark:border-orange-800">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <CheckSquare size={20} className="text-orange-600 dark:text-orange-400" />
                          <span className="font-medium text-gray-900 dark:text-white">
                            {selectedPermissions.size} selected
                          </span>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={clearSelection}
                            className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                          >
                            Clear
                          </button>
                          <button
                            onClick={addSelectedPermissions}
                            disabled={saving}
                            className="px-4 py-1.5 text-sm bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors font-medium flex items-center gap-2 disabled:opacity-50"
                          >
                            {saving ? (
                              <Loader2 size={16} className="animate-spin" />
                            ) : (
                              <Plus size={16} />
                            )}
                            Add Selected
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Filters */}
                  <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 space-y-3">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                      <input
                        type="text"
                        placeholder="Search permissions..."
                        className="w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 dark:focus:ring-orange-400"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <select
                        className="px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 dark:focus:ring-orange-400"
                        value={filterModule}
                        onChange={(e) => setFilterModule(e.target.value)}
                      >
                        <option value="all">All Modules</option>
                        {modules.map((mod) => (
                          <option key={mod} value={mod}>
                            {mod}
                          </option>
                        ))}
                      </select>
                      <select
                        className="px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 dark:focus:ring-orange-400"
                        value={filterAssigned}
                        onChange={(e) => setFilterAssigned(e.target.value)}
                      >
                        <option value="all">All Status</option>
                        <option value="unassigned">Unassigned ({unassignedCount})</option>
                        <option value="assigned">Assigned</option>
                      </select>
                    </div>
                    {unassignedCount > 0 && (
                      <button
                        onClick={selectAllUnassigned}
                        className="w-full px-3 py-2 text-sm border border-orange-300 dark:border-orange-700 text-orange-600 dark:text-orange-400 rounded-lg hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors flex items-center justify-center gap-2"
                      >
                        <CheckSquare size={16} />
                        Select All Unassigned ({unassignedCount})
                      </button>
                    )}
                  </div>

                  {/* Permissions List */}
                  <div className="p-4 space-y-4 max-h-[500px] overflow-y-auto">
                    {Object.keys(filteredPermissionsByModule).length === 0 ? (
                      <div className="text-center py-12">
                        <Search size={48} className="mx-auto mb-4 text-gray-400 dark:text-gray-600" />
                        <p className="text-gray-500 dark:text-gray-400 font-medium mb-1">
                          No permissions found
                        </p>
                        <p className="text-sm text-gray-400 dark:text-gray-500">
                          Try adjusting your filters
                        </p>
                      </div>
                    ) : (
                      Object.keys(filteredPermissionsByModule).map((module) => {
                        const rolePerms = rolePermissions[selectedRole.id] || [];
                        const rolePermIds = new Set(rolePerms.map((p) => p.id));

                        return (
                          <div key={module} className="animate-fade-in">
                            <h4 className="font-semibold text-sm mb-3 text-gray-700 dark:text-gray-300 uppercase tracking-wide flex items-center gap-2">
                              <Package size={16} />
                              {module}
                            </h4>
                            <div className="space-y-2">
                              {filteredPermissionsByModule[module].map((perm) => {
                                const hasPermission = rolePermIds.has(perm.id);
                                const isSelected = selectedPermissions.has(perm.id);

                                return (
                                  <div
                                    key={perm.id}
                                    onClick={() => !hasPermission && togglePermissionSelection(perm.id)}
                                    className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-all cursor-pointer ${
                                      hasPermission
                                        ? "border-green-300 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 cursor-not-allowed"
                                        : isSelected
                                        ? "border-orange-500 bg-orange-50 dark:bg-orange-900/20 shadow-md"
                                        : "border-gray-200 dark:border-gray-700 hover:border-orange-300 hover:bg-orange-50/30 dark:hover:bg-orange-900/5"
                                    }`}
                                  >
                                    <div className="flex items-start gap-3">
                                      {/* Checkbox */}
                                      {!hasPermission && (
                                        <div className="flex-shrink-0 mt-0.5">
                                          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                                            isSelected
                                              ? "bg-orange-500 border-orange-500"
                                              : "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
                                          }`}>
                                            {isSelected && <Check size={14} className="text-white" />}
                                          </div>
                                        </div>
                                      )}
                                      
                                      {/* Content */}
                                      <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-start mb-1">
                                          <code className="text-sm font-mono font-semibold text-gray-900 dark:text-white">
                                            {perm.code}
                                          </code>
                                          {hasPermission && (
                                            <div className="flex items-center gap-1 text-xs font-medium text-green-700 dark:text-green-400 ml-2">
                                              <Check size={14} />
                                              Assigned
                                            </div>
                                          )}
                                        </div>
                                        {perm.description && (
                                          <p className="text-xs text-gray-600 dark:text-gray-400">
                                            {perm.description}
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-16 text-center h-full flex flex-col items-center justify-center">
              <div className="w-24 h-24 bg-gradient-to-br from-orange-100 to-orange-200 dark:from-orange-900/20 dark:to-orange-800/20 rounded-2xl flex items-center justify-center mb-6 shadow-inner">
                <Link2 size={48} className="text-orange-500 dark:text-orange-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Select a Role
              </h3>
              <p className="text-gray-600 dark:text-gray-400 max-w-sm">
                Click on a role from the list to view and manage its permissions
              </p>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes slide-in {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        @keyframes scale-in {
          from {
            transform: scale(0.95);
            opacity: 0;
          }
          to {
            transform: scale(1);
            opacity: 1;
          }
        }
        @keyframes fade-in {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        .animate-slide-in {
          animation: slide-in 0.3s ease-out;
        }
        .animate-scale-in {
          animation: scale-in 0.2s ease-out;
        }
        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}