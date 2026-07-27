"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { useRBAC } from "@/providers/RBACProvider";
import {
  X,
  Shield,
  Loader2,
  UserPlus,
  Trash2,
  Plus,
  AlertCircle,
  CheckCircle,
  XCircle,
} from "lucide-react";

/* ----------------------------------
   Helpers
---------------------------------- */
const normalizeEffectivePerms = (data) => {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.effective_permissions)) return data.effective_permissions;
  if (Array.isArray(data.permissions)) return data.permissions;
  if (typeof data === "object") {
    return Object.keys(data).filter((k) => data[k] === true);
  }
  return [];
};

export default function UserAccessManager({ user, orgId, onClose }) {
  const {
    assignRole,
    removeRole,
    removeDenial,
    getEffectivePermissions,
    grantPermission,
    revokePermission,
    denyPermission,
    listCustomGrants,
    listDenials,
  } = useRBAC();

  /* ----------------------------------
     Local State (isolated from parent)
  ---------------------------------- */
  const [allRoles, setAllRoles] = useState([]);
  const [allPermissions, setAllPermissions] = useState([]);
  const [userRoles, setUserRoles] = useState([]);
  const [rolePermsMap, setRolePermsMap] = useState({});
  const [effectivePerms, setEffectivePerms] = useState([]);
  const [customGrants, setCustomGrants] = useState([]);
  const [denials, setDenials] = useState([]);
  const [selectedRole, setSelectedRole] = useState("");
  const [selectedPermission, setSelectedPermission] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
console.log(allRoles)
  // Add ref to prevent concurrent loads
  const isLoadingRef = useRef(false);

  /* ----------------------------------
     Load everything (isolated) - FIXED VERSION
  ---------------------------------- */
  const loadData = useCallback(async () => {
    if (!orgId || !user?.uid) return;
    
    // Prevent concurrent loads
    if (isLoadingRef.current) return;
    
    isLoadingRef.current = true;
    setLoading(true);
    
    try {
      // Fetch all data in parallel
      const [rolesRes, permsRes, userRolesRes, effPerms, grants, denies] = await Promise.all([
        fetch(`/api/post-gres-apis/rbac/roles?org_id=${orgId}&user=${user.uid}`, { cache: "no-store" }),
        fetch(`/api/post-gres-apis/rbac/permissions?orgId=${orgId}&user=${user.uid}`, { cache: "no-store" }),
        fetch(`/api/post-gres-apis/rbac/user/${user.uid}?org_id=${orgId}`, { cache: "no-store" }),
        getEffectivePermissions(user.uid, orgId),
        listCustomGrants(user.uid, orgId),
        listDenials(user.uid, orgId),
      ]);

      const roles = await rolesRes.json();
      const perms = await permsRes.json();
      const assignedRoles = await userRolesRes.json();

      // Fetch permissions for each role in parallel
      const rolePermPairs = await Promise.all(
        (assignedRoles || []).map(async (r) => {
          try {
            const res = await fetch(
              `/api/post-gres-apis/rbac/permissions/roles/${r.role_id}/permissions?user=${user.uid}`,
              { cache: "no-store" }
            );
            const data = await res.json();
            return [r.role_id, Array.isArray(data) ? data : []];
          } catch (err) {
            console.error(`Error loading perms for role ${r.role_id}:`, err);
            return [r.role_id, []];
          }
        })
      );

      setAllRoles(roles || []);
      setAllPermissions(perms || []);
      setUserRoles(assignedRoles || []);
      setRolePermsMap(Object.fromEntries(rolePermPairs));
      setEffectivePerms(normalizeEffectivePerms(effPerms));
      setCustomGrants(grants || []);
      setDenials(denies || []);
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
      isLoadingRef.current = false;
    }
  }, [user?.uid, orgId]); // REMOVED unstable function dependencies

  // Load data only once on mount or when user/org changes
  useEffect(() => {
    loadData();
  }, [user?.uid, orgId]); // ONLY depend on stable values

  /* ----------------------------------
     Refresh only effective permissions
  ---------------------------------- */
  const refreshEffective = useCallback(async () => {
    if (!user?.uid || !orgId) return;
    
    try {
      const [effPerms, grants, denies] = await Promise.all([
        getEffectivePermissions(user.uid, orgId),
        listCustomGrants(user.uid, orgId),
        listDenials(user.uid, orgId),
      ]);

      setEffectivePerms(normalizeEffectivePerms(effPerms));
      setCustomGrants(grants || []);
      setDenials(denies || []);
    } catch (error) {
      console.error("Error refreshing permissions:", error);
    }
  }, [user?.uid, orgId]); // REMOVED unstable function dependencies

  /* ----------------------------------
     Actions - Call RBAC functions directly
  ---------------------------------- */
const handleAssignRole = async () => {
  if (!selectedRole) return;

  if (userRoles.length > 0) {
    const current = userRoles[0]?.role_name;
    const ok = confirm(
      `This will replace the current role "${current}" with "${selectedRole}". Continue?`
    );
    if (!ok) return;
  }

  setActionLoading(true);
  try {
    await assignRole({
      userId: user.uid,
      roleName: selectedRole,
      scope: "org",
      resourceId: orgId,
      orgId,
    });

    await loadData();
    setSelectedRole("");
  } finally {
    setActionLoading(false);
  }
};

  const handleRemoveRole = async (r) => {
    if (!confirm(`Remove role "${r.role_name}" from this user?`)) return;

    setActionLoading(true);
    try {
      await removeRole({
        userId: user.uid,
        roleName: r.role_name,
        scope: r.scope,
        resourceId: orgId,
      });

      // Reload local data
      await loadData();
    } catch (error) {
      console.error("Error removing role:", error);
      alert("Failed to remove role");
    } finally {
      setActionLoading(false);
    }
  };

  const handleGrant = async () => {
    if (!selectedPermission) return;

    setActionLoading(true);
    try {
      await grantPermission({
        userId: user.uid,
        permissionCode: selectedPermission,
        scope: "org",
        resourceId: orgId,
      });

      await refreshEffective();
      setSelectedPermission("");
    } catch (error) {
      console.error("Error granting permission:", error);
      alert("Failed to grant permission");
    } finally {
      setActionLoading(false);
    }
  };
const handleRemoveDenial = async (code) => {
  if (!confirm(`Remove denial for "${code.permission_code}"?`)) return;

  setActionLoading(true);
  try {
    await removeDenial({
      userId: user.uid,
      permissionCode: code.permission_code,
      scope: code.scope,
      resourceId: orgId,
    });

    await refreshEffective();
  } catch (error) {
    console.error("Error removing denial:", error);
    alert("Failed to remove denial");
  } finally {
    setActionLoading(false);
  }
};

  const handleRevoke = async (code) => {
    if (!confirm(`Revoke permission "${code}"?`)) return;

    setActionLoading(true);
    try {
      await revokePermission({
        userId: user.uid,
        permissionCode: code,
        scope: "org",
        resourceId: orgId,
      });

      await refreshEffective();
    } catch (error) {
      console.error("Error revoking permission:", error);
      alert("Failed to revoke permission");
    } finally {
      setActionLoading(false);
    }
  };

 const handleDeny = async (code, role) => {
  if (!role) {
    alert("Cannot deny permission without a scope context.");
    return;
  }

  setActionLoading(true);
  try {
    await denyPermission({
      userId: user.uid,
      permissionCode: code,
      scope: role.scope,
      resourceId: role.resource_id,
      reason: "Manual deny",
    });

    await refreshEffective();
  } finally {
    setActionLoading(false);
  }
};


  /* ----------------------------------
     UI (unchanged)
  ---------------------------------- */
  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
        <div className="bg-white dark:bg-gray-900 rounded-xl p-8 shadow-2xl">
          <Loader2 className="animate-spin text-orange-500 mx-auto mb-4" size={40} />
          <p className="text-gray-600 dark:text-gray-400">Loading user access...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex justify-end">
      <div className="w-full max-w-2xl bg-white dark:bg-gray-900 h-full overflow-y-auto shadow-2xl animate-slide-in">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-gradient-to-r from-orange-500 to-orange-600 px-6 py-5 shadow-lg">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Shield size={24} />
                Access Management
              </h2>
              <p className="text-orange-100 text-sm mt-1">
                {user.email}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors text-white"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-8">
          {/* ================= ROLES ================= */}
          <section className="bg-gray-50 dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Shield size={20} className="text-orange-500" />
              Assigned Roles
            </h3>

            {userRoles.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <Shield size={32} className="mx-auto mb-2 opacity-50" />
                <p className="text-sm">No roles assigned yet</p>
              </div>
            ) : (
              <div className="space-y-3 mb-4">
                {userRoles.map((r) => (
                  <div
                    key={r.id}
                    className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden"
                  >
                    <div className="flex justify-between items-center bg-gray-100 dark:bg-gray-800 px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Shield size={16} className="text-blue-600 dark:text-blue-400" />
                        <span className="font-semibold text-gray-900 dark:text-white">
                          {r.role_name}
                        </span>
                        <span className="text-xs px-2 py-1 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded">
                          {r.scope}
                        </span>
                      </div>
                      <button
                        onClick={() => handleRemoveRole(r)}
                        disabled={actionLoading}
                        className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded text-red-600 dark:text-red-400 transition-colors disabled:opacity-50"
                        title="Remove role"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>

                    {rolePermsMap[r.role_id]?.length > 0 && (
                      <div className="px-4 py-3 space-y-1 overflow-x-scroll">
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                          Inherited Permissions:
                        </p>
                        {rolePermsMap[r.role_id].map((p) => (
                          <div key={p.id} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 ">
                            <CheckCircle size={12} className="text-green-600 dark:text-green-400" />
                            <code className="text-xs">{p.code}</code>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Assign Role */}
            <div className="flex gap-3">
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="flex-1 px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-orange-500 dark:focus:ring-orange-400 transition-colors"
                disabled={actionLoading}
              >
                <option value="">Select role to assign...</option>
                {allRoles
                  .filter((r) => !userRoles.some((ur) => ur.role_name === r.name))
                  .map((r) => (
                    <option key={r.id} value={r.name}>
                      {r.name} ({r.scope})
                    </option>
                  ))}
              </select>
              <button
                onClick={handleAssignRole}
                disabled={!selectedRole || actionLoading}
                className="px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {actionLoading ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <UserPlus size={18} />
                )}
                Assign
              </button>
            </div>
          </section>

          {/* ================= EFFECTIVE PERMS ================= */}
          <section className="bg-gray-50 dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Effective Permissions ({effectivePerms.length})
            </h3>

            {effectivePerms.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <AlertCircle size={32} className="mx-auto mb-2 opacity-50" />
                <p className="text-sm">No effective permissions</p>
              </div>
            ) : (
              <div className="space-y-2 mb-4 max-h-96 overflow-y-auto">
                {effectivePerms.map((p) => {
                  const denied = denials.some((d) => d.permission_code === p);
                  const custom = customGrants.some((g) => g.permission_code === p);
const roleSource = userRoles.find((r) =>
  rolePermsMap[r.role_id]?.some((rp) => rp.code === p)
);

                  return (
                    <div
                      key={p}
                      className="flex justify-between items-center bg-white dark:bg-gray-900 px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-700 group hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <code className="text-sm font-mono text-gray-900 dark:text-white">{p}</code>
                        {custom && (
                          <span className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 rounded">
                            custom
                          </span>
                        )}
                        {denied && (
                          <span className="text-xs px-2 py-0.5 bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded">
                            denied
                          </span>
                        )}
                      </div>

                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleRevoke(p)}
                          disabled={actionLoading}
                          className="text-xs px-2 py-1 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors disabled:opacity-50"
                        >
                          Revoke
                        </button>
                        <button
  onClick={() => handleDeny(p, roleSource)}
                          disabled={actionLoading}
                          className="text-xs px-2 py-1 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded transition-colors disabled:opacity-50"
                        >
                          Deny
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}


            {/* Grant Permission */}
            <div className="flex gap-3">
              <select
                value={selectedPermission}
                onChange={(e) => setSelectedPermission(e.target.value)}
                className="flex-1 px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-orange-500 dark:focus:ring-orange-400 transition-colors"
                disabled={actionLoading}
              >
                <option value="">Select permission to grant...</option>
                {allPermissions
                  .filter((p) => !effectivePerms.includes(p.code))
                  .map((p) => (
                    <option key={p.id} value={p.code}>
                      {p.code} - {p.description}
                    </option>
                  ))}
              </select>
              <button
                onClick={handleGrant}
                disabled={!selectedPermission || actionLoading}
                className="px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {actionLoading ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Plus size={18} />
                )}
                Grant
              </button>
            </div>
            
          </section>
          {/* ================= DENIALS ================= */}
<section className="bg-red-50 dark:bg-red-900/10 rounded-xl p-6 border border-red-200 dark:border-red-800">
  <h3 className="text-lg font-semibold text-red-700 dark:text-red-400 mb-4 flex items-center gap-2">
    <XCircle size={20} />
    Explicit Denials ({denials.length})
  </h3>

  {denials.length === 0 ? (
    <p className="text-sm text-gray-500 dark:text-gray-400">
      No explicit denials applied to this user.
    </p>
  ) : (
    <div className="space-y-3">
      {denials.map((d) => (
        <div
          key={d.permission_code}
          className="flex justify-between items-start bg-white dark:bg-gray-900 p-4 rounded-lg border border-red-200 dark:border-red-800"
        >
          <div className="space-y-1">
            <code className="text-sm font-mono text-gray-900 dark:text-white">
              {d.permission_code}
            </code>

            {d.reason && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Reason: {d.reason}
              </p>
            )}

            <p className="text-xs text-gray-400">
              Scope: {d.scope} | Resource: {d.resource_id}
            </p>
          </div>

          <button
            onClick={() => handleRemoveDenial(d)}
            disabled={actionLoading}
            className="text-xs px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded transition disabled:opacity-50"
          >
            Remove
          </button>
        </div>
      ))}
    </div>
  )}
</section>

        </div>
      </div>

      <style jsx>{`
        @keyframes slide-in {
          from {
            transform: translateX(100%);
          }
          to {
            transform: translateX(0);
          }
        }
        .animate-slide-in {
          animation: slide-in 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}