"use client";
import { ThemeProvider } from "@/context/ThemeContext";
import React from "react";
import { UserProvider } from "@/providers/postGresPorviders/UserProvider";
import { OrganisationProvider } from "@/providers/postGresPorviders/organisationProvider";
import { SurveyProvider } from "@/providers/surveyPProvider";
import { ProjectProvider } from "@/providers/projectPProvider";
import { RBACProvider } from "@/providers/RBACProvider";
export default function LayoutFile({ children }) {
  return (
    <div>
      <ThemeProvider>
        <UserProvider>
          <OrganisationProvider>
            <SurveyProvider>
              <ProjectProvider>
                <RBACProvider>
              {children}
              </RBACProvider>
              </ProjectProvider>
            </SurveyProvider>
          </OrganisationProvider>
        </UserProvider>
      </ThemeProvider>
    </div>
  );
}
