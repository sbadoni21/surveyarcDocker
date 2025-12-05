"use client";
import React, { useEffect, useState } from "react";

export default function PriceSensitivityConfig({ config = {}, updateConfig }) {
  const [currency, setCurrency] = useState(config.currency || "₹");
  const [tooCheapLabel, setTooCheapLabel] = useState(
    config.tooCheapLabel || "Too cheap"
  );
  const [cheapLabel, setCheapLabel] = useState(
    config.cheapLabel || "Cheap / good value"
  );
  const [expensiveLabel, setExpensiveLabel] = useState(
    config.expensiveLabel || "Expensive but still acceptable"
  );
  const [tooExpensiveLabel, setTooExpensiveLabel] = useState(
    config.tooExpensiveLabel || "Too expensive"
  );
  const [min, setMin] = useState(config.min ?? 0);
  const [max, setMax] = useState(config.max ?? "");
  const [step, setStep] = useState(config.step ?? 1);
  const [showHelperText, setShowHelperText] = useState(
    config.showHelperText ?? true
  );

  useEffect(() => {
    updateConfig({
      ...config,
      currency,
      tooCheapLabel,
      cheapLabel,
      expensiveLabel,
      tooExpensiveLabel,
      min,
      max: max === "" ? null : max,
      step,
      showHelperText,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    currency,
    tooCheapLabel,
    cheapLabel,
    expensiveLabel,
    tooExpensiveLabel,
    min,
    max,
    step,
    showHelperText,
  ]);

  return (
    <div className="space-y-4 p-3">
      <div className="flex gap-4">
        <div>
          <label className="block text-sm mb-1 dark:text-[#96949C]">
            Currency symbol
          </label>
          <input
            type="text"
            className="w-16 px-3 py-2 rounded-lg border dark:bg-[#1A1A1E] dark:text-[#CBC9DE]"
            maxLength={3}
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm mb-1 dark:text-[#96949C]">
            Min value (optional)
          </label>
          <input
            type="number"
            className="w-24 px-3 py-2 rounded-lg border dark:bg-[#1A1A1E] dark:text-[#CBC9DE]"
            value={min}
            onChange={(e) => setMin(e.target.value === "" ? 0 : Number(e.target.value))}
          />
        </div>

        <div>
          <label className="block text-sm mb-1 dark:text-[#96949C]">
            Max value (optional)
          </label>
          <input
            type="number"
            className="w-24 px-3 py-2 rounded-lg border dark:bg-[#1A1A1E] dark:text-[#CBC9DE]"
            value={max}
            onChange={(e) =>
              setMax(e.target.value === "" ? "" : Number(e.target.value))
            }
          />
        </div>

        <div>
          <label className="block text-sm mb-1 dark:text-[#96949C]">
            Step
          </label>
          <input
            type="number"
            className="w-20 px-3 py-2 rounded-lg border dark:bg-[#1A1A1E] dark:text-[#CBC9DE]"
            value={step}
            min={0.01}
            step={0.01}
            onChange={(e) => setStep(Number(e.target.value) || 1)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="block text-xs dark:text-[#96949C]">
          Question row labels
        </label>

        <input
          type="text"
          className="w-full px-3 py-2 rounded-lg border dark:bg-[#1A1A1E] dark:text-[#CBC9DE] mb-2"
          value={tooCheapLabel}
          onChange={(e) => setTooCheapLabel(e.target.value)}
          placeholder="Too cheap"
        />
        <input
          type="text"
          className="w-full px-3 py-2 rounded-lg border dark:bg-[#1A1A1E] dark:text-[#CBC9DE] mb-2"
          value={cheapLabel}
          onChange={(e) => setCheapLabel(e.target.value)}
          placeholder="Cheap / good value"
        />
        <input
          type="text"
          className="w-full px-3 py-2 rounded-lg border dark:bg-[#1A1A1E] dark:text-[#CBC9DE] mb-2"
          value={expensiveLabel}
          onChange={(e) => setExpensiveLabel(e.target.value)}
          placeholder="Expensive but still acceptable"
        />
        <input
          type="text"
          className="w-full px-3 py-2 rounded-lg border dark:bg-[#1A1A1E] dark:text-[#CBC9DE]"
          value={tooExpensiveLabel}
          onChange={(e) => setTooExpensiveLabel(e.target.value)}
          placeholder="Too expensive"
        />
      </div>

      <div className="flex items-center gap-3">
        <input
          id="vw_helper"
          type="checkbox"
          className="h-4 w-4"
          checked={showHelperText}
          onChange={(e) => setShowHelperText(e.target.checked)}
        />
        <label htmlFor="vw_helper" className="text-sm dark:text-[#96949C]">
          Show helper text under question
        </label>
      </div>
    </div>
  );
}
