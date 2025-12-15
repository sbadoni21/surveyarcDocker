"use client";

import { useState, useEffect } from "react";
import {
  Trash2,
  Plus,
  GripVertical,
  AlertCircle,
  Settings2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

export default function AutoSumConfig({ config = {}, updateConfig }) {
  /* --------------------------------------------------
     INITIALIZE DEFAULT CONFIG (CRITICAL – DO NOT REMOVE)
     Matches YesNoConfig / OSAT pattern exactly
  -------------------------------------------------- */
  useEffect(() => {
    if (!("items" in config)) updateConfig("items", ["Item 1", "Item 2"]);
    if (!("total" in config)) updateConfig("total", 100);
    if (!("showRemaining" in config)) updateConfig("showRemaining", true);
    if (!("allowDecimals" in config)) updateConfig("allowDecimals", false);
    if (!("minValue" in config)) updateConfig("minValue", 0);
    if (!("maxValue" in config)) updateConfig("maxValue", null);
    if (!("requireTotal" in config)) updateConfig("requireTotal", true);
    if (!("allowNegative" in config)) updateConfig("allowNegative", false);
    if (!("decimalPlaces" in config)) updateConfig("decimalPlaces", 2);
    if (!("itemDescriptions" in config)) updateConfig("itemDescriptions", {});
    if (!("showPercentages" in config)) updateConfig("showPercentages", false);
    if (!("enableReordering" in config))
      updateConfig("enableReordering", true);
  }, []);

  /* --------------------------------------------------
     STATE
  -------------------------------------------------- */
  const [expandedSections, setExpandedSections] = useState({
    items: true,
    allocation: true,
    validation: true,
    advanced: false,
  });

  const [draggedIndex, setDraggedIndex] = useState(null);
  const [errors, setErrors] = useState({});

  /* --------------------------------------------------
     DERIVED CONFIG VALUES
  -------------------------------------------------- */
  const items = Array.isArray(config.items)
    ? config.items
    : ["Item 1", "Item 2"];

  const total = config.total ?? 100;
  const showRemaining = config.showRemaining ?? true;
  const allowDecimals = config.allowDecimals ?? false;
  const minValue = config.minValue ?? 0;
  const maxValue = config.maxValue ?? null;
  const requireTotal = config.requireTotal ?? true;
  const allowNegative = config.allowNegative ?? false;
  const decimalPlaces = config.decimalPlaces ?? 2;
  const showPercentages = config.showPercentages ?? false;
  const enableReordering = config.enableReordering ?? true;
  const itemDescriptions = config.itemDescriptions ?? {};

  /* --------------------------------------------------
     HELPERS
  -------------------------------------------------- */
  const toggleSection = (section) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const updateItems = (next) => updateConfig("items", next);

  const validateItemName = (name, index) => {
    const nextErrors = { ...errors };

    if (!name.trim()) {
      nextErrors[`item_${index}`] = "Item name is required";
    } else if (
      items.some((item, i) => i !== index && item === name)
    ) {
      nextErrors[`item_${index}`] = "Duplicate item name";
    } else {
      delete nextErrors[`item_${index}`];
    }

    setErrors(nextErrors);
  };

  const handleItemChange = (i, val) => {
    const next = [...items];
    next[i] = val;
    updateItems(next);
    validateItemName(val, i);
  };

  const handleDescriptionChange = (i, val) => {
    updateConfig("itemDescriptions", {
      ...itemDescriptions,
      [items[i]]: val,
    });
  };

  const addItem = () =>
    updateItems([...items, `Item ${items.length + 1}`]);

  const removeItem = (i) => {
    if (items.length <= 2) {
      setErrors({ general: "Minimum 2 items required" });
      return;
    }
    updateItems(items.filter((_, idx) => idx !== i));
  };

  const duplicateItem = (i) => {
    const next = [...items];
    next.splice(i + 1, 0, `${items[i]} (Copy)`);
    updateItems(next);
  };

  const handleDragStart = (i) => setDraggedIndex(i);

  const handleDragOver = (e, i) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === i) return;

    const next = [...items];
    const dragged = next[draggedIndex];
    next.splice(draggedIndex, 1);
    next.splice(i, 0, dragged);

    setDraggedIndex(i);
    updateItems(next);
  };

  const handleDragEnd = () => setDraggedIndex(null);

  const validateTotal = (value) => {
    const num = Number(value);
    if (Number.isNaN(num) || num <= 0) {
      setErrors({ ...errors, total: "Total must be a positive number" });
    } else {
      const next = { ...errors };
      delete next.total;
      setErrors(next);
    }
  };

  const SectionHeader = ({ title, section, icon: Icon }) => (
    <button
      type="button"
      onClick={() => toggleSection(section)}
      className="w-full flex items-center justify-between p-3 bg-gray-50 border rounded-lg"
    >
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-gray-600" />
        <span className="text-sm font-semibold">{title}</span>
      </div>
      {expandedSections[section] ? (
        <ChevronUp className="w-4 h-4" />
      ) : (
        <ChevronDown className="w-4 h-4" />
      )}
    </button>
  );

  /* --------------------------------------------------
     RENDER
  -------------------------------------------------- */
  return (
    <div className="space-y-4 p-6 bg-white rounded-xl shadow-sm">

      {errors.general && (
        <div className="flex gap-2 p-3 bg-red-50 border border-red-200 rounded">
          <AlertCircle className="w-4 h-4 text-red-600" />
          <span className="text-sm text-red-700">{errors.general}</span>
        </div>
      )}

      {/* ITEMS */}
      <SectionHeader title="Survey Items" section="items" icon={Settings2} />
      {expandedSections.items && (
        <div className="space-y-3 p-4 bg-gray-50 rounded border">
          {items.map((item, i) => (
            <div
              key={i}
              draggable={enableReordering}
              onDragStart={() => handleDragStart(i)}
              onDragOver={(e) => handleDragOver(e, i)}
              onDragEnd={handleDragEnd}
              className="bg-white border rounded p-3"
            >
              <div className="flex gap-2 items-start">
                {enableReordering && (
                  <GripVertical className="w-4 h-4 mt-2 text-gray-400" />
                )}
                <div className="flex-1 space-y-2">
                  <input
                    className="w-full px-3 py-2 border rounded"
                    value={item}
                    onChange={(e) =>
                      handleItemChange(i, e.target.value)
                    }
                  />
                  <input
                    className="w-full px-3 py-2 text-sm border rounded"
                    value={itemDescriptions[item] || ""}
                    onChange={(e) =>
                      handleDescriptionChange(i, e.target.value)
                    }
                    placeholder="Optional description"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <button
                    onClick={() => duplicateItem(i)}
                    className="text-xs text-blue-600"
                  >
                    Copy
                  </button>
                  <button
                    onClick={() => removeItem(i)}
                    className="text-xs text-red-600"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          ))}
          <button
            onClick={addItem}
            className="flex items-center gap-2 text-sm text-blue-600"
          >
            <Plus className="w-4 h-4" /> Add Item
          </button>
        </div>
      )}

      {/* ALLOCATION */}
      <SectionHeader
        title="Allocation Rules"
        section="allocation"
        icon={Settings2}
      />
      {expandedSections.allocation && (
        <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded border">
          <input
            type="number"
            value={total}
            onChange={(e) => {
              updateConfig("total", Number(e.target.value));
              validateTotal(e.target.value);
            }}
            className="px-3 py-2 border rounded"
          />

          <select
            value={decimalPlaces}
            onChange={(e) =>
              updateConfig("decimalPlaces", Number(e.target.value))
            }
            className="px-3 py-2 border rounded"
          >
            <option value={0}>No decimals</option>
            <option value={1}>1 decimal</option>
            <option value={2}>2 decimals</option>
            <option value={3}>3 decimals</option>
          </select>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={showRemaining}
              onChange={(e) =>
                updateConfig("showRemaining", e.target.checked)
              }
            />
            Show remaining total
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={allowDecimals}
              onChange={(e) =>
                updateConfig("allowDecimals", e.target.checked)
              }
            />
            Allow decimals
          </label>
        </div>
      )}

      {/* VALIDATION */}
      <SectionHeader
        title="Validation & Constraints"
        section="validation"
        icon={AlertCircle}
      />
      {expandedSections.validation && (
        <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded border">
          <input
            type="number"
            value={minValue}
            onChange={(e) =>
              updateConfig("minValue", Number(e.target.value))
            }
            placeholder="Min per item"
            className="px-3 py-2 border rounded"
          />
          <input
            type="number"
            value={maxValue ?? ""}
            onChange={(e) =>
              updateConfig(
                "maxValue",
                e.target.value ? Number(e.target.value) : null
              )
            }
            placeholder="Max per item"
            className="px-3 py-2 border rounded"
          />

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={requireTotal}
              onChange={(e) =>
                updateConfig("requireTotal", e.target.checked)
              }
            />
            Require exact total
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={allowNegative}
              onChange={(e) =>
                updateConfig("allowNegative", e.target.checked)
              }
            />
            Allow negative values
          </label>
        </div>
      )}

      {/* ADVANCED */}
      <SectionHeader
        title="Advanced Options"
        section="advanced"
        icon={Settings2}
      />
      {expandedSections.advanced && (
        <div className="p-4 bg-gray-50 rounded border">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={enableReordering}
              onChange={(e) =>
                updateConfig("enableReordering", e.target.checked)
              }
            />
            Enable item reordering
          </label>
        </div>
      )}
    </div>
  );
}
