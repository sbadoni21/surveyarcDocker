'use client';

import { TicketTemplateProvider } from '@/providers/postGresPorviders/ticketTemplateProvider';
import React from 'react';


export default function Layout({ children }) {
  return (
    <div className="min-h-screen flex flex-col bg-[var(--background)] text-[var(--text-primary)]">
<TicketTemplateProvider>
    <main className="">
      {children}
    </main>
</TicketTemplateProvider>
    </div>
  );
}
