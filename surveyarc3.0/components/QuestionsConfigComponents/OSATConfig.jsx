"use client";
import React, { useEffect } from "react";

export default function OSATConfig({ config, updateConfig }) {
  const min = config.min ?? 1;
  const max = config.max ?? 5;

  // Initialize labels dynamically when min/max changes
  useEffect(() => {
    const updatedLabels = { ...config.labels };

    for (let i = min; i <= max; i++) {
      if (!updatedLabels[i]) {
        updatedLabels[i] = ""; // default empty
      }
    }

    // Remove labels outside range
    Object.keys(updatedLabels).forEach((key) => {
      const numKey = parseInt(key);
      if (numKey < min || numKey > max) delete updatedLabels[key];
    });

    updateConfig("labels", updatedLabels);
  }, [min, max]);

  const handleMinChange = (e) =>
    updateConfig("min", parseInt(e.target.value) || 1);

  const handleMaxChange = (e) =>
    updateConfig("max", parseInt(e.target.value) || 5);

  const handleLabelChange = (index, value) => {
    updateConfig("labels", {
      ...config.labels,
      [index]: value,
    });
  };

  return (
    <div className="space-y-4 dark:bg-[#1A1A1E] dark:text-[#96949C] p-2">

      <h3 className="font-semibold mb-2">OSAT Question Settings</h3>

      {/* Min / Max */}
      <div className="flex gap-4">
        <div className="flex-1">
          <label className="block text-sm">Min Value</label>
          <input
            type="number"
            className="w-full border p-2 rounded dark:bg-[#1A1A1E] dark:text-[#96949C]"
            value={min}
            onChange={handleMinChange}
            onWheel={(e) => e.target.blur()}
          />
        </div>

        <div className="flex-1">
          <label className="block text-sm">Max Value</label>
          <input
            type="number"
            className="w-full border p-2 rounded dark:bg-[#1A1A1E] dark:text-[#96949C]"
            value={max}
            onChange={handleMaxChange}
            onWheel={(e) => e.target.blur()}
          />
        </div>
      </div>

      {/* Per-number labels */}
      <div className="space-y-3">
        <label className="block text-sm font-medium">Labels per Score</label>

        {Array.from({ length: max - min + 1 }, (_, idx) => {
          const number = min + idx;
          return (
            <div key={number} className="flex items-center gap-3">
              <div className="w-10 text-sm font-semibold">{number}</div>
              <input
                type="text"
                className="flex-1 border p-2 rounded dark:bg-[#1A1A1E] dark:text-[#CBC9DE]"
                placeholder={`Label for ${number}`}
                value={config.labels?.[number] || ""}
                onChange={(e) => handleLabelChange(number, e.target.value)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
