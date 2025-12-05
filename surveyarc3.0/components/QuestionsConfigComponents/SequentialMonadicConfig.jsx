"use client";
import React from "react";

export default function SequentialMonadicConfig({ config = {}, updateConfig }) {
  const sequenceMode = config.sequenceMode || "random_subset";
  const maxConceptsPerRespondent =
    Number(config.maxConceptsPerRespondent) || 3;

  const concepts = Array.isArray(config.concepts) ? config.concepts : [];
  const metrics = Array.isArray(config.metrics) ? config.metrics : [];

  const showProgressBar = Boolean(config.showProgressBar ?? true);
  const showConceptIndex = Boolean(config.showConceptIndex ?? true);
  const showOpenEndedPerConcept = Boolean(
    config.showOpenEndedPerConcept ?? true
  );
  const openEndedLabel =
    config.openEndedLabel ||
    "What did you like or dislike about this concept?";

  const showSummaryScreen = Boolean(config.showSummaryScreen ?? true);
  const summaryQuestionLabel =
    config.summaryQuestionLabel ||
    "Now that you’ve seen all concepts, which one do you prefer overall?";
  const summaryMetricId = config.summaryMetricId || "overall_choice";

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
      },
    ]);
  };

  const removeConcept = (idx) => {
    const next = concepts.filter((_, i) => i !== idx);
    updateConfig("concepts", next);
  };

  const moveConcept = (from, to) => {
    if (to < 0 || to >= concepts.length) return;
    const next = [...concepts];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
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
      {/* Sequence logic */}
      <section className="space-y-2">
        <h3 className="font-medium">Sequence logic</h3>
        <select
          value={sequenceMode}
          onChange={(e) => updateConfig("sequenceMode", e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-[#8C8A97] dark:bg-[#1A1A1E]"
        >
          <option value="fixed">Fixed order (as listed)</option>
          <option value="random">Random order (all concepts)</option>
          <option value="random_subset">
            Random subset (limit per respondent)
          </option>
        </select>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
          <label className="space-y-1">
            <span className="text-xs">
              Max concepts per respondent (for random_subset)
            </span>
            <input
              type="number"
              min={1}
              max={concepts.length || 10}
              value={maxConceptsPerRespondent}
              onChange={(e) =>
                updateConfig(
                  "maxConceptsPerRespondent",
                  Number(e.target.value) || 1
                )
              }
              className="w-full px-3 py-2 rounded-lg border border-[#8C8A97] dark:bg-[#1A1A1E]"
            />
            <span className="text-[10px] text-gray-500">
              If greater than total concepts, all will be shown.
            </span>
          </label>

          <label className="flex items-center gap-2 mt-1">
            <input
              type="checkbox"
              checked={showProgressBar}
              onChange={(e) => updateConfig("showProgressBar", e.target.checked)}
              className="h-4 w-4"
            />
            <span>Show progress bar (1 / N concepts)</span>
          </label>

          <label className="flex items-center gap-2 mt-1">
            <input
              type="checkbox"
              checked={showConceptIndex}
              onChange={(e) =>
                updateConfig("showConceptIndex", e.target.checked)
              }
              className="h-4 w-4"
            />
            <span>Show concept index (Concept 1 of N)</span>
          </label>
        </div>
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
            Add at least 2 concepts to run a sequential monadic test.
          </p>
        )}

        <div className="space-y-4">
          {concepts.map((c, idx) => (
            <div
              key={c.id || idx}
              className="rounded-xl border border-[#8C8A97]/40 dark:bg-[#1A1A1E] bg-white p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">
                    #{idx + 1}
                  </span>
                  <span className="font-medium">
                    {c.name || `Concept ${idx + 1}`}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => moveConcept(idx, idx - 1)}
                    className="text-[11px] px-2 py-1 rounded border border-[#8C8A97]/40 hover:bg-gray-100 dark:hover:bg-[#2A2A2F]"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => moveConcept(idx, idx + 1)}
                    className="text-[11px] px-2 py-1 rounded border border-[#8C8A97]/40 hover:bg-gray-100 dark:hover:bg-[#2A2A2F]"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => removeConcept(idx)}
                    className="text-xs text-red-500 hover:underline"
                  >
                    Remove
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="space-y-1 text-xs">
                  <span>Internal ID</span>
                  <input
                    type="text"
                    value={c.id || ""}
                    onChange={(e) => updateConcept(idx, { id: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-[#8C8A97] dark:bg-[#1A1A1E]"
                    placeholder="c1, c2..."
                  />
                </label>

                <label className="space-y-1 text-xs">
                  <span>Name (shown to user)</span>
                  <input
                    type="text"
                    value={c.name || ""}
                    onChange={(e) =>
                      updateConcept(idx, { name: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-[#8C8A97] dark:bg-[#1A1A1E]"
                    placeholder="Concept A"
                  />
                </label>

                <label className="space-y-1 text-xs">
                  <span>Image URL</span>
                  <input
                    type="text"
                    value={c.imageUrl || ""}
                    onChange={(e) =>
                      updateConcept(idx, { imageUrl: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-[#8C8A97] dark:bg-[#1A1A1E]"
                    placeholder="https://..."
                  />
                </label>

                <label className="space-y-1 text-xs">
                  <span>Price / tagline</span>
                  <input
                    type="text"
                    value={c.price || ""}
                    onChange={(e) =>
                      updateConcept(idx, { price: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-[#8C8A97] dark:bg-[#1A1A1E]"
                    placeholder="₹499, Limited offer..."
                  />
                </label>

                <label className="space-y-1 text-xs md:col-span-2">
                  <span>Tag (optional)</span>
                  <input
                    type="text"
                    value={c.tag || ""}
                    onChange={(e) =>
                      updateConcept(idx, { tag: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-[#8C8A97] dark:bg-[#1A1A1E]"
                    placeholder="Variant A, Premium, etc."
                  />
                </label>
              </div>

              <label className="space-y-1 text-xs block">
                <span>Description</span>
                <textarea
                  value={c.description || ""}
                  onChange={(e) =>
                    updateConcept(idx, { description: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-[#8C8A97] dark:bg-[#1A1A1E] min-h-[60px]"
                />
              </label>
            </div>
          ))}
        </div>
      </section>

      {/* Metrics */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-medium">Per-concept metrics</h3>
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
                <label className="space-y-1">
                  <span>Type</span>
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
                </label>

                <label className="space-y-1">
                  <span>Min / Max</span>
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
                </label>

                <label className="space-y-1">
                  <span>Left / Right labels</span>
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
                </label>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Open-ended per concept */}
      <section className="space-y-2">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={showOpenEndedPerConcept}
            onChange={(e) =>
              updateConfig("showOpenEndedPerConcept", e.target.checked)
            }
            className="h-4 w-4"
          />
          <span>Include open-ended text for each concept</span>
        </label>

        {showOpenEndedPerConcept && (
          <div className="space-y-1">
            <span className="text-xs">Open-ended label</span>
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

      {/* Summary screen */}
      <section className="space-y-2">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={showSummaryScreen}
            onChange={(e) =>
              updateConfig("showSummaryScreen", e.target.checked)
            }
            className="h-4 w-4"
          />
          <span>Show final summary question (overall preference)</span>
        </label>

        {showSummaryScreen && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <label className="space-y-1">
              <span>Summary question label</span>
              <input
                type="text"
                value={summaryQuestionLabel}
                onChange={(e) =>
                  updateConfig("summaryQuestionLabel", e.target.value)
                }
                className="w-full px-3 py-2 rounded-lg border border-[#8C8A97] dark:bg-[#1A1A1E]"
              />
            </label>

            <label className="space-y-1">
              <span>Summary metric ID (for data)</span>
              <input
                type="text"
                value={summaryMetricId}
                onChange={(e) =>
                  updateConfig("summaryMetricId", e.target.value)
                }
                className="w-full px-3 py-2 rounded-lg border border-[#8C8A97] dark:bg-[#1A1A1E]"
                placeholder="overall_choice"
              />
            </label>
          </div>
        )}
      </section>
    </div>
  );
}
