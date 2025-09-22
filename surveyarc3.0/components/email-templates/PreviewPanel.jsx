"use client";
import React, { useMemo, useState } from "react";
import { Icon } from "@iconify/react";
import { useTemplates } from "./TemplatesProvider";
import { applyVars } from "@/utils/emailTemplates";

export default function PreviewPanel() {
  const { form, varsPreview } = useTemplates();
  const [mode, setMode] = useState("html");

  const subject = useMemo(() => applyVars(form.subject, varsPreview), [form.subject, varsPreview]);
  const html = useMemo(() => applyVars(form.html, varsPreview), [form.html, varsPreview]);
  const text = useMemo(() => applyVars(form.text, varsPreview), [form.text, varsPreview]);

  return (
    <section className="bg-white rounded-xl border shadow-sm overflow-hidden">
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <h4 className="font-semibold flex items-center gap-2">
            <Icon icon="mdi:eye-outline" width="18" height="18" />
            Preview
          </h4>
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setMode("html")}
              className={`px-3 py-1 text-xs rounded ${mode === "html" ? "bg-white shadow-sm" : "hover:text-gray-900"}`}
            >
              HTML
            </button>
            <button
              onClick={() => setMode("text")}
              className={`px-3 py-1 text-xs rounded ${mode === "text" ? "bg-white shadow-sm" : "hover:text-gray-900"}`}
            >
              Text
            </button>
          </div>
        </div>

        {subject && (
          <div className="mt-3 p-3 bg-blue-50 rounded-lg">
            <div className="text-xs font-medium text-blue-700">Subject</div>
            <div className="text-sm text-blue-900">{subject}</div>
          </div>
        )}
      </div>

      <div className="p-4">
        {mode === "html" ? (
          html ? (
            <iframe
              className="w-full h-96 border rounded-lg"
              // NOTE: for real sending, sanitize HTML on the server pipeline.
              srcDoc={`<!doctype html><html><body style="font-family:Arial, sans-serif; padding:16px">${html}</body></html>`}
            />
          ) : (
            <div className="h-96 border rounded-lg bg-gray-50 flex items-center justify-center">
              <p className="text-gray-500">No HTML content</p>
            </div>
          )
        ) : (
          <div className="h-96 border rounded-lg p-4 bg-gray-50 overflow-auto">
            <pre className="text-sm whitespace-pre-wrap">{text || "No text content"}</pre>
          </div>
        )}
      </div>
    </section>
  );
}
