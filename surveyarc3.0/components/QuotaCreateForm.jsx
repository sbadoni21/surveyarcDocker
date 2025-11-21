"use client";

import React, { useState } from "react";

export default function QuotaCreateForm({ surveyId, orgId, onCreated }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isEnabled, setIsEnabled] = useState(true);
  const [stopCondition, setStopCondition] = useState("greater");
  const [whenMet, setWhenMet] = useState("close_survey");
  const [cells, setCells] = useState([
    {
      label: "",
      cap: 0,
      condition: {},
      is_enabled: true
    }
  ]);

  const handleCellChange = (index, field, value) => {
    const updated = [...cells];
    updated[index][field] = value;
    setCells(updated);
  };

  const addCell = () => {
    setCells([
      ...cells,
      { label: "", cap: 0, condition: {}, is_enabled: true }
    ]);
  };

  const createQuota = async () => {
    const payload = {
      org_id: orgId,
      survey_id: surveyId,
      name,
      description,
      is_enabled: isEnabled,
      stop_condition: stopCondition,
      when_met: whenMet,
      action_payload: {},
      metadata: {},
      cells
    };

    await quotaApi.create(payload);
    if (onCreated) onCreated();
  };

  return (
    <div className="p-4 space-y-6 border rounded-md bg-white">

      {/* QUOTA BASIC FIELDS */}
      <div>
        <label className="font-semibold">Quota Name *</label>
        <input
          className="border p-2 rounded w-full"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Age 18-24 group"
        />
      </div>

      <div>
        <label>Description</label>
        <textarea
          className="border p-2 rounded w-full"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional description…"
        />
      </div>

      {/* STOP CONDITION */}
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

      {/* WHEN QUOTA IS REACHED */}
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

      {/* QUOTA CELLS */}
      <div>
        <h3 className="font-bold text-lg">Quota Cells</h3>

        {cells.map((cell, index) => (
          <div key={index} className="p-3 border rounded mb-4">
            <label>Label *</label>
            <input
              className="border p-2 rounded w-full"
              value={cell.label}
              onChange={(e) =>
                handleCellChange(index, "label", e.target.value)
              }
            />

            <label>Cap *</label>
            <input
              type="number"
              className="border p-2 rounded w-full"
              value={cell.cap}
              onChange={(e) =>
                handleCellChange(index, "cap", parseInt(e.target.value))
              }
            />

            <label className="mt-2">Condition (JSON)</label>
            <input
              className="border p-2 rounded w-full"
              placeholder='{"gender": "female"}'
              value={JSON.stringify(cell.condition)}
              onChange={(e) =>
                handleCellChange(index, "condition", JSON.parse(e.target.value))
              }
            />

            <label className="flex items-center gap-2 mt-2">
              <input
                type="checkbox"
                checked={cell.is_enabled}
                onChange={(e) =>
                  handleCellChange(index, "is_enabled", e.target.checked)
                }
              />
              Enabled
            </label>
          </div>
        ))}

        <button
          onClick={addCell}
          className="bg-gray-200 px-3 py-2 rounded mt-2"
        >
          + Add Cell
        </button>
      </div>

      <button
        onClick={createQuota}
        className="bg-blue-600 text-white px-4 py-2 rounded"
      >
        Save Quota
      </button>
    </div>
  );
}
