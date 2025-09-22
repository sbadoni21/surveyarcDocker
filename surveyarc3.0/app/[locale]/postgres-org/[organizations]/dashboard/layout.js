"use client";
import Sidebar from "@/components/frontend/Sidebar";
import { OrganisationProvider } from "@/providers/postGresPorviders/organisationProvider";
import { ProjectProvider } from "@/providers/postGresPorviders/projectProvider";
import { UserProvider } from "@/providers/postGresPorviders/UserProvider";
import React, { useState } from "react";


export default function Layout({ children }) {
  const [isCollapsed, setIsCollapsed] = useState(true);

  return (
    <div className="flex w-full bg-[#F5F5F5] dark:bg-[#121214]">
      <OrganisationProvider>
        <UserProvider>
          <ProjectProvider>
            <Sidebar
              isCollapsed={isCollapsed}
              setIsCollapsed={setIsCollapsed}
            />
            <main
              className={`transition-all  duration-300 ${
                isCollapsed
                  ? "w-[calc(100%-30px)] "
                  : "w-[calc(100%-200px)]"
              }`}
            >
              {children}
            </main>
          </ProjectProvider>
        </UserProvider>
      </OrganisationProvider>
    </div>
  );
}
