"use client";
import React, { useMemo } from "react";

export default function MatrixRatingConfig({ config = {}, updateConfig }) {
  const rows = useMemo(
    () =>
      Array.isArray(config.rows) && config.rows.length > 0
        ? config.rows
        : ["Service Quality", "Product Quality", "Price", "Support"],
    [config.rows]
  );

  const columns = useMemo(
    () =>
      Array.isArray(config.columns) && config.columns.length > 0
        ? config.columns
        : ["Brand A", "Brand B", "Brand C"],
    [config.columns]
  );

  const scaleMin =
    typeof config.scaleMin === "number" ? config.scaleMin : 1;
  const scaleMax =
    typeof config.scaleMax === "number" ? config.scaleMax : 5;

  const lowLabel = config.lowLabel ?? "Very Poor";
  const highLabel = config.highLabel ?? "Excellent";
  const neutralLabel = config.neutralLabel ?? "Average";

  const colorMode =
    config.colorMode === "mono" || config.colorMode === "diverging"
      ? config.colorMode
      : "diverging";

  const randomizeRows = Boolean(config.randomizeRows);
  const randomizeColumns = Boolean(config.randomizeColumns);
  const showNumbers = config.showNumbers !== false;
  const requireAllCells = Boolean(config.requireAllCells);
  const requireAllRows = Boolean(config.requireAllRows);
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

  const handleScaleMinChange = (e) => {
    const v = parseInt(e.target.value, 10);
    const safe = Number.isNaN(v) ? 1 : Math.max(0, v);
    updateConfig("scaleMin", safe);
    if (safe >= scaleMax) {
      updateConfig("scaleMax", safe + 1);
    }
  };

  const handleScaleMaxChange = (e) => {
    const v = parseInt(e.target.value, 10);
    const safe = Number.isNaN(v) ? 5 : Math.max(scaleMin + 1, v);
    updateConfig("scaleMax", safe);
  };

  return (
    <div className="space-y-4 text-sm">
      {/* Rows */}
      <div className="space-y-1">
        <label className="block dark:text-[#CBC9DE] text-[#111827]">
          Rows (statements / attributes) – one per line
        </label>
        <textarea
          rows={4}
          className="w-full px-3 py-2 rounded-lg border border-[#8C8A97] dark:bg-[#1A1A1E] dark:text-[#CBC9DE] bg-white"
          value={rows.join("\n")}
          onChange={handleRowsChange}
          placeholder={"Service Quality\nProduct Quality\nPrice\nSupport"}
        />
        <p className="text-xs text-gray-500">
          Each row is a statement or KPI you want rated across all brands/options.
        </p>
      </div>

      {/* Columns */}
      <div className="space-y-1">
        <label className="block dark:text-[#CBC9DE] text-[#111827]">
          Columns (brands / options) – comma separated
        </label>
        <input
          type="text"
          className="w-full px-3 py-2 rounded-lg border border-[#8C8A97] dark:bg-[#1A1A1E] dark:text-[#CBC9DE] bg-white"
          value={columns.join(", ")}
          onChange={handleColumnsChange}
          placeholder="Brand A, Brand B, Brand C"
        />
        <p className="text-xs text-gray-500">
          These will be shown as columns at the top of the grid.
        </p>
      </div>

      {/* Scale */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="block dark:text-[#CBC9DE] text-[#111827]">
            Scale minimum value
          </label>
          <input
            type="number"
            min={0}
            max={scaleMax - 1}
            value={scaleMin}
            onChange={handleScaleMinChange}
            className="w-full px-3 py-2 rounded-lg border border-[#8C8A97] dark:bg-[#1A1A1E] dark:text-[#CBC9DE] bg-white"
          />
        </div>
        <div className="space-y-1">
          <label className="block dark:text-[#CBC9DE] text-[#111827]">
            Scale maximum value
          </label>
          <input
            type="number"
            min={scaleMin + 1}
            max={11}
            value={scaleMax}
            onChange={handleScaleMaxChange}
            className="w-full px-3 py-2 rounded-lg border border-[#8C8A97] dark:bg-[#1A1A1E] dark:text-[#CBC9DE] bg-white"
          />
        </div>
      </div>

      {/* Labels */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="space-y-1">
          <label className="block dark:text-[#CBC9DE] text-[#111827]">
            Low-end label
          </label>
          <input
            type="text"
            value={lowLabel}
            onChange={(e) => updateConfig("lowLabel", e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-[#8C8A97] dark:bg-[#1A1A1E] dark:text-[#CBC9DE] bg-white"
            placeholder="Very Poor"
          />
        </div>
        <div className="space-y-1">
          <label className="block dark:text-[#CBC9DE] text-[#111827]">
            Neutral label (optional)
          </label>
          <input
            type="text"
            value={neutralLabel}
            onChange={(e) => updateConfig("neutralLabel", e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-[#8C8A97] dark:bg-[#1A1A1E] dark:text-[#CBC9DE] bg-white"
            placeholder="Average"
          />
        </div>
        <div className="space-y-1">
          <label className="block dark:text-[#CBC9DE] text-[#111827]">
            High-end label
          </label>
          <input
            type="text"
            value={highLabel}
            onChange={(e) => updateConfig("highLabel", e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-[#8C8A97] dark:bg-[#1A1A1E] bg-white dark:text-[#CBC9DE]"
            placeholder="Excellent"
          />
        </div>
      </div>

      {/* Color mode + options */}
      <div className="space-y-2">
        <label className="block dark:text-[#CBC9DE] text-[#111827]">
          Color mode
        </label>
        <select
          value={colorMode}
          onChange={(e) => updateConfig("colorMode", e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-[#8C8A97] dark:bg-[#1A1A1E] dark:text-[#CBC9DE] bg-white"
        >
          <option value="diverging">
            Diverging (red → amber → green heatmap)
          </option>
          <option value="mono">
            Monochrome (single-color intensity)
          </option>
        </select>
        <p className="text-xs text-gray-500">
          Used only for visual emphasis on the grid – analysis is numeric.
        </p>
      </div>

      {/* Toggles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
            onChange={(e) =>
              updateConfig("randomizeColumns", e.target.checked)
            }
            className="h-4 w-4"
          />
          <span className="dark:text-[#CBC9DE] text-[#111827]">
            Randomize column order (per respondent)
          </span>
        </label>

        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={showNumbers}
            onChange={(e) => updateConfig("showNumbers", e.target.checked)}
            className="h-4 w-4"
          />
          <span className="dark:text-[#CBC9DE] text-[#111827]">
            Show numeric values inside circles
          </span>
        </label>

        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={requireAllCells}
            onChange={(e) => updateConfig("requireAllCells", e.target.checked)}
            className="h-4 w-4"
          />
          <span className="dark:text-[#CBC9DE] text-[#111827]">
            Require every cell to be answered
          </span>
        </label>

        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={requireAllRows}
            onChange={(e) => updateConfig("requireAllRows", e.target.checked)}
            className="h-4 w-4"
          />
          <span className="dark:text-[#CBC9DE] text-[#111827]">
            Require at least one rating per row
          </span>
        </label>
      </div>

      {/* Layout */}
      <div className="space-y-1">
        <label className="block dark:text-[#CBC9DE] text-[#111827]">
          Layout density
        </label>
        <select
          value={layout}
          onChange={(e) => updateConfig("layout", e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-[#8C8A97] dark:bg-[#1A1A1E] dark:text-[#CBC9DE] bg-white"
        >
          <option value="comfortable">Comfortable (larger buttons)</option>
          <option value="compact">Compact (smaller for long grids)</option>
        </select>
      </div>
    </div>
  );
}
