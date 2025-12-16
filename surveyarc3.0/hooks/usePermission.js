
// ==================== 3. Permission Check Hook (hooks/usePermission.js) ====================
"use client";

import { useState, useEffect } from "react";
import { useRBAC } from "@/providers/RBACProvider";
import { useUser } from "@/providers/postGresPorviders/UserProvider";

export const usePermission = (permissionCode, orgId, scope = "org", resourceId) => {
  const { hasPermission } = useRBAC();
  const { user } = useUser();
  const [allowed, setAllowed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkPermission = async () => {
      if (!user?.uid || !permissionCode) {
        setAllowed(false);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const result = await hasPermission(
          user.uid,
          permissionCode,
          orgId,
          scope,
          resourceId
        );
        setAllowed(result);
      } catch (error) {
        console.error("Permission check failed:", error);
        setAllowed(false);
      } finally {
        setLoading(false);
      }
    };

    checkPermission();
  }, [user?.uid, permissionCode, orgId, scope, resourceId, hasPermission]);

  return { allowed, loading };
};
