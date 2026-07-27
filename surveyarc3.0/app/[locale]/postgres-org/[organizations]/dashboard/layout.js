"use client";
import Sidebar from "@/components/frontend/Sidebar";
import { GroupProvider } from "@/providers/postGresPorviders/GroupProvider";
import { useOrganisation } from "@/providers/postGresPorviders/organisationProvider";
import { QuotaProvider } from "@/providers/postGresPorviders/quotaProvider";
import { useUser } from "@/providers/postGresPorviders/UserProvider";
import { useRBAC } from "@/providers/RBACProvider";
import { SLAProvider } from "@/providers/slaProvider";
import React, { useEffect, useState, useRef } from "react";

export default function Layout({ children }) {
  const [isCollapsed, setIsCollapsed] = useState(true);
  const { loadEffectivePermissions, permissionsLoaded } = useRBAC();
  const { user } = useUser();
  const { organisation } = useOrganisation();
  
  // CRITICAL: Track if we've already loaded permissions
  const hasLoadedRef = useRef(false);
  const lastLoadKey = useRef("");

  useEffect(() => {
    // Create a unique key for this user+org combination
    const loadKey = `${user?.uid}-${organisation?.org_id}`;
    
    // Only load if:
    // 1. We have both user and org
    // 2. We haven't loaded yet OR the user/org has changed
    // 3. Permissions aren't already loaded
    if (
      user?.uid && 
      organisation?.org_id && 
      lastLoadKey.current !== loadKey &&
      !permissionsLoaded
    ) {
      lastLoadKey.current = loadKey;
      hasLoadedRef.current = true;
      loadEffectivePermissions(user.uid, organisation.org_id);
    }
  }, [user?.uid, organisation?.org_id]); // REMOVED loadEffectivePermissions and permissionsLoaded from deps

  return (
    <div className="flex w-full bg-[#F5F5F5] dark:bg-[#121214]">
      <GroupProvider>
        <QuotaProvider>
          <Sidebar
            isCollapsed={isCollapsed}
            setIsCollapsed={setIsCollapsed}
          />
          <SLAProvider>
            <main
              className={`transition-all duration-300 ${
                isCollapsed
                  ? "w-[calc(100%-30px)]"
                  : "w-[calc(100%-200px)]"
              }`}
            >
              {children}
            </main>
          </SLAProvider>
        </QuotaProvider>
      </GroupProvider>
    </div>
  );
}
