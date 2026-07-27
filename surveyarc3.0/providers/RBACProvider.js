// providers/RBACProvider.jsx
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
  const [effectivePermSet, setEffectivePermSet] = useState(new Set());
  const [permissionsLoaded, setPermissionsLoaded] = useState(false);

  const cacheRef = useRef(new Map());
  const activePermissionsKeyRef = useRef(null);

  // CRITICAL: Track what we're currently loading to prevent duplicates
  const loadingKeysRef = useRef(new Set());

  // ----------------------------------
  // Cache helpers
  // ----------------------------------
  const invalidateCache = useCallback((userId) => {
    if (!userId) {
      cacheRef.current.clear();
      activePermissionsKeyRef.current = null;
      setEffectivePermSet(new Set());
      setPermissionsLoaded(false);
    } else {
      cacheRef.current.delete(`roles:${userId}`);
      Array.from(cacheRef.current.keys()).forEach((key) => {
        if (key.startsWith(`permissions:${userId}`) || key.startsWith(`effective:${userId}`)) {
          cacheRef.current.delete(key);
        }
      });
      if (
        activePermissionsKeyRef.current &&
        activePermissionsKeyRef.current.includes(`:${userId}:`)
      ) {
        activePermissionsKeyRef.current = null;
        setEffectivePermSet(new Set());
        setPermissionsLoaded(false);
      }
    }
  }, []);

  // ==================================================
  // ROLE MANAGEMENT
  // ==================================================

  const listUserRoles = useCallback(async (userId, orgId) => {
    if (!userId) return [];

    const key = `roles:${userId}:${orgId || 'global'}`;
    if (cacheRef.current.has(key)) {
      return cacheRef.current.get(key);
    }

    // Prevent duplicate requests
    if (loadingKeysRef.current.has(key)) {
      console.log("[RBAC] Already loading roles, skipping:", key);
      return [];
    }

    loadingKeysRef.current.add(key);
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
      loadingKeysRef.current.delete(key);
    }
  }, []);

  const assignRole = useCallback(async (data) => {
    setLoading(true);
    try {
      const body = {
        user_uid: data.userId,
        role_name: data.roleName,
        created_by: data.createdBy || null,
        scope: data.scope,
        resource_id: data.resourceId,
        org_id: data.orgId || null,
        is_creating_org: data.isCreatingOrg || false,
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

      if (!data.isCreatingOrg) {
        await listUserRoles(data.userId, data.orgId);
      }
      
      invalidateCache(data.userId);
      return result;
    } catch (error) {
      console.error("[RBAC] Error assigning role:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [listUserRoles, invalidateCache]);

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

  const hasPermission = useCallback(async (userId, permissionCode, orgId, scope, resourceId) => {
    try {
      const params = new URLSearchParams({
        user_id: userId,
        permission_code: permissionCode,
        org_id: orgId || '',
        scope: scope || 'org',
        resource_id: resourceId || '',
      });
      
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

  // ==================================================
  // USER PERMISSIONS CRUD
  // ==================================================

  const getEffectivePermissions = useCallback(async (userId, orgId, scope = null, resourceId = null) => {
    if (!userId || !orgId) return null;

    const key = `effective:${userId}:${orgId}`;
    
    // Check cache first
    if (cacheRef.current.has(key)) {
      return cacheRef.current.get(key);
    }

    // Prevent duplicate requests
    if (loadingKeysRef.current.has(key)) {
      return null;
    }

    loadingKeysRef.current.add(key);
    setLoading(true);
    
    try {
      const params = new URLSearchParams({
        org_id: orgId,
        user: userId,
      });
      
      if (scope) params.set("scope", scope);
      if (resourceId) params.set("resource_id", resourceId);

      const res = await fetch(
        `/api/post-gres-apis/rbac/user-permissions/user/${userId}/effective?${params}`,
        { cache: "no-store" }
      );

      if (!res.ok) {
        throw new Error(`Failed to load effective permissions: ${res.statusText}`);
      }

      const data = await res.json();
      cacheRef.current.set(key, data);
      return data;
    } catch (error) {
      console.error("Error loading effective permissions:", error);
      return null;
    } finally {
      setLoading(false);
      loadingKeysRef.current.delete(key);
    }
  }, []);

  const loadEffectivePermissions = useCallback(
    async (userId, orgId, scope = null, resourceId = null) => {
      const requestKey = `effective:${userId}:${orgId}`;

      if (
        permissionsLoaded &&
        activePermissionsKeyRef.current === requestKey
      ) {
        return effectivePermSet;
      }

      const data = await getEffectivePermissions(userId, orgId, scope, resourceId);

      if (!data) {
        activePermissionsKeyRef.current = requestKey;
        setEffectivePermSet(new Set());
        setPermissionsLoaded(true);
        return;
      }
      const permissions = Array.isArray(data)
        ? data
        : data.effective_permissions || data.permissions || [];
      activePermissionsKeyRef.current = requestKey;
      setEffectivePermSet(new Set(permissions));
      setPermissionsLoaded(true);
    },
    [effectivePermSet, getEffectivePermissions, permissionsLoaded]
  );

  const listCustomGrants = useCallback(async (userId, orgId, currentUserId) => {
    if (!userId || !orgId) return [];

    const key = `grants:${userId}:${orgId}`;
    if (loadingKeysRef.current.has(key)) {
      console.log("[RBAC] Already loading custom grants, skipping");
      return [];
    }

    loadingKeysRef.current.add(key);
    setLoading(true);
    
    try {
      const params = new URLSearchParams({
        org_id: orgId,
        user: currentUserId || userId,
      });

      const res = await fetch(
        `/api/post-gres-apis/rbac/user-permissions/user/${userId}/custom-grants?${params}`,
        { cache: "no-store" }
      );

      if (!res.ok) {
        throw new Error(`Failed to load custom grants: ${res.statusText}`);
      }

      const data = await res.json();
      return data.custom_grants || [];
    } catch (error) {
      console.error("Error loading custom grants:", error);
      return [];
    } finally {
      setLoading(false);
      loadingKeysRef.current.delete(key);
    }
  }, []);

  const listDenials = useCallback(async (userId, orgId, currentUserId) => {
    if (!userId || !orgId) return [];

    const key = `denials:${userId}:${orgId}`;
    if (loadingKeysRef.current.has(key)) {
      console.log("[RBAC] Already loading denials, skipping");
      return [];
    }

    loadingKeysRef.current.add(key);
    setLoading(true);
    
    try {
      const params = new URLSearchParams({
        org_id: orgId,
        user: currentUserId || userId,
      });

      const res = await fetch(
        `/api/post-gres-apis/rbac/user-permissions/user/${userId}/denials?${params}`,
        { cache: "no-store" }
      );

      if (!res.ok) {
        throw new Error(`Failed to load denials: ${res.statusText}`);
      }

      const data = await res.json();
      return data.denials || [];
    } catch (error) {
      console.error("Error loading denials:", error);
      return [];
    } finally {
      setLoading(false);
      loadingKeysRef.current.delete(key);
    }
  }, []);

  const grantPermission = useCallback(async (data) => {
    setLoading(true);
    try {
      const body = {
        user_uid: data.userId,
        permission_code: data.permissionCode,
        scope: data.scope || "org",
        resource_id: data.resourceId,
        user_id: data.grantedBy,
      };

      const res = await fetch(`/api/post-gres-apis/rbac/user-permissions/grant`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        cache: "no-store",
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.detail || "Failed to grant permission");
      }

      const result = await res.json();
      invalidateCache(data.userId);
      return result;
    } catch (error) {
      console.error("Error granting permission:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [invalidateCache]);

  const revokePermission = useCallback(async (data) => {
    setLoading(true);
    try {
      const body = {
        user_uid: data.userId,
        permission_code: data.permissionCode,
        scope: data.scope || "org",
        resource_id: data.resourceId,
        user_id: data.revokedBy,
      };

      const res = await fetch(`/api/post-gres-apis/rbac/user-permissions/revoke`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        cache: "no-store",
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.detail || "Failed to revoke permission");
      }

      const result = await res.json();
      invalidateCache(data.userId);
      return result;
    } catch (error) {
      console.error("Error revoking permission:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [invalidateCache]);

  const denyPermission = useCallback(async (data) => {
    setLoading(true);
    try {
      const body = {
        user_uid: data.userId,
        permission_code: data.permissionCode,
        scope: data.scope || "org",
        resource_id: data.resourceId,
        reason: data.reason || null,
        user_id: data.deniedBy,
      };

      const res = await fetch(`/api/post-gres-apis/rbac/user-permissions/deny`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        cache: "no-store",
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.detail || "Failed to deny permission");
      }

      const result = await res.json();
      invalidateCache(data.userId);
      return result;
    } catch (error) {
      console.error("Error denying permission:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [invalidateCache]);

  const removeDenial = useCallback(async (data) => {
    setLoading(true);
    try {
      const body = {
        user_uid: data.userId,
        permission_code: data.permissionCode,
        scope: data.scope || "org",
        resource_id: data.resourceId,
        user_id: data.removedBy,
      };

      const res = await fetch(`/api/post-gres-apis/rbac/user-permissions/remove-denial`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        cache: "no-store",
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.detail || "Failed to remove denial");
      }

      const result = await res.json();
      invalidateCache(data.userId);
      return result;
    } catch (error) {
      console.error("Error removing denial:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [invalidateCache]);

  const hasCapability = useCallback(
    (permissionCode) => effectivePermSet.has(permissionCode),
    [effectivePermSet]
  );

  const value = useMemo(
    () => ({
      loading,
      userRoles,
      listUserRoles,
      assignRole,
      removeRole,
      hasPermission,
      permissionsLoaded,
      getEffectivePermissions,
      listCustomGrants,
      listDenials,
      grantPermission,
      revokePermission,
      denyPermission,
      removeDenial,
      effectivePermSet,
      invalidateCache,
      loadEffectivePermissions,
      hasCapability,
    }),
    [
      loading,
      userRoles,
      listUserRoles,
      assignRole,
      removeRole,
      hasPermission,
      permissionsLoaded,
      getEffectivePermissions,
      listCustomGrants,
      listDenials,
      grantPermission,
      revokePermission,
      denyPermission,
      removeDenial,
      effectivePermSet,
      invalidateCache,
      loadEffectivePermissions,
      hasCapability,
    ]
  );

  return <RBACCtx.Provider value={value}>{children}</RBACCtx.Provider>;
};

export const  useRBAC = () => {
  const ctx = useContext(RBACCtx);
  if (!ctx) throw new Error("useRBAC must be used inside RBACProvider");
  return ctx;
};
