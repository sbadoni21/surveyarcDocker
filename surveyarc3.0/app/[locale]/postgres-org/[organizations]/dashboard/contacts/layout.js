'use client';

import { CampaignProvider } from '@/providers/campaginProviders';
import { CampaignResultProvider } from '@/providers/campaginResultProvider';
import { ContactProvider } from '@/providers/postGresPorviders/ContactProvider';
import { SurveyProvider } from '@/providers/surveyPProvider';
import React from 'react';

export default function Layout({ children }) {
  return (
    <div className="min-h-screen flex flex-col  text-[var(--text-primary)]">
      {/* Header */}<ContactProvider>

      {/* Main Content */}
      <main className="">
        {children}
      </main>
</ContactProvider>
    </div>
  );
}
