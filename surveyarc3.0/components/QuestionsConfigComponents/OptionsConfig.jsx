"use client";

import React, { useEffect, useMemo, useState, useRef } from "react";
import QUESTION_TYPES from "@/enums/questionTypes";
import { RiDeleteBin6Line } from "react-icons/ri";

const isEqual = (a, b) => {
  try {
    return JSON.stringify(a || []) === JSON.stringify(b || []);
  } catch {
    return false;
  }
};

const makeDeterministicId = (label, index) => {
  const safe = String(label ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `opt_${index}${safe ? `_${safe}` : ""}`;
};

const SERIAL_REGEX = /^([A-Za-z]+)(\d+)$/;

const generateNextOptionSerial = (options, prefix = "A") => {
  const nums = options
    .map((o) => o.serial_label)
    .filter(Boolean)
    .map((s) => {
      const m = SERIAL_REGEX.exec(s);
      return m && m[1] === prefix ? parseInt(m[2], 10) : null;
    })
    .filter((n) => n != null);

  const next = nums.length ? Math.max(...nums) + 1 : 1;
  return `${prefix}${next}`;
};

const normalizeIncoming = (incoming = []) => {
  return (incoming || [])
    .map((o, idx) => {
      if (o == null) return null;
      if (typeof o === "string") {
        return { id: makeDeterministicId(o, idx), label: o };
      }
      const id = o.id || makeDeterministicId(o.label ?? "", idx);
      return {
        id,
        label: o.label ?? "",
        serial_label: o.serial_label ?? null,
        isOther: !!o.isOther,
        isNone: !!o.isNone,
      };
    })
    .filter(Boolean);
};

export default function OptionsConfig({
  config = {},
  updateConfig = () => {},
  type,
}) {
  const incomingOptions = config.options || [];
  const normalizedIncoming = useMemo(
    () => normalizeIncoming(incomingOptions),
    [incomingOptions]
  );

  const [options, setOptions] = useState(normalizedIncoming);

  const mountedRef = useRef(false);
  const debounceRef = useRef(null);
  const writeLockRef = useRef(false);
  const writeLockTimerRef = useRef(null);
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [search, setSearch] = useState("");
  const [editAllModalOpen, setEditAllModalOpen] = useState(false);
  const [editAllText, setEditAllText] = useState("");

  const WRITE_LOCK_MS = 700;
  const DEBOUNCE_MS = 300;

  const engageWriteLock = () => {
    writeLockRef.current = true;
    if (writeLockTimerRef.current) clearTimeout(writeLockTimerRef.current);
    writeLockTimerRef.current = setTimeout(() => {
      writeLockRef.current = false;
      writeLockTimerRef.current = null;
    }, WRITE_LOCK_MS);
  };

  useEffect(() => {
    if (writeLockRef.current) return;
    if (!isEqual(normalizedIncoming, options)) {
      setOptions(normalizedIncoming);
    }
  }, [normalizedIncoming]);

  // debounce pushing options -> parent config
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      const parentNormalized = normalizeIncoming(config.options || []);
      if (!isEqual(options, parentNormalized)) {
        mountedRef.current = true;
        updateConfig("options", options);
      }
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [options]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (writeLockTimerRef.current) clearTimeout(writeLockTimerRef.current);
    };
  }, []);

  const setOptionLabel = (index, label) => {
    engageWriteLock();
    setOptions((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], label };
      return copy;
    });
  };

  const addOption = () => {
    engageWriteLock();
    setOptions((prev) => {
      const i = prev.length;
      const nextSerial = generateNextOptionSerial(prev, "A");

      return [
        ...prev,
        {
          id: makeDeterministicId("", i),
          label: "",
          serial_label: nextSerial,
        },
      ];
    });
  };

  const removeOption = (id) => {
    engageWriteLock();
    setOptions((prev) => prev.filter((o) => o.id !== id));
  };

  const addSpecialIfMissing = (flag) => {
    engageWriteLock();
    setOptions((prev) => {
      if (prev.some((o) => o[flag])) return prev;
      const entry = {
        id: flag === "isOther" ? "other" : "none",
        label: flag === "isOther" ? "Other" : "None",
        [flag]: true,
      };
      return [...prev, entry];
    });
  };

  const removeSpecial = (flag) => {
    engageWriteLock();
    setOptions((prev) => prev.filter((o) => !o[flag]));
  };

  const toggleSpecial = (flag, enabled) => {
    if (enabled) addSpecialIfMissing(flag);
    else removeSpecial(flag);
  };

  const parseBulkText = (text) => {
    if (!text) return [];
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    const results = [];
    for (let l of lines) {
      if (l.includes(",") && l.split(",").length > 1) {
        l.split(",")
          .map((c) => c.trim())
          .filter(Boolean)
          .forEach((c) => results.push(c));
      } else {
        results.push(l);
      }
    }
    return results;
  };

  const bulkAddFromText = (text) => {
    const parsed = parseBulkText(text);
    if (!parsed.length) return;
    engageWriteLock();
    setOptions((prev) => {
      const specials = prev.filter((p) => p.isOther || p.isNone);
      const normalPrev = prev.filter((p) => !p.isOther && !p.isNone);
      const existingLabels = new Set(
        normalPrev.map((p) => String(p.label).trim().toLowerCase())
      );
      const newItems = [];
      parsed.forEach((label, idx) => {
        const trimmed = String(label).trim();
        if (!trimmed) return;
        if (existingLabels.has(trimmed.toLowerCase())) return;
        existingLabels.add(trimmed.toLowerCase());
        const id = makeDeterministicId(
          trimmed,
          normalPrev.length + newItems.length
        );
        newItems.push({ id, label: trimmed });
      });
      return [...normalPrev, ...newItems, ...specials];
    });
  };

  const handleFileImport = async (file) => {
    if (!file) return;
    try {
      const txt = await file.text();
      const lines = txt
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);
      const parsed = [];
      for (let l of lines) {
        if (l.includes(",")) {
          const cols = l
            .split(",")
            .map((c) => c.trim())
            .filter(Boolean);
          if (cols.length) parsed.push(cols[0]);
        } else {
          parsed.push(l);
        }
      }
      bulkAddFromText(parsed.join("\n"));
    } catch (err) {
      console.error("Failed to import file", err);
    }
  };

  const openEditAllModal = () => {
    const nonSpecial = options.filter((o) => !o.isOther && !o.isNone);
    setEditAllText(nonSpecial.map((o) => o.label).join("\n"));
    setEditAllModalOpen(true);
  };

  const saveEditAll = () => {
    const parsed = parseBulkText(editAllText);
    engageWriteLock();
    setOptions((prev) => {
      const specials = prev.filter((p) => p.isOther || p.isNone);
      const newNorm = parsed.map((label, idx) => ({
        id: makeDeterministicId(label, idx),
        label,
      }));
      return [...newNorm, ...specials];
    });
    setEditAllModalOpen(false);
  };

  const visibleOptions = options.filter((o) => {
    if (!search) return true;
    return String(o.label).toLowerCase().includes(search.toLowerCase());
  });

  const labelText =
    type === QUESTION_TYPES.CHECKBOX
      ? "Checkbox options"
      : type === QUESTION_TYPES.DROPDOWN
      ? "Dropdown options"
      : "Choices";

  // show min/max only for DROPDOWN and CHECKBOX
  const showMinMax =
    type === QUESTION_TYPES.DROPDOWN || type === QUESTION_TYPES.CHECKBOX;

  // Local controlled values for min/max (strings to allow empty)
  const [minLocal, setMinLocal] = useState(
    typeof config.minSelections !== "undefined"
      ? String(config.minSelections)
      : ""
  );
  const [maxLocal, setMaxLocal] = useState(
    typeof config.maxSelections !== "undefined"
      ? String(config.maxSelections)
      : ""
  );
  const [minError, setMinError] = useState("");
  const [maxError, setMaxError] = useState("");

  // sync when parent config or options change
  useEffect(() => {
    setMinLocal(
      typeof config.minSelections !== "undefined"
        ? String(config.minSelections)
        : ""
    );
    setMaxLocal(
      typeof config.maxSelections !== "undefined"
        ? String(config.maxSelections)
        : ""
    );
  }, [config.minSelections, config.maxSelections]);

  // validate whenever local values or options change
  useEffect(() => {
    setMinError("");
    setMaxError("");

    const optCount = options.filter((o) => !o.isOther && !o.isNone).length;
    const parseNum = (v) => {
      if (v === "" || v == null) return null;
      const n = Number(v);
      if (Number.isNaN(n)) return null;
      return Math.floor(n);
    };

    const minN = parseNum(minLocal);
    const maxN = parseNum(maxLocal);

    if (minN != null && minN < 0) setMinError("Min cannot be negative");
    if (maxN != null && maxN < 0) setMaxError("Max cannot be negative");

    if (minN != null && maxN != null && minN > maxN) {
      setMinError("Min cannot be greater than Max");
      setMaxError("Max cannot be less than Min");
    }

    if (maxN != null && optCount > 0 && maxN > optCount) {
      setMaxError(`Max cannot exceed option count (${optCount})`);
    }

    if (minN != null && optCount > 0 && minN > optCount) {
      setMinError(`Min cannot exceed option count (${optCount})`);
    }
  }, [minLocal, maxLocal, options]);

  // commit functions: only update parent config when valid (called onBlur or via auto-fix)
  const commitMin = () => {
    // if invalid, do not push
    if (minError) return;
    const v = minLocal === "" ? undefined : Math.max(0, parseInt(minLocal, 10));
    updateConfig("minSelections", typeof v === "undefined" ? undefined : v);
  };
  const commitMax = () => {
    if (maxError) return;
    const v = maxLocal === "" ? undefined : Math.max(0, parseInt(maxLocal, 10));
    updateConfig("maxSelections", typeof v === "undefined" ? undefined : v);
  };

  // auto-fix clamp max -> option count
  const clampMaxToOptionCount = () => {
    const optCount = options.filter((o) => !o.isOther && !o.isNone).length;
    setMaxLocal(String(optCount));
    // push immediately
    updateConfig("maxSelections", optCount);
    setMaxError("");
  };

  return (
    <>
      <div className="space-y-3 dark:bg-[#1A1A1E] dark:text-[#96949C] p-2">
        <label className="block dark:text-[#96949C] text-sm">{labelText}</label>

        <div className="flex gap-2 items-center">
          <input
            placeholder="Search options..."
            className="flex-1 border border-[#8C8A97] dark:bg-[#1A1A1E] py-1 px-3 rounded"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <button
            type="button"
            onClick={() => setBulkModalOpen(true)}
            className="bg-[#D5D5D5] text-black px-3 text-sm py-1 rounded"
            title="Bulk add options (paste newline or CSV)"
          >
            Bulk Add
          </button>

          <label className="bg-[#D5D5D5] text-black px-3 text-sm py-1 rounded cursor-pointer">
            Import
            <input
              type="file"
              accept=".txt,.csv"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFileImport(f);
                e.currentTarget.value = "";
              }}
              className="hidden"
            />
          </label>

          <button
            type="button"
            onClick={openEditAllModal}
            className="bg-[#f3f4f6] dark:bg-[#222] px-3 text-sm py-1 rounded"
            title="Edit all options in one view"
          >
            Edit All
          </button>
        </div>

        <div className="space-y-2 max-h-64 overflow-auto mt-2">
          {visibleOptions.map((opt, i) => (
            <div key={opt.id} className="flex items-center gap-3">
              {/* Serial Label */}
              <input
                className="w-20 border px-2 py-1 rounded text-xs text-center"
                value={opt.serial_label || ""}
                placeholder="A1"
                onChange={(e) => {
                  const value = e.target.value.trim();
                  setOptions((prev) => {
                    const copy = [...prev];

                    // 🔒 uniqueness check
                    if (
                      value &&
                      copy.some(
                        (o, idx) => idx !== i && o.serial_label === value
                      )
                    ) {
                      alert("Option serial label must be unique");
                      return prev;
                    }

                    copy[i] = { ...copy[i], serial_label: value || null };
                    return copy;
                  });
                }}
              />

              {/* Option Label */}
              <input
                className="border flex-grow px-3 py-1 rounded"
                value={opt.label}
                onChange={(e) =>
                  setOptionLabel(options.indexOf(opt), e.target.value)
                }
              />
            </div>
          ))}

          {visibleOptions.length === 0 && (
            <div className="text-sm text-gray-500 dark:text-gray-400 p-2">
              No options found.
            </div>
          )}
        </div>

        <div className="flex gap-2 mt-2">
          <button
            type="button"
            onClick={addOption}
            className="bg-[#D5D5D5] text-black px-3 text-sm py-1 rounded"
          >
            + Add Option
          </button>
          <div className="flex-1" />
        </div>

        <div className="space-y-3 mt-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={Boolean(options.some((o) => o.isOther))}
              onChange={(e) => toggleSpecial("isOther", e.target.checked)}
            />
            <span className="text-sm">Add “Other” Option</span>
          </label>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={Boolean(options.some((o) => o.isNone))}
              onChange={(e) => toggleSpecial("isNone", e.target.checked)}
            />
            <span className="text-sm">Add “None (exclusive)” Option</span>
          </label>
        </div>

        {showMinMax && (
          <div className="mt-3 border-t pt-3">
            <label className="block text-sm mb-2 dark:text-[#96949C]">
              Selection limits
            </label>
            <div className="flex items-start gap-3 max-w-full flex-wrap">
              <div className="flex flex-col">
                <label className="text-xs text-gray-500">Min selections</label>
                <input
                  type="number"
                  min={0}
                  className={`px-3 py-2 rounded border dark:border-[#222] bg-white dark:bg-[#1A1A1E] w-36`}
                  value={minLocal}
                  onWheel={(e) => e.target.blur()}
                  onChange={(e) => setMinLocal(e.target.value)}
                  onBlur={commitMin}
                  placeholder="0"
                />
                {minError && (
                  <div className="text-xs text-red-500 mt-1">{minError}</div>
                )}
              </div>

              <div className="flex flex-col">
                <label className="text-xs text-gray-500">Max selections</label>
                <input
                  type="number"
                  min={0}
                  onWheel={(e) => e.target.blur()}
                  className={`px-3 py-2 rounded border dark:border-[#222] bg-white dark:bg-[#1A1A1E] w-36`}
                  value={maxLocal}
                  onChange={(e) => setMaxLocal(e.target.value)}
                  onBlur={commitMax}
                  placeholder=""
                />
                {maxError && (
                  <div className="text-xs text-red-500 mt-1">{maxError}</div>
                )}
              </div>

              <div className="text-sm text-gray-500 mt-2">
                Leave blank to allow any number (up to option count).
                <div className="mt-2">
                  {maxError && maxError.includes("option count") && (
                    <button
                      className="text-xs text-blue-600 underline"
                      onClick={clampMaxToOptionCount}
                      type="button"
                    >
                      Auto-fix: clamp max to option count
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bulk Add modal (fullscreen) */}
      {bulkModalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-0 bg-black/40">
          <div
            className="absolute inset-0"
            onClick={() => {
              setBulkModalOpen(false);
              setBulkText("");
            }}
          />
          <div className="relative bg-white dark:bg-[#0b0b0d] rounded-none p-6 w-full h-full overflow-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold mb-0 text-black dark:text-white">
                Bulk Add Options (full screen)
              </h3>
              <div>
                <button
                  className="px-3 py-1 rounded bg-gray-100 mr-2"
                  onClick={() => {
                    setBulkModalOpen(false);
                    setBulkText("");
                  }}
                >
                  Cancel
                </button>
                <button
                  className="px-3 py-1 rounded bg-green-600 text-white"
                  onClick={() => {
                    bulkAddFromText(bulkText);
                    setBulkModalOpen(false);
                    setBulkText("");
                  }}
                >
                  Add Options
                </button>
              </div>
            </div>

            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              Paste options one-per-line or comma-separated. CSV files imported
              earlier will also work.
            </p>

            <textarea
              rows={20}
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              className="w-full h-[calc(100%-180px)] p-3 border rounded bg-white dark:bg-[#111] dark:text-white"
              placeholder={`Option 1\nOption 2\nOption 3\n...`}
            />

            <div className="mt-4 text-xs text-gray-500">
              Tip: You can paste long lists (100+ options) — duplicates will be
              ignored.
            </div>
          </div>
        </div>
      )}

      {/* Edit All modal (fullscreen) */}
      {editAllModalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-0 bg-black/40">
          <div
            className="absolute inset-0"
            onClick={() => setEditAllModalOpen(false)}
          />
          <div className="relative bg-white dark:bg-[#0b0b0d] rounded-none p-6 w-full h-full overflow-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold mb-0 text-black dark:text-white">
                Edit All Options (full screen)
              </h3>
              <div>
                <button
                  className="px-3 py-1 rounded bg-gray-100 mr-2"
                  onClick={() => setEditAllModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  className="px-3 py-1 rounded bg-blue-600 text-white"
                  onClick={saveEditAll}
                >
                  Save
                </button>
              </div>
            </div>

            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              Each line is an option. Special options (Other/None) are preserved
              at the end.
            </p>

            <textarea
              rows={30}
              value={editAllText}
              onChange={(e) => setEditAllText(e.target.value)}
              className="w-full h-[calc(100%-180px)] p-3 border rounded bg-white dark:bg-[#111] dark:text-white"
            />
          </div>
        </div>
      )}
    </>
  );
}
