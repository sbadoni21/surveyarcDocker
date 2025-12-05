"use client";
import React from "react";

export default function ConjointConfig({ config = {}, updateConfig }) {
  const attributes = config.attributes || [];
  const cardsPerTask = config.cardsPerTask ?? 3;
  const tasksCount = config.tasksCount ?? 4;
  const randomize = config.randomize ?? true;

  const updateAttributes = (next) => {
    updateConfig("attributes", next);
  };

  const handleAttrNameChange = (index, value) => {
    const next = [...attributes];
    next[index] = { ...(next[index] || {}), name: value };
    updateAttributes(next);
  };

  const handleLevelChange = (attrIndex, levelIndex, value) => {
    const attr = attributes[attrIndex] || { name: "", levels: [""] };
    const levels = Array.isArray(attr.levels) ? [...attr.levels] : [""];
    levels[levelIndex] = value;
    const next = [...attributes];
    next[attrIndex] = { ...attr, levels };
    updateAttributes(next);
  };

  const handleAddAttribute = () => {
    const next = [
      ...attributes,
      {
        name: `Attribute ${attributes.length + 1}`,
        levels: ["Level 1", "Level 2"],
      },
    ];
    updateAttributes(next);
  };

  const handleRemoveAttribute = (index) => {
    const next = attributes.filter((_, i) => i !== index);
    updateAttributes(next);
  };

  const handleAddLevel = (attrIndex) => {
    const attr = attributes[attrIndex] || { name: "", levels: [] };
    const levels = Array.isArray(attr.levels) ? [...attr.levels] : [];
    levels.push(`Level ${levels.length + 1}`);
    const next = [...attributes];
    next[attrIndex] = { ...attr, levels };
    updateAttributes(next);
  };

  const handleRemoveLevel = (attrIndex, levelIndex) => {
    const attr = attributes[attrIndex] || { name: "", levels: [] };
    const levels = (attr.levels || []).filter((_, i) => i !== levelIndex);
    const next = [...attributes];
    next[attrIndex] = { ...attr, levels };
    updateAttributes(next);
  };

  const handleNumberChange = (key, value) => {
    const num = parseInt(value, 10);
    if (Number.isNaN(num)) return;
    updateConfig(key, num);
  };

  return (
    <div className="space-y-4 p-4">
      <p className="text-xs text-gray-500 dark:text-[#96949C]">
        Conjoint: respondents see multiple <b>profiles/cards</b> built from
        attributes and levels and choose the most preferred option in each task.
      </p>

      {/* Attributes + levels */}
      <div className="space-y-3">
        <label className="block text-sm dark:text-[#CBC9DE] text-slate-800">
          Attributes & levels
        </label>

        <div className="space-y-3">
          {attributes.map((attr, attrIndex) => (
            <div
              key={attrIndex}
              className="rounded-lg border border-slate-200 dark:border-[#3A3A40] bg-white/70 dark:bg-[#1A1A1E] p-3 space-y-2"
            >
              <div className="flex gap-2 items-center">
                <input
                  type="text"
                  className="flex-1 px-3 py-2 rounded-lg border border-[#8C8A97] dark:bg-[#1A1A1E] bg-white/80 text-sm dark:text-[#CBC9DE] text-slate-800"
                  value={attr?.name || ""}
                  onChange={(e) =>
                    handleAttrNameChange(attrIndex, e.target.value)
                  }
                  placeholder={`Attribute ${attrIndex + 1} (e.g. Price, Brand)`}
                />
                <button
                  type="button"
                  onClick={() => handleRemoveAttribute(attrIndex)}
                  className="px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white/70 dark:bg-[#1A1A1E] dark:text-[#96949C] hover:bg-red-50 hover:border-red-300 transition"
                >
                  ✕
                </button>
              </div>

              {/* Levels */}
              <div className="space-y-1">
                <p className="text-xs text-gray-500 dark:text-[#96949C]">
                  Levels for this attribute
                </p>
                {(attr.levels || []).map((lvl, lvlIndex) => (
                  <div key={lvlIndex} className="flex gap-2">
                    <input
                      type="text"
                      className="flex-1 px-3 py-2 rounded-lg border border-[#8C8A97] dark:bg-[#1A1A1E] bg-white/80 text-sm dark:text-[#CBC9DE] text-slate-800"
                      value={lvl}
                      onChange={(e) =>
                        handleLevelChange(
                          attrIndex,
                          lvlIndex,
                          e.target.value
                        )
                      }
                      placeholder={`Level ${lvlIndex + 1}`}
                    />
                    <button
                      type="button"
                      onClick={() =>
                        handleRemoveLevel(attrIndex, lvlIndex)
                      }
                      className="px-2 py-1 text-xs rounded-lg border border-slate-300 bg-white/70 dark:bg-[#1A1A1E] dark:text-[#96949C] hover:bg-red-50 hover:border-red-300 transition"
                    >
                      ✕
                    </button>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={() => handleAddLevel(attrIndex)}
                  className="mt-1 text-xs px-3 py-2 rounded-lg border border-dashed border-slate-300 dark:border-[#3A3A40] bg-white/60 dark:bg-[#1A1A1E] hover:bg-slate-50 dark:hover:bg-[#25252A] transition"
                >
                  + Add level
                </button>
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={handleAddAttribute}
            className="text-xs px-3 py-2 rounded-lg border border-dashed border-slate-300 dark:border-[#3A3A40] bg-white/60 dark:bg-[#1A1A1E] hover:bg-slate-50 dark:hover:bg-[#25252A] transition"
          >
            + Add attribute
          </button>
        </div>
      </div>

      {/* Design options */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-1">
          <label className="block text-sm dark:text-[#CBC9DE] text-slate-800">
            Cards per task
          </label>
          <input
            type="number"
            min={2}
            max={6}
            value={cardsPerTask}
            onChange={(e) =>
              handleNumberChange("cardsPerTask", e.target.value)
            }
            className="w-full px-3 py-2 rounded-lg border border-[#8C8A97] dark:bg-[#1A1A1E] bg-white/80 text-sm dark:text-[#CBC9DE] text-slate-800"
          />
          <p className="text-[10px] text-gray-400">
            How many profiles are shown side-by-side (e.g. 2–3).
          </p>
        </div>

        <div className="space-y-1">
          <label className="block text-sm dark:text-[#CBC9DE] text-slate-800">
            Number of tasks
          </label>
          <input
            type="number"
            min={1}
            value={tasksCount}
            onChange={(e) =>
              handleNumberChange("tasksCount", e.target.value)
            }
            className="w-full px-3 py-2 rounded-lg border border-[#8C8A97] dark:bg-[#1A1A1E] bg-white/80 text-sm dark:text-[#CBC9DE] text-slate-800"
          />
          <p className="text-[10px] text-gray-400">
            How many choice screens each respondent will do.
          </p>
        </div>

        <div className="space-y-1">
          <label className="block text-sm dark:text-[#CBC9DE] text-slate-800">
            Randomize profiles
          </label>
          <div className="flex items-center gap-2 mt-1">
            <input
              type="checkbox"
              checked={Boolean(randomize)}
              onChange={(e) =>
                updateConfig("randomize", e.target.checked)
              }
              className="h-4 w-4"
            />
            <span className="text-xs dark:text-[#96949C] text-slate-600">
              Random order of profiles inside each task.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
