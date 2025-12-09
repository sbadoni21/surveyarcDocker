'use client';

import { CampaignProvider } from '@/providers/campaginProviders';
import { CampaignResultProvider } from '@/providers/campaginResultProvider';
import { ContactProvider } from '@/providers/postGresPorviders/contactProvider';
import { SalesforceAccountProvider } from '@/providers/postGresPorviders/SalesforceAccountProvider';
import { SalesforceContactProvider } from '@/providers/postGresPorviders/SalesforceContactProvider';
import { SalesforceSyncProvider } from '@/providers/postGresPorviders/SalesforceSyncProvider';
import { SurveyProvider } from '@/providers/surveyPProvider';
import React from 'react';

export default function Layout({ children }) {
  return (
    <div className="min-h-screen flex flex-col  text-[var(--text-primary)]">
<ContactProvider>
  <SalesforceAccountProvider>
    <SalesforceContactProvider>
    <SalesforceSyncProvider>
      {/* Main Content */}
      <main className="">
        {children}
      </main>
      </SalesforceSyncProvider>
      </SalesforceContactProvider>
      </SalesforceAccountProvider>
      </ContactProvider>
    </div>
  );
}
