"use client";
import React from "react";

export default function MaxDiffConfig({ config = {}, updateConfig }) {
  const items = config.items || [];
  const setSize = config.setSize ?? 4;
  const numSets = config.numSets ?? 4;
  const randomize = config.randomize ?? true;

  const handleItemChange = (index, value) => {
    const next = [...items];
    next[index] = value;
    updateConfig("items", next);
  };

  const handleAddItem = () => {
    const next = [...items, `Option ${items.length + 1}`];
    updateConfig("items", next);
  };

  const handleRemoveItem = (index) => {
    const next = items.filter((_, i) => i !== index);
    updateConfig("items", next);
  };

  const handleNumberChange = (key, value) => {
    const num = parseInt(value, 10);
    if (Number.isNaN(num)) return;
    updateConfig(key, num);
  };

  return (
    <div className="space-y-4 p-4">
      <p className="text-xs text-gray-500 dark:text-[#96949C]">
        MaxDiff (Best–Worst Scaling): respondents see a small set of items and
        pick the <b>most</b> and <b>least</b> important/appealing each time.
      </p>

      {/* Items list */}
      <div className="space-y-2">
        <label className="block text-sm dark:text-[#CBC9DE] text-slate-800">
          Items to compare
        </label>

        <div className="space-y-2">
          {items.map((item, idx) => (
            <div key={idx} className="flex gap-2">
              <input
                type="text"
                className="flex-1 px-3 py-2 rounded-lg border border-[#8C8A97] dark:bg-[#1A1A1E] bg-white/80 text-sm dark:text-[#CBC9DE] text-slate-800"
                value={item}
                onChange={(e) => handleItemChange(idx, e.target.value)}
                placeholder={`Item ${idx + 1}`}
              />
              <button
                type="button"
                onClick={() => handleRemoveItem(idx)}
                className="px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white/70 dark:bg-[#1A1A1E] dark:text-[#96949C] hover:bg-red-50 hover:border-red-300 transition"
              >
                ✕
              </button>
            </div>
          ))}

          <button
            type="button"
            onClick={handleAddItem}
            className="text-xs px-3 py-2 rounded-lg border border-dashed border-slate-300 dark:border-[#3A3A40] bg-white/60 dark:bg-[#1A1A1E] hover:bg-slate-50 dark:hover:bg-[#25252A] transition"
          >
            + Add item
          </button>
        </div>
      </div>

      {/* Layout options */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-1">
          <label className="block text-sm dark:text-[#CBC9DE] text-slate-800">
            Items per screen
          </label>
          <input
            type="number"
            min={2}
            max={items.length || 10}
            value={setSize}
            onChange={(e) => handleNumberChange("setSize", e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-[#8C8A97] dark:bg-[#1A1A1E] bg-white/80 text-sm dark:text-[#CBC9DE] text-slate-800"
          />
          <p className="text-[10px] text-gray-400">
            Typical values: 3–5 items visible per task.
          </p>
        </div>

        <div className="space-y-1">
          <label className="block text-sm dark:text-[#CBC9DE] text-slate-800">
            Number of screens
          </label>
          <input
            type="number"
            min={1}
            value={numSets}
            onChange={(e) => handleNumberChange("numSets", e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-[#8C8A97] dark:bg-[#1A1A1E] bg-white/80 text-sm dark:text-[#CBC9DE] text-slate-800"
          />
          <p className="text-[10px] text-gray-400">
            How many times they will see a set and choose best / worst.
          </p>
        </div>

        <div className="space-y-1">
          <label className="block text-sm dark:text-[#CBC9DE] text-slate-800">
            Randomize item order
          </label>
          <div className="flex items-center gap-2 mt-1">
            <input
              type="checkbox"
              checked={Boolean(randomize)}
              onChange={(e) => updateConfig("randomize", e.target.checked)}
              className="h-4 w-4"
            />
            <span className="text-xs dark:text-[#96949C] text-slate-600">
              Shuffle items across screens to reduce order bias.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
