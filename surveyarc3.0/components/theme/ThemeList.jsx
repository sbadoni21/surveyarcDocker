"use client";
import React from "react";
import { useThemes } from "./ThemesProvider";
import { Icon } from "@iconify/react";

export default function ThemeList() {
  const { loading, themes, currentId, open, createTheme, duplicateTheme, deleteTheme } = useThemes();

  return (
    <section className="bg-white rounded-xl border shadow-sm overflow-hidden">
      <div className="p-4 border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon icon="mdi:palette-outline" width="20" height="20" />
          <h3 className="font-semibold">Themes</h3>
        </div>
        <button onClick={createTheme} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:opacity-90">
          New Theme
        </button>
      </div>

      <div className="max-h-96 overflow-auto divide-y">
        {loading ? (
          <div className="p-6 text-center text-gray-500">Loading…</div>
        ) : themes.length === 0 ? (
          <div className="p-6 text-center text-gray-500">No themes yet</div>
        ) : (
          themes.map((t) => (
            <div
              key={t.id}
              className={`p-4 cursor-pointer hover:bg-gray-50 ${currentId === t.id ? "bg-blue-50" : ""}`}
              onClick={() => open(t.id)}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">{t.name}</div>
                  <div className="text-xs text-gray-500">
                    {t.isDefault ? "Default • " : ""}
                    Used by {Array.isArray(t.usedBy) ? t.usedBy.length : 0} survey(s)
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    className="text-xs px-2 py-1 border rounded hover:bg-gray-50"
                    onClick={(e) => { e.stopPropagation(); duplicateTheme(t.id); }}
                  >
                    Duplicate
                  </button>
                  { (
                    <button
                      className="text-xs px-2 py-1 border rounded text-red-600 hover:bg-red-50"
                      onClick={(e) => { e.stopPropagation(); deleteTheme(t.id); }}
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>

              {/* tiny palette preview */}
              <div className="flex gap-1 mt-3">
                {["primary","secondary","background","surface","text","muted"].map(k => (
                  <span
                    key={k}
                    title={k}
                    className="inline-block w-5 h-5 rounded"
                    style={{ background: t?.palette?.[k] || "#eee", border: "1px solid #e5e7eb" }}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
