"use client";
import React, { useState, useEffect } from "react";
import { useTheme } from "@/providers/postGresPorviders/themeProvider";

export default function AttachToSurvey({ surveyThemeId, onAttach }) {
  const { themes } = useTheme();
  const [selectedThemeId, setSelectedThemeId] = useState(surveyThemeId || "");

  useEffect(() => {
    setSelectedThemeId(surveyThemeId || "");
  }, [surveyThemeId]);

  const handleChange = (e) => {
    const themeId = e.target.value;
    setSelectedThemeId(themeId);

    if (onAttach) {
      onAttach(themeId); // Call parent callback to attach theme to survey
    }
  };

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
          value={selectedThemeId}
          onChange={handleChange}
          className="w-full border rounded-lg px-3 py-2"
        >
          <option value="">-- Select a Theme --</option>
          {themes.map((t) => (
            <option key={t.themeId} value={t.themeId}>
              {t.name} {t.isDefault ? "• Default" : ""}
            </option>
          ))}
        </select>
      </div>
    </section>
  );
}
