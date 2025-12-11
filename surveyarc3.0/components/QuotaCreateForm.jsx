// components/quota/QuotaCreateForm.jsx
"use client";

import React, { useEffect, useState } from "react";
import quotaModel from "@/models/postGresModels/quotaModel";

export default function QuotaCreateForm({
  surveyId,
  orgId,
  questionId = null,
  questionOptions = [],   // [{ id, label }]
  initial = null,         // when editing, we pass the existing quota here
  onCreated,
  onCancel,
}) {
  const isEdit = !!initial?.id;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isEnabled, setIsEnabled] = useState(true);
  const [quotaType, setQuotaType] = useState("hard"); // 'hard' or 'soft'
  const [stopCondition, setStopCondition] = useState("greater");
  const [whenMet, setWhenMet] = useState("close_survey");
  const [cells, setCells] = useState([
    { label: "", cap: 0, condition: {}, is_enabled: true, targetOptionId: null },
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Hydrate form when `initial` changes (edit mode)
  useEffect(() => {
    if (!initial) return;

    setName(initial.name || "");
    setDescription(initial.description || "");
    setIsEnabled(
      initial.isEnabled ??
      initial.is_enabled ??
      true
    );
    setQuotaType(initial.quotaType ?? initial.quota_type ?? "hard");
    setStopCondition(initial.stopCondition ?? initial.stop_condition ?? "greater");
    setWhenMet(initial.whenMet ?? initial.when_met ?? "close_survey");

    const mappedCells = (initial.cells || []).map((c) => ({
      label: c.label || "",
      cap: c.cap ?? 0,
      condition: c.condition || {},
      is_enabled: c.isEnabled ?? c.is_enabled ?? true,
      targetOptionId: c.targetOptionId ?? c.target_option_id ?? null,
    }));

    setCells(
      mappedCells.length
        ? mappedCells
        : [{ label: "", cap: 0, condition: {}, is_enabled: true, targetOptionId: null }]
    );
  }, [initial]);

  const handleCellChange = (index, field, value) => {
    setCells((prev) => {
      const next = [...prev];
      if (field === "cap") {
        const n = Number(value);
        next[index][field] = Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
      } else {
        next[index][field] = value;
      }
      return next;
    });
  };

  const addCell = () =>
    setCells((prev) => [
      ...prev,
      { label: "", cap: 0, condition: {}, is_enabled: true, targetOptionId: null },
    ]);

  const removeCell = (i) =>
    setCells((prev) => prev.filter((_, idx) => idx !== i));

  const parseCondition = (cond) => {
    if (cond == null) return {};
    if (typeof cond === "object") return cond;
    if (typeof cond === "string") {
      const t = cond.trim();
      if (t === "") return {};
      try {
        return JSON.parse(t);
      } catch (e) {
        throw new Error("Invalid JSON for condition: " + e.message);
      }
    }
    return {};
  };

  const saveQuota = async () => {
    setError("");

    if (!name.trim()) {
      setError("Quota name required");
      return;
    }

    if (!cells.length) {
      setError("Add at least one cell");
      return;
    }

    try {
      const normalizedCells = cells.map((c, i) => {
        if (!c.label || !String(c.label).trim()) {
          throw new Error(`Cell ${i + 1}: label is required`);
        }
        const capNum = Number(c.cap);
        const cap = Number.isFinite(capNum) ? Math.floor(capNum) : 0;
        if (cap < 0) {
          throw new Error(`Cell ${i + 1}: cap must be >= 0`);
        }
        const parsedCondition = parseCondition(c.condition);

        return {
          label: String(c.label).trim(),
          cap,
          condition: parsedCondition,
          is_enabled: Boolean(c.is_enabled),
          target_option_id: c.targetOptionId ?? null,
        };
      });

      const payload = {
        orgId,
        surveyId,
        questionId,
        name: name.trim(),
        description: description?.trim() || "",
        isEnabled,
        quotaType,
        stopCondition,
        whenMet,
        actionPayload: initial?.actionPayload || {},
        metadata: initial?.metadata || {},
        cells: normalizedCells,
      };

      setSaving(true);

      let res;
      if (isEdit) {
        console.log("Updating quota", initial.id, "payload:", payload);
        res = await quotaModel.update(initial.id, payload);
      } else {
        console.log("Creating quota with payload:", payload);
        res = await quotaModel.create(payload);
      }

      if (onCreated) onCreated(res);
    } catch (e) {
      console.error("saveQuota error", e);
      setError(e?.message || String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full min-h-[480px]">
      <div className="flex-1 overflow-auto p-6">
        <div className="space-y-6 max-w-[1100px] mx-auto">
          {error && <div className="text-sm text-red-600">{error}</div>}

          {/* Quota Name */}
          <div>
            <label className="font-semibold">Quota Name *</label>
            <input
              className="border p-2 rounded w-full"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="E.g. Female 18-24 quota"
            />
          </div>

          {/* Quota Enabled */}
          <div className="flex items-center gap-2">
            <label className="font-semibold">Quota Enabled</label>
            <input
              type="checkbox"
              checked={isEnabled}
              onChange={(e) => setIsEnabled(e.target.checked)}
            />
          </div>

          {/* Quota Type */}
          <div>
            <label className="font-semibold">Quota Type</label>
            <div className="flex gap-3 items-center mt-2">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="quotaType"
                  value="hard"
                  checked={quotaType === "hard"}
                  onChange={() => setQuotaType("hard")}
                />
                <span className="text-sm">
                  Hard — block respondents when cap hit
                </span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="quotaType"
                  value="soft"
                  checked={quotaType === "soft"}
                  onChange={() => setQuotaType("soft")}
                />
                <span className="text-sm">
                  Soft — warn/admin action but allow responses
                </span>
              </label>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="font-semibold">Description</label>
            <textarea
              className="border p-2 rounded w-full"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description…"
            />
          </div>

          {/* Stop condition + When met */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="font-semibold">Stop Condition</label>
              <select
                className="border p-2 rounded w-full"
                value={stopCondition}
                onChange={(e) => setStopCondition(e.target.value)}
              >
                <option value="greater">Greater</option>
                <option value="equal">Equal</option>
                <option value="less">Less</option>
                <option value="greater_or_equal">Greater or Equal</option>
              </select>
            </div>

            <div>
              <label className="font-semibold">When Met</label>
              <select
                className="border p-2 rounded w-full"
                value={whenMet}
                onChange={(e) => setWhenMet(e.target.value)}
              >
                <option value="close_survey">Close Survey</option>
                <option value="show_message">Show Message</option>
                <option value="redirect">Redirect</option>
              </select>
            </div>
          </div>

          {/* Cells */}
          <div>
            <h3 className="font-bold text-lg">Quota Cells</h3>

            {cells.map((cell, index) => (
              <div
                key={index}
                className="p-3 border rounded mb-4 bg-white dark:bg-[#07101a]"
              >
                <div className="flex items-center justify-between">
                  <div className="font-medium">Cell #{index + 1}</div>
                  <button
                    onClick={() => removeCell(index)}
                    type="button"
                    className="text-sm text-red-600"
                  >
                    Remove
                  </button>
                </div>

                {/* Label */}
                <div className="mt-2">
                  <label className="text-sm">Label *</label>
                  <input
                    className="border p-2 rounded w-full mt-1"
                    value={cell.label}
                    onChange={(e) =>
                      handleCellChange(index, "label", e.target.value)
                    }
                    placeholder="E.g. Female 18-24"
                  />
                </div>

                {/* Cap + Target Option */}
                <div className="mt-2 grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm">Cap *</label>
                    <input
                      type="number"
                      min="0"
                      className="border p-2 rounded w-full mt-1"
                      value={cell.cap}
                      onChange={(e) =>
                        handleCellChange(index, "cap", e.target.value)
                      }
                    />
                  </div>

                  <div>
                    <label className="text-sm">Target Option (optional)</label>
                    <select
                      className="border p-2 rounded w-full mt-1"
                      value={cell.targetOptionId ?? ""}
                      onChange={(e) =>
                        handleCellChange(
                          index,
                          "targetOptionId",
                          e.target.value || null
                        )
                      }
                    >
                      <option value="">
                        — Global / Not option-specific —
                      </option>
                      {questionOptions.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                    <div className="text-xs text-gray-500 mt-1">
                      If selected, this cell counts only respondents who chose
                      that option.
                    </div>
                  </div>
                </div>

                {/* Condition */}
                <div className="mt-2">
                  <label className="text-sm">
                    Condition (JSON) — optional
                  </label>
                  <textarea
                    className="border p-2 rounded w-full font-mono text-sm mt-1"
                    rows={4}
                    placeholder='{"gender":"female"}'
                    value={
                      typeof cell.condition === "string"
                        ? cell.condition
                        : JSON.stringify(cell.condition || {}, null, 2)
                    }
                    onChange={(e) =>
                      handleCellChange(index, "condition", e.target.value)
                    }
                  />
                </div>

                {/* Enabled */}
                <label className="flex items-center gap-2 mt-3">
                  <input
                    type="checkbox"
                    checked={cell.is_enabled}
                    onChange={(e) =>
                      handleCellChange(
                        index,
                        "is_enabled",
                        e.target.checked
                      )
                    }
                  />
                  Enabled
                </label>
              </div>
            ))}

            <button
              onClick={addCell}
              type="button"
              className="bg-gray-200 px-3 py-2 rounded mt-2"
            >
              + Add Cell
            </button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-6 py-4 border-t bg-white dark:bg-[#07101a]">
        <div className="flex justify-between items-center max-w-[1100px] mx-auto">
          <div className="text-sm text-gray-500">
            {questionId
              ? `Attaching to question: ${questionId}`
              : "Quota (not tied to question)"}
          </div>
          <div className="flex gap-2">
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 rounded border text-sm"
              >
                Cancel
              </button>
            )}
            <button
              onClick={saveQuota}
              disabled={saving}
              className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-60"
            >
              {saving
                ? "Saving…"
                : isEdit
                ? "Update Quota"
                : "Save Quota"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
