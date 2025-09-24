'use client';

import React from 'react';

import { QuestionProvider } from '@/providers/questionPProvider';
import { RuleProvider } from '@/providers/rulePProvider';

export default function Layout({ children }) {
  return (
    <div className="min-h-screen flex flex-col bg-[var(--background)] text-[var(--text-primary)]">
      {/* Header */}
   
<QuestionProvider>
  <RuleProvider>
    {/* Main Content */}
    <main className="">
      {children}
    </main>
  </RuleProvider>
</QuestionProvider>
 
    </div>
  );
}
