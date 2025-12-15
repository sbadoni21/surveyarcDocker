"use client";
import React, { useEffect } from "react";

export default function YesNoConfig({ config = {}, updateConfig }) {
  const yesLabel = config.yesLabel ?? "Yes";
  const noLabel = config.noLabel ?? "No";
  const showIcons = config.showIcons ?? true;
  const yesIcon = config.yesIcon ?? "✓";
  const noIcon = config.noIcon ?? "✕";
  const layout = config.layout ?? "horizontal";
  const yesColor = config.yesColor ?? "#10B981";
  const noColor = config.noColor ?? "#EF4444";

  /* --------------------------------------------------
     INITIALIZE DEFAULTS (LIKE OSAT useEffect)
  -------------------------------------------------- */
  useEffect(() => {
    if (!("yesLabel" in config)) updateConfig("yesLabel", "Yes");
    if (!("noLabel" in config)) updateConfig("noLabel", "No");
    if (!("showIcons" in config)) updateConfig("showIcons", true);
    if (!("yesIcon" in config)) updateConfig("yesIcon", "✓");
    if (!("noIcon" in config)) updateConfig("noIcon", "✕");
    if (!("layout" in config)) updateConfig("layout", "horizontal");
    if (!("yesColor" in config)) updateConfig("yesColor", "#10B981");
    if (!("noColor" in config)) updateConfig("noColor", "#EF4444");
  }, []);

  /* --------------------------------------------------
     RENDER
  -------------------------------------------------- */

  return (
    <div className="space-y-5 p-4">
      <p className="text-xs text-gray-500">
        Simple Yes/No question with customizable labels and layout.
      </p>

      {/* Labels */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">Yes Label</label>
          <input
            value={yesLabel}
            onChange={(e) => updateConfig("yesLabel", e.target.value)}
            className="w-full px-3 py-2 border rounded"
          />
        </div>

        <div>
          <label className="text-sm font-medium">No Label</label>
          <input
            value={noLabel}
            onChange={(e) => updateConfig("noLabel", e.target.value)}
            className="w-full px-3 py-2 border rounded"
          />
        </div>
      </div>

      {/* Icons */}
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={showIcons}
          onChange={(e) => updateConfig("showIcons", e.target.checked)}
        />
        Show icons
      </label>

      {showIcons && (
        <div className="grid grid-cols-2 gap-4 ml-6">
          <input
            value={yesIcon}
            onChange={(e) => updateConfig("yesIcon", e.target.value)}
            placeholder="✓"
            className="px-3 py-2 border rounded"
          />
          <input
            value={noIcon}
            onChange={(e) => updateConfig("noIcon", e.target.value)}
            placeholder="✕"
            className="px-3 py-2 border rounded"
          />
        </div>
      )}

      {/* Layout */}
      <div>
        <label className="text-sm font-medium">Layout</label>
        <div className="flex gap-4">
          <label>
            <input
              type="radio"
              checked={layout === "horizontal"}
              onChange={() => updateConfig("layout", "horizontal")}
            />
            Horizontal
          </label>

          <label>
            <input
              type="radio"
              checked={layout === "vertical"}
              onChange={() => updateConfig("layout", "vertical")}
            />
            Vertical
          </label>
        </div>
      </div>

      {/* Colors */}
      <div className="grid grid-cols-2 gap-4">
        <input
          type="color"
          value={yesColor}
          onChange={(e) => updateConfig("yesColor", e.target.value)}
        />
        <input
          type="color"
          value={noColor}
          onChange={(e) => updateConfig("noColor", e.target.value)}
        />
      </div>

      {/* Preview */}
      <div className={`flex ${layout === "vertical" ? "flex-col" : "flex-row"} gap-3`}>
        <button style={{ borderColor: yesColor, color: yesColor }} className="border px-4 py-2">
          {showIcons && yesIcon} {yesLabel}
        </button>
        <button style={{ borderColor: noColor, color: noColor }} className="border px-4 py-2">
          {showIcons && noIcon} {noLabel}
        </button>
      </div>
    </div>
  );
}
