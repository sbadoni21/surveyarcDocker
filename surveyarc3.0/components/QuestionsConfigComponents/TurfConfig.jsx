"use client";
import React from "react";

export default function TurfProConfig({ config = {}, updateConfig }) {
  const { options = [], responseScale = {}, portfolioMax = 3 } = config;

  const updateOptionLabel = (i, label) => {
    const copy = [...options];
    copy[i].label = label;
    updateConfig("options", copy);
  };

  return (
    <div className="space-y-4">

      {/* Options */}
      <div>
        <label className="text-sm dark:text-[#96949C]">Options</label>
        {options.map((opt, i) => (
          <div key={opt.id} className="grid grid-cols-3 gap-2 mt-2">
            <input
              value={opt.label}
              onChange={(e) => updateOptionLabel(i, e.target.value)}
              className="col-span-2 px-3 py-2 border rounded-md dark:bg-[#1A1A1E]"
            />
            <input
              type="number"
              step="0.01"
              value={opt.baseReach}
              onChange={(e) => {
                const copy = [...options];
                copy[i].baseReach = Number(e.target.value);
                updateConfig("options", copy);
              }}
              className="px-3 py-2 border rounded-md"
            />
          </div>
        ))}

        <button
          className="mt-2 px-3 py-1 bg-[#ED7A13] text-white text-xs rounded"
          onClick={() =>
            updateConfig("options", [
              ...options,
              { id: `opt_${options.length}`, label: "New Option", baseReach: 0.1 }
            ])
          }
        >
          + Add Option
        </button>
      </div>

      {/* Portfolio Size */}
      <div>
        <label className="text-sm dark:text-[#96949C]">Max Items in Portfolio</label>
        <input
          type="number"
          value={portfolioMax}
          onChange={(e) => updateConfig("portfolioMax", Number(e.target.value))}
          className="w-24 px-3 py-2 border rounded-md dark:bg-[#1A1A1E]"
        />
      </div>

      {/* Response Scale (weighted reach) */}
      <div className="space-y-2">
        <label className="text-sm dark:text-[#96949C]">Response Preference Weight</label>
        {Object.entries(responseScale).map(([key, val]) => (
          <div key={key} className="grid grid-cols-2 gap-2">
            <span className="text-xs pt-2">Scale {key}</span>
            <input
              type="number"
              step="0.01"
              value={val.reachValue}
              onChange={(e) =>
                updateConfig("responseScale", {
                  ...responseScale,
                  [key]: {
                    ...val,
                    reachValue: Number(e.target.value)
                  }
                })
              }
              className="px-3 py-2 border rounded-md dark:bg-[#1A1A1E]"
            />
          </div>
        ))}
      </div>

      <p className="text-xs text-gray-500 dark:text-[#96949C]">
        TURF simulations will be generated in Analytics view.
      </p>
    </div>
  );
}
