"use client";
import React, { useState, useEffect, useMemo } from "react";
import {
  LayoutDashboard,
  FolderOpen,
  Users,
  CheckCheckIcon,
  Settings,
  LogOut,
  Menu,
  X,
  Building2,
  Contact2,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { deleteCookie, getCookie } from "cookies-next";
import { useUser } from "@/providers/postGresPorviders/UserProvider";
import { useRBAC } from "@/providers/RBACProvider";
import { useOrganisation } from "@/providers/postGresPorviders/organisationProvider";

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useUser();
  const { organisation } = useOrganisation();
  const {
    loading: rbacLoading,
    hasCapability,
    permissionsLoaded,
    effectivePermSet
  } = useRBAC();
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [activeItem, setActiveItem] = useState("Dashboard");
  const [orgName, setOrgName] = useState("");
  const [orgHoverTitle, setOrgHoverTitle] = useState("");
    const { orgId, language } = useMemo(() => {
    const segs = pathname.split("/").filter(Boolean);
    const lang = segs[0] || "en";
    const idFromPath = segs.at(2);
    const id =
      idFromPath ||
      (getCookie("currentOrgId") ? String(getCookie("currentOrgId")) : "");
    return { orgId: id, language: lang };
  }, [pathname]);


  // ===== Compute userRole for tickets path =====
  const userRole = useMemo(() => {
    if (!user) return "agent";

    const currentUid = String(user?.uid || user?.user_id || user?.id || "");
    const currentEmail = String(user?.email || "").toLowerCase();
    const orgMembers = Array.isArray(organisation?.team_members)
      ? organisation.team_members
      : [];

    const orgMember = orgMembers.find((member) => {
      const memberUid = String(member?.uid || member?.user_id || member?.id || "");
      const memberEmail = String(member?.email || "").toLowerCase();
      return (
        (currentUid && memberUid === currentUid) ||
        (currentEmail && memberEmail === currentEmail)
      );
    });

    const orgRoles =
      user.meta_data?.org_roles ||
      user.metaData?.org_roles ||
      user.meta_data?.orgRoles ||
      user.metaData?.orgRoles ||
      {};

    const orgSpecificRole =
      (orgId && (orgRoles[String(orgId)] || orgRoles[orgId])) || null;

    const baseRole = orgMember?.role || orgSpecificRole || user.role || "agent";
    return String(baseRole).toLowerCase();
  }, [user, orgId, organisation]);

  const hasAnyEffectivePermissions = effectivePermSet?.size > 0;
  const useLegacyRoleFallback =
    permissionsLoaded && !rbacLoading && !hasAnyEffectivePermissions;

  // Permission states
  const permissions = useMemo(() => ({
    canViewDashboard:
      hasCapability("project.read") ||
      (useLegacyRoleFallback &&
        ["owner", "admin", "manager", "member", "team_lead", "agent", "user"].includes(userRole)),
    canViewProjects:
      hasCapability("project.read") ||
      (useLegacyRoleFallback &&
        ["owner", "admin", "manager", "member"].includes(userRole)),
    canViewTickets:
      hasCapability("support.group.read") ||
      hasCapability("support.team.read") ||
      (useLegacyRoleFallback &&
        ["owner", "admin", "manager", "team_lead", "agent", "user"].includes(
          userRole
        )),
    canViewContacts:
      hasCapability("support.member.add") ||
      (useLegacyRoleFallback &&
        ["owner", "admin", "manager"].includes(userRole)),
    canViewTeam:
      hasCapability("rbac.view_assignments") ||
      (useLegacyRoleFallback && ["owner", "admin"].includes(userRole)),
    canViewRolesandPermissions:
      hasCapability("rbac.view_permissions") ||
      (useLegacyRoleFallback && ["owner", "admin"].includes(userRole)),
    canViewSettings:
      hasCapability("billing.view") ||
      (useLegacyRoleFallback && ["owner", "admin"].includes(userRole)),
  }), [hasCapability, useLegacyRoleFallback, userRole]);

  // Helper function to get tickets path based on role
  const getOrgTicketsPath = useMemo(() => {
    const roleMap = {
      owner: "business-calendars",
      admin: "business-calendars",
      manager: "business-calendars",
      team_lead: "my-group-tickets",
      agent: "agent-tickets",
      user: "agent-tickets",
    };
    return `org-tickets/${roleMap[userRole] || "agent-tickets"}`;
  }, [userRole]);

  // =========================
  //      MENU ITEMS LOGIC (RBAC-BASED)
  // =========================
  const menuItems = useMemo(() => {
    if (!permissionsLoaded) {
      return [];
    }

    const items = [];

    // Dashboard - show if user has any project read permission
    if (permissions.canViewDashboard) {
      items.push({
        icon: LayoutDashboard,
        label: "Dashboard",
        path: "",
      });
    }

    // Survey Management - project.read permission
    if (permissions.canViewProjects) {
      items.push({
        icon: FolderOpen,
        label: "Survey Management",
        path: "projects",
      });
    }

    // Tickets Management - support.group.read or support.team.read
    if (permissions.canViewTickets) {
      items.push({
        icon: Building2,
        label: "Tickets Management",
        path: getOrgTicketsPath,
      });
    }

    // Roles & Permissions
    if (permissions.canViewRolesandPermissions) {
      items.push({
        icon: CheckCheckIcon,
        label: "Roles & Permissions",
        path: "roles-permissions",
      });
    }

    // Contacts Management - support.member.add permission
    if (permissions.canViewContacts) {
      items.push({
        icon: Contact2,
        label: "Contacts Management",
        path: "contacts",
      });
    }

    // Team - rbac.view_assignments permission
    if (permissions.canViewTeam) {
      items.push({
        icon: Users,
        label: "Team",
        path: "team",
      });
    }

    // Settings - billing.view permission
    if (permissions.canViewSettings) {
      items.push({
        icon: Settings,
        label: "Settings",
        path: "settings",
      });
    }

    return items;
  }, [permissions, permissionsLoaded, getOrgTicketsPath]);

  const getActiveItemFromPath = useMemo(() => {
    return (currentPath) => {
      const parts = currentPath.split("/").filter(Boolean);
      const dashboardIdx = parts.findIndex((p) => p === "dashboard");
      
      if (dashboardIdx === -1) return "Dashboard";
      if (dashboardIdx === parts.length - 1) return "Dashboard";

      const segment = parts[dashboardIdx + 1];

      if (segment === "org-tickets") return "Tickets Management";

      const match = menuItems.find((m) => m.path.startsWith(segment));
      return match ? match.label : "Dashboard";
    };
  }, [menuItems]);

  useEffect(() => {
    setActiveItem(getActiveItemFromPath(pathname));
  }, [pathname, getActiveItemFromPath]);

  const toggleSidebar = () => setIsCollapsed((v) => !v);
  const toggleMobile = () => setIsMobileOpen((v) => !v);

  const handleLogout = () => {
    deleteCookie("currentUserId");
    deleteCookie("currentOrgId");
    router.push("/login");
  };

  const handleItemClick = (item) => {
    const path = item.path
      ? `/${language}/postgres-org/${orgId}/dashboard/${item.path}`
      : `/${language}/postgres-org/${orgId}/dashboard`;
    router.push(path);
    setIsMobileOpen(false);
  };

  // Show loading state while permissions are being checked
  const isLoading = !user?.uid || !permissionsLoaded || rbacLoading;

  return (
    <>
      <div className="z-10">
        {/* MOBILE TOGGLER */}
        <button
          onClick={toggleMobile}
          className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-orange-500 text-white rounded-lg shadow-lg hover:bg-orange-600 transition-colors"
        >
          {isMobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>

        {isMobileOpen && (
          <div
            className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
            onClick={toggleMobile}
          />
        )}

        {/* SIDEBAR */}
        <div
          className={`
          fixed left-0 top-0 h-full bg-white dark:bg-[#1A1A1E] shadow-lg
          transition-all duration-300 ease-in-out z-40
          ${isCollapsed ? "w-16" : "w-64"}
          ${isMobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        `}
        >
          {/* HEADER */}
          <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800 h-16">
            {!isCollapsed && (
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
                  <div className="w-4 h-4 bg-white rounded-sm"></div>
                </div>
                <span
                  className="font-semibold text-[#74727E] dark:text-gray-300 text-sm leading-4 truncate"
                  title={orgHoverTitle}
                >
                  {orgName || "Organisation"}
                </span>
              </div>
            )}

            <button
              onClick={toggleSidebar}
              className="hidden lg:flex p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-md transition-colors"
              aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              <Menu size={16} />
            </button>
          </div>

          {/* NAVIGATION */}
          <nav className="flex-1 px-2 pt-4 pb-2 overflow-y-auto max-h-[calc(100vh-4rem)]">
            {isLoading ? (
              // Loading state
              <div className="flex flex-col items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
                {!isCollapsed && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">
                    Loading permissions...
                  </p>
                )}
              </div>
            ) : menuItems.length === 0 ? (
              // No permissions state
              !isCollapsed && (
                <div className="flex flex-col items-center justify-center py-8 px-4">
                  <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
                    No menu items available. Please contact your administrator.
                  </p>
                </div>
              )
            ) : (
              // Menu items
              <ul className="space-y-1">
                {menuItems.map((item, index) => {
                  const IconComp = item.icon;
                  const isActive = activeItem === item.label;
                  return (
                    <li key={index} className="relative">
                      {isActive && (
                        <span className="absolute z-30 -left-2 top-1 bottom-1 w-1 bg-orange-500 rounded-r-md" />
                      )}

                      <button
                        onClick={() => handleItemClick(item)}
                        className={`
                        relative z-10 flex w-[90%] mx-auto items-center space-x-3 rounded-lg p-3 pl-5 text-left transition-all duration-200
                        ${
                          isActive
                            ? "bg-[#FFB5733B] text-orange-600 dark:bg-orange-900/30 dark:text-orange-400"
                            : "text-[#74727E] dark:text-gray-400 hover:bg-[#FFB5733B] dark:hover:bg-orange-900/30 hover:text-orange-600 dark:hover:text-orange-400"
                        }
                        ${isCollapsed ? "justify-center px-2" : ""}
                      `}
                        title={isCollapsed ? item.label : ""}
                        aria-label={item.label}
                      >
                        <IconComp
                          size={20}
                          className={`flex-shrink-0 ${
                            isActive
                              ? "text-orange-500 dark:text-orange-400"
                              : ""
                          }`}
                        />
                        {!isCollapsed && (
                          <span className="font-semibold text-sm">
                            {item.label}
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}

                {/* LOGOUT BUTTON */}
                <li className="pt-2 border-t border-gray-100 dark:border-gray-800 mt-2">
                  <button
                    onClick={handleLogout}
                    className={`
                    w-[90%] mx-auto flex items-center space-x-3 p-3 rounded-lg transition-all duration-200 text-left
                    text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20
                    ${isCollapsed ? "justify-center px-2" : "pl-5"}
                  `}
                    title={isCollapsed ? "Log out" : ""}
                    aria-label="Log out"
                  >
                    <LogOut size={20} className="flex-shrink-0" />
                    {!isCollapsed && (
                      <span className="font-medium text-sm">Log out</span>
                    )}
                  </button>
                </li>
              </ul>
            )}
          </nav>
        </div>

        {/* SPACER */}
        <div
          className={`hidden lg:block transition-all duration-300 ${
            isCollapsed ? "w-16" : "w-64"
          }`}
        />
      </div>
    </>
  );
}
