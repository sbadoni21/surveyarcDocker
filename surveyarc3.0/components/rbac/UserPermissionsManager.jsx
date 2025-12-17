// components/rbac/UserPermissionsManager.jsx
"use client";

import { useEffect, useState } from "react";
import { Shield, Plus, Trash2, Ban, CheckCircle, X, Loader2 } from "lucide-react";
import { useRBAC } from "@/providers/RBACProvider";
import { useUser } from "@/providers/postGresPorviders/UserProvider";

export default function UserPermissionsManager({  orgId }) {
  const { user: currentUser } = useUser();
  const {
    loading,
    getEffectivePermissions,
    listCustomGrants,
    listDenials,
    grantPermission,
    revokePermission,
    denyPermission,
    removeDenial,
  } = useRBAC();
  const userId = currentUser?.uid
  const [effectivePerms, setEffectivePerms] = useState(null);
  const [customGrants, setCustomGrants] = useState([]);
  const [denials, setDenials] = useState([]);
  const [allPermissions, setAllPermissions] = useState([]);
  const [showGrantModal, setShowGrantModal] = useState(false);
  const [showDenyModal, setShowDenyModal] = useState(false);
  const [localLoading, setLocalLoading] = useState(false);

  // Load data
  useEffect(() => {
    if (userId && orgId && currentUser?.uid) {
      loadData();
    }
  }, [userId, orgId, currentUser?.uid]);

  const loadData = async () => {
    setLocalLoading(true);
    try {
      // Load effective permissions
      const effective = await getEffectivePermissions(userId, orgId);
      setEffectivePerms(effective);

      // Load custom grants
      const grants = await listCustomGrants(userId, orgId, currentUser.uid);
      setCustomGrants(grants);

      // Load denials
      const denialsList = await listDenials(userId, orgId, currentUser.uid);
      setDenials(denialsList);

      // Load all available permissions
      const permsRes = await fetch(
        `/api/post-gres-apis/rbac/permissions?user=${currentUser.uid}`,
        { cache: "no-store" }
      );
      if (permsRes.ok) {
        const data = await permsRes.json();
        setAllPermissions(data || []);
      }
    } catch (error) {
      console.error("Error loading permissions:", error);
    } finally {
      setLocalLoading(false);
    }
  };

  const handleGrantPermission = async (permissionCode) => {
    try {
      await grantPermission({
        userId: userId,
        permissionCode: permissionCode,
        scope: "org",
        resourceId: orgId,
        grantedBy: currentUser.uid,
      });

      await loadData();
      setShowGrantModal(false);
    } catch (error) {
      alert(error.message || "Failed to grant permission");
    }
  };

  const handleRevokePermission = async (permissionCode) => {
    if (!confirm(`Revoke custom grant for "${permissionCode}"?`)) return;

    try {
      await revokePermission({
        userId: userId,
        permissionCode: permissionCode,
        scope: "org",
        resourceId: orgId,
        revokedBy: currentUser.uid,
      });

      await loadData();
    } catch (error) {
      alert(error.message || "Failed to revoke permission");
    }
  };

  const handleDenyPermission = async (permissionCode, reason) => {
    try {
      await denyPermission({
        userId: userId,
        permissionCode: permissionCode,
        scope: "org",
        resourceId: orgId,
        reason: reason,
        deniedBy: currentUser.uid,
      });

      await loadData();
      setShowDenyModal(false);
    } catch (error) {
      alert(error.message || "Failed to deny permission");
    }
  };

  const handleRemoveDenial = async (permissionCode) => {
    if (!confirm(`Remove denial for "${permissionCode}"?`)) return;

    try {
      await removeDenial({
        userId: userId,
        permissionCode: permissionCode,
        scope: "org",
        resourceId: orgId,
        removedBy: currentUser.uid,
      });

      await loadData();
    } catch (error) {
      alert(error.message || "Failed to remove denial");
    }
  };

  if (localLoading || loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="animate-spin text-orange-500" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Effective Permissions Summary */}
      <div className="bg-gradient-to-r from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-2">
          <Shield className="text-orange-600" size={20} />
          <h3 className="font-semibold text-lg dark:text-white">Effective Permissions</h3>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
          Total: {effectivePerms?.effective_permissions?.length || 0} permissions
        </p>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div className="bg-white dark:bg-gray-800 rounded p-3">
            <div className="text-gray-500 text-xs mb-1">From Roles</div>
            <div className="text-xl font-bold text-blue-600">
              {effectivePerms?.breakdown?.from_roles?.length || 0}
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded p-3">
            <div className="text-gray-500 text-xs mb-1">Custom Grants</div>
            <div className="text-xl font-bold text-green-600">
              {effectivePerms?.breakdown?.custom_grants?.length || 0}
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded p-3">
            <div className="text-gray-500 text-xs mb-1">Denials</div>
            <div className="text-xl font-bold text-red-600">
              {effectivePerms?.breakdown?.denials?.length || 0}
            </div>
          </div>
        </div>
      </div>

      {/* Custom Grants Section */}
      <div className="border rounded-lg p-4 dark:border-gray-700">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold flex items-center gap-2 dark:text-white">
            <CheckCircle className="text-green-600" size={18} />
            Custom Permission Grants
          </h3>
          <button
            onClick={() => setShowGrantModal(true)}
            className="px-3 py-1.5 bg-green-500 text-white rounded-lg text-sm flex items-center gap-1 hover:bg-green-600 transition-colors"
          >
            <Plus size={16} />
            Grant Permission
          </button>
        </div>

        {customGrants.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
            No custom grants
          </p>
        ) : (
          <div className="space-y-2">
            {customGrants.map((grant) => (
              <div
                key={grant.id}
                className="flex justify-between items-center p-3 bg-green-50 dark:bg-green-900/20 rounded border border-green-200 dark:border-green-800"
              >
                <div className="flex-1">
                  <div className="font-mono text-sm font-semibold dark:text-white">
                    {grant.permission_code}
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">
                    {grant.description || grant.module}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Granted by: {grant.granted_by || "System"}
                  </div>
                </div>
                <button
                  onClick={() => handleRevokePermission(grant.permission_code)}
                  className="p-2 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
                  title="Revoke"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Denials Section */}
      <div className="border rounded-lg p-4 dark:border-gray-700">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold flex items-center gap-2 dark:text-white">
            <Ban className="text-red-600" size={18} />
            Permission Denials
          </h3>
          <button
            onClick={() => setShowDenyModal(true)}
            className="px-3 py-1.5 bg-red-500 text-white rounded-lg text-sm flex items-center gap-1 hover:bg-red-600 transition-colors"
          >
            <Ban size={16} />
            Deny Permission
          </button>
        </div>

        {denials.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
            No denials
          </p>
        ) : (
          <div className="space-y-2">
            {denials.map((denial) => (
              <div
                key={denial.id}
                className="flex justify-between items-center p-3 bg-red-50 dark:bg-red-900/20 rounded border border-red-200 dark:border-red-800"
              >
                <div className="flex-1">
                  <div className="font-mono text-sm font-semibold dark:text-white">
                    {denial.permission_code}
                  </div>
                  {denial.reason && (
                    <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                      Reason: {denial.reason}
                    </div>
                  )}
                  <div className="text-xs text-gray-500 mt-1">
                    Denied by: {denial.denied_by || "System"}
                  </div>
                </div>
                <button
                  onClick={() => handleRemoveDenial(denial.permission_code)}
                  className="p-2 text-green-600 hover:bg-green-100 dark:hover:bg-green-900/30 rounded transition-colors"
                  title="Remove denial"
                >
                  <CheckCircle size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Grant Permission Modal */}
      {showGrantModal && (
        <GrantPermissionModal
          allPermissions={allPermissions}
          onGrant={handleGrantPermission}
          onClose={() => setShowGrantModal(false)}
        />
      )}

      {/* Deny Permission Modal */}
      {showDenyModal && (
        <DenyPermissionModal
          allPermissions={allPermissions}
          onDeny={handleDenyPermission}
          onClose={() => setShowDenyModal(false)}
        />
      )}
    </div>
  );
}

// Grant Permission Modal Component
function GrantPermissionModal({ allPermissions, onGrant, onClose }) {
  const [selectedPermission, setSelectedPermission] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!selectedPermission) {
      alert("Please select a permission");
      return;
    }
    setSubmitting(true);
    try {
      await onGrant(selectedPermission);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-md w-full mx-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold dark:text-white">Grant Custom Permission</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2 dark:text-gray-300">Select Permission</label>
            <select
              value={selectedPermission}
              onChange={(e) => setSelectedPermission(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            >
              <option value="">-- Choose a permission --</option>
              {allPermissions.map((perm) => (
                <option key={perm.code} value={perm.code}>
                  {perm.code} - {perm.description || perm.module}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-2 justify-end">
            <button
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 border rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 dark:border-gray-600 dark:text-white disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 flex items-center gap-2"
            >
              {submitting && <Loader2 className="animate-spin" size={16} />}
              Grant Permission
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Deny Permission Modal Component
function DenyPermissionModal({ allPermissions, onDeny, onClose }) {
  const [selectedPermission, setSelectedPermission] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!selectedPermission) {
      alert("Please select a permission");
      return;
    }
    setSubmitting(true);
    try {
      await onDeny(selectedPermission, reason);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-md w-full mx-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold dark:text-white">Deny Permission</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2 dark:text-gray-300">Select Permission</label>
            <select
              value={selectedPermission}
              onChange={(e) => setSelectedPermission(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            >
              <option value="">-- Choose a permission --</option>
              {allPermissions.map((perm) => (
                <option key={perm.code} value={perm.code}>
                  {perm.code} - {perm.description || perm.module}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 dark:text-gray-300">Reason (Optional)</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why is this permission being denied?"
              className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              rows={3}
            />
          </div>

          <div className="flex gap-2 justify-end">
            <button
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 border rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 dark:border-gray-600 dark:text-white disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 flex items-center gap-2"
            >
              {submitting && <Loader2 className="animate-spin" size={16} />}
              Deny Permission
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}