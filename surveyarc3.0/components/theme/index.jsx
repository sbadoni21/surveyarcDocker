"use client";
import React, { useState } from "react";
import ThemesProvider from "./ThemesProvider";
import ThemeList from "./ThemeList";
import ThemeEditor from "./ThemeEditor";
import ThemePreview from "./ThemePreview";
import AttachToSurvey from "./AttachToSurvey";

export default function ThemeManager() {
  const [draftTheme, setDraftTheme] = useState(null);

  return (
    <ThemesProvider>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 p-4 h-screen">
        <div className="xl:col-span-1 space-y-6">
          <ThemeList />
          <AttachToSurvey />
        </div>
        <div className="xl:col-span-2 space-y-6">
          <ThemeEditor onDraftChange={setDraftTheme} />
          <ThemePreview draftTheme={draftTheme} />
        </div>
      </div>
    </ThemesProvider>
  );
}