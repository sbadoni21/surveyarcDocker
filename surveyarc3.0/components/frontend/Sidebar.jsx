"use client";
import React, { useState, useEffect, useMemo } from "react";
import {
  LayoutDashboard,
  FolderOpen,
  Users,
  Settings,
  LogOut,
  Menu,
  Palette,
  PhoneCall,
  X,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { deleteCookie, getCookie } from "cookies-next";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/firebase/firebase";
import { Email } from "@mui/icons-material";

export default function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [activeItem, setActiveItem] = useState("Dashboard");
  const [orgName, setOrgName] = useState("");
  const [orgHoverTitle, setOrgHoverTitle] = useState(""); // details shown on hover only

  const pathname = usePathname();
  const router = useRouter();

  // Derive orgId from route (/.../org/:id/...) or fallback to cookie
  const orgId = useMemo(() => {
    const segs = pathname.split("/").filter(Boolean);
    // matches your original: at(2) when path like /en/org/:id/dashboard
    const idFromPath = segs.at(2);
    return idFromPath || (getCookie("currentOrgId") ? String(getCookie("currentOrgId")) : "");
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

            // Build hover-only details (no CSS changes)
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

  const menuItems = [
    { icon: LayoutDashboard, label: "Dashboard", href: "#" },
    { icon: FolderOpen, label: "Projects", href: "#" },
    { icon: Users, label: "Team", href: "#" },
    { icon: Settings, label: "Settings", href: "#" },
    { icon: Email, label: "Email", href: "#" },
    { icon: Palette, label: "Theme", href: "#" },
    { icon: PhoneCall, label: "Whatsapp", href: "#" },
  ];

  const getActiveItemFromPath = (currentPath) => {
    const parts = currentPath.split("/").filter(Boolean);
    const idx = parts.findIndex((p) => p === "dashboard");
    if (idx === -1 || idx === parts.length - 1) return "Dashboard";
    const seg = parts[idx + 1];
    const match = menuItems.find((m) => m.label.toLowerCase() === seg.toLowerCase());
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
    router.push("/login"); // keep client-side
  };

  const handleItemClick = (label) => {
    const lower = label.toLowerCase();
    const path =
      lower === "dashboard"
        ? `/postgres-org/${orgId}/dashboard`
        : `/postgres-org/${orgId}/dashboard/${lower}`;
    router.push(path);
    setIsMobileOpen(false);
  };

  return (
    <>
      <div className="z-10">
        {/* MOBILE TOGGLER (unchanged styling) */}
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

        {/* SIDEBAR SHELL (classes unchanged) */}
        <div
          className={`
          fixed left-0 top-0 h-full bg-white dark:bg-[#1A1A1E] shadow-lg
          transition-all duration-300 ease-in-out z-40
          ${isCollapsed ? "w-16" : "w-64"}
          ${isMobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        `}
        >
          {/* HEADER (unchanged markup, just inject title attr) */}
          <div className="flex items-center justify-between p-4 border-b border-gray-100 h-16">
            {!isCollapsed && (
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
                  <div className="w-4 h-4 bg-white rounded-sm"></div>
                </div>
                <span
                  className="font-semibold text-[#74727E] text-sm leading-4"
                  title={orgHoverTitle} // <-- extra details on hover only
                >
                  {orgName || "Organisation"}
                </span>
              </div>
            )}

            <button
              onClick={toggleSidebar}
              className="hidden lg:flex p-1.5 text-gray-400 hover:text-gray-600  rounded-md transition-colors"
            >
              <Menu size={16} />
            </button>
          </div>

          {/* NAV (unchanged) */}
          <nav className="flex-1 px-2 pt-4 pb-2">
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
                      onClick={() => handleItemClick(item.label)}
                      className={`
                        relative z-10 flex w-[90%] mx-auto items-center space-x-3 rounded-lg p-3 pl-5 text-left transition-all duration-200
                        ${isActive ? "bg-[#FFB5733B] text-orange-600" : "text-[#74727E] hover:bg-[#FFB5733B] hover:text-orange-600"}
                        ${isCollapsed ? "justify-end" : ""}
                      `}
                      title={isCollapsed ? item.label : ""}
                    >
                      <Icon size={20} className={`flex-shrink-0 ${isActive ? "text-orange-500" : ""}`} />
                      {!isCollapsed && (
                        <span className="font-semibold text-sm">{item.label}</span>
                      )}
                    </button>
                  </li>
                );
              })}
              <li className="">
                <button
                  onClick={handleLogout}
                  className={`
                    w-full flex items-center space-x-3 p-3 rounded-lg transition-all duration-200 text-left
                    text-red-600 hover:bg-red-50
                    ${isCollapsed ? "justify-center px-2" : ""}
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

        {/* SPACER (unchanged) */}
        <div className={`hidden lg:block transition-all duration-300 ${isCollapsed ? "w-16" : "w-64"}`} />
      </div>
    </>
  );
}
