"use client";
import React from "react";
import { Icon } from "@iconify/react";
import { useTemplates } from "./TemplatesProvider";

export default function TemplateList() {
  const {
    rows, search, setSearch, loadingList, loadMore,
    currentId, open, createNew, duplicate, remove
  } = useTemplates();

  return (
    <section className="bg-white rounded-xl border shadow-sm overflow-hidden">
      <div className="p-4 border-b flex items-center gap-2">
        <Icon icon="mdi:email-multiple-outline" width="20" height="20" />
        <h3 className="font-semibold">Templates</h3>
        <span className="ml-auto text-xs text-gray-500">{rows.length} shown</span>
      </div>

      <div className="p-3 border-b flex gap-2">
        <div className="relative flex-1">
          <Icon icon="mdi:magnify" width="16" height="16" className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, subject, tags…"
            className="w-full pl-8 pr-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
            aria-label="Search templates"
          />
        </div>
        <button
          onClick={createNew}
          className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
          title="Create template"
        >
          <Icon icon="mdi:plus" width="16" height="16" />
        </button>
      </div>

      <div className="max-h-96 overflow-auto divide-y">
        {loadingList ? (
          <div className="p-4 text-center text-gray-500">
            <Icon icon="mdi:loading" width="20" height="20" className="animate-spin mx-auto mb-2" />
            Loading…
          </div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Icon icon="mdi:email-outline" width="48" height="48" className="mx-auto mb-3 text-gray-300" />
            <p className="font-medium">No templates yet</p>
            <p className="text-sm mt-1">Click “New” to create your first template.</p>
          </div>
        ) : (
          rows.map((t) => {
            const active = t.id === currentId;
            return (
              <div
                key={t.id}
                className={`p-4 cursor-pointer hover:bg-gray-50 ${active ? "bg-blue-50" : ""}`}
                onClick={() => open(t.id)}
                role="button"
                aria-label={`Open template ${t.name}`}
              >
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="font-medium text-gray-900 truncate">{t.name || "Untitled"}</div>
                    {t.subject && <div className="text-xs text-gray-500 truncate mt-1">{t.subject}</div>}
                    <div className="flex items-center gap-2 mt-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${t.status === "published" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"}`}>
                        {t.status || "draft"}
                      </span>
                      <span className="text-xs text-gray-400">v{t.version || 0}</span>
                      {Array.isArray(t.tags) && t.tags.slice(0, 2).map((tag) => (
                        <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">{tag}</span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); duplicate(t.id); }}
                      className="text-xs px-2 py-1 border rounded hover:bg-gray-50"
                    >
                      Duplicate
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); remove(t.id); }}
                      className="text-xs px-2 py-1 border rounded text-red-600 hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="p-3 border-t">
        <button
          onClick={loadMore}
          className="w-full px-3 py-2 border rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50"
          disabled={!rows.length}
        >
          Load more
        </button>
      </div>
    </section>
  );
}
