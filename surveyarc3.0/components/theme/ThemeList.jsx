"use client";
import React from "react";
import { Icon } from "@iconify/react";
import { useTheme } from "@/providers/postGresPorviders/themeProvider";
import { useSurvey } from "@/providers/surveyPProvider";

export default function ThemeList({ surveyId, orgId }) {
  const {
    loading,
    themes,
    currentId,
    open,
    createTheme,
    duplicateTheme,
    deleteTheme,
  } = useTheme();
  
  const { updateSurvey } = useSurvey();

  const addThemeToSurvey = async (orgId, surveyId, id) => {
    await updateSurvey(orgId, surveyId, { theme_id: id });
  };

  return (
    <section className="bg-white rounded-xl border shadow-sm overflow-hidden">
      <div className="p-4 border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon icon="mdi:palette-outline" width="20" height="20" />
          <h3 className="font-semibold">Themes</h3>
        </div>

        <button
          onClick={createTheme}
          className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:opacity-90"
        >
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
              key={t.themeId}
              className={`p-4 cursor-pointer hover:bg-gray-50 ${
                currentId === t.themeId ? "bg-blue-50" : ""
              }`}
              onClick={() => open(t.themeId)}
            >
              <div className="flex items-center justify-between">
                <div className="font-medium">{t.name}</div>

                <div className="flex items-center gap-2">
                  <button
                    className="text-xs px-2 py-1 border rounded hover:bg-gray-50"
                    onClick={(e) => {
                      e.stopPropagation();
                      duplicateTheme(t.themeId);
                    }}
                  >
                    Duplicate
                  </button>

                  <button
                    className="text-xs px-2 py-1 border rounded text-red-600 hover:bg-red-50"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteTheme(t.themeId);
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>

              <button
                onClick={() => {
                  addThemeToSurvey(orgId, surveyId, t.themeId);
                }}
                className="text-xs text-white bg-fuchsia-800 p-1 mt-2"
              >
                Apply Theme to current survey
              </button>

            </div>
          ))
        )}
      </div>
    </section>
  );
}
