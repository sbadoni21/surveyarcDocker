"use client";
import React, { useState } from "react";
import TemplatesProvider from "./TemplatesProvider";
import TemplateList from "./TemplateList";
import TemplateToolbar from "./TemplateToolbar";
import TemplateForm from "./TemplateForm";
import VariablesPanel from "./VariablesPanel";
import PreviewPanel from "./PreviewPanel";
import HelpDrawer from "./HelpDrawer";

export default function EmailTemplates() {
  const [helpOpen, setHelpOpen] = useState(false);

  return (
    <TemplatesProvider>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 p-4">
        <div className="xl:col-span-1">
          <TemplateList />
        </div>

        <div className="xl:col-span-2 space-y-6">
          <section className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <TemplateToolbar onOpenHelp={() => setHelpOpen(true)} />
            <TemplateForm />
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <VariablesPanel />
            <PreviewPanel />
          </div>
        </div>
      </div>

      <HelpDrawer open={helpOpen} onClose={() => setHelpOpen(false)} />
    </TemplatesProvider>
  );
}
