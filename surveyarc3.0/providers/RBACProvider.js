// ==================== 1. RBAC Provider (providers/RBACProvider.jsx) ====================
"use client";

import React, {
  createContext,
  useContext,
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";

const RBACCtx = createContext(null);

export const RBACProvider = ({ children }) => {
  const [loading, setLoading] = useState(false);
  const [userRoles, setUserRoles] = useState([]);

  const cacheRef = useRef(new Map());

  // ----------------------------------
  // Cache helpers
  // ----------------------------------
  const invalidateCache = useCallback((userId) => {
    if (!userId) {
      cacheRef.current.clear();
    } else {
      cacheRef.current.delete(`roles:${userId}`);
    }
  }, []);

  // ----------------------------------
  // Load roles for user
  // ----------------------------------
  const listUserRoles = useCallback(async (userId, orgId) => {
    if (!userId) return [];

    const key = `roles:${userId}:${orgId || 'global'}`;
    if (cacheRef.current.has(key)) {
      return cacheRef.current.get(key);
    }

    setLoading(true);
    try {
      const res = await fetch(
        `/api/post-gres-apis/rbac/user/${encodeURIComponent(userId)}?org_id=${orgId || ''}`,
        { cache: "no-store" }
      );
      
      if (!res.ok) {
        throw new Error(`Failed to load roles: ${res.statusText}`);
      }

      const roles = await res.json();
      cacheRef.current.set(key, roles);
      setUserRoles(roles);
      return roles;
    } catch (error) {
      console.error("Error loading user roles:", error);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // ----------------------------------
  // Assign role
  // ----------------------------------
  const assignRole = useCallback(async (data) => {
    setLoading(true);
    try {
      const body = {
        user_uid: data.userId,
        role_name: data.roleName,
        scope: data.scope,
        resource_id: data.resourceId,
        org_id: data.orgId || null,
      };

      const res = await fetch(`/api/post-gres-apis/rbac/assign-role`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        cache: "no-store",
      });

      if (!res.ok) {
        const error = await res.text();
        throw new Error(error || "Failed to assign role");
      }

      const result = await res.json();

      // Refresh roles
      await listUserRoles(data.userId, data.orgId);
      invalidateCache(data.userId);

      return result;
    } catch (error) {
      console.error("Error assigning role:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [listUserRoles, invalidateCache]);

  // ----------------------------------
  // Remove role
  // ----------------------------------
  const removeRole = useCallback(async (data) => {
    setLoading(true);
    try {
      const body = {
        user_uid: data.userId,
        role_name: data.roleName,
        scope: data.scope,
        resource_id: data.resourceId,
      };

      const res = await fetch(`/api/post-gres-apis/rbac/remove-role`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        cache: "no-store",
      });

      if (!res.ok) {
        throw new Error("Failed to remove role");
      }

      setUserRoles((prev) =>
        prev.filter(
          (r) =>
            !(
              r.user_uid === data.userId &&
              r.role_name === data.roleName &&
              r.scope === data.scope &&
              r.resource_id === data.resourceId
            )
        )
      );

      invalidateCache(data.userId);
      return true;
    } catch (error) {
      console.error("Error removing role:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [invalidateCache]);

  // ----------------------------------
  // Check permission
  // ----------------------------------
  const hasPermission = useCallback(async (userId, permissionCode, orgId, scope, resourceId) => {
    try {

      const params = new URLSearchParams({
        user_id: userId,
        permission_code: permissionCode,
        org_id: orgId || '',
        scope: scope || 'org',
        resource_id: resourceId || '',
      });
console.log(params)
      const res = await fetch(
        `/api/post-gres-apis/rbac/check-permission?${params}`,
        { cache: "no-store" }
      );

      if (!res.ok) return false;

      const result = await res.json();
      return result.allowed || false;
    } catch (error) {
      console.error("Error checking permission:", error);
      return false;
    }
  }, []);

  // ----------------------------------
  // Provider value
  // ----------------------------------
  const value = useMemo(
    () => ({
      loading,
      userRoles,
      listUserRoles,
      assignRole,
      removeRole,
      hasPermission,
      invalidateCache,
    }),
    [
      loading,
      userRoles,
      listUserRoles,
      assignRole,
      removeRole,
      hasPermission,
      invalidateCache,
    ]
  );

  return <RBACCtx.Provider value={value}>{children}</RBACCtx.Provider>;
};

// ----------------------------------
// Hook
// ----------------------------------
export const useRBAC = () => {
  const ctx = useContext(RBACCtx);
  if (!ctx) throw new Error("useRBAC must be used inside RBACProvider");
  return ctx;
};