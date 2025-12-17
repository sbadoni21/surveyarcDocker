

// ==================== 4. Protected Component Wrapper (components/rbac/ProtectedAction.jsx) ====================
"use client";

import React from "react";
import { usePermission } from "@/hooks/usePermission";
import { Loader2, Lock } from "lucide-react";

export const ProtectedAction = ({
  permission,
  orgId,
  scope = "org",
  resourceId ,
  children,
  fallback = null,
  showLock = false,
}) => {
  const { allowed, loading } = usePermission(permission, orgId, scope, resourceId);

  if (loading) {
    return fallback || <Loader2 className="animate-spin text-gray-400" size={16} />;
  }

  if (!allowed) {
    if (showLock) {
      return (
        <div className="inline-flex items-center gap-1 text-gray-400 text-sm">
          <Lock size={14} />
          <span>No permission</span>
        </div>
      );
    }
    return fallback;
  }

  return <>{children}</>;
};
