"use client";
import React, { useMemo } from "react";

export default function SmileyRatingConfig({ config = {}, updateConfig }) {
  const fallbackFaces = 5;
  const fallbackLabels = [
    "Very unhappy",
    "Unhappy",
    "Neutral",
    "Happy",
    "Very happy",
  ];

  const faces = useMemo(() => {
    const n = Number(config.faces);
    if (Number.isFinite(n) && n >= 3 && n <= 7) return n;
    return fallbackFaces;
  }, [config.faces]);

  const labels = useMemo(() => {
    if (Array.isArray(config.labels) && config.labels.length > 0) {
      // ensure length = faces
      const arr = [...config.labels];
      while (arr.length < faces) arr.push("");
      return arr.slice(0, faces);
    }
    // default labels trimmed to faces length
    return fallbackLabels.slice(0, faces);
  }, [config.labels, faces]);

  const highlightColor = config.highlightColor || "#FACC15"; // amber-400
  const baseColor = config.baseColor || "#9CA3AF"; // gray-400
  const showLabels = config.showLabels ?? true;
  const storeAs = config.storeAs || "score"; // 'score' | 'label'

  const includeNA = Boolean(config.includeNA);
  const naLabel = config.naLabel || "Not applicable / Don’t know";

  const handleLabelChange = (idx, value) => {
    const next = [...labels];
    next[idx] = value;
    updateConfig("labels", next);
  };

  const handleFacesChange = (e) => {
    const v = Number(e.target.value) || fallbackFaces;
    const clamped = Math.min(7, Math.max(3, v));
    updateConfig("faces", clamped);

    // optionally trim/pad labels
    const next = [...labels];
    while (next.length < clamped) next.push("");
    updateConfig("labels", next.slice(0, clamped));
  };

  return (
    <div className="space-y-5 text-sm">
      {/* Visual settings */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Faces count */}
        <label className="block space-y-1">
          <span className="text-sm dark:text-[#CBC9DE] text-[#111827]">
            Number of smileys
          </span>
          <select
            value={faces}
            onChange={handleFacesChange}
            className="w-full mt-1 px-3 py-2 rounded-lg border border-[#8C8A97] dark:bg-[#1A1A1E] dark:text-[#CBC9DE] bg-white text-sm"
          >
            <option value={3}>3 (Sad / Neutral / Happy)</option>
            <option value={5}>5 (Very unhappy → Very happy)</option>
            <option value={7}>7 (Fine-grained)</option>
          </select>
          <span className="text-[11px] text-gray-500">
            Controls how many emojis are shown on the scale.
          </span>
        </label>

        {/* Highlight color */}
        <label className="block space-y-1">
          <span className="text-sm dark:text-[#CBC9DE] text-[#111827]">
            Highlight color
          </span>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={highlightColor}
              onChange={(e) => updateConfig("highlightColor", e.target.value)}
              className="h-9 w-9 rounded-md border border-[#8C8A97] bg-transparent p-1"
            />
            <input
              type="text"
              value={highlightColor}
              onChange={(e) => updateConfig("highlightColor", e.target.value)}
              className="flex-1 px-3 py-2 rounded-lg border border-[#8C8A97] dark:bg-[#1A1A1E] dark:text-[#CBC9DE] bg-white text-xs font-mono"
              placeholder="#FACC15"
            />
          </div>
          <span className="text-[11px] text-gray-500">
            Used for the selected emoji and hover states.
          </span>
        </label>

        {/* Base color */}
        <label className="block space-y-1">
          <span className="text-sm dark:text-[#CBC9DE] text-[#111827]">
            Base color
          </span>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={baseColor}
              onChange={(e) => updateConfig("baseColor", e.target.value)}
              className="h-9 w-9 rounded-md border border-[#8C8A97] bg-transparent p-1"
            />
            <input
              type="text"
              value={baseColor}
              onChange={(e) => updateConfig("baseColor", e.target.value)}
              className="flex-1 px-3 py-2 rounded-lg border border-[#8C8A97] dark:bg-[#1A1A1E] dark:text-[#CBC9DE] bg-white text-xs font-mono"
              placeholder="#9CA3AF"
            />
          </div>
          <span className="text-[11px] text-gray-500">
            Color of non-selected emojis.
          </span>
        </label>

        {/* Store as */}
        <label className="block space-y-1">
          <span className="text-sm dark:text-[#CBC9DE] text-[#111827]">
            Store response as
          </span>
          <select
            value={storeAs}
            onChange={(e) => updateConfig("storeAs", e.target.value)}
            className="w-full mt-1 px-3 py-2 rounded-lg border border-[#8C8A97] dark:bg-[#1A1A1E] dark:text-[#CBC9DE] bg-white text-sm"
          >
            <option value="score">Numeric score (1–N)</option>
            <option value="label">Label text</option>
          </select>
          <span className="text-[11px] text-gray-500">
            Score is easier for analysis; labels are more human readable.
          </span>
        </label>
      </div>

      {/* Labels per face */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm dark:text-[#CBC9DE] text-[#111827]">
            Labels under each emoji
          </span>
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={showLabels}
              onChange={(e) => updateConfig("showLabels", e.target.checked)}
              className="h-4 w-4"
            />
            <span className="dark:text-[#CBC9DE] text-[#4B5563]">
              Show labels to respondents
            </span>
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {labels.map((lbl, idx) => (
            <input
              key={idx}
              type="text"
              value={lbl}
              onChange={(e) => handleLabelChange(idx, e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[#8C8A97] dark:bg-[#1A1A1E] dark:text-[#CBC9DE] bg-white text-xs"
              placeholder={`Label for position ${idx + 1}`}
            />
          ))}
        </div>
        <p className="text-[11px] text-gray-500">
          Leave blank to hide specific labels. Order is left → right on the
          scale.
        </p>
      </div>

      {/* N/A option */}
      <div className="border-t border-[#2E2C38] pt-3 space-y-2">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={includeNA}
            onChange={(e) => updateConfig("includeNA", e.target.checked)}
            className="h-4 w-4"
          />
          <span className="text-sm dark:text-[#CBC9DE] text-[#111827]">
            Add &quot;Not applicable / Don’t know&quot; option
          </span>
        </label>

        {includeNA && (
          <input
            type="text"
            value={naLabel}
            onChange={(e) => updateConfig("naLabel", e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-[#8C8A97] dark:bg-[#1A1A1E] dark:text-[#CBC9DE] bg-white text-xs"
            placeholder="Not applicable / Don’t know"
          />
        )}

        <p className="text-[11px] text-gray-500">
          When selected, value will be stored as &quot;NA&quot; in answers.
        </p>
      </div>

      <p className="text-[11px] text-gray-500">
        Emojis themselves are fixed in the answer UI for visual consistency
        across surveys. This config controls analysis behavior, labels, and
        colors.
      </p>
    </div>
  );
}
