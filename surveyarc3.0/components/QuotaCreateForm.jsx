// components/quota/QuotaCreateForm.jsx
"use client";

import React, { useState } from "react";
import quotaModel from "@/models/postGresModels/quotaModel";

export default function QuotaCreateForm({
  surveyId,
  orgId,
  questionId = null,
  questionOptions = [], // [{ id, label }]
  onCreated,
}) {
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

  const addCell = () => setCells((prev) => [...prev, { label: "", cap: 0, condition: {}, is_enabled: true, targetOptionId: null }]);
  const removeCell = (i) => setCells((prev) => prev.filter((_, idx) => idx !== i));

  const parseCondition = (cond) => {
    if (cond == null) return {};
    if (typeof cond === "object") return cond;
    if (typeof cond === "string") {
      const t = cond.trim();
      if (t === "") return {};
      try { return JSON.parse(t); } catch (e) { throw new Error("Invalid JSON for condition: " + e.message); }
    }
    return {};
  };

  const createQuota = async () => {
    setError("");
    if (!name.trim()) { setError("Quota name required"); return; }
    if (!cells.length) { setError("Add at least one cell"); return; }

    try {
      const normalizedCells = cells.map((c, i) => {
        if (!c.label || !String(c.label).trim()) throw new Error(`Cell ${i + 1}: label is required`);
        const cap = Number.isFinite(Number(c.cap)) ? Math.floor(Number(c.cap)) : 0;
        if (cap < 0) throw new Error(`Cell ${i + 1}: cap must be >= 0`);
        const parsed = parseCondition(c.condition);
        return {
          label: String(c.label).trim(),
          cap,
          condition: parsed,
          is_enabled: Boolean(c.is_enabled),
          target_option_id: c.targetOptionId ?? null, // backend expects snake_case
        };
      });

      const payload = {
        orgId,
        surveyId,
        questionId,
        name: name.trim(),
        description: description?.trim() || "",
        isEnabled,
        quotaType, // 'hard' or 'soft'
        stopCondition,
        whenMet,
        actionPayload: {},
        metadata: {},
        cells: normalizedCells,
      };

      setSaving(true);
      console.log("Creating quota with payload:", payload);
      const res = await quotaModel.create(payload);
      if (onCreated) onCreated(res);
    } catch (e) {
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

          <div>
            <label className="font-semibold">Quota Name *</label>
            <input className="border p-2 rounded w-full" value={name} onChange={(e) => setName(e.target.value)} placeholder="E.g. Female 18-24 quota" />
          </div>

          <div>
            <label className="font-semibold">Quota Type</label>
            <div className="flex gap-3 items-center mt-2">
              <label className="flex items-center gap-2">
                <input type="radio" name="quotaType" value="hard" checked={quotaType === "hard"} onChange={() => setQuotaType("hard")} />
                <span className="text-sm">Hard — block respondents when cap hit</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" name="quotaType" value="soft" checked={quotaType === "soft"} onChange={() => setQuotaType("soft")} />
                <span className="text-sm">Soft — warn/admin action but allow responses</span>
              </label>
            </div>
          </div>

          <div>
            <label>Description</label>
            <textarea className="border p-2 rounded w-full" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional description…" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="font-semibold">Stop Condition</label>
              <select className="border p-2 rounded w-full" value={stopCondition} onChange={(e) => setStopCondition(e.target.value)}>
                <option value="greater">Greater</option>
                <option value="equal">Equal</option>
                <option value="less">Less</option>
                <option value="greater_or_equal">Greater or Equal</option>
              </select>
            </div>

            <div>
              <label className="font-semibold">When Met</label>
              <select className="border p-2 rounded w-full" value={whenMet} onChange={(e) => setWhenMet(e.target.value)}>
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
              <div key={index} className="p-3 border rounded mb-4">
                <div className="flex items-center justify-between">
                  <div className="font-medium">Cell #{index + 1}</div>
                  <button onClick={() => removeCell(index)} type="button" className="text-sm text-red-600">Remove</button>
                </div>

                <div className="mt-2">
                  <label className="text-sm">Label *</label>
                  <input className="border p-2 rounded w-full mt-1" value={cell.label} onChange={(e) => handleCellChange(index, "label", e.target.value)} placeholder="E.g. Female 18-24" />
                </div>

                <div className="mt-2 grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm">Cap *</label>
                    <input type="number" min="0" className="border p-2 rounded w-full mt-1" value={cell.cap} onChange={(e) => handleCellChange(index, "cap", e.target.value)} />
                  </div>

                  <div>
                    <label className="text-sm">Target Option (optional)</label>
                    <select className="border p-2 rounded w-full mt-1" value={cell.targetOptionId ?? ""} onChange={(e) => handleCellChange(index, "targetOptionId", e.target.value || null)}>
                      <option value="">— Global / Not option-specific —</option>
                      {questionOptions.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                    </select>
                    <div className="text-xs text-gray-500 mt-1">If selected, this cell counts only respondents who chose that option.</div>
                  </div>
                </div>

                <div className="mt-2">
                  <label className="text-sm">Condition (JSON) — optional</label>
                  <textarea className="border p-2 rounded w-full font-mono text-sm mt-1" rows={4}
                    placeholder='{"gender":"female"}'
                    value={typeof cell.condition === "string" ? cell.condition : JSON.stringify(cell.condition || {}, null, 2)}
                    onChange={(e) => handleCellChange(index, "condition", e.target.value)}
                  />
                </div>

                <label className="flex items-center gap-2 mt-3">
                  <input type="checkbox" checked={cell.is_enabled} onChange={(e) => handleCellChange(index, "is_enabled", e.target.checked)} />
                  Enabled
                </label>
              </div>
            ))}

            <button onClick={addCell} type="button" className="bg-gray-200 px-3 py-2 rounded mt-2">+ Add Cell</button>
          </div>
          
        </div>
      </div>

      {/* footer */}
      <div className="px-6 py-4 border-t bg-white dark:bg-[#07101a]">
        <div className="flex justify-between items-center max-w-[1100px] mx-auto">
          <div className="text-sm text-gray-500">{questionId ? `Attaching to question: ${questionId}` : "Quota (not tied to question)"}</div>
          <div>
            <button onClick={createQuota} disabled={saving} className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-60">
              {saving ? "Saving…" : "Save Quota"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
