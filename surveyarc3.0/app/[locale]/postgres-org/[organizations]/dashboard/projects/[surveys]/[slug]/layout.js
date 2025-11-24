'use client';

import React from 'react';

import { QuestionProvider } from '@/providers/questionPProvider';
import { RuleProvider } from '@/providers/rulePProvider';
import { ContactProvider } from '@/providers/postGresPorviders/contactProvider';
import { ResponseProvider } from '@/providers/postGresPorviders/responsePProvider';
import { CampaignProvider } from '@/providers/postGresPorviders/campaignProvider';
import { TagProvider } from "@/providers/postGresPorviders/TagProvider";
import { TicketTaxonomyProvider } from "@/providers/postGresPorviders/TicketTaxonomyProvider";
import { TicketCategoryProvider } from "@/providers/postGresPorviders/TicketCategoryProvider";

export default function Layout({ children }) {
  return (
    <div className="min-h-screen flex flex-col bg-[var(--background)] text-[var(--text-primary)]">
      {/* Header */}
                    <TicketCategoryProvider>
      
                                      <TicketTaxonomyProvider>
      
            <TagProvider>
      
   <ContactProvider>
<QuestionProvider>
  <RuleProvider>
    <ResponseProvider>
      <CampaignProvider>
    {/* Main Content */}
    <main className="">
      {children}
    </main>
          </CampaignProvider>

    </ResponseProvider>
  </RuleProvider>
</QuestionProvider>
 </ContactProvider>
             </TagProvider>
                                </TicketTaxonomyProvider>
                                              </TicketCategoryProvider>
                                

    </div>
  );
}
