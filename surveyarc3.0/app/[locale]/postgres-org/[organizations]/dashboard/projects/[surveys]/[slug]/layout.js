'use client';

import React from 'react';

import { QuestionProvider } from '@/providers/questionPProvider';
import { RuleProvider } from '@/providers/rulePProvider';
import { ContactProvider } from '@/providers/postGresPorviders/contactProvider';
import { ResponseProvider } from '@/providers/postGresPorviders/responsePProvider';

export default function Layout({ children }) {
  return (
    <div className="min-h-screen flex flex-col bg-[var(--background)] text-[var(--text-primary)]">
      {/* Header */}
   <ContactProvider>
<QuestionProvider>
  <RuleProvider>
    <ResponseProvider>
    {/* Main Content */}
    <main className="">
      {children}
    </main>
    </ResponseProvider>
  </RuleProvider>
</QuestionProvider>
 </ContactProvider>
    </div>
  );
}
