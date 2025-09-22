"use client";
import React from "react";
import { Icon } from "@iconify/react";

export default function HelpDrawer({ open, onClose }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <aside className="absolute right-0 top-0 h-full w-full sm:w-[480px] bg-white shadow-xl overflow-y-auto">
        <div className="p-4 border-b flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-2">
            <Icon icon="mdi:help-circle-outline" width="20" height="20" />
            How to use Email Templates
          </h3>
          <button onClick={onClose} className="p-2 rounded hover:bg-gray-100" aria-label="Close help">
            <Icon icon="mdi:close" width="18" height="18" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          <Step
            title="1) Create or open a template"
            body="Click “New” to start from a starter template, or pick one from the left list."
          />
          <Step
            title="2) Add content"
            body={`Fill “Subject”, “HTML content” and optional “Plain text”. Use variables like ${'{{name}}'} or ${'{{order.id}}'} anywhere.`}
          />
          <Step
            title="3) Preview with sample values"
            body="On the Variables panel, enter example values for detected variables and see the live preview update."
          />
          <Step
            title="4) Save & Publish"
            body="Changes auto-save. When ready to use in campaigns, click Publish. Each publish creates a read-only version snapshot."
          />
          <Step
            title="5) Import / Export"
            body="Export to JSON for backup/reuse. Import a JSON file to create a new draft from a previous export."
          />

          <div className="p-4 rounded-lg bg-amber-50 text-amber-900 border border-amber-200">
            <div className="font-medium mb-1">Tips</div>
            <ul className="list-disc pl-5 text-sm space-y-1">
              <li>Keep a consistent style; consider using inline CSS for emails.</li>
              <li>Prefer short subjects; include a clear CTA.</li>
              <li>Always provide a plain-text version for deliverability.</li>
              <li>For sending, render variables on the server and sanitize HTML.</li>
            </ul>
          </div>
        </div>
      </aside>
    </div>
  );
}

function Step({ title, body }) {
  return (
    <div>
      <div className="font-medium">{title}</div>
      <p className="text-sm text-gray-600">{body}</p>
    </div>
  );
}
