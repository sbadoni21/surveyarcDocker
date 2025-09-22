"use client";
import React from "react";
import { useThemes } from "./ThemesProvider";

export default function AttachToSurvey() {
  const { themes, surveyThemeId, attachToSurvey } = useThemes();

  return (
    <section className="bg-white rounded-xl border shadow-sm overflow-hidden">
      <div className="p-4 border-b">
        <h3 className="font-semibold">Attach to Survey</h3>
        <p className="text-xs text-gray-500 mt-1">
          Pick which theme this survey uses. You can reuse themes across surveys.
        </p>
      </div>
      <div className="p-4">
        <select
          value={surveyThemeId || ""}
          onChange={(e) => attachToSurvey(e.target.value)}
          className="w-full border rounded-lg px-3 py-2"
        >
          {themes.map(t => (
            <option key={t.id} value={t.id}>
              {t.name} {t.isDefault ? "• Default" : ""}
            </option>
          ))}
        </select>
      </div>
    </section>
  );
}
