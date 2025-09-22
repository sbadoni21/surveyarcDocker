"use client";
import React from "react";
import { Icon } from "@iconify/react";
import { useTemplates } from "./TemplatesProvider";

export default function TemplateToolbar({ onOpenHelp }) {
  const { form, setForm, saving, justSaved, publish, exportJSON, importJSON } = useTemplates();

  return (
    <div className="p-4 border-b flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Icon icon="mdi:file-document-edit-outline" width="20" height="20" />
        <h3 className="font-semibold">Editor</h3>
        {saving && (
          <span className="text-xs text-blue-600 flex items-center gap-1">
            <Icon icon="mdi:loading" className="animate-spin" width="14" height="14" /> Saving…
          </span>
        )}
        {justSaved && <span className="text-xs text-green-600">Saved</span>}
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onOpenHelp}
          className="px-2 py-1 border rounded-lg text-sm hover:bg-gray-50"
          title="How to use"
        >
          <Icon icon="mdi:help-circle-outline" width="18" height="18" />
        </button>

        <select
          value={form.status}
          onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
          className="border rounded-lg px-2 py-1 text-sm"
          aria-label="Status"
        >
          <option value="draft">Draft</option>
          <option value="published">Published</option>
          <option value="archived">Archived</option>
        </select>

        <button
          onClick={publish}
          className="px-3 py-1.5 bg-[#ED7A13] text-white rounded-lg text-sm hover:opacity-90"
        >
          Publish (snapshot)
        </button>

        <input
          id="import-tpl"
          className="hidden"
          type="file"
          accept="application/json"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) importJSON(f);
            e.currentTarget.value = "";
          }}
        />
        <label htmlFor="import-tpl" className="px-3 py-1.5 border rounded-lg text-sm hover:bg-gray-50 cursor-pointer">
          Import
        </label>

        <button onClick={exportJSON} className="px-3 py-1.5 border rounded-lg text-sm hover:bg-gray-50">
          Export
        </button>
      </div>
    </div>
  );
}
