"use client";
import Sidebar from "@/components/frontend/Sidebar";
import BusinessCalendarsProvider from "@/providers/BusinessCalendarsProvider";
import { OrganisationProvider } from "@/providers/postGresPorviders/organisationProvider";
import { ProjectProvider } from "@/providers/postGresPorviders/projectProvider";
import { QuotaProvider } from "@/providers/postGresPorviders/quotaProvider";
import { SupportGroupProvider } from "@/providers/postGresPorviders/SupportGroupProvider";
import { SupportTeamProvider } from "@/providers/postGresPorviders/SupportTeamProvider";
import { TagProvider } from "@/providers/postGresPorviders/TagProvider";
import { ThemeProvider } from "@/providers/postGresPorviders/themeProvider";
import { TicketCategoryProvider } from "@/providers/postGresPorviders/TicketCategoryProvider";
import { TicketTaxonomyProvider } from "@/providers/postGresPorviders/TicketTaxonomyProvider";
import { UserProvider } from "@/providers/postGresPorviders/UserProvider";
import { QuestionProvider } from "@/providers/questionPProvider";
import { SLAProvider } from "@/providers/slaProvider";
import { SurveyProvider } from "@/providers/surveyPProvider";
import { TicketProvider } from "@/providers/ticketsProvider";
import React, { useState } from "react";

export default function Layout({ children }) {
  const [isCollapsed, setIsCollapsed] = useState(true);

  return (
    <div className="flex w-full bg-[#F5F5F5] dark:bg-[#121214]">
  
                       <QuestionProvider>
                        <SurveyProvider>
                                <main
                                
                                >
                                  {children}
                                </main>
                                </SurveyProvider>
                                </QuestionProvider>
                            
    </div>
  );
}
