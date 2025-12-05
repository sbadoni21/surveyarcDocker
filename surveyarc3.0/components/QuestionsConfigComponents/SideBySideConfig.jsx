"use client";
import React, { useMemo } from "react";

export default function SideBySideConfig({ config = {}, updateConfig }) {
  const leftLabel = config.leftLabel ?? "Concept A";
  const rightLabel = config.rightLabel ?? "Concept B";

  const attributes = useMemo(
    () =>
      Array.isArray(config.attributes) && config.attributes.length > 0
        ? config.attributes
        : [
            "Overall appeal",
            "Clarity of message",
            "Uniqueness",
            "Fit with brand",
          ],
    [config.attributes]
  );

  const mode =
    config.mode === "preference_only" ||
    config.mode === "rate_both" ||
    config.mode === "preference_and_rate"
      ? config.mode
      : "preference_and_rate";

  const scaleMin =
    typeof config.scaleMin === "number" ? config.scaleMin : 1;
  const scaleMax =
    typeof config.scaleMax === "number" ? config.scaleMax : 5;

  const leftBiasLabel =
    config.leftBiasLabel ?? "Concept A is much better";
  const rightBiasLabel =
    config.rightBiasLabel ?? "Concept B is much better";
  const neutralLabel = config.neutralLabel ?? "About the same";

  const showTieOption = config.showTieOption !== false;
  const randomizeRowOrder = Boolean(config.randomizeRowOrder);
  const randomizeLeftRight = Boolean(config.randomizeLeftRight);
  const showAttributeCodes = Boolean(config.showAttributeCodes);

  const handleAttributesChange = (e) => {
    const next = e.target.value
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    updateConfig("attributes", next);
  };

  const handleScaleMinChange = (e) => {
    const v = parseInt(e.target.value, 10);
    const safe = Number.isNaN(v) ? 1 : Math.max(0, v);
    updateConfig("scaleMin", safe);
    if (safe >= scaleMax) updateConfig("scaleMax", safe + 1);
  };

  const handleScaleMaxChange = (e) => {
    const v = parseInt(e.target.value, 10);
    const safe = Number.isNaN(v) ? 5 : Math.max(scaleMin + 1, v);
    updateConfig("scaleMax", safe);
  };

  return (
    <div className="space-y-4 text-sm">
      {/* Labels for stimuli */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className="space-y-1">
          <span className="block dark:text-[#CBC9DE] text-[#111827]">
            Left stimulus label
          </span>
          <input
            type="text"
            value={leftLabel}
            onChange={(e) => updateConfig("leftLabel", e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-[#8C8A97] dark:bg-[#1A1A1E] dark:text-[#CBC9DE] bg-white"
            placeholder="Concept A"
          />
        </label>

        <label className="space-y-1">
          <span className="block dark:text-[#CBC9DE] text-[#111827]">
            Right stimulus label
          </span>
          <input
            type="text"
            value={rightLabel}
            onChange={(e) => updateConfig("rightLabel", e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-[#8C8A97] dark:bg-[#1A1A1E] dark:text-[#CBC9DE] bg-white"
            placeholder="Concept B"
          />
        </label>
      </div>

      {/* Attributes per row */}
      <div className="space-y-1">
        <label className="block dark:text-[#CBC9DE] text-[#111827]">
          Attributes / aspects (one per line)
        </label>
        <textarea
          rows={4}
          value={attributes.join("\n")}
          onChange={handleAttributesChange}
          className="w-full px-3 py-2 rounded-lg border border-[#8C8A97] dark:bg-[#1A1A1E] dark:text-[#CBC9DE] bg-white"
          placeholder={"Overall appeal\nClarity of message\nUniqueness\nFit with brand"}
        />
        <p className="text-xs text-gray-500">
          Each row will show {leftLabel} vs {rightLabel} and ask for preference / ratings.
        </p>
      </div>

      {/* Mode */}
      <div className="space-y-1">
        <label className="block dark:text-[#CBC9DE] text-[#111827]">
          Response mode
        </label>
        <select
          value={mode}
          onChange={(e) => updateConfig("mode", e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-[#8C8A97] dark:bg-[#1A1A1E] dark:text-[#CBC9DE] bg-white"
        >
          <option value="preference_only">
            Preference only (A vs B vs Tie)
          </option>
          <option value="rate_both">
            Rate both concepts on a numeric scale
          </option>
          <option value="preference_and_rate">
            Preference + ratings for both
          </option>
        </select>
      </div>

      {/* Scale settings */}
      {(mode === "rate_both" || mode === "preference_and_rate") && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="space-y-1">
            <span className="block dark:text-[#CBC9DE] text-[#111827]">
              Rating scale minimum
            </span>
            <input
              type="number"
              min={0}
              max={scaleMax - 1}
              value={scaleMin}
              onChange={handleScaleMinChange}
              className="w-full px-3 py-2 rounded-lg border border-[#8C8A97] dark:bg-[#1A1A1E] dark:text-[#CBC9DE] bg-white"
            />
          </label>
          <label className="space-y-1">
            <span className="block dark:text-[#CBC9DE] text-[#111827]">
              Rating scale maximum
            </span>
            <input
              type="number"
              min={scaleMin + 1}
              max={11}
              value={scaleMax}
              onChange={handleScaleMaxChange}
              className="w-full px-3 py-2 rounded-lg border border-[#8C8A97] dark:bg-[#1A1A1E] dark:text-[#CBC9DE] bg-white"
            />
          </label>
        </div>
      )}

      {/* Preference labels */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <label className="space-y-1">
          <span className="block dark:text-[#CBC9DE] text-[#111827]">
            Left-better label
          </span>
          <input
            type="text"
            value={leftBiasLabel}
            onChange={(e) => updateConfig("leftBiasLabel", e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-[#8C8A97] dark:bg-[#1A1A1E] dark:text-[#CBC9DE] bg-white"
            placeholder="Concept A is much better"
          />
        </label>
        <label className="space-y-1">
          <span className="block dark:text-[#CBC9DE] text-[#111827]">
            Tie label
          </span>
          <input
            type="text"
            value={neutralLabel}
            onChange={(e) => updateConfig("neutralLabel", e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-[#8C8A97] dark:bg-[#1A1A1E] dark:text-[#CBC9DE] bg-white"
            placeholder="About the same"
          />
        </label>
        <label className="space-y-1">
          <span className="block dark:text-[#CBC9DE] text-[#111827]">
            Right-better label
          </span>
          <input
            type="text"
            value={rightBiasLabel}
            onChange={(e) => updateConfig("rightBiasLabel", e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-[#8C8A97] dark:bg-[#1A1A1E] dark:text-[#CBC9DE] bg-white"
            placeholder="Concept B is much better"
          />
        </label>
      </div>

      {/* Toggles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={showTieOption}
            onChange={(e) => updateConfig("showTieOption", e.target.checked)}
            className="h-4 w-4"
          />
          <span className="dark:text-[#CBC9DE] text-[#111827]">
            Allow tie / about-the-same
          </span>
        </label>

        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={randomizeRowOrder}
            onChange={(e) =>
              updateConfig("randomizeRowOrder", e.target.checked)
            }
            className="h-4 w-4"
          />
          <span className="dark:text-[#CBC9DE] text-[#111827]">
            Randomize attribute order (per respondent)
          </span>
        </label>

        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={randomizeLeftRight}
            onChange={(e) =>
              updateConfig("randomizeLeftRight", e.target.checked)
            }
            className="h-4 w-4"
          />
          <span className="dark:text-[#CBC9DE] text-[#111827]">
            Randomly flip A/B per respondent
          </span>
        </label>

        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={showAttributeCodes}
            onChange={(e) =>
              updateConfig("showAttributeCodes", e.target.checked)
            }
            className="h-4 w-4"
          />
          <span className="dark:text-[#CBC9DE] text-[#111827]">
            Show attribute codes (for analysis)
          </span>
        </label>
      </div>
    </div>
  );
}
