"use client";

import { useEffect, useState } from "react";
import {
  Shield,
  Loader2,
  Users,
  Key,
  Link2,
  AlertCircle,
} from "lucide-react";
import { useUser } from "@/providers/postGresPorviders/UserProvider";
import { useRBAC } from "@/providers/RBACProvider";
import { RolesTab } from "./RolesTab";
import { PermissionsTab } from "./PermissionsTab";
import { MappingsTab } from "./MappingsTab";

export default function RBACManagement({ orgId }) {
  const { user } = useUser();
  const { hasPermission } = useRBAC();
  const userId = user?.uid;

  const [activeTab, setActiveTab] = useState("roles");
  const [canManage, setCanManage] = useState(false);
  const [checkingPermission, setCheckingPermission] = useState(true);
  
  // Lift data state to parent to persist across tab changes
  const [rolesData, setRolesData] = useState({
    roles: [],
    loading: true,
    hasLoaded: false,
  });
  
  const [permissionsData, setPermissionsData] = useState({
    permissions: [],
    loading: true,
    hasLoaded: false,
  });
  
  const [mappingsData, setMappingsData] = useState({
    mappings: [],
    loading: true,
    hasLoaded: false,
  });

  // Check if user can manage RBAC
  useEffect(() => {
    async function checkAccess() {
      if (!userId || !orgId) return;
      
      const allowed = await hasPermission(
        userId,
        "rbac.manage_permissions",
        orgId,
        "org",
        orgId
      );
      
      setCanManage(allowed);
      setCheckingPermission(false);
    }
    
    checkAccess();
  }, [userId, orgId, hasPermission]);

  if (checkingPermission) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="animate-spin" size={40} />
      </div>
    );
  }

  if (!canManage) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
          <div className="flex items-center gap-3">
            <AlertCircle className="text-red-600 dark:text-red-400" size={24} />
            <div>
              <h2 className="font-semibold text-red-900 dark:text-red-100">Access Denied</h2>
              <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                You don't have permission to manage RBAC settings. Contact your organization owner.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Shield className="text-orange-500" size={32} />
          RBAC Management
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Manage roles, permissions, and access control for your organization
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700 mb-6">
        <button
          onClick={() => setActiveTab("roles")}
          className={`px-6 py-3 font-medium transition-colors flex items-center gap-2 ${
            activeTab === "roles"
              ? "border-b-2 border-orange-500 text-orange-600 dark:text-orange-400"
              : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
          }`}
        >
          <Users size={18} />
          Roles
        </button>
        <button
          onClick={() => setActiveTab("permissions")}
          className={`px-6 py-3 font-medium transition-colors flex items-center gap-2 ${
            activeTab === "permissions"
              ? "border-b-2 border-orange-500 text-orange-600 dark:text-orange-400"
              : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
          }`}
        >
          <Key size={18} />
          Permissions
        </button>
        <button
          onClick={() => setActiveTab("mappings")}
          className={`px-6 py-3 font-medium transition-colors flex items-center gap-2 ${
            activeTab === "mappings"
              ? "border-b-2 border-orange-500 text-orange-600 dark:text-orange-400"
              : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
          }`}
        >
          <Link2 size={18} />
          Role Permissions
        </button>
      </div>

      {/* Content - Pass data state and setters */}
      {activeTab === "roles" && (
        <RolesTab 
          orgId={orgId} 
          userId={userId} 
          data={rolesData}
          setData={setRolesData}
        />
      )}
      {activeTab === "permissions" && (
        <PermissionsTab 
          orgId={orgId} 
          userId={userId}
          data={permissionsData}
          setData={setPermissionsData}
        />
      )}
      {activeTab === "mappings" && (
        <MappingsTab 
          orgId={orgId} 
          userId={userId}
          data={mappingsData}
          setData={setMappingsData}
        />
      )}
    </div>
  );
}