"use client";

import React from "react";
import { RiDeleteBinLine } from "react-icons/ri";

/**
 * Generate next serial label like A1, A2, A3…
 * Skips gaps but always increments max number
 */
function generateNextOptionSerial(items = [], prefix = "A") {
  let max = 0;

  items.forEach((it) => {
    if (!it?.serial_label) return;
    const match = String(it.serial_label).match(
      new RegExp(`^${prefix}(\\d+)$`, "i")
    );
    if (match) {
      max = Math.max(max, parseInt(match[1], 10));
    }
  });

  return `${prefix}${max + 1}`;
}

export default function RankingConfig({ config, updateConfig }) {
  const items = Array.isArray(config.items) ? config.items : [];

  // --------------------------------------------------
  // ADD ITEM (auto serial)
  // --------------------------------------------------
  const addItem = () => {
    const nextSerial = generateNextOptionSerial(items, "A");
    updateConfig("items", [
      ...items,
      { label: "", serial_label: nextSerial },
    ]);
  };

  // --------------------------------------------------
  // REMOVE ITEM
  // --------------------------------------------------
  const removeItem = (index) => {
    const newItems = items.filter((_, i) => i !== index);
    updateConfig("items", newItems);
  };

  return (
    <div className="space-y-4 dark:bg-[#1A1A1E]">
      <label className="block font-semibold dark:text-[#96949C] text-gray-700">
        Items to Rank
      </label>

      {items.map((item, index) => (
        <div key={index} className="flex items-center gap-2">
          {/* SERIAL LABEL (A1, A2…) */}
          <input
            type="text"
            className="w-16 border border-gray-300 rounded p-2 text-center text-xs"
            value={item.serial_label || ""}
            placeholder={`A${index + 1}`}
            onChange={(e) => {
              const value = e.target.value.trim();
              const copy = [...items];

              // 🔒 prevent duplicates
              if (
                value &&
                copy.some(
                  (it, i) => i !== index && it.serial_label === value
                )
              ) {
                alert("Serial label must be unique");
                return;
              }

              copy[index] = {
                ...copy[index],
                serial_label: value,
              };
              updateConfig("items", copy);
            }}
          />

          {/* ITEM LABEL */}
          <input
            type="text"
            className="flex-1 border border-gray-300 rounded p-2"
            value={item.label || ""}
            placeholder={`Item ${index + 1}`}
            onChange={(e) => {
              const copy = [...items];
              copy[index] = {
                ...copy[index],
                label: e.target.value,
              };
              updateConfig("items", copy);
            }}
          />

          {/* DELETE */}
          <button
            type="button"
            onClick={() => removeItem(index)}
            className="text-red-500 text-sm hover:underline"
          >
            <RiDeleteBinLine size={22} />
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={addItem}
        className="bg-[#f5f5f5] text-black px-4 py-2 rounded text-sm font-medium"
      >
        + Add Item
      </button>

      <p className="text-sm text-gray-500 mt-2">
        Each item has a unique serial label used for logic, exports, and
        referencing.
      </p>
    </div>
  );
}
