"use client";
import React, { useMemo } from "react";

export default function LikertConfig({ config = {}, updateConfig }) {
  // 🔒 Safe defaults
  const fallbackLabels = [
    "Strongly Disagree",
    "Disagree",
    "Neutral",
    "Agree",
    "Strongly Agree",
  ];

  const labels = useMemo(
    () =>
      Array.isArray(config.labels) && config.labels.length > 0
        ? config.labels
        : fallbackLabels,
    [config.labels]
  );

  const scale = Number.isFinite(config.scale) ? config.scale : labels.length;

  // Anchors (can override ends + mid)
  const leftAnchor =
    typeof config.leftAnchorLabel === "string"
      ? config.leftAnchorLabel
      : labels[0] || "Negative end";

  const rightAnchor =
    typeof config.rightAnchorLabel === "string"
      ? config.rightAnchorLabel
      : labels[labels.length - 1] || "Positive end";

  const midAnchor =
    typeof config.midAnchorLabel === "string"
      ? config.midAnchorLabel
      : labels[Math.floor(labels.length / 2)] || "Neutral";

  // Behaviour toggles
  const randomize = Boolean(config.randomize);
  const includeNA = Boolean(config.includeNA);
  const naLabel = config.naLabel || "Not applicable / Don’t know";

  const gridMode = Boolean(config.gridMode); // for multi-row Likert grids
  const minAnswersRequired = Number.isFinite(config.minAnswersRequired)
    ? config.minAnswersRequired
    : 0;

  // Scoring options
  const storeAsNumeric = Boolean(config.storeAsNumeric);
  const numericMin = Number.isFinite(config.numericMin)
    ? config.numericMin
    : 1;
  const numericMax = Number.isFinite(config.numericMax)
    ? config.numericMax
    : scale;

  const reverseScore = Boolean(config.reverseScore);

  // --- handlers ---

  const handleLabelsChange = (e) => {
    const parts = e.target.value
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    updateConfig("labels", parts);
    // keep scale in sync if not explicitly set
    if (!Number.isFinite(config.scale)) {
      updateConfig("scale", parts.length || 5);
    }
  };

  const handleScaleChange = (e) => {
    const v = Number(e.target.value) || labels.length || 5;
    updateConfig("scale", v);
  };

  const handleRandomizeChange = (e) => {
    updateConfig("randomize", e.target.checked);
  };

  const handleIncludeNAChange = (e) => {
    updateConfig("includeNA", e.target.checked);
  };

  const handleNALabelChange = (e) => {
    updateConfig("naLabel", e.target.value);
  };

  const handleLeftAnchorChange = (e) => {
    updateConfig("leftAnchorLabel", e.target.value);
  };

  const handleRightAnchorChange = (e) => {
    updateConfig("rightAnchorLabel", e.target.value);
  };

  const handleMidAnchorChange = (e) => {
    updateConfig("midAnchorLabel", e.target.value);
  };

  const handleGridModeChange = (e) => {
    updateConfig("gridMode", e.target.checked);
  };

  const handleMinAnswersRequiredChange = (e) => {
    const v = Number(e.target.value) || 0;
    updateConfig("minAnswersRequired", Math.max(0, v));
  };

  const handleStoreAsNumericChange = (e) => {
    updateConfig("storeAsNumeric", e.target.checked);
  };

  const handleNumericMinChange = (e) => {
    const v = Number(e.target.value) || 1;
    updateConfig("numericMin", v);
    if (!Number.isFinite(config.numericMax) || v >= numericMax) {
      updateConfig("numericMax", v + (scale - 1));
    }
  };

  const handleNumericMaxChange = (e) => {
    const v = Number(e.target.value) || numericMin + (scale - 1);
    updateConfig("numericMax", Math.max(v, numericMin + 1));
  };

  const handleReverseScoreChange = (e) => {
    updateConfig("reverseScore", e.target.checked);
  };

  // simple preview labels (with optional NA)
  const previewOptions = includeNA ? [...labels, naLabel] : labels;

  return (
    <div className="space-y-6">
      {/* 1️⃣ Scale Labels */}
      <div className="space-y-2">
        <label className="block space-y-1">
          <span className="text-sm dark:text-[#CBC9DE] text-[#1f2933]">
            Labels (comma-separated)
          </span>
          <input
            type="text"
            value={labels.join(", ")}
            onChange={handleLabelsChange}
            className="w-full mt-1 px-3 py-2 rounded-lg border border-[#8C8A97] dark:bg-[#1A1A1E] dark:text-[#CBC9DE] bg-white text-sm"
            placeholder="Strongly Disagree, Disagree, Neutral, Agree, Strongly Agree"
          />
        </label>
        <p className="text-xs text-gray-500">
          These labels will be shown from left to right on the scale.
        </p>
      </div>

      {/* 2️⃣ Scale length */}
      <div className="space-y-2">
        <label className="block space-y-1">
          <span className="text-sm dark:text-[#CBC9DE] text-[#1f2933]">
            Scale length
          </span>
          <input
            type="number"
            min={3}
            max={10}
            value={scale}
            onChange={handleScaleChange}
            className="w-full mt-1 px-3 py-2 rounded-lg border border-[#8C8A97] dark:bg-[#1A1A1E] dark:text-[#CBC9DE] bg-white text-sm"
          />
        </label>
        <p className="text-xs text-gray-500">
          Typically equal to number of labels ({labels.length}), but you can
          override for special scales.
        </p>
      </div>

      {/* 3️⃣ Anchors & mid-point */}
      <div className="space-y-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          Anchors
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <label className="space-y-1">
            <span className="text-xs dark:text-[#CBC9DE] text-[#1f2933]">
              Left anchor
            </span>
            <input
              type="text"
              value={leftAnchor}
              onChange={handleLeftAnchorChange}
              className="w-full px-3 py-2 rounded-lg border border-[#8C8A97] dark:bg-[#1A1A1E] dark:text-[#CBC9DE] bg-white text-xs"
              placeholder="e.g. Extremely Negative"
            />
          </label>

          <label className="space-y-1">
            <span className="text-xs dark:text-[#CBC9DE] text-[#1f2933]">
              Mid-point label
            </span>
            <input
              type="text"
              value={midAnchor}
              onChange={handleMidAnchorChange}
              className="w-full px-3 py-2 rounded-lg border border-[#8C8A97] dark:bg-[#1A1A1E] dark:text-[#CBC9DE] bg-white text-xs"
              placeholder="e.g. Neutral / Neither"
            />
          </label>

          <label className="space-y-1">
            <span className="text-xs dark:text-[#CBC9DE] text-[#1f2933]">
              Right anchor
            </span>
            <input
              type="text"
              value={rightAnchor}
              onChange={handleRightAnchorChange}
              className="w-full px-3 py-2 rounded-lg border border-[#8C8A97] dark:bg-[#1A1A1E] dark:text-[#CBC9DE] bg-white text-xs"
              placeholder="e.g. Extremely Positive"
            />
          </label>
        </div>
      </div>

      {/* 4️⃣ Behaviour & Layout */}
      <div className="space-y-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          Behaviour & layout
        </div>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={randomize}
            onChange={handleRandomizeChange}
            className="h-4 w-4"
          />
          <span className="text-sm dark:text-[#CBC9DE] text-[#1f2933]">
            Randomize option order (per respondent)
          </span>
        </label>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={gridMode}
            onChange={handleGridModeChange}
            className="h-4 w-4"
          />
          <span className="text-sm dark:text-[#CBC9DE] text-[#1f2933]">
            Use in matrix/grid mode (multiple rows with same scale)
          </span>
        </label>

        {gridMode && (
          <label className="flex items-center gap-2 mt-1">
            <span className="text-xs dark:text-[#CBC9DE] text-[#1f2933]">
              Minimum rows required answered
            </span>
            <input
              type="number"
              min={0}
              value={minAnswersRequired}
              onChange={handleMinAnswersRequiredChange}
              className="w-20 px-2 py-1 rounded-lg border border-[#8C8A97] dark:bg-[#1A1A1E] dark:text-[#CBC9DE] bg-white text-xs"
            />
          </label>
        )}
      </div>

      {/* 5️⃣ NA / DK option */}
      <div className="space-y-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          Not applicable / Don&apos;t know
        </div>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={includeNA}
            onChange={handleIncludeNAChange}
            className="h-4 w-4"
          />
          <span className="text-sm dark:text-[#CBC9DE] text-[#1f2933]">
            Add &quot;N/A&quot; / &quot;Don&apos;t know&quot; as an extra
            option
          </span>
        </label>

        {includeNA && (
          <label className="block space-y-1">
            <span className="text-xs dark:text-[#CBC9DE] text-[#1f2933]">
              N/A label
            </span>
            <input
              type="text"
              value={naLabel}
              onChange={handleNALabelChange}
              className="w-full px-3 py-2 rounded-lg border border-[#8C8A97] dark:bg-[#1A1A1E] dark:text-[#CBC9DE] bg-white text-xs"
              placeholder="e.g. Not applicable / Don’t know"
            />
          </label>
        )}
      </div>

      {/* 6️⃣ Scoring / Data output */}
      <div className="space-y-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          Scoring & data
        </div>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={storeAsNumeric}
            onChange={handleStoreAsNumericChange}
            className="h-4 w-4"
          />
          <span className="text-sm dark:text-[#CBC9DE] text-[#1f2933]">
            Store as numeric score instead of raw label
          </span>
        </label>

        {storeAsNumeric && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <label className="space-y-1">
              <span className="text-xs dark:text-[#CBC9DE] text-[#1f2933]">
                Min score (left)
              </span>
              <input
                type="number"
                value={numericMin}
                onChange={handleNumericMinChange}
                className="w-full px-3 py-2 rounded-lg border border-[#8C8A97] dark:bg-[#1A1A1E] dark:text-[#CBC9DE] bg-white text-xs"
              />
            </label>

            <label className="space-y-1">
              <span className="text-xs dark:text-[#CBC9DE] text-[#1f2933]">
                Max score (right)
              </span>
              <input
                type="number"
                value={numericMax}
                onChange={handleNumericMaxChange}
                className="w-full px-3 py-2 rounded-lg border border-[#8C8A97] dark:bg-[#1A1A1E] dark:text-[#CBC9DE] bg-white text-xs"
              />
            </label>

            <label className="flex items-center gap-2 mt-5 md:mt-7">
              <input
                type="checkbox"
                checked={reverseScore}
                onChange={handleReverseScoreChange}
                className="h-4 w-4"
              />
              <span className="text-xs dark:text-[#CBC9DE] text-[#1f2933]">
                Reverse scoring (right = lowest)
              </span>
            </label>
          </div>
        )}

        <p className="text-[11px] text-gray-500">
          Scoring is applied when exporting / processing data. UI will still
          show labels; backend can use <code>numericMin</code>,{" "}
          <code>numericMax</code> and <code>reverseScore</code>.
        </p>
      </div>

      {/* 7️⃣ Tiny preview */}
      <div className="mt-4 p-3 rounded-xl border border-dashed border-[#3a3a45] dark:bg-[#111217] bg-white/60">
        <div className="text-xs font-medium mb-2 text-gray-500">
          Preview (approx.)
        </div>
        <div className="flex flex-wrap gap-2">
          {previewOptions.map((lbl, idx) => (
            <div
              key={`${lbl}-${idx}`}
              className="px-2 py-1 rounded-full text-[11px] border border-[#8C8A97] dark:border-[#3a3a45] dark:text-[#CBC9DE]"
            >
              {lbl}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
