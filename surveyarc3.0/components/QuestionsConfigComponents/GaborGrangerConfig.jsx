"use client";

import React, { useMemo } from "react";

export default function GaborGrangerConfig({ config = {}, updateConfig }) {
  const {
    currencySymbol = "₹",
    productName = "",
    pricePoints = [99, 149, 199, 249],
    scaleMode = "likert", // 'likert' | 'binary'
    likertOptions = [
      "Definitely would buy",
      "Probably would buy",
      "Might or might not buy",
      "Probably would not buy",
      "Definitely would not buy",
    ],
    yesLabel = "Yes",
    noLabel = "No",
  } = config || {};

  // UI text value for prices
  const pricePointsText = useMemo(
    () => (Array.isArray(pricePoints) ? pricePoints.join(", ") : ""),
    [pricePoints]
  );

  const handlePriceChange = (value) => {
    const arr = value
      .split(",")
      .map((v) => v.trim())
      .filter((v) => v !== "")
      .map((v) => Number(v))
      .filter((n) => !Number.isNaN(n));

    updateConfig("pricePoints", arr);
  };

  const handleUpdateLikertOption = (idx, newVal) => {
    const next = [...likertOptions];
    next[idx] = newVal;
    updateConfig("likertOptions", next);
  };

  const handleAddLikertOption = () => {
    const next = [...likertOptions, "New option"];
    updateConfig("likertOptions", next);
  };

  const handleRemoveLikertOption = (idx) => {
    if (likertOptions.length <= 2) return; // keep at least 2
    const next = likertOptions.filter((_, i) => i !== idx);
    updateConfig("likertOptions", next);
  };

  return (
    <div className="space-y-6 dark:bg-[#1A1A1E] bg-white/80 rounded-xl p-4">
      {/* Product name */}
      <div className="space-y-2">
        <label className="block text-sm dark:text-[#96949C] text-black">
          Product Name
        </label>
        <input
          type="text"
          value={productName}
          onChange={(e) => updateConfig("productName", e.target.value)}
          placeholder="e.g. Lip Oil, Subscription Plan, Gadget"
          className="w-full px-4 py-2 rounded-lg border border-[#8C8A97] dark:bg-[#1A1A1E] dark:text-[#CBC9DE]"
        />
      </div>

      {/* Currency + Price points */}
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-3 space-y-2">
          <label className="block text-sm dark:text-[#96949C] text-black">
            Currency symbol
          </label>
          <input
            type="text"
            maxLength={3}
            value={currencySymbol}
            onChange={(e) => updateConfig("currencySymbol", e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-[#8C8A97] dark:bg-[#1A1A1E] dark:text-[#CBC9DE]"
          />
        </div>

        <div className="col-span-9 space-y-2">
          <label className="block text-sm dark:text-[#96949C] text-black">
            Price Points (comma-separated)
          </label>
          <input
            type="text"
            value={pricePointsText}
            onChange={(e) => handlePriceChange(e.target.value)}
            placeholder="99, 149, 199, 249"
            className="w-full px-4 py-2 rounded-lg border border-[#8C8A97] dark:bg-[#1A1A1E] dark:text-[#CBC9DE]"
          />
          <p className="text-[11px] text-gray-500 dark:text-gray-400">
            These prices will be shown one-by-one to the respondent.
          </p>
        </div>
      </div>

      {/* Scale mode selector */}
      <div className="space-y-2">
        <label className="block text-sm dark:text-[#96949C] text-black">
          Response scale type
        </label>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => updateConfig("scaleMode", "likert")}
            className={`px-3 py-2 rounded-lg text-sm border ${
              scaleMode === "likert"
                ? "bg-[#ED7A13] text-white border-[#ED7A13]"
                : "bg-transparent dark:bg-[#1A1A1E] dark:text-[#CBC9DE] border-[#8C8A97]"
            }`}
          >
            5-point likelihood scale
          </button>
          <button
            type="button"
            onClick={() => updateConfig("scaleMode", "binary")}
            className={`px-3 py-2 rounded-lg text-sm border ${
              scaleMode === "binary"
                ? "bg-[#ED7A13] text-white border-[#ED7A13]"
                : "bg-transparent dark:bg-[#1A1A1E] dark:text-[#CBC9DE] border-[#8C8A97]"
            }`}
          >
            Yes / No purchase
          </button>
        </div>
      </div>

      {/* Likert configuration */}
      {scaleMode === "likert" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm dark:text-[#96949C] text-black">
              Likert options (shown under each price)
            </span>
            <button
              type="button"
              onClick={handleAddLikertOption}
              className="text-xs px-2 py-1 rounded-lg bg-[#ED7A13] text-white"
            >
              + Add option
            </button>
          </div>

          <div className="space-y-2">
            {likertOptions.map((opt, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <span className="text-xs w-6 text-right text-gray-400">
                  {idx + 1}.
                </span>
                <input
                  type="text"
                  value={opt}
                  onChange={(e) =>
                    handleUpdateLikertOption(idx, e.target.value)
                  }
                  className="flex-1 px-3 py-2 rounded-lg border border-[#8C8A97] dark:bg-[#1A1A1E] dark:text-[#CBC9DE]"
                />
                {likertOptions.length > 2 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveLikertOption(idx)}
                    className="text-xs text-red-500 hover:underline"
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>

          <p className="text-[11px] text-gray-500 dark:text-gray-400">
            Typical wording: &ldquo;Definitely would buy&rdquo; → 
            &ldquo;Definitely would not buy&rdquo;.
          </p>
        </div>
      )}

      {/* Binary Yes/No configuration */}
      {scaleMode === "binary" && (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="block text-sm dark:text-[#96949C] text-black">
              Yes Label
            </label>
            <input
              type="text"
              value={yesLabel}
              onChange={(e) => updateConfig("yesLabel", e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[#8C8A97] dark:bg-[#1A1A1E] dark:text-[#CBC9DE]"
              placeholder="Yes, would buy at this price"
            />
          </div>
          <div className="space-y-2">
            <label className="block text-sm dark:text-[#96949C] text-black">
              No Label
            </label>
            <input
              type="text"
              value={noLabel}
              onChange={(e) => updateConfig("noLabel", e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[#8C8A97] dark:bg-[#1A1A1E] dark:text-[#CBC9DE]"
              placeholder="No, would not buy at this price"
            />
          </div>
        </div>
      )}
    </div>
  );
}
