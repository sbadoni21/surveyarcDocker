"use client";
import React, { useMemo } from "react";

export default function ComparisonGridConfig({ config = {}, updateConfig }) {
  const attributes = useMemo(
    () =>
      Array.isArray(config.attributes) && config.attributes.length > 0
        ? config.attributes
        : [
            "Ease of use",
            "Features",
            "Value for money",
            "Customer support",
          ],
    [config.attributes]
  );

  const brands = useMemo(
    () =>
      Array.isArray(config.brands) && config.brands.length > 0
        ? config.brands
        : ["Brand A", "Brand B", "Brand C"],
    [config.brands]
  );

  const maxSelectionsPerRow =
    typeof config.maxSelectionsPerRow === "number" &&
    config.maxSelectionsPerRow > 0
      ? config.maxSelectionsPerRow
      : 1;

  const allowTies = Boolean(config.allowTies);
  const includeNone = config.includeNone !== false;
  const noneLabel = config.noneLabel ?? "None of these";

  const randomizeAttributes = Boolean(config.randomizeAttributes);
  const randomizeBrands = Boolean(config.randomizeBrands);

  const requireSelectionEachRow =
    config.requireSelectionEachRow !== false;

  const layout =
    config.layout === "compact" ? "compact" : "comfortable";

  const handleAttributesChange = (e) => {
    const next = e.target.value
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    updateConfig("attributes", next);
  };

  const handleBrandsChange = (e) => {
    const next = e.target.value
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    updateConfig("brands", next);
  };

  const handleMaxPerRowChange = (e) => {
    const v = parseInt(e.target.value, 10);
    const safe = Number.isNaN(v) ? 1 : Math.max(1, v);
    updateConfig("maxSelectionsPerRow", safe);
  };

  return (
    <div className="space-y-4 text-sm">
      {/* Attributes */}
      <div className="space-y-1">
        <label className="block dark:text-[#CBC9DE] text-[#111827]">
          Attributes (rows) – one per line
        </label>
        <textarea
          rows={4}
          value={attributes.join("\n")}
          onChange={handleAttributesChange}
          className="w-full px-3 py-2 rounded-lg border border-[#8C8A97] dark:bg-[#1A1A1E] dark:text-[#CBC9DE] bg-white"
          placeholder={"Ease of use\nFeatures\nValue for money\nCustomer support"}
        />
        <p className="text-xs text-gray-500">
          Each row is an attribute the respondent will assign to one or more brands.
        </p>
      </div>

      {/* Brands */}
      <div className="space-y-1">
        <label className="block dark:text-[#CBC9DE] text-[#111827]">
          Brands / options (columns) – comma separated
        </label>
        <input
          type="text"
          value={brands.join(", ")}
          onChange={handleBrandsChange}
          className="w-full px-3 py-2 rounded-lg border border-[#8C8A97] dark:bg-[#1A1A1E] dark:text-[#CBC9DE] bg-white"
          placeholder="Brand A, Brand B, Brand C"
        />
        <p className="text-xs text-gray-500">
          These appear as columns. Respondents assign attributes to these brands.
        </p>
      </div>

      {/* Selection rules */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <label className="space-y-1">
          <span className="block dark:text-[#CBC9DE] text-[#111827]">
            Max selections per row
          </span>
          <input
            type="number"
            min={1}
            max={brands.length}
            value={maxSelectionsPerRow}
            onChange={handleMaxPerRowChange}
            className="w-full px-3 py-2 rounded-lg border border-[#8C8A97] dark:bg-[#1A1A1E] dark:text-[#CBC9DE] bg-white"
          />
          <p className="text-xs text-gray-500">
            1 = strict winner-per-row; &gt;1 allows ties for that attribute.
          </p>
        </label>

        <label className="flex items-center gap-2 mt-6">
          <input
            type="checkbox"
            checked={allowTies}
            onChange={(e) => updateConfig("allowTies", e.target.checked)}
            className="h-4 w-4"
          />
          <span className="dark:text-[#CBC9DE] text-[#111827]">
            Allow ties (multiple brands for same attribute)
          </span>
        </label>

        <label className="flex items-center gap-2 mt-6">
          <input
            type="checkbox"
            checked={requireSelectionEachRow}
            onChange={(e) =>
              updateConfig("requireSelectionEachRow", e.target.checked)
            }
            className="h-4 w-4"
          />
          <span className="dark:text-[#CBC9DE] text-[#111827]">
            Require selection for every row
          </span>
        </label>
      </div>

      {/* None-of-these + randomization */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={includeNone}
              onChange={(e) => updateConfig("includeNone", e.target.checked)}
              className="h-4 w-4"
            />
            <span className="dark:text-[#CBC9DE] text-[#111827]">
              Include &quot;None of these&quot; column
            </span>
          </label>
          {includeNone && (
            <input
              type="text"
              value={noneLabel}
              onChange={(e) => updateConfig("noneLabel", e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[#8C8A97] dark:bg-[#1A1A1E] dark:text-[#CBC9DE] bg-white"
              placeholder="None of these"
            />
          )}
        </div>

        <div className="space-y-2">
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={randomizeAttributes}
              onChange={(e) =>
                updateConfig("randomizeAttributes", e.target.checked)
              }
              className="h-4 w-4"
            />
            <span className="dark:text-[#CBC9DE] text-[#111827]">
              Randomize attribute order
            </span>
          </label>

          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={randomizeBrands}
              onChange={(e) =>
                updateConfig("randomizeBrands", e.target.checked)
              }
              className="h-4 w-4"
            />
            <span className="dark:text-[#CBC9DE] text-[#111827]">
              Randomize brand order
            </span>
          </label>
        </div>
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
          <option value="comfortable">Comfortable (larger cells)</option>
          <option value="compact">Compact (for large grids)</option>
        </select>
      </div>
    </div>
  );
}
