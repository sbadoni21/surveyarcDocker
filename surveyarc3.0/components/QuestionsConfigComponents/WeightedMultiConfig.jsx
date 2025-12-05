"use client";
import React from "react";
import { v4 as uuidv4 } from "uuid";

function normalizeOptions(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map((o, idx) => {
    if (typeof o === "string") {
      return {
        id: `opt_${idx + 1}`,
        label: o,
        description: "",
        min: 0,
        max: 10,
        locked: false,
      };
    }
    return {
      id: o.id || `opt_${idx + 1}`,
      label: o.label || `Option ${idx + 1}`,
      description: o.description || "",
      min: typeof o.min === "number" ? o.min : 0,
      max: typeof o.max === "number" ? o.max : 10,
      locked: !!o.locked,
    };
  });
}

export default function WeightedMultiConfig({ config, updateConfig }) {
  const options = normalizeOptions(config.options || []);

  const set = (key, value) => updateConfig(key, value);

  const updateOption = (id, patch) => {
    const next = options.map((opt) =>
      opt.id === id ? { ...opt, ...patch } : opt
    );
    set("options", next);
  };

  const addOption = () => {
    const next = [
      ...options,
      {
        id: uuidv4(),
        label: `Option ${options.length + 1}`,
        description: "",
        min: config.minWeight ?? 0,
        max: config.maxWeight ?? 10,
        locked: false,
      },
    ];
    set("options", next);
  };

  const removeOption = (id) => {
    const next = options.filter((o) => o.id !== id);
    set("options", next);
  };

  const weightType = config.weightType || "slider";

  return (
    <div className="space-y-5 text-sm">
      {/* Weight Type */}
      <div>
        <label className="block mb-1 font-medium dark:text-[#CBC9DE]">
          Weight Input Type
        </label>
        <select
          value={weightType}
          onChange={(e) => set("weightType", e.target.value)}
          className="w-full p-2 rounded-md border dark:bg-[#1A1A1E] dark:text-[#CBC9DE]"
        >
          <option value="slider">Slider (0–10)</option>
          <option value="textbox">Numeric Box</option>
          <option value="scale">Fixed Scale (e.g., 1–10)</option>
        </select>
        <p className="mt-1 text-xs text-gray-400">
          Controls how respondents assign weights to each option.
        </p>
      </div>

      {/* Global Min/Max */}
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="block mb-1 font-medium dark:text-[#CBC9DE]">
            Global Min Weight
          </label>
          <input
            type="number"
            className="w-full p-2 rounded-md border dark:bg-[#1A1A1E] dark:text-[#CBC9DE]"
            value={config.minWeight ?? 0}
            onChange={(e) => set("minWeight", Number(e.target.value))}
          />
        </div>
        <div className="flex-1">
          <label className="block mb-1 font-medium dark:text-[#CBC9DE]">
            Global Max Weight
          </label>
          <input
            type="number"
            className="w-full p-2 rounded-md border dark:bg-[#1A1A1E] dark:text-[#CBC9DE]"
            value={config.maxWeight ?? 10}
            onChange={(e) => set("maxWeight", Number(e.target.value))}
          />
        </div>
      </div>

      {/* Total Limit */}
      <div className="flex items-center justify-between">
        <span className="dark:text-[#CBC9DE] font-medium">
          Enable Total Weight Cap
        </span>
        <input
          type="checkbox"
          checked={!!config.totalLimitEnabled}
          onChange={(e) => set("totalLimitEnabled", e.target.checked)}
        />
      </div>

      {config.totalLimitEnabled && (
        <div>
          <label className="block mb-1 font-medium dark:text-[#CBC9DE]">
            Total Max Weight
          </label>
          <input
            type="number"
            className="w-full p-2 rounded-md border dark:bg-[#1A1A1E] dark:text-[#CBC9DE]"
            value={config.totalMax ?? 100}
            onChange={(e) => set("totalMax", Number(e.target.value))}
          />
          <p className="mt-1 text-xs text-gray-400">
            Sum of all weights cannot exceed this value.
          </p>
        </div>
      )}

      {/* Validation Controls */}
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="block mb-1 font-medium dark:text-[#CBC9DE]">
            Min Options with &gt; 0 Weight
          </label>
          <input
            type="number"
            min={0}
            className="w-full p-2 rounded-md border dark:bg-[#1A1A1E] dark:text-[#CBC9DE]"
            value={config.requireMinAssigned ?? 1}
            onChange={(e) =>
              set("requireMinAssigned", Math.max(0, Number(e.target.value)))
            }
          />
        </div>
        <div className="flex-1">
          <label className="block mb-1 font-medium dark:text-[#CBC9DE]">
            Require Non-zero Total
          </label>
          <div className="flex items-center justify-between mt-1">
            <span className="text-xs text-gray-400">
              Total weight must be &gt; 0
            </span>
            <input
              type="checkbox"
              checked={!!config.requireNonZeroTotal}
              onChange={(e) => set("requireNonZeroTotal", e.target.checked)}
            />
          </div>
        </div>
      </div>

      {/* Toggles */}
      <div className="flex items-center justify-between">
        <span className="text-sm dark:text-[#CBC9DE]">Show Remaining Bar</span>
        <input
          type="checkbox"
          checked={!!config.showRemainingBar}
          onChange={(e) => set("showRemainingBar", e.target.checked)}
        />
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm dark:text-[#CBC9DE]">Show Total Weight</span>
        <input
          type="checkbox"
          checked={!!config.showTotal}
          onChange={(e) => set("showTotal", e.target.checked)}
        />
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm dark:text-[#CBC9DE]">Allow Zero Weight</span>
        <input
          type="checkbox"
          checked={!!config.allowZero}
          onChange={(e) => set("allowZero", e.target.checked)}
        />
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm dark:text-[#CBC9DE]">
          Normalize to 100 on Submit (metadata)
        </span>
        <input
          type="checkbox"
          checked={!!config.normalizeToTotal}
          onChange={(e) => set("normalizeToTotal", e.target.checked)}
        />
      </div>

      {/* Option List Editor */}
      <div className="mt-4 border-t pt-3 border-dashed border-gray-600/40">
        <div className="flex items-center justify-between mb-2">
          <h4 className="font-medium dark:text-[#CBC9DE]">Options</h4>
          <button
            type="button"
            onClick={addOption}
            className="px-3 py-1.5 rounded-md text-xs bg-[#ED7A13] text-white hover:brightness-110"
          >
            + Add Option
          </button>
        </div>

        <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
          {options.map((opt) => (
            <div
              key={opt.id}
              className="p-3 rounded-lg border dark:border-[#333] bg-white/60 dark:bg-[#1A1A1E]"
            >
              <div className="flex gap-2">
                <input
                  type="text"
                  className="flex-1 px-2 py-1 rounded border dark:bg-[#111] dark:text-[#CBC9DE]"
                  value={opt.label}
                  onChange={(e) =>
                    updateOption(opt.id, { label: e.target.value })
                  }
                  placeholder="Option label"
                />
                <button
                  type="button"
                  onClick={() => removeOption(opt.id)}
                  className="px-2 text-xs rounded bg-red-500/90 text-white hover:bg-red-600"
                >
                  Remove
                </button>
              </div>

              <textarea
                className="mt-2 w-full px-2 py-1 rounded border text-xs dark:bg-[#111] dark:text-[#CBC9DE]"
                value={opt.description || ""}
                onChange={(e) =>
                  updateOption(opt.id, { description: e.target.value })
                }
                placeholder="(Optional) description / example"
              />

              <div className="mt-2 flex gap-3 text-xs">
                <div className="flex-1">
                  <label className="block mb-0.5">Min</label>
                  <input
                    type="number"
                    className="w-full px-2 py-1 rounded border dark:bg-[#111] dark:text-[#CBC9DE]"
                    value={opt.min}
                    onChange={(e) =>
                      updateOption(opt.id, { min: Number(e.target.value) })
                    }
                  />
                </div>
                <div className="flex-1">
                  <label className="block mb-0.5">Max</label>
                  <input
                    type="number"
                    className="w-full px-2 py-1 rounded border dark:bg-[#111] dark:text-[#CBC9DE]"
                    value={opt.max}
                    onChange={(e) =>
                      updateOption(opt.id, { max: Number(e.target.value) })
                    }
                  />
                </div>
                <div className="flex items-center justify-between flex-1 mt-4">
                  <span>Lock</span>
                  <input
                    type="checkbox"
                    checked={opt.locked}
                    onChange={(e) =>
                      updateOption(opt.id, { locked: e.target.checked })
                    }
                  />
                </div>
              </div>
            </div>
          ))}

          {options.length === 0 && (
            <p className="text-xs text-gray-500">
              No options yet. Click &quot;Add Option&quot; to start.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
