// components/QuestionsConfigComponents/SliderConfig.jsx
"use client";

import React from "react";

export default function SliderConfig({ config = {}, updateConfig }) {
  const {
    min = 0,
    max = 100,
    step = 1,
    prefix = "",
    suffix = "",
    showValue = true,
    showTicks = true,
    snapToAnchors = true,
    anchors = [],
  } = config;

  const handleNumber = (key) => (e) => {
    const raw = e.target.value;
    const num = raw === "" ? "" : Number(raw);
    updateConfig(key, Number.isNaN(num) ? "" : num);
  };

  const handleText = (key) => (e) => {
    updateConfig(key, e.target.value);
  };

  const handleToggle = (key) => (e) => {
    updateConfig(key, e.target.checked);
  };

  const handleAnchorChange = (index, field, newValue) => {
    const next = [...(anchors || [])];
    next[index] = {
      ...next[index],
      [field]: field === "value" ? Number(newValue) || 0 : newValue,
    };
    updateConfig("anchors", next);
  };

  const handleAddAnchor = () => {
    const base = Number.isFinite(max) ? max : 100;
    const next = [
      ...(anchors || []),
      { value: base, label: `Label ${anchors.length + 1}` },
    ];
    updateConfig("anchors", next);
  };

  const handleRemoveAnchor = (index) => {
    const next = (anchors || []).filter((_, i) => i !== index);
    updateConfig("anchors", next);
  };

  return (
    <div className="space-y-5">
      {/* Scale basics */}
      <div>
        <h4 className="text-sm font-medium mb-3 dark:text-[#CBC9DE]">
          Scale settings
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs mb-1 dark:text-[#96949C]">
              Min value
            </label>
            <input
              type="number"
              className="w-full px-3 py-2 rounded-md border dark:bg-[#1A1A1E] dark:text-[#CBC9DE]"
              value={min}
              onChange={handleNumber("min")}
            />
          </div>
          <div>
            <label className="block text-xs mb-1 dark:text-[#96949C]">
              Max value
            </label>
            <input
              type="number"
              className="w-full px-3 py-2 rounded-md border dark:bg-[#1A1A1E] dark:text-[#CBC9DE]"
              value={max}
              onChange={handleNumber("max")}
            />
          </div>
          <div>
            <label className="block text-xs mb-1 dark:text-[#96949C]">
              Step
            </label>
            <input
              type="number"
              className="w-full px-3 py-2 rounded-md border dark:bg-[#1A1A1E] dark:text-[#CBC9DE]"
              value={step}
              onChange={handleNumber("step")}
              min={1}
            />
          </div>
          <div>
            <label className="block text-xs mb-1 dark:text-[#96949C]">
              Default value
            </label>
            <input
              type="number"
              className="w-full px-3 py-2 rounded-md border dark:bg-[#1A1A1E] dark:text-[#CBC9DE]"
              value={config.startValue ?? ""}
              onChange={handleNumber("startValue")}
            />
          </div>
        </div>
      </div>

      {/* Formatting */}
      <div>
        <h4 className="text-sm font-medium mb-3 dark:text-[#CBC9DE]">
          Display formatting
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs mb-1 dark:text-[#96949C]">
              Prefix (e.g. ₹)
            </label>
            <input
              type="text"
              className="w-full px-3 py-2 rounded-md border dark:bg-[#1A1A1E] dark:text-[#CBC9DE]"
              value={prefix}
              onChange={handleText("prefix")}
            />
          </div>
          <div>
            <label className="block text-xs mb-1 dark:text-[#96949C]">
              Suffix (e.g. %)
            </label>
            <input
              type="text"
              className="w-full px-3 py-2 rounded-md border dark:bg-[#1A1A1E] dark:text-[#CBC9DE]"
              value={suffix}
              onChange={handleText("suffix")}
            />
          </div>
          <div className="flex flex-col justify-center gap-2">
            <label className="inline-flex items-center gap-2 text-xs dark:text-[#96949C]">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={showValue}
                onChange={handleToggle("showValue")}
              />
              Show numeric value beside slider
            </label>
            <label className="inline-flex items-center gap-2 text-xs dark:text-[#96949C]">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={showTicks}
                onChange={handleToggle("showTicks")}
              />
              Show tick marks / labels
            </label>
            <label className="inline-flex items-center gap-2 text-xs dark:text-[#96949C]">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={snapToAnchors}
                onChange={handleToggle("snapToAnchors")}
              />
              Snap to nearest anchor label
            </label>
          </div>
        </div>
      </div>

      {/* Anchors */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-medium dark:text-[#CBC9DE]">
            Anchor points (advanced labels)
          </h4>
          <button
            type="button"
            onClick={handleAddAnchor}
            className="px-3 py-1.5 text-xs rounded-lg bg-[#ED7A13] text-white hover:brightness-110"
          >
            + Add anchor
          </button>
        </div>

        {(!anchors || anchors.length === 0) && (
          <p className="text-xs text-gray-500 dark:text-[#96949C]">
            Add anchors like 0 = &quot;Very low&quot;, 50 = &quot;Neutral&quot;,
            100 = &quot;Very high&quot;. These create ticks and tooltips for the
            respondent.
          </p>
        )}

        <div className="space-y-2">
          {(anchors || []).map((a, i) => (
            <div
              key={i}
              className="grid grid-cols-[90px,1fr,auto] gap-2 items-center bg-white/5 dark:bg-[#1A1A1E] border rounded-lg px-3 py-2"
            >
              <input
                type="number"
                className="px-2 py-1.5 text-xs rounded border dark:bg-[#121214] dark:text-[#CBC9DE]"
                value={a.value}
                onChange={(e) =>
                  handleAnchorChange(i, "value", e.target.value)
                }
              />
              <input
                type="text"
                className="px-2 py-1.5 text-xs rounded border dark:bg-[#121214] dark:text-[#CBC9DE]"
                placeholder="Label (eg. Very satisfied)"
                value={a.label || ""}
                onChange={(e) =>
                  handleAnchorChange(i, "label", e.target.value)
                }
              />
              <button
                type="button"
                onClick={() => handleRemoveAnchor(i)}
                className="text-[10px] px-2 py-1 rounded bg-red-50 text-red-600 dark:bg-red-900/40 dark:text-red-200"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
