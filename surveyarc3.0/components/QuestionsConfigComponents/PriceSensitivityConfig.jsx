"use client";
import React, { useEffect } from "react";

export default function PriceSensitivityConfig({ config = {}, updateConfig }) {
  /* --------------------------------------------------
     DERIVED CONFIG VALUES
  -------------------------------------------------- */
  const currency = config.currency ?? "₹";

  const tooCheapLabel = config.tooCheapLabel ?? "Too cheap";
  const cheapLabel = config.cheapLabel ?? "Cheap / good value";
  const expensiveLabel =
    config.expensiveLabel ?? "Expensive but still acceptable";
  const tooExpensiveLabel = config.tooExpensiveLabel ?? "Too expensive";

  const min = config.min ?? 0;
  const max = config.max ?? null;
  const step = config.step ?? 1;

  const showHelperText = config.showHelperText ?? true;

  /* --------------------------------------------------
     INITIALIZE DEFAULTS (CRITICAL)
     Ensures config exists on FIRST SAVE
  -------------------------------------------------- */
  useEffect(() => {
    if (!("currency" in config)) updateConfig("currency", "₹");

    if (!("tooCheapLabel" in config))
      updateConfig("tooCheapLabel", "Too cheap");

    if (!("cheapLabel" in config))
      updateConfig("cheapLabel", "Cheap / good value");

    if (!("expensiveLabel" in config))
      updateConfig(
        "expensiveLabel",
        "Expensive but still acceptable"
      );

    if (!("tooExpensiveLabel" in config))
      updateConfig("tooExpensiveLabel", "Too expensive");

    if (!("min" in config)) updateConfig("min", 0);
    if (!("max" in config)) updateConfig("max", null);
    if (!("step" in config)) updateConfig("step", 1);
    if (!("showHelperText" in config))
      updateConfig("showHelperText", true);
  }, []);

  /* --------------------------------------------------
     RENDER
  -------------------------------------------------- */
  return (
    <div className="space-y-4 p-3">
      {/* Numeric controls */}
      <div className="flex flex-wrap gap-4">
        <div>
          <label className="block text-sm mb-1 dark:text-[#96949C]">
            Currency symbol
          </label>
          <input
            type="text"
            className="w-16 px-3 py-2 rounded-lg border dark:bg-[#1A1A1E] dark:text-[#CBC9DE]"
            maxLength={3}
            value={currency}
            onChange={(e) =>
              updateConfig("currency", e.target.value)
            }
          />
        </div>

        <div>
          <label className="block text-sm mb-1 dark:text-[#96949C]">
            Min value
          </label>
          <input
            type="number"
            className="w-24 px-3 py-2 rounded-lg border dark:bg-[#1A1A1E] dark:text-[#CBC9DE]"
            value={min}
            onChange={(e) =>
              updateConfig(
                "min",
                e.target.value === "" ? 0 : Number(e.target.value)
              )
            }
          />
        </div>

        <div>
          <label className="block text-sm mb-1 dark:text-[#96949C]">
            Max value
          </label>
          <input
            type="number"
            className="w-24 px-3 py-2 rounded-lg border dark:bg-[#1A1A1E] dark:text-[#CBC9DE]"
            value={max ?? ""}
            onChange={(e) =>
              updateConfig(
                "max",
                e.target.value === ""
                  ? null
                  : Number(e.target.value)
              )
            }
          />
        </div>

        <div>
          <label className="block text-sm mb-1 dark:text-[#96949C]">
            Step
          </label>
          <input
            type="number"
            min={0.01}
            step={0.01}
            className="w-20 px-3 py-2 rounded-lg border dark:bg-[#1A1A1E] dark:text-[#CBC9DE]"
            value={step}
            onChange={(e) =>
              updateConfig("step", Number(e.target.value) || 1)
            }
          />
        </div>
      </div>

      {/* Labels */}
      <div className="space-y-2">
        <label className="block text-xs dark:text-[#96949C]">
          Question row labels
        </label>

        <input
          className="w-full px-3 py-2 rounded-lg border dark:bg-[#1A1A1E] dark:text-[#CBC9DE]"
          value={tooCheapLabel}
          onChange={(e) =>
            updateConfig("tooCheapLabel", e.target.value)
          }
        />

        <input
          className="w-full px-3 py-2 rounded-lg border dark:bg-[#1A1A1E] dark:text-[#CBC9DE]"
          value={cheapLabel}
          onChange={(e) =>
            updateConfig("cheapLabel", e.target.value)
          }
        />

        <input
          className="w-full px-3 py-2 rounded-lg border dark:bg-[#1A1A1E] dark:text-[#CBC9DE]"
          value={expensiveLabel}
          onChange={(e) =>
            updateConfig("expensiveLabel", e.target.value)
          }
        />

        <input
          className="w-full px-3 py-2 rounded-lg border dark:bg-[#1A1A1E] dark:text-[#CBC9DE]"
          value={tooExpensiveLabel}
          onChange={(e) =>
            updateConfig("tooExpensiveLabel", e.target.value)
          }
        />
      </div>

      {/* Helper text toggle */}
      <label className="flex items-center gap-3 text-sm dark:text-[#96949C]">
        <input
          type="checkbox"
          checked={showHelperText}
          onChange={(e) =>
            updateConfig("showHelperText", e.target.checked)
          }
        />
        Show helper text under question
      </label>
    </div>
  );
}
