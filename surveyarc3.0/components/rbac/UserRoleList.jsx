import { Trash2 } from "lucide-react";
import { useRBAC } from "@/providers/RBACProvider";
import RoleBadge from "./RoleBadge";

export default function UserRoleList({ userUid }) {
  const { userRoles, removeRole, loading } = useRBAC();

  if (loading) {
    return <div className="text-sm text-gray-500">Loading roles…</div>;
  }

  if (!userRoles.length) {
    return (
      <div className="text-sm text-gray-500 border border-dashed rounded p-4">
        No roles assigned
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {userRoles.map((r) => (
        <div
          key={r.id}
          className="flex items-center justify-between p-3 bg-gray-50 border rounded-md"
        >
          <div className="space-y-1">
            <RoleBadge role={r.roleName} scope={r.scope} />
            <div className="text-xs text-gray-600">
              Resource: <span className="font-mono">{r.resourceId}</span>
            </div>
          </div>

          <button
            onClick={() =>
              removeRole({
                userUid,
                roleName: r.roleName,
                scope: r.scope,
                resourceId: r.resourceId,
              })
            }
            className="p-2 text-red-600 hover:bg-red-50 rounded"
            title="Remove role"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
