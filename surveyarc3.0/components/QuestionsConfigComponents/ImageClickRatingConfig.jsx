"use client";

import React, { useMemo } from "react";

export default function ImageClickRatingConfig({ config = {}, updateConfig }) {
  // 🔒 Safe defaults
  const images = useMemo(
    () =>
      Array.isArray(config.images) && config.images.length > 0
        ? config.images
        : [
            { url: "", label: "Image 1", value: null },
            { url: "", label: "Image 2", value: null },
          ],
    [config.images]
  );

  const scaleMin = Number.isFinite(config.scaleMin) ? config.scaleMin : 1;
  const scaleMax = Number.isFinite(config.scaleMax) ? config.scaleMax : 5;
  const allowMulti = Boolean(config.allowMultiSelect);
  const requireAllRated = Boolean(config.requireAllRated);

  const handleImageChange = (index, field, value) => {
    const next = images.map((img, i) =>
      i === index ? { ...img, [field]: value } : img
    );
    updateConfig("images", next);
  };

  const handleAddImage = () => {
    const next = [
      ...images,
      { url: "", label: `Image ${images.length + 1}`, value: null },
    ];
    updateConfig("images", next);
  };

  const handleRemoveImage = (index) => {
    const next = images.filter((_, i) => i !== index);
    updateConfig("images", next);
  };

  const handleScaleMinChange = (e) => {
    const v = Number(e.target.value) || 1;
    updateConfig("scaleMin", v);
    if (!Number.isFinite(config.scaleMax) || v >= scaleMax) {
      updateConfig("scaleMax", Math.max(v + 1, v + 1));
    }
  };

  const handleScaleMaxChange = (e) => {
    const v = Number(e.target.value) || scaleMin + 1;
    updateConfig("scaleMax", Math.max(v, scaleMin + 1));
  };

  const handleAllowMultiChange = (e) => {
    updateConfig("allowMultiSelect", e.target.checked);
  };

  const handleRequireAllRatedChange = (e) => {
    updateConfig("requireAllRated", e.target.checked);
  };

  return (
    <div className="space-y-6">
      {/* Scale Settings */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="space-y-1">
          <span className="text-sm dark:text-[#CBC9DE] text-[#1f2933]">
            Scale minimum
          </span>
          <input
            type="number"
            min={0}
            max={scaleMax - 1}
            value={scaleMin}
            onChange={handleScaleMinChange}
            className="w-full mt-1 px-3 py-2 rounded-lg border border-[#8C8A97] dark:bg-[#1A1A1E] dark:text-[#CBC9DE] bg-white text-sm"
          />
        </label>

        <label className="space-y-1">
          <span className="text-sm dark:text-[#CBC9DE] text-[#1f2933]">
            Scale maximum
          </span>
          <input
            type="number"
            min={scaleMin + 1}
            max={20}
            value={scaleMax}
            onChange={handleScaleMaxChange}
            className="w-full mt-1 px-3 py-2 rounded-lg border border-[#8C8A97] dark:bg-[#1A1A1E] dark:text-[#CBC9DE] bg-white text-sm"
          />
        </label>
      </div>

      {/* Behaviour toggles */}
      <div className="space-y-2">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={allowMulti}
            onChange={handleAllowMultiChange}
            className="h-4 w-4"
          />
          <span className="text-sm dark:text-[#CBC9DE]">
            Allow rating multiple images with the same value
          </span>
        </label>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={requireAllRated}
            onChange={handleRequireAllRatedChange}
            className="h-4 w-4"
          />
          <span className="text-sm dark:text-[#CBC9DE]">
            Require all images to be rated before next
          </span>
        </label>
      </div>

      {/* Images list */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium dark:text-[#CBC9DE]">
            Images to rate
          </span>
          <button
            type="button"
            onClick={handleAddImage}
            className="text-xs px-3 py-1.5 rounded-lg bg-[#ED7A13] text-white hover:opacity-90"
          >
            + Add image
          </button>
        </div>

        <div className="space-y-3">
          {images.map((img, i) => (
            <div
              key={i}
              className="p-3 rounded-lg border border-[#3a3a45] bg-white/5 dark:bg-[#1A1A1E] space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs dark:text-[#CBC9DE]">
                  Image {i + 1}
                </span>
                <button
                  type="button"
                  onClick={() => handleRemoveImage(i)}
                  className="text-[11px] px-2 py-1 rounded bg-red-500/10 text-red-500 hover:bg-red-500/20"
                >
                  Remove
                </button>
              </div>

              <label className="block space-y-1">
                <span className="text-xs dark:text-[#CBC9DE]">
                  Image URL
                </span>
                <input
                  type="text"
                  value={img.url || ""}
                  onChange={(e) =>
                    handleImageChange(i, "url", e.target.value)
                  }
                  className="w-full px-3 py-2 rounded-lg border border-[#8C8A97] dark:bg-[#1A1A1E] dark:text-[#CBC9DE] bg-white text-xs"
                  placeholder="https://..."
                />
              </label>

              <label className="block space-y-1">
                <span className="text-xs dark:text-[#CBC9DE]">
                  Label / Caption
                </span>
                <input
                  type="text"
                  value={img.label || ""}
                  onChange={(e) =>
                    handleImageChange(i, "label", e.target.value)
                  }
                  className="w-full px-3 py-2 rounded-lg border border-[#8C8A97] dark:bg-[#1A1A1E] dark:text-[#CBC9DE] bg-white text-xs"
                  placeholder="e.g. Concept A – Minimal pack"
                />
              </label>
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs text-gray-500 mt-2">
        In the form, respondents will click each image and assign a rating
        between {scaleMin} and {scaleMax}.
      </p>
    </div>
  );
}
