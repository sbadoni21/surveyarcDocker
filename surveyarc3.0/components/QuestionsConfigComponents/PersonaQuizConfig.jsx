"use client";
import React, { useMemo } from "react";

export default function PersonaQuizConfig({ config = {}, updateConfig }) {
  const personas = Array.isArray(config.personas) ? config.personas : [];
  const items = Array.isArray(config.items) ? config.items : [];
  const resultSettings = config.resultSettings || {};

  const handlePersonaChange = (idx, field, value) => {
    const next = personas.map((p, i) =>
      i === idx ? { ...p, [field]: value } : p
    );
    updateConfig("personas", next);
  };

  const addPersona = () => {
    const idBase = `persona_${personas.length + 1}`;
    const next = [
      ...personas,
      {
        id: idBase,
        label: `Persona ${personas.length + 1}`,
        description: "",
        color: "#4B5563",
      },
    ];
    updateConfig("personas", next);
  };

  const removePersona = (idx) => {
    const next = personas.filter((_, i) => i !== idx);
    updateConfig("personas", next);
  };

  const handleItemChange = (idx, field, value) => {
    const next = items.map((it, i) =>
      i === idx ? { ...it, [field]: value } : it
    );
    updateConfig("items", next);
  };

  const addItem = () => {
    const idBase = `item_${items.length + 1}`;
    const next = [
      ...items,
      {
        id: idBase,
        text: `Question ${items.length + 1}`,
        options: [],
      },
    ];
    updateConfig("items", next);
  };

  const removeItem = (idx) => {
    const next = items.filter((_, i) => i !== idx);
    updateConfig("items", next);
  };

  const handleOptionChange = (itemIdx, optIdx, field, value) => {
    const item = items[itemIdx];
    const options = Array.isArray(item.options) ? item.options : [];
    const nextOptions = options.map((opt, i) =>
      i === optIdx ? { ...opt, [field]: value } : opt
    );
    const nextItems = items.map((it, i) =>
      i === itemIdx ? { ...it, options: nextOptions } : it
    );
    updateConfig("items", nextItems);
  };

  const handleWeightChange = (itemIdx, optIdx, personaId, value) => {
    const item = items[itemIdx];
    const options = Array.isArray(item.options) ? item.options : [];
    const opt = options[optIdx] || {};
    const weights = { ...(opt.weights || {}) };
    weights[personaId] = Number(value) || 0;

    const nextOptions = options.map((o, i) =>
      i === optIdx ? { ...o, weights } : o
    );
    const nextItems = items.map((it, i) =>
      i === itemIdx ? { ...it, options: nextOptions } : it
    );
    updateConfig("items", nextItems);
  };

  const addOption = (itemIdx) => {
    const item = items[itemIdx];
    const options = Array.isArray(item.options) ? item.options : [];
    const idBase = `opt_${options.length + 1}`;
    const weightsInit = {};
    personas.forEach((p) => (weightsInit[p.id] = 0));

    const nextOptions = [
      ...options,
      {
        id: idBase,
        label: `Option ${options.length + 1}`,
        weights: weightsInit,
      },
    ];
    const nextItems = items.map((it, i) =>
      i === itemIdx ? { ...it, options: nextOptions } : it
    );
    updateConfig("items", nextItems);
  };

  const tieBreak = resultSettings.tieBreak || "first";
  const showTopN = resultSettings.showTopN ?? 1;
  const showScores = !!resultSettings.showScores;

  const personaIds = useMemo(
    () => personas.map((p) => p.id),
    [personas]
  );

  return (
    <div className="space-y-6">
      {/* Personas */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold dark:text-[#CBC9DE]">
            Personas
          </h3>
          <button
            type="button"
            onClick={addPersona}
            className="text-xs px-3 py-1 rounded-lg bg-[#ED7A13] text-white hover:shadow-md transition"
          >
            + Add Persona
          </button>
        </div>

        {personas.length === 0 && (
          <p className="text-xs text-gray-500">
            Start by defining personas – we&apos;ll map answer options to them.
          </p>
        )}

        <div className="space-y-3">
          {personas.map((p, idx) => (
            <div
              key={p.id || idx}
              className="border rounded-xl p-3 flex flex-col gap-2 dark:bg-[#1A1A1E] bg-white"
            >
              <div className="flex justify-between items-center gap-3">
                <input
                  type="text"
                  className="flex-1 px-3 py-2 rounded-lg border text-sm dark:bg-[#121214] dark:text-[#CBC9DE]"
                  value={p.label || ""}
                  onChange={(e) =>
                    handlePersonaChange(idx, "label", e.target.value)
                  }
                  placeholder="Persona label (e.g. Analytical Achiever)"
                />
                <input
                  type="text"
                  className="w-40 px-3 py-2 rounded-lg border text-xs dark:bg-[#121214] dark:text-[#CBC9DE]"
                  value={p.id || ""}
                  onChange={(e) =>
                    handlePersonaChange(idx, "id", e.target.value)
                  }
                  placeholder="Internal ID"
                />
                <input
                  type="color"
                  className="w-10 h-10 rounded-md border"
                  value={p.color || "#4B5563"}
                  onChange={(e) =>
                    handlePersonaChange(idx, "color", e.target.value)
                  }
                />
                <button
                  type="button"
                  onClick={() => removePersona(idx)}
                  className="text-xs text-red-500 hover:underline"
                >
                  Remove
                </button>
              </div>
              <textarea
                className="w-full px-3 py-2 rounded-lg border text-xs dark:bg-[#121214] dark:text-[#CBC9DE]"
                value={p.description || ""}
                onChange={(e) =>
                  handlePersonaChange(idx, "description", e.target.value)
                }
                placeholder="Short description shown in result screen."
              />
            </div>
          ))}
        </div>
      </section>

      {/* Items & options */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold dark:text-[#CBC9DE]">
            Quiz Items & Weights
          </h3>
          <button
            type="button"
            onClick={addItem}
            className="text-xs px-3 py-1 rounded-lg bg-[#2563eb] text-white hover:shadow-md transition"
          >
            + Add Item
          </button>
        </div>

        {items.length === 0 && (
          <p className="text-xs text-gray-500">
            Add items (mini-questions). Each option contributes to persona
            scores.
          </p>
        )}

        <div className="space-y-4">
          {items.map((it, itemIdx) => (
            <div
              key={it.id || itemIdx}
              className="border rounded-xl p-3 space-y-3 dark:bg-[#1A1A1E] bg-white"
            >
              <div className="flex justify-between items-start gap-3">
                <div className="flex-1 space-y-2">
                  <input
                    type="text"
                    className="w-full px-3 py-2 rounded-lg border text-sm dark:bg-[#121214] dark:text-[#CBC9DE]"
                    value={it.text || ""}
                    onChange={(e) =>
                      handleItemChange(itemIdx, "text", e.target.value)
                    }
                    placeholder="Item question text"
                  />
                  <p className="text-[10px] text-gray-500">
                    Example: &quot;When choosing a product like this, what
                    matters most?&quot;
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => removeItem(itemIdx)}
                  className="text-xs text-red-500 hover:underline whitespace-nowrap"
                >
                  Remove Item
                </button>
              </div>

              {/* Options table */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-medium dark:text-[#CBC9DE]">
                    Options & Weights
                  </span>
                  <button
                    type="button"
                    onClick={() => addOption(itemIdx)}
                    className="text-xs px-2 py-1 rounded-lg bg-[#059669] text-white"
                  >
                    + Add Option
                  </button>
                </div>

                <div className="overflow-auto rounded-lg border">
                  <table className="min-w-full text-xs">
                    <thead className="bg-gray-50 dark:bg-[#121214]">
                      <tr>
                        <th className="px-3 py-2 text-left">Option</th>
                        {personas.map((p) => (
                          <th
                            key={p.id}
                            className="px-2 py-2 text-center whitespace-nowrap"
                          >
                            {p.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(it.options || []).map((opt, optIdx) => (
                        <tr
                          key={opt.id || optIdx}
                          className="border-t dark:border-[#25252b]"
                        >
                          <td className="px-3 py-2">
                            <input
                              type="text"
                              className="w-full px-2 py-1 rounded border dark:bg-[#121214] dark:text-[#CBC9DE]"
                              value={opt.label || ""}
                              onChange={(e) =>
                                handleOptionChange(
                                  itemIdx,
                                  optIdx,
                                  "label",
                                  e.target.value
                                )
                              }
                              placeholder="Option label"
                            />
                          </td>
                          {personas.map((p) => {
                            const w = opt.weights?.[p.id] ?? 0;
                            return (
                              <td
                                key={p.id}
                                className="px-2 py-1 text-center"
                              >
                                <input
                                  type="number"
                                  className="w-16 px-2 py-1 rounded border dark:bg-[#121214] dark:text-[#CBC9DE]"
                                  value={w}
                                  onChange={(e) =>
                                    handleWeightChange(
                                      itemIdx,
                                      optIdx,
                                      p.id,
                                      e.target.value
                                    )
                                  }
                                />
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                      {(it.options || []).length === 0 && (
                        <tr>
                          <td
                            colSpan={1 + personas.length}
                            className="px-3 py-2 text-[10px] text-gray-500"
                          >
                            No options yet. Click &quot;Add Option&quot;.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Result settings */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold dark:text-[#CBC9DE]">
          Result Settings
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <label className="space-y-1 text-xs">
            <span className="block dark:text-[#CBC9DE]">Show top N personas</span>
            <input
              type="number"
              min={1}
              max={personas.length || 5}
              value={showTopN}
              onChange={(e) =>
                updateConfig("resultSettings", {
                  ...resultSettings,
                  showTopN: Number(e.target.value) || 1,
                })
              }
              className="w-full px-3 py-2 rounded-lg border dark:bg-[#121214] dark:text-[#CBC9DE]"
            />
          </label>

          <label className="space-y-1 text-xs">
            <span className="block dark:text-[#CBC9DE]">Tie-break strategy</span>
            <select
              value={tieBreak}
              onChange={(e) =>
                updateConfig("resultSettings", {
                  ...resultSettings,
                  tieBreak: e.target.value,
                })
              }
              className="w-full px-3 py-2 rounded-lg border dark:bg-[#121214] dark:text-[#CBC9DE]"
            >
              <option value="first">Pick first max</option>
              <option value="random">Random among top</option>
              <option value="multi">Show all tied personas</option>
            </select>
          </label>

          <label className="flex items-center gap-2 text-xs mt-5">
            <input
              type="checkbox"
              checked={showScores}
              onChange={(e) =>
                updateConfig("resultSettings", {
                  ...resultSettings,
                  showScores: e.target.checked,
                })
              }
            />
            <span className="dark:text-[#CBC9DE]">
              Show persona score bars in result
            </span>
          </label>
        </div>

        <label className="space-y-1 text-xs">
          <span className="block dark:text-[#CBC9DE]">Result title</span>
          <input
            type="text"
            value={resultSettings.resultTitle || ""}
            onChange={(e) =>
              updateConfig("resultSettings", {
                ...resultSettings,
                resultTitle: e.target.value,
              })
            }
            className="w-full px-3 py-2 rounded-lg border dark:bg-[#121214] dark:text-[#CBC9DE]"
          />
        </label>

        <label className="space-y-1 text-xs">
          <span className="block dark:text-[#CBC9DE]">Result subtitle</span>
          <input
            type="text"
            value={resultSettings.resultSubtitle || ""}
            onChange={(e) =>
              updateConfig("resultSettings", {
                ...resultSettings,
                resultSubtitle: e.target.value,
              })
            }
            className="w-full px-3 py-2 rounded-lg border dark:bg-[#121214] dark:text-[#CBC9DE]"
          />
        </label>
      </section>
    </div>
  );
}
