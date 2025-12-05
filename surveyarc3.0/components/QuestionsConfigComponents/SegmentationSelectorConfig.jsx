"use client";
import React, { useMemo } from "react";

export default function SegmentationSelectorConfig({ config = {}, updateConfig }) {
  const segments = useMemo(
    () => Array.isArray(config.segments) ? config.segments : [],
    [config.segments]
  );

  const mode = config.mode === "multi" ? "multi" : "single";
  const minSelect = Number.isFinite(config.minSelect) ? config.minSelect : 1;
  const maxSelect = Number.isFinite(config.maxSelect) ? config.maxSelect : (mode === "single" ? 1 : segments.length || 3);
  const randomizeOrder = Boolean(config.randomizeOrder);
  const showDescriptions = config.showDescriptions !== false;
  const showIcons = config.showIcons !== false;
  const showCodes = Boolean(config.showCodes);

  const updateSegmentField = (index, field, value) => {
    const next = segments.map((s, i) =>
      i === index ? { ...s, [field]: value } : s
    );
    updateConfig("segments", next);
  };

  const handleAddSegment = () => {
    const idx = segments.length + 1;
    const next = [
      ...segments,
      {
        id: `SEG_${idx}`,
        code: `S${idx}`,
        label: `Segment ${idx}`,
        description: "",
        icon: "👤",
        colorTag: "#4B5563",
      },
    ];
    updateConfig("segments", next);
  };

  const handleRemoveSegment = (index) => {
    const next = segments.filter((_, i) => i !== index);
    updateConfig("segments", next);
  };

  const handleDuplicateSegment = (index) => {
    const seg = segments[index];
    if (!seg) return;
    const idx = segments.length + 1;
    const copy = {
      ...seg,
      id: seg.id ? `${seg.id}_COPY` : `SEG_${idx}`,
      code: seg.code ? `${seg.code}_C` : `S${idx}`,
    };
    const next = [...segments.slice(0, index + 1), copy, ...segments.slice(index + 1)];
    updateConfig("segments", next);
  };

  return (
    <div className="space-y-5">
      {/* Mode */}
      <div className="flex gap-4">
        <div className="flex-1 space-y-1">
          <label className="block text-sm dark:text-[#CBC9DE] text-[#111827]">
            Selection mode
          </label>
          <select
            value={mode}
            onChange={(e) => {
              const v = e.target.value === "multi" ? "multi" : "single";
              updateConfig("mode", v);
              if (v === "single") {
                updateConfig("minSelect", 1);
                updateConfig("maxSelect", 1);
              }
            }}
            className="w-full px-3 py-2 rounded-lg border border-[#8C8A97] dark:bg-[#1A1A1E] dark:text-[#CBC9DE] bg-white text-sm"
          >
            <option value="single">Single segment (radio)</option>
            <option value="multi">Multiple segments (checkbox)</option>
          </select>
          <p className="text-xs text-gray-500 mt-1">
            Single = “Which one best describes you?”. Multi = “Check all that apply.”
          </p>
        </div>

        {/* Min / Max (for multi) */}
        {mode === "multi" && (
          <div className="flex-1 flex gap-3">
            <div className="flex-1 space-y-1">
              <label className="block text-sm dark:text-[#CBC9DE] text-[#111827]">
                Min selections
              </label>
              <input
                type="number"
                min={0}
                max={maxSelect}
                value={minSelect}
                onChange={(e) =>
                  updateConfig("minSelect", Number(e.target.value) || 0)
                }
                className="w-full px-3 py-2 rounded-lg border border-[#8C8A97] dark:bg-[#1A1A1E] dark:text-[#CBC9DE] bg-white text-sm"
              />
            </div>
            <div className="flex-1 space-y-1">
              <label className="block text-sm dark:text-[#CBC9DE] text-[#111827]">
                Max selections
              </label>
              <input
                type="number"
                min={1}
                max={segments.length || 10}
                value={maxSelect}
                onChange={(e) =>
                  updateConfig("maxSelect", Number(e.target.value) || 1)
                }
                className="w-full px-3 py-2 rounded-lg border border-[#8C8A97] dark:bg-[#1A1A1E] dark:text-[#CBC9DE] bg-white text-sm"
              />
            </div>
          </div>
        )}
      </div>

      {/* Display options */}
      <div className="flex flex-wrap gap-4 text-sm">
        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={randomizeOrder}
            onChange={(e) => updateConfig("randomizeOrder", e.target.checked)}
            className="h-4 w-4"
          />
          <span className="dark:text-[#CBC9DE] text-[#111827]">Randomize segment order</span>
        </label>

        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={showDescriptions}
            onChange={(e) => updateConfig("showDescriptions", e.target.checked)}
            className="h-4 w-4"
          />
          <span className="dark:text-[#CBC9DE] text-[#111827]">Show descriptions</span>
        </label>

        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={showIcons}
            onChange={(e) => updateConfig("showIcons", e.target.checked)}
            className="h-4 w-4"
          />
          <span className="dark:text-[#CBC9DE] text-[#111827]">Show icons</span>
        </label>

        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={showCodes}
            onChange={(e) => updateConfig("showCodes", e.target.checked)}
            className="h-4 w-4"
          />
          <span className="dark:text-[#CBC9DE] text-[#111827]">Show segment code</span>
        </label>
      </div>

      {/* Segments list */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium dark:text-[#CBC9DE] text-[#111827]">
            Segments ({segments.length})
          </h4>
          <button
            type="button"
            onClick={handleAddSegment}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#ED7A13] text-white hover:brightness-110 transition"
          >
            + Add Segment
          </button>
        </div>

        {segments.length === 0 && (
          <p className="text-xs text-gray-500">
            No segments defined yet. Click “Add Segment” to create your first persona.
          </p>
        )}

        <div className="space-y-3">
          {segments.map((seg, index) => (
            <div
              key={seg.id || index}
              className="rounded-xl border border-[#3F3C4C33] dark:border-[#3F3C4C] bg-white/70 dark:bg-[#1A1A1E] p-3 space-y-2 shadow-sm"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    className="w-10 text-center rounded-lg border border-[#8C8A97] dark:bg-[#111827] dark:text-[#CBC9DE] bg-white text-xs"
                    value={seg.code || ""}
                    onChange={(e) =>
                      updateSegmentField(index, "code", e.target.value)
                    }
                    placeholder="Code"
                  />
                  <input
                    type="text"
                    className="flex-1 px-3 py-2 rounded-lg border border-[#8C8A97] dark:bg-[#111827] dark:text-[#CBC9DE] bg-white text-sm"
                    value={seg.label || ""}
                    onChange={(e) =>
                      updateSegmentField(index, "label", e.target.value)
                    }
                    placeholder={`Segment ${index + 1} name`}
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    className="w-12 text-center rounded-lg border border-[#8C8A97] dark:bg-[#111827] dark:text-[#CBC9DE] bg-white text-sm"
                    value={seg.icon || ""}
                    onChange={(e) =>
                      updateSegmentField(index, "icon", e.target.value)
                    }
                    placeholder="😀"
                  />
                  <input
                    type="color"
                    className="w-8 h-8 rounded-md border border-[#8C8A97] cursor-pointer"
                    value={seg.colorTag || "#4B5563"}
                    onChange={(e) =>
                      updateSegmentField(index, "colorTag", e.target.value)
                    }
                  />
                </div>
              </div>

              <textarea
                className="w-full mt-1 px-3 py-2 rounded-lg border border-[#8C8A97] dark:bg-[#111827] dark:text-[#CBC9DE] bg-white text-xs"
                rows={2}
                value={seg.description || ""}
                onChange={(e) =>
                  updateSegmentField(index, "description", e.target.value)
                }
                placeholder="Short description that helps the respondent understand this persona."
              />

              <div className="flex items-center justify-between">
                <span className="text-[11px] text-gray-500">
                  Segment ID (stored in responses):{" "}
                  <code className="bg-black/5 dark:bg-white/5 px-1 py-0.5 rounded">
                    {seg.id || `SEG_${index + 1}`}
                  </code>
                </span>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleDuplicateSegment(index)}
                    className="text-[11px] px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    Duplicate
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemoveSegment(index)}
                    className="text-[11px] px-2 py-1 rounded-lg border border-red-300 text-red-600 hover:bg-red-50"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <p className="text-[11px] text-gray-500">
          Segments are stored as <code>segmentId</code> values in answers. You can later map them
          to personas / clusters in reporting & exports.
        </p>
      </div>
    </div>
  );
}
