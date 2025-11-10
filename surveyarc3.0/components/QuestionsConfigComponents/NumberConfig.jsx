// components/QuestionConfigComponents/NumberConfig.tsx
"use client";
import React, { useState, useEffect } from "react";

export default function NumberConfig({ config, updateConfig }) {
  const [placeholder, setPlaceholder] = useState(config.placeholder || "");
  const [min, setMin] = useState(config.min ?? "");
  const [max, setMax] = useState(config.max ?? "");
  const [step, setStep] = useState(config.step ?? "");

  // Sync local state when parent config changes
  useEffect(() => {
    setPlaceholder(config.placeholder || "");
    setMin(config.min ?? "");
    setMax(config.max ?? "");
    setStep(config.step ?? "");
  }, [config.placeholder, config.min, config.max, config.step]);

  const onPlaceholderChange = (e) => {
    const val = e.target.value;
    setPlaceholder(val);
    updateConfig("placeholder", val);
  };

  const onMinChange = (e) => {
    const val = e.target.value;
    setMin(val);
    updateConfig("min", val === "" ? null : Number(val));
  };

  const onMaxChange = (e) => {
    const val = e.target.value;
    setMax(val);
    updateConfig("max", val === "" ? null : Number(val));
  };

  const onStepChange = (e) => {
    const val = e.target.value;
    setStep(val);
    updateConfig("step", val === "" ? null : Number(val));
  };

  return (
    <div className="space-y-4 dark:bg-[#1A1A1E] dark:text-[#96949C]">
      <div>
        <label className="block text-sm">Placeholder</label>
        <input
          type="text"
          className="border p-2 rounded w-full dark:bg-[#1A1A1E] dark:text-[#CBC9DE]"
          value={placeholder}
          onChange={onPlaceholderChange}
          placeholder="Enter placeholder text (optional)"
        />
      </div>
      <div className="flex gap-4">
        <div className="flex-1">
          <label className="block text-sm">Min Value</label>
          <input
            type="number"
            className="border p-2 rounded w-full dark:bg-[#1A1A1E] dark:text-[#CBC9DE]"
            value={min}
            onWheel={(e) => e.target.blur()}
            onChange={onMinChange}
          />
        </div>
        <div className="flex-1">
          <label className="block text-sm">Max Value</label>
          <input
            type="number"
            className="border p-2 rounded w-full dark:bg-[#1A1A1E] dark:text-[#CBC9DE]"
            value={max}
            onWheel={(e) => e.target.blur()}
            onChange={onMaxChange}
          />
        </div>
        <div className="flex-1">
          <label className="block text-sm">Step</label>
          <input
            type="number"
            className="border p-2 rounded w-full dark:bg-[#1A1A1E] dark:text-[#CBC9DE]"
            value={step}
            onChange={onStepChange}
          />
        </div>
      </div>
    </div>
  );
}
