"use client";
import React, { useMemo } from "react";

export default function TableGridConfig({ config = {}, updateConfig }) {
  const rows = useMemo(
    () =>
      Array.isArray(config.rows) && config.rows.length > 0
        ? config.rows
        : [
            "Ease of use",
            "Speed of the tool",
            "Quality of insights",
            "Customer support",
          ],
    [config.rows]
  );

  const columns = useMemo(
    () =>
      Array.isArray(config.columns) && config.columns.length > 0
        ? config.columns
        : ["Very poor", "Poor", "Average", "Good", "Excellent"],
    [config.columns]
  );

  const randomizeRows = Boolean(config.randomizeRows);
  const randomizeColumns = Boolean(config.randomizeColumns);
  const showRowNumbers = Boolean(config.showRowNumbers);
  const layout = config.layout || "comfortable";

  const handleRowChange = (index, value) => {
    const next = [...rows];
    next[index] = value;
    updateConfig("rows", next);
  };

  const handleColumnChange = (index, value) => {
    const next = [...columns];
    next[index] = value;
    updateConfig("columns", next);
  };

  const addRow = () => {
    const next = [...rows, `Statement ${rows.length + 1}`];
    updateConfig("rows", next);
  };

  const removeRow = (index) => {
    const next = rows.filter((_, i) => i !== index);
    updateConfig("rows", next);
  };

  const addColumn = () => {
    const next = [...columns, `Column ${columns.length + 1}`];
    updateConfig("columns", next);
  };

  const removeColumn = (index) => {
    const next = columns.filter((_, i) => i !== index);
    updateConfig("columns", next);
  };

  return (
    <div className="space-y-6">
      {/* Rows (statements) */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-medium dark:text-[#CBC9DE] text-[#1f2933]">
            Rows (statements)
          </h4>
          <button
            type="button"
            onClick={addRow}
            className="text-xs px-2 py-1 rounded-lg bg-[#ED7A13] text-white hover:opacity-90"
          >
            + Add row
          </button>
        </div>
        <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
          {rows.map((row, idx) => (
            <div key={idx} className="flex gap-2 items-center">
              <span className="text-xs text-gray-500 w-6 text-right">
                {idx + 1}.
              </span>
              <input
                type="text"
                value={row}
                onChange={(e) => handleRowChange(idx, e.target.value)}
                className="flex-1 px-3 py-2 rounded-lg border border-[#8C8A97] dark:bg-[#1A1A1E] dark:text-[#CBC9DE] bg-white text-sm"
                placeholder={`Row ${idx + 1} label`}
              />
              {rows.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeRow(idx)}
                  className="text-xs px-2 py-1 rounded-lg border border-red-500 text-red-500 hover:bg-red-50 dark:hover:bg-red-950"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
        <p className="mt-1 text-xs text-gray-500">
          Each row becomes a statement with exactly one answer (column) per
          respondent.
        </p>
      </div>

      {/* Columns (scale / options) */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-medium dark:text-[#CBC9DE] text-[#1f2933]">
            Columns (answer options)
          </h4>
          <button
            type="button"
            onClick={addColumn}
            className="text-xs px-2 py-1 rounded-lg bg-[#ED7A13] text-white hover:opacity-90"
          >
            + Add column
          </button>
        </div>

        <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
          {columns.map((col, idx) => (
            <div key={idx} className="flex gap-2 items-center">
              <span className="text-xs text-gray-500 w-6 text-right">
                {idx + 1}.
              </span>
              <input
                type="text"
                value={col}
                onChange={(e) => handleColumnChange(idx, e.target.value)}
                className="flex-1 px-3 py-2 rounded-lg border border-[#8C8A97] dark:bg-[#1A1A1E] dark:text-[#CBC9DE] bg:white text-sm"
                placeholder={`Column ${idx + 1} label`}
              />
              {columns.length > 2 && (
                <button
                  type="button"
                  onClick={() => removeColumn(idx)}
                  className="text-xs px-2 py-1 rounded-lg border border-red-500 text-red-500 hover:bg-red-50 dark:hover:bg-red-950"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
        <p className="mt-1 text-xs text-gray-500">
          Typical examples: “Strongly disagree” → “Strongly agree”, “Very
          dissatisfied” → “Very satisfied”, etc.
        </p>
      </div>

      {/* Behavior / appearance */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={randomizeRows}
            onChange={(e) => updateConfig("randomizeRows", e.target.checked)}
          />
          <span className="text-sm dark:text-[#CBC9DE] text-[#1f2933]">
            Randomize row order per respondent
          </span>
        </label>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={randomizeColumns}
            onChange={(e) => updateConfig("randomizeColumns", e.target.checked)}
          />
          <span className="text-sm dark:text-[#CBC9DE] text-[#1f2933]">
            Randomize column order per respondent
          </span>
        </label>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={showRowNumbers}
            onChange={(e) => updateConfig("showRowNumbers", e.target.checked)}
          />
          <span className="text-sm dark:text-[#CBC9DE] text-[#1f2933]">
            Show row numbers
          </span>
        </label>

        <label className="block">
          <span className="text-sm dark:text-[#CBC9DE] text-[#1f2933]">
            Layout density
          </span>
          <select
            value={layout}
            onChange={(e) => updateConfig("layout", e.target.value)}
            className="mt-1 w-full px-3 py-2 rounded-lg border border-[#8C8A97] dark:bg-[#1A1A1E] dark:text-[#CBC9DE] bg-white text-sm"
          >
            <option value="comfortable">Comfortable (larger cells)</option>
            <option value="compact">Compact (more rows on screen)</option>
          </select>
        </label>
      </div>
    </div>
  );
}
