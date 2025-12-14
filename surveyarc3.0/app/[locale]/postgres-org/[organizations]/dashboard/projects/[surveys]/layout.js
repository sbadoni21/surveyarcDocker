"use client";

import { CampaignProvider } from "@/providers/campaginProviders";
import { CampaignResultProvider } from "@/providers/campaginResultProvider";
import { ParticipantSourceProvider } from "@/providers/postGresPorviders/participantSourcePProvider";
import { SupportTeamProvider } from "@/providers/postGresPorviders/SupportTeamProvider";
import { QuestionProvider } from "@/providers/questionPProvider";
import { SurveyProvider } from "@/providers/surveyPProvider";
import React from "react";

export default function Layout({ children }) {
  return (
    <div className="min-h-screen flex flex-col  text-[var(--text-primary)]">
      {/* Header */}
      <CampaignResultProvider>
        <CampaignProvider>
          <ParticipantSourceProvider>
        <QuestionProvider>
            <SupportTeamProvider>
              {/* Main Content */}
              <main className="">{children}</main>
            </SupportTeamProvider>
            </QuestionProvider>
              </ParticipantSourceProvider>
        </CampaignProvider>
      </CampaignResultProvider>
    </div>
  );
}
