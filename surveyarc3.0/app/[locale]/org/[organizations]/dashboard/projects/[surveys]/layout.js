'use client';

import { CampaignProvider } from '@/providers/campaginProviders';
import { CampaignResultProvider } from '@/providers/campaginResultProvider';
import { SurveyProvider } from '@/providers/surveyPProvider';
import React from 'react';

export default function Layout({ children }) {
  return (
    <div className="min-h-screen flex flex-col  text-[var(--text-primary)]">
      {/* Header */}
      <CampaignResultProvider>
   <CampaignProvider>
<SurveyProvider>
      {/* Main Content */}
      <main className="">
        {children}
      </main>
</SurveyProvider>
 </CampaignProvider>
 </CampaignResultProvider>
    </div>
  );
}
