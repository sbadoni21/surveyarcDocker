"use client";
import React from "react";

export default function SemanticDiffConfig({ config, updateConfig }) {
  const items = config.items || [];

  const handleItemChange = (idx, field, value) => {
    const next = items.map((it, i) =>
      i === idx ? { ...it, [field]: value } : it
    );
    updateConfig("items", next);
  };

  const addRow = () => {
    const next = [
      ...items,
      {
        id: `sd_${items.length + 1}`,
        left: "Left label",
        right: "Right label",
      },
    ];
    updateConfig("items", next);
  };

  const removeRow = (idx) => {
    const next = items.filter((_, i) => i !== idx);
    updateConfig("items", next);
  };

  return (
    <div className="space-y-4 p-3">
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs mb-1 dark:text-[#96949C]">
            Min value
          </label>
          <input
            type="number"
            className="w-full px-3 py-2 rounded-lg border dark:bg-[#1A1A1E] dark:text-[#CBC9DE] border-[#8C8A97] text-sm"
            value={config.scaleMin ?? 1}
            onChange={(e) =>
              updateConfig("scaleMin", Number(e.target.value) || 1)
            }
          />
        </div>

        <div>
          <label className="block text-xs mb-1 dark:text-[#96949C]">
            Max value
          </label>
          <input
            type="number"
            className="w-full px-3 py-2 rounded-lg border dark:bg-[#1A1A1E] dark:text-[#CBC9DE] border-[#8C8A97] text-sm"
            value={config.scaleMax ?? 7}
            onChange={(e) =>
              updateConfig("scaleMax", Number(e.target.value) || 7)
            }
          />
        </div>

        <div className="flex items-end gap-2">
          <input
            id="sd_show_numbers"
            type="checkbox"
            checked={!!config.showNumbers}
            onChange={(e) => updateConfig("showNumbers", e.target.checked)}
            className="h-4 w-4"
          />
          <label
            htmlFor="sd_show_numbers"
            className="text-xs dark:text-[#96949C]"
          >
            Show numbers on scale
          </label>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-xs font-medium dark:text-[#96949C]">
            Row pairs (left vs right)
          </span>
          <button
            type="button"
            onClick={addRow}
            className="text-xs px-3 py-1 rounded-lg bg-[#ED7A13] text-white"
          >
            + Add row
          </button>
        </div>

        {items.length === 0 && (
          <p className="text-xs text-gray-500">
            No rows yet. Click &quot;Add row&quot; to create a pair.
          </p>
        )}

        <div className="space-y-2">
          {items.map((item, idx) => (
            <div
              key={item.id || idx}
              className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center"
            >
              <input
                type="text"
                className="px-3 py-2 rounded-lg border dark:bg-[#1A1A1E] dark:text-[#CBC9DE] border-[#8C8A97] text-xs"
                placeholder="Left label"
                value={item.left || ""}
                onChange={(e) =>
                  handleItemChange(idx, "left", e.target.value)
                }
              />
              <input
                type="text"
                className="px-3 py-2 rounded-lg border dark:bg-[#1A1A1E] dark:text-[#CBC9DE] border-[#8C8A97] text-xs"
                placeholder="Right label"
                value={item.right || ""}
                onChange={(e) =>
                  handleItemChange(idx, "right", e.target.value)
                }
              />
              <button
                type="button"
                onClick={() => removeRow(idx)}
                className="text-xs px-2 py-1 rounded-lg border border-red-200 text-red-600 hover:bg-red-50"
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
