"use client";

import { CampaignProvider } from "@/providers/campaginProviders";
import { CampaignResultProvider } from "@/providers/campaginResultProvider";
import { SupportTeamProvider } from "@/providers/postGresPorviders/SupportTeamProvider";
import { SurveyProvider } from "@/providers/surveyPProvider";
import React from "react";

export default function Layout({ children }) {
  return (
    <div className="min-h-screen flex flex-col  text-[var(--text-primary)]">
      {/* Header */}
      <CampaignResultProvider>
        <CampaignProvider>
          <SurveyProvider>
            <SupportTeamProvider>
              {/* Main Content */}
              <main className="">{children}</main>
            </SupportTeamProvider>
          </SurveyProvider>
        </CampaignProvider>
      </CampaignResultProvider>
    </div>
  );
}
