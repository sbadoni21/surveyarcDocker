"use client";
import React from "react";

export default function MonadicConfig({ config = {}, updateConfig }) {
  const allocationMode = config.allocationMode || "simple_random";
  const concepts = Array.isArray(config.concepts) ? config.concepts : [];
  const metrics = Array.isArray(config.metrics) ? config.metrics : [];
  const showOpenEnded = Boolean(config.showOpenEnded);
  const openEndedLabel =
    config.openEndedLabel ||
    "What did you like or dislike about this concept?";
  const persistConceptInSession =
    config.persistConceptInSession ?? true;

  const updateConcept = (idx, patch) => {
    const next = [...concepts];
    next[idx] = { ...next[idx], ...patch };
    updateConfig("concepts", next);
  };

  const addConcept = () => {
    const id = `c${(concepts.length || 0) + 1}`;
    updateConfig("concepts", [
      ...concepts,
      {
        id,
        name: `Concept ${id.toUpperCase()}`,
        description: "",
        imageUrl: "",
        price: "",
        tag: "",
        weight: 1,
        isControl: false,
      },
    ]);
  };

  const removeConcept = (idx) => {
    const next = concepts.filter((_, i) => i !== idx);
    updateConfig("concepts", next);
  };

  const updateMetric = (idx, patch) => {
    const next = [...metrics];
    next[idx] = { ...next[idx], ...patch };
    updateConfig("metrics", next);
  };

  const addMetric = () => {
    const id = `m${(metrics.length || 0) + 1}`;
    updateConfig("metrics", [
      ...metrics,
      {
        id,
        label: `Metric ${id.toUpperCase()}`,
        type: "likert",
        min: 1,
        max: 5,
        leftLabel: "",
        rightLabel: "",
      },
    ]);
  };

  const removeMetric = (idx) => {
    const next = metrics.filter((_, i) => i !== idx);
    updateConfig("metrics", next);
  };

  return (
    <div className="space-y-6 text-sm dark:text-[#CBC9DE] text-[#1f2933]">
      {/* Allocation */}
      <section className="space-y-2">
        <h3 className="font-medium">Allocation logic</h3>
        <select
          value={allocationMode}
          onChange={(e) => updateConfig("allocationMode", e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-[#8C8A97] dark:bg-[#1A1A1E]"
        >
          <option value="simple_random">Simple random (equal chance)</option>
          <option value="weighted">
            Weighted random (use concept weights)
          </option>
          <option value="quota">
            Quota-based (handled in backend / rules)
          </option>
        </select>
        <p className="text-xs text-gray-500">
          Allocation algorithm is applied once per respondent. For quota,
          implement logic in backend using this config.
        </p>

        <label className="flex items-center gap-2 mt-2">
          <input
            type="checkbox"
            checked={persistConceptInSession}
            onChange={(e) =>
              updateConfig("persistConceptInSession", e.target.checked)
            }
            className="h-4 w-4"
          />
          <span>
            Persist assigned concept across pages (recommended)
          </span>
        </label>
      </section>

      {/* Concepts */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-medium">Concepts</h3>
          <button
            type="button"
            onClick={addConcept}
            className="text-xs px-3 py-1 rounded-lg bg-[#ED7A13] text-white hover:opacity-90"
          >
            + Add concept
          </button>
        </div>

        {concepts.length === 0 && (
          <p className="text-xs text-gray-500">
            No concepts defined. Add at least 2 to run a monadic test.
          </p>
        )}

        <div className="space-y-4">
          {concepts.map((c, idx) => (
            <div
              key={c.id || idx}
              className="rounded-xl border border-[#8C8A97]/40 dark:bg-[#1A1A1E] bg-white p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">
                  {c.name || `Concept ${idx + 1}`}
                </span>
                <button
                  type="button"
                  onClick={() => removeConcept(idx)}
                  className="text-xs text-red-500 hover:underline"
                >
                  Remove
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs">Internal ID</label>
                  <input
                    type="text"
                    value={c.id || ""}
                    onChange={(e) =>
                      updateConcept(idx, { id: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-[#8C8A97] dark:bg-[#1A1A1E]"
                    placeholder="c1, c2..."
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs">Name (shown to user)</label>
                  <input
                    type="text"
                    value={c.name || ""}
                    onChange={(e) =>
                      updateConcept(idx, { name: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-[#8C8A97] dark:bg-[#1A1A1E]"
                    placeholder="Concept A"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs">Image URL (optional)</label>
                  <input
                    type="text"
                    value={c.imageUrl || ""}
                    onChange={(e) =>
                      updateConcept(idx, { imageUrl: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-[#8C8A97] dark:bg-[#1A1A1E]"
                    placeholder="https://..."
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs">Price / tagline (optional)</label>
                  <input
                    type="text"
                    value={c.price || ""}
                    onChange={(e) =>
                      updateConcept(idx, { price: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-[#8C8A97] dark:bg-[#1A1A1E]"
                    placeholder="₹499, Introductory offer, etc."
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs">Tag (Control / Variant)</label>
                  <input
                    type="text"
                    value={c.tag || ""}
                    onChange={(e) =>
                      updateConcept(idx, { tag: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-[#8C8A97] dark:bg-[#1A1A1E]"
                    placeholder="Control, Variant A..."
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs">Weight</label>
                  <input
                    type="number"
                    min={0}
                    step={0.1}
                    value={c.weight ?? 1}
                    onChange={(e) =>
                      updateConcept(idx, {
                        weight: Number(e.target.value) || 0,
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-[#8C8A97] dark:bg-[#1A1A1E]"
                  />
                  <p className="text-[10px] text-gray-500">
                    Used when allocation mode = weighted.
                  </p>
                </div>
              </div>

              <label className="flex items-center gap-2 mt-1">
                <input
                  type="checkbox"
                  checked={Boolean(c.isControl)}
                  onChange={(e) =>
                    updateConcept(idx, { isControl: e.target.checked })
                  }
                  className="h-4 w-4"
                />
                <span className="text-xs">Mark as control concept</span>
              </label>

              <div className="space-y-1">
                <label className="text-xs">Description (shown on card)</label>
                <textarea
                  value={c.description || ""}
                  onChange={(e) =>
                    updateConcept(idx, { description: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-[#8C8A97] dark:bg-[#1A1A1E] min-h-[60px]"
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Metrics */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-medium">Evaluation metrics</h3>
          <button
            type="button"
            onClick={addMetric}
            className="text-xs px-3 py-1 rounded-lg bg-[#ED7A13] text-white hover:opacity-90"
          >
            + Add metric
          </button>
        </div>

        {metrics.length === 0 && (
          <p className="text-xs text-gray-500">
            Add at least 1 metric (e.g. purchase intent).
          </p>
        )}

        <div className="space-y-3">
          {metrics.map((m, idx) => (
            <div
              key={m.id || idx}
              className="rounded-lg border border-[#8C8A97]/40 dark:bg-[#1A1A1E] bg-white p-3 space-y-2"
            >
              <div className="flex items-center justify-between">
                <input
                  type="text"
                  value={m.label || ""}
                  onChange={(e) =>
                    updateMetric(idx, { label: e.target.value })
                  }
                  className="flex-1 mr-2 px-3 py-2 rounded-lg border border-[#8C8A97] dark:bg-[#1A1A1E]"
                  placeholder="Purchase intent"
                />
                <button
                  type="button"
                  onClick={() => removeMetric(idx)}
                  className="text-xs text-red-500 hover:underline"
                >
                  Remove
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
                <div className="space-y-1">
                  <label>Type</label>
                  <select
                    value={m.type || "likert"}
                    onChange={(e) =>
                      updateMetric(idx, { type: e.target.value })
                    }
                    className="w-full px-2 py-1 rounded-lg border border-[#8C8A97] dark:bg-[#1A1A1E]"
                  >
                    <option value="likert">Likert 1–5</option>
                    <option value="star">Star rating</option>
                    <option value="slider">Slider</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label>Min / Max</label>
                  <div className="flex gap-1">
                    <input
                      type="number"
                      value={m.min ?? 1}
                      onChange={(e) =>
                        updateMetric(idx, {
                          min: Number(e.target.value) || 1,
                        })
                      }
                      className="w-full px-2 py-1 rounded-lg border border-[#8C8A97] dark:bg-[#1A1A1E]"
                    />
                    <input
                      type="number"
                      value={m.max ?? 5}
                      onChange={(e) =>
                        updateMetric(idx, {
                          max: Number(e.target.value) || 5,
                        })
                      }
                      className="w-full px-2 py-1 rounded-lg border border-[#8C8A97] dark:bg-[#1A1A1E]"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label>Left / Right labels (optional)</label>
                  <div className="flex gap-1">
                    <input
                      type="text"
                      value={m.leftLabel || ""}
                      onChange={(e) =>
                        updateMetric(idx, { leftLabel: e.target.value })
                      }
                      className="w-full px-2 py-1 rounded-lg border border-[#8C8A97] dark:bg-[#1A1A1E]"
                      placeholder="Low"
                    />
                    <input
                      type="text"
                      value={m.rightLabel || ""}
                      onChange={(e) =>
                        updateMetric(idx, { rightLabel: e.target.value })
                      }
                      className="w-full px-2 py-1 rounded-lg border border-[#8C8A97] dark:bg-[#1A1A1E]"
                      placeholder="High"
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Open-ended */}
      <section className="space-y-2">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={showOpenEnded}
            onChange={(e) =>
              updateConfig("showOpenEnded", e.target.checked)
            }
            className="h-4 w-4"
          />
          <span>Include open-ended feedback</span>
        </label>

        {showOpenEnded && (
          <div className="space-y-1">
            <label className="text-xs">Open-ended question label</label>
            <input
              type="text"
              value={openEndedLabel}
              onChange={(e) =>
                updateConfig("openEndedLabel", e.target.value)
              }
              className="w-full px-3 py-2 rounded-lg border border-[#8C8A97] dark:bg-[#1A1A1E]"
            />
          </div>
        )}
      </section>
    </div>
  );
}
