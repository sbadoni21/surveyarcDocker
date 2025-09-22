"use client";
import React from "react";
import { RiDeleteBinLine } from "react-icons/ri";

export default function RankingConfig({ config, updateConfig }) {
  const items = Array.isArray(config.items) ? config.items : [];

  const handleItemChange = (index, value) => {
    const newItems = [...items];
    newItems[index] = value;
    updateConfig("items", newItems);
  };

  const addItem = () => {
    updateConfig("items", [...items, ""]);
  };

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
          <input
            type="text"
            value={item}
            onChange={(e) => handleItemChange(index, e.target.value)}
            placeholder={`Item ${index + 1}`}
            className="w-full border border-gray-300 rounded p-2"
          />
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
        These items will be shown in a drag-and-drop list for ranking.
      </p>
    </div>
  );
}
