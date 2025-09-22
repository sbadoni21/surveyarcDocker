"use client";
import React, { useMemo } from "react";
import { Icon } from "@iconify/react";
import { useTemplates } from "./TemplatesProvider";
import { extractVars } from "@/utils/emailTemplates";

export default function VariablesPanel() {
  const { form, varsPreview, setVarsPreview } = useTemplates();
  const detected = useMemo(
    () => extractVars(form.subject, form.html, form.text),
    [form.subject, form.html, form.text]
  );

  const fillSample = () => {
    const stock = { name: "John Doe", company: "Acme Corp", email: "john@example.com", "order.id": "12345" };
    const next = {};
    detected.forEach((k) => (next[k] = stock[k] || `Sample ${k}`));
    setVarsPreview(next);
  };

  return (
    <section className="bg-white rounded-xl border shadow-sm overflow-hidden">
      <div className="p-4 border-b">
        <h4 className="font-semibold flex items-center gap-2">
          <Icon icon="mdi:code-braces" width="18" height="18" />
          Variables ({detected.length})
        </h4>
      </div>

      <div className="p-4">
        {detected.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Icon icon="mdi:code-braces" width="32" height="32" className="mx-auto mb-3 text-gray-300" />
            <p className="text-sm">
              No variables detected. Use <code>{'{{variable}}'}</code> in subject, HTML or text.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {detected.map((k) => (
              <div key={k}>
                <label className="block text-sm font-medium mb-1">{k}</label>
                <input
                  value={varsPreview?.[k] || ""}
                  onChange={(e) => setVarsPreview((v) => ({ ...v, [k]: e.target.value }))}
                  placeholder={`Enter ${k}…`}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>
            ))}
            <div className="pt-3 border-t flex gap-2">
              <button onClick={fillSample} className="text-xs px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200">
                Fill sample
              </button>
              <button onClick={() => setVarsPreview({})} className="text-xs px-3 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200">
                Clear
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
