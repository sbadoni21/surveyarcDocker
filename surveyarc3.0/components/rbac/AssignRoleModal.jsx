"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { useRBAC } from "@/providers/RBACProvider";

const ROLE_OPTIONS = [
  { name: "owner", scope: "org" },
  { name: "admin", scope: "org" },
  { name: "manager", scope: "group" },
  { name: "agent", scope: "group" },
  { name: "viewer", scope: "org" },
];

export default function AssignRoleModal({ userUid, orgId, onClose }) {
  const { assignRole, loading } = useRBAC();

  const [roleName, setRoleName] = useState("");
  const [scope, setScope] = useState("");
  const [resourceId, setResourceId] = useState("");

  const handleAssign = async () => {
    if (!roleName || !scope || !resourceId) return;

    await assignRole({
      userUid,
      roleName,
      scope,
      resourceId,
      orgId,
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-white w-full max-w-md rounded-lg shadow-lg">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold text-gray-900">Assign Role</h3>
          <button onClick={onClose}>
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4">
          <select
            className="w-full border rounded px-2 py-2 text-sm"
            value={roleName}
            onChange={(e) => {
              const r = ROLE_OPTIONS.find(x => x.name === e.target.value);
              setRoleName(r?.name || "");
              setScope(r?.scope || "");
            }}
          >
            <option value="">Select role</option>
            {ROLE_OPTIONS.map((r) => (
              <option key={r.name} value={r.name}>
                {r.name} ({r.scope})
              </option>
            ))}
          </select>

          <input
            className="w-full border rounded px-2 py-2 text-sm"
            placeholder="Resource ID (orgId / groupId / projectId)"
            value={resourceId}
            onChange={(e) => setResourceId(e.target.value)}
          />
        </div>

        {/* Footer */}
        <div className="p-4 border-t flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-2 text-sm border rounded"
          >
            Cancel
          </button>
          <button
            onClick={handleAssign}
            disabled={loading}
            className="px-4 py-2 text-sm bg-slate-700 text-white rounded disabled:opacity-50"
          >
            Assign
          </button>
        </div>
      </div>
    </div>
  );
}
