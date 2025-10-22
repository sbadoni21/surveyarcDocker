"use client";
import React, { useState, useEffect, useMemo } from "react";
import {
  LayoutDashboard,
  FolderOpen,
  Users,
  Settings,
  LogOut,
  Menu,
  Ticket,
  X,
  Building2,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { deleteCookie, getCookie } from "cookies-next";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/firebase/firebase";
import { useUser } from "@/providers/postGresPorviders/UserProvider";

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useUser(); // Get user from UserProvider - must be at top level
  
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [activeItem, setActiveItem] = useState("Dashboard");
  const [orgName, setOrgName] = useState("");
  const [orgHoverTitle, setOrgHoverTitle] = useState("");

  // Derive orgId and language from route
  const { orgId, language } = useMemo(() => {
    const segs = pathname.split("/").filter(Boolean);
    const lang = segs[0] || 'en'; // First segment is language
    const idFromPath = segs.at(2); // Third segment after postgres-org
    const id = idFromPath || (getCookie("currentOrgId") ? String(getCookie("currentOrgId")) : "");
    return { orgId: id, language: lang };
  }, [pathname]);

  useEffect(() => {
    let cancelled = false;

    async function fetchOrg() {
      try {
        if (!orgId) {
          if (!cancelled) {
            setOrgName("");
            setOrgHoverTitle("");
          }
          return;
        }
        const snap = await getDoc(doc(db, "organizations", String(orgId)));
        if (!cancelled) {
          if (snap.exists()) {
            const data = snap.data() || {};
            const name = data?.name || String(orgId);
            setOrgName(name);

            const plan = (data?.subscription?.plan || "free").toUpperCase();
            const trial = !!data?.subscription?.trial?.isActive;
            const endSecs = data?.subscription?.endDate?.seconds;
            const expiry = endSecs
              ? new Date(endSecs * 1000).toLocaleDateString("en-GB", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                })
              : "";
            const title = `${name} • ${trial ? "TRIAL " : ""}${plan}${
              expiry ? ` • Expires ${expiry}` : ""
            }`;
            setOrgHoverTitle(title);
          } else {
            setOrgName("Organisation");
            setOrgHoverTitle("");
          }
        }
      } catch (e) {
        if (!cancelled) {
          setOrgName("Organisation");
          setOrgHoverTitle("");
        }
        console.error("Sidebar org load error:", e);
      }
    }

    fetchOrg();
    return () => {
      cancelled = true;
    };
  }, [orgId]);

  // Get user role for org-tickets routing
  const userRole = useMemo(() => {
    if (!user || !user.role) return 'agent';
    return user.role.toLowerCase();
  }, [user]);

  // Determine first available org-tickets page based on role
  const getOrgTicketsPath = () => {
    const roleMap = {
      owner: 'business-calendars',
      admin: 'business-calendars',
      manager: 'business-calendars',
      team_lead: 'my-group-tickets',
      agent: 'agent-tickets'
    };
    return `org-tickets/${roleMap[userRole] || 'agent-tickets'}`;
  };

  // Only show Org Tickets if user has a valid role
  const shouldShowOrgTickets = userRole && ['owner', 'admin', 'manager', 'team_lead', 'agent','user'].includes(userRole);

  const menuItems = [
    { icon: LayoutDashboard, label: "Dashboard", path: "" },
    ...(shouldShowOrgTickets ? [{ icon: Building2, label: "Org Tickets", path: getOrgTicketsPath() }] : []),
    { icon: Users, label: "Team", path: "team" },
    { icon: FolderOpen, label: "Projects", path: "projects" },
    { icon: Settings, label: "Settings", path: "settings" },
  ];

  const getActiveItemFromPath = (currentPath) => {
    const parts = currentPath.split("/").filter(Boolean);
    
    // Find dashboard index
    const dashboardIdx = parts.findIndex((p) => p === "dashboard");
    if (dashboardIdx === -1) return "Dashboard";
    
    // If nothing after dashboard, we're on dashboard
    if (dashboardIdx === parts.length - 1) return "Dashboard";
    
    // Get the segment after dashboard
    const segment = parts[dashboardIdx + 1];
    
    // Check if we're in org-tickets section
    if (segment === "org-tickets") return "Org Tickets";
    
    // Match against menu items
    const match = menuItems.find((m) => m.path.startsWith(segment));
    return match ? match.label : "Dashboard";
  };

  useEffect(() => {
    setActiveItem(getActiveItemFromPath(pathname));
  }, [pathname]);

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
                  className="font-semibold text-[#74727E] dark:text-gray-300 text-sm leading-4"
                  title={orgHoverTitle}
                >
                  {orgName || "Organisation"}
                </span>
              </div>
            )}

            <button
              onClick={toggleSidebar}
              className="hidden lg:flex p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-md transition-colors"
            >
              <Menu size={16} />
            </button>
          </div>

          {/* NAVIGATION */}
          <nav className="flex-1 px-2 pt-4 pb-2 overflow-y-auto max-h-[calc(100vh-4rem)]">
            <ul className="space-y-1">
              {menuItems.map((item, index) => {
                const Icon = item.icon;
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
                        ${isActive 
                          ? "bg-[#FFB5733B] text-orange-600 dark:bg-orange-900/30 dark:text-orange-400" 
                          : "text-[#74727E] dark:text-gray-400 hover:bg-[#FFB5733B] dark:hover:bg-orange-900/30 hover:text-orange-600 dark:hover:text-orange-400"
                        }
                        ${isCollapsed ? "justify-center px-2" : ""}
                      `}
                      title={isCollapsed ? item.label : ""}
                    >
                      <Icon 
                        size={20} 
                        className={`flex-shrink-0 ${isActive ? "text-orange-500 dark:text-orange-400" : ""}`} 
                      />
                      {!isCollapsed && (
                        <span className="font-semibold text-sm">{item.label}</span>
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
                >
                  <LogOut size={20} className="flex-shrink-0" />
                  {!isCollapsed && <span className="font-medium text-sm">Log out</span>}
                </button>
              </li>
            </ul>
          </nav>
        </div>

        {/* SPACER */}
        <div className={`hidden lg:block transition-all duration-300 ${isCollapsed ? "w-16" : "w-64"}`} />
      </div>
    </>
  );
}