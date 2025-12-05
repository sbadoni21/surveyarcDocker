"use client";

import React from "react";

export default function BayesAcqConfig({ config = {}, updateConfig }) {
  const items = config.items || [];
  const choiceSetSize = config.choiceSetSize ?? 3;
  const rounds = config.rounds ?? 5;
  const algorithm = config.algorithm || "bayesian_thompson";

  const handleItemChange = (index, key, value) => {
    const next = [...items];
    next[index] = { ...next[index], [key]: value };
    updateConfig("items", next);
  };

  const handleAddItem = () => {
    const next = [
      ...items,
      { id: `item_${items.length + 1}`, label: `Feature ${items.length + 1}` },
    ];
    updateConfig("items", next);
  };

  const handleRemoveItem = (index) => {
    const next = items.filter((_, i) => i !== index);
    updateConfig("items", next);
  };

  const handleNumericChange = (key, value) => {
    const num = Number(value);
    if (Number.isNaN(num)) return;
    updateConfig(key, num);
  };

  return (
    <div className="space-y-4">
      {/* High-level description */}
      <div className="text-xs rounded-lg p-3 bg-slate-50 dark:bg-[#1A1A1E] dark:text-[#96949C] border border-slate-200 dark:border-[#333]">
        <p>
          Bayesian Adaptive Choice shows small sets of features in multiple
          rounds, updating what is shown based on previous answers. Use this
          for deep preference learning and recommendation-style research.
        </p>
      </div>

      {/* Items editor */}
      <div className="space-y-2">
        <label className="text-sm font-medium dark:text-[#CBC9DE]">
          Features / Items
        </label>
        <div className="space-y-2">
          {items.length === 0 && (
            <div className="text-xs text-slate-500 dark:text-[#96949C]">
              No items yet. Add at least 4–6 features for a good design.
            </div>
          )}

          {items.map((item, index) => (
            <div
              key={item.id || index}
              className="flex gap-2 items-center bg-white dark:bg-[#1A1A1E] border border-slate-200 dark:border-[#333] rounded-lg p-2"
            >
              <input
                className="w-1/3 px-2 py-1 text-xs rounded border dark:bg-[#1A1A1E] dark:text-[#CBC9DE]"
                placeholder="Internal ID"
                value={item.id || ""}
                onChange={(e) => handleItemChange(index, "id", e.target.value)}
              />
              <input
                className="flex-1 px-2 py-1 text-xs rounded border dark:bg-[#1A1A1E] dark:text-[#CBC9DE]"
                placeholder="Label shown to respondent"
                value={item.label || ""}
                onChange={(e) =>
                  handleItemChange(index, "label", e.target.value)
                }
              />
              <button
                type="button"
                onClick={() => handleRemoveItem(index)}
                className="text-xs px-2 py-1 rounded bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/40 dark:text-red-300"
              >
                Remove
              </button>
            </div>
          ))}

          <button
            type="button"
            onClick={handleAddItem}
            className="text-xs px-3 py-1.5 rounded-lg bg-[#ED7A13] text-white hover:bg-[#d76b0f] transition"
          >
            + Add feature
          </button>
        </div>
      </div>

      {/* Design controls */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="space-y-1">
          <label className="text-sm font-medium dark:text-[#CBC9DE]">
            Options per screen
          </label>
          <input
            type="number"
            min={2}
            max={items.length || 10}
            value={choiceSetSize}
            onChange={(e) => handleNumericChange("choiceSetSize", e.target.value)}
            className="w-full px-2 py-1 rounded border text-sm dark:bg-[#1A1A1E] dark:text-[#CBC9DE]"
          />
          <p className="text-[10px] text-slate-500 dark:text-[#96949C]">
            Recommended: 3–4 options per round.
          </p>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium dark:text-[#CBC9DE]">
            Number of rounds
          </label>
          <input
            type="number"
            min={2}
            max={20}
            value={rounds}
            onChange={(e) => handleNumericChange("rounds", e.target.value)}
            className="w-full px-2 py-1 rounded border text-sm dark:bg-[#1A1A1E] dark:text-[#CBC9DE]"
          />
          <p className="text-[10px] text-slate-500 dark:text-[#96949C]">
            More rounds = more precision but longer survey.
          </p>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium dark:text-[#CBC9DE]">
            Algorithm
          </label>
          <select
            value={algorithm}
            onChange={(e) => updateConfig("algorithm", e.target.value)}
            className="w-full px-2 py-1 rounded border text-sm dark:bg-[#1A1A1E] dark:text-[#CBC9DE]"
          >
            <option value="bayesian_thompson">Bayesian Thompson Sampling</option>
            <option value="epsilon_greedy">Epsilon-Greedy</option>
            <option value="random">Random (Debug / Simple)</option>
          </select>
          <p className="text-[10px] text-slate-500 dark:text-[#96949C]">
            Backend can later implement true Bayesian updates per algorithm.
          </p>
        </div>
      </div>
    </div>
  );
}
