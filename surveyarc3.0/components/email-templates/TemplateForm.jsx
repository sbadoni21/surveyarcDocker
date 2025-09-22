"use client";
import React from "react";
import { useTemplates } from "./TemplatesProvider";

export default function TemplateForm() {
  const { form, setForm } = useTemplates();

  const onTags = (val) =>
    setForm((f) => ({ ...f, tags: val.split(",").map((t) => t.trim()).filter(Boolean) }));

  return (
    <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="space-y-4">
        <FormField label="Template name *" hint="A clear, human name shown in your list.">
          <input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Welcome Email"
            className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
          />
        </FormField>

        <FormField label="Subject line" hint={`Use variables like ${'{{name}}'}.`}>
          <input
            value={form.subject}
            onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
            placeholder="Welcome {{name}}!"
            className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
          />
        </FormField>

        <FormField label="Tags" hint="Comma separated. e.g. welcome, onboarding">
          <input
            value={(form.tags || []).join(", ")}
            onChange={(e) => onTags(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
          />
        </FormField>

        <FormField label="Plain text (optional)" hint="Fallback for plain-text email clients.">
          <textarea
            value={form.text}
            onChange={(e) => setForm((f) => ({ ...f, text: e.target.value }))}
            className="w-full border rounded-lg px-3 py-2 h-40 font-mono text-sm resize-y focus:ring-2 focus:ring-blue-500"
          />
        </FormField>
      </div>

      <div>
        <FormField
          label="HTML content"
          hint={`Use variables like ${'{{name}}'} and ${'{{order.id}}'}. For production sending, sanitize on server.`}
        >
          <textarea
            value={form.html}
            onChange={(e) => setForm((f) => ({ ...f, html: e.target.value }))}
            placeholder="<h1>Hello {{name}}</h1>"
            className="w-full border rounded-lg px-3 py-2 h-80 font-mono text-sm resize-y focus:ring-2 focus:ring-blue-500"
          />
        </FormField>
      </div>
    </div>
  );
}

function FormField({ label, hint, children }) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1">{label}</label>
      {children}
      {hint && <p className="text-xs text-gray-500 mt-1">{hint}</p>}
    </div>
  );
}
