"use client";
import React, { useMemo } from "react";

export default function MultiGridConfig({ config = {}, updateConfig }) {
  const rows = useMemo(
    () =>
      Array.isArray(config.rows) && config.rows.length > 0
        ? config.rows
        : ["Feature A", "Feature B", "Feature C"],
    [config.rows]
  );

  const columns = useMemo(
    () =>
      Array.isArray(config.columns) && config.columns.length > 0
        ? config.columns
        : ["Very important", "Important", "Neutral", "Not important"],
    [config.columns]
  );

  const randomizeRows = Boolean(config.randomizeRows);
  const randomizeColumns = Boolean(config.randomizeColumns);
  const minSelectionsPerRow =
    typeof config.minSelectionsPerRow === "number"
      ? config.minSelectionsPerRow
      : 0;
  const maxSelectionsPerRow =
    typeof config.maxSelectionsPerRow === "number"
      ? config.maxSelectionsPerRow
      : null;
  const requireAllRows = Boolean(config.requireAllRows);
  const showRowNumbers = Boolean(config.showRowNumbers);
  const layout = config.layout === "compact" ? "compact" : "comfortable";

  const handleRowsChange = (e) => {
    const next = e.target.value
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    updateConfig("rows", next);
  };

  const handleColumnsChange = (e) => {
    const next = e.target.value
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    updateConfig("columns", next);
  };

  const handleMinChange = (e) => {
    const v = parseInt(e.target.value, 10);
    updateConfig("minSelectionsPerRow", Number.isNaN(v) ? 0 : Math.max(0, v));
  };

  const handleMaxChange = (e) => {
    const v = parseInt(e.target.value, 10);
    if (Number.isNaN(v) || v <= 0) {
      updateConfig("maxSelectionsPerRow", null);
    } else {
      updateConfig("maxSelectionsPerRow", v);
    }
  };

  return (
    <div className="space-y-4 text-sm">
      {/* Rows */}
      <div className="space-y-1">
        <label className="block dark:text-[#CBC9DE] text-[#111827]">
          Rows (one per line)
        </label>
        <textarea
          rows={4}
          className="w-full px-3 py-2 rounded-lg border border-[#8C8A97] dark:bg-[#1A1A1E] dark:text-[#CBC9DE] bg-white"
          value={rows.join("\n")}
          onChange={handleRowsChange}
          placeholder={"Feature A\nFeature B\nFeature C"}
        />
        <p className="text-xs text-gray-500">
          Each row is typically a feature, attribute, or brand.
        </p>
      </div>

      {/* Columns */}
      <div className="space-y-1">
        <label className="block dark:text-[#CBC9DE] text-[#111827]">
          Columns (comma-separated)
        </label>
        <input
          type="text"
          className="w-full px-3 py-2 rounded-lg border border-[#8C8A97] dark:bg-[#1A1A1E] dark:text-[#CBC9DE] bg-white"
          value={columns.join(", ")}
          onChange={handleColumnsChange}
          placeholder="Very important, Important, Neutral, Not important"
        />
        <p className="text-xs text-gray-500">
          These are the response options repeated for each row.
        </p>
      </div>

      {/* Randomization */}
      <div className="flex flex-col gap-2">
        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={randomizeRows}
            onChange={(e) => updateConfig("randomizeRows", e.target.checked)}
            className="h-4 w-4"
          />
          <span className="dark:text-[#CBC9DE] text-[#111827]">
            Randomize row order (per respondent)
          </span>
        </label>

        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={randomizeColumns}
            onChange={(e) => updateConfig("randomizeColumns", e.target.checked)}
            className="h-4 w-4"
          />
          <span className="dark:text-[#CBC9DE] text-[#111827]">
            Randomize column order (per respondent)
          </span>
        </label>
      </div>

      {/* Constraints */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="block dark:text-[#CBC9DE] text-[#111827]">
            Min selections per row
          </label>
          <input
            type="number"
            min={0}
            max={columns.length}
            value={minSelectionsPerRow}
            onChange={handleMinChange}
            className="w-full px-3 py-2 rounded-lg border border-[#8C8A97] dark:bg-[#1A1A1E] dark:text-[#CBC9DE] bg-white"
          />
          <p className="text-xs text-gray-500">
            0 = no minimum required for that row.
          </p>
        </div>

        <div className="space-y-1">
          <label className="block dark:text-[#CBC9DE] text-[#111827]">
            Max selections per row
          </label>
          <input
            type="number"
            min={1}
            max={columns.length}
            value={maxSelectionsPerRow ?? ""}
            onChange={handleMaxChange}
            className="w-full px-3 py-2 rounded-lg border border-[#8C8A97] dark:bg-[#1A1A1E] dark:text-[#CBC9DE] bg-white"
            placeholder="Leave blank for no limit"
          />
          <p className="text-xs text-gray-500">
            Leave empty for &quot;any number&quot; in a row.
          </p>
        </div>
      </div>

      {/* Extra flags */}
      <div className="flex flex-col gap-2">
        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={requireAllRows}
            onChange={(e) => updateConfig("requireAllRows", e.target.checked)}
            className="h-4 w-4"
          />
          <span className="dark:text-[#CBC9DE] text-[#111827]">
            Require response for every row
          </span>
        </label>

        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={showRowNumbers}
            onChange={(e) => updateConfig("showRowNumbers", e.target.checked)}
            className="h-4 w-4"
          />
          <span className="dark:text-[#CBC9DE] text-[#111827]">
            Show row numbers (1., 2., 3., ...)
          </span>
        </label>
      </div>

      {/* Layout toggle */}
      <div className="space-y-1">
        <label className="block dark:text-[#CBC9DE] text-[#111827]">
          Layout density
        </label>
        <select
          value={layout}
          onChange={(e) => updateConfig("layout", e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-[#8C8A97] dark:bg-[#1A1A1E] dark:text-[#CBC9DE] bg-white"
        >
          <option value="comfortable">Comfortable</option>
          <option value="compact">Compact</option>
        </select>
        <p className="text-xs text-gray-500">
          Use compact for long grids or mobile-heavy surveys.
        </p>
      </div>
    </div>
  );
}
