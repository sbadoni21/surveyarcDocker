"use client";
import React, { useState, useCallback } from "react";
import { useTheme } from "@/providers/postGresPorviders/themeProvider";

/* ---------- Helper ---------- */
const ColorPickerRow = ({ label, value, onChange }) => (
  <div className="flex items-center justify-between gap-3 border rounded-lg p-2">
    <span className="text-sm">{label}</span>
    <div className="flex items-center gap-2">
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} />
      <input
        className="w-28 border rounded px-2 py-1 text-xs"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  </div>
);

/* ---------- Logo ---------- */
const LogoUploader = ({ value, onChange }) => {
  const [preview, setPreview] = useState(value || "");

  const handlePick = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file); // temporary
    setPreview(url);
    onChange(url); // later replace with firebase upload
  };

  return (
    <div className="flex flex-col items-center gap-3">
      {preview ? (
        <img src={preview} alt="logo" className="h-10 w-10 border rounded object-contain" />
      ) : (
        <div className="h-10 w-10 border rounded bg-gray-100" />
      )}
      <input type="file" accept="image/*" onChange={handlePick} value="" />
    </div>
  );
};

/* ---------- EDITOR ---------- */
export default function ThemeEditor({ initialTheme }) {
  const { create, update } = useTheme();
    console.log(Date.now())

  const [draft, setDraft] = useState(
    initialTheme ?? {
      name: "",
      logoUrl: "",
      createdAt:"",
      lightPrimaryColor: "#3b82f6",
      lightSecondaryColor: "#78716c",
      lightTextColor: "#000000",
      lightBackgroundColor: "#ffffff",
      darkPrimaryColor: "#3b82f6",
      darkSecondaryColor: "#78716c",
      darkTextColor: "#ffffff",
      darkBackgroundColor: "#000000",
      meta: {},
      isActive: true,
    }
  );

  /* ----- update helper ----- */
  const setField = useCallback((path, value) => {
    setDraft((prev) => {
      const keys = path.split(".");
      const next = { ...prev };
      let cursor = next;
      keys.forEach((k, i) => {
        if (i === keys.length - 1) cursor[k] = value;
        else cursor[k] = { ...cursor[k] };
        cursor = cursor[k];
      });
      return next;
    });
  }, []);

  /* ----- save logic ----- */
  const handleSave = async () => {
    const payloadCreated = { createdAt: Date.now(),...draft };
    
    const payloadUpdated = { updatedAt: Date.now(),...draft };

    if (draft.themeId) await update(draft.themeId, payloadUpdated);
    else await create(payloadCreated);

    alert("Theme saved ✅");
  };

  return (
    <div className="bg-white rounded-xl border shadow-sm p-6 space-y-6">

      <h3 className="font-semibold text-lg">Theme Editor</h3>

      {/* NAME */}
      <div>
        <label className="text-sm">Name</label>
        <input
          className="w-full border rounded px-3 py-2"
          value={draft.name}
          onChange={(e) => setField("name", e.target.value)}
        />
      </div>

      {/* LOGO */}
      <div>
        <label className="text-sm">Logo</label>
        <LogoUploader
          value={draft.logoUrl}
          onChange={(url) => setField("logoUrl", url)}
        />
      </div>

      {/* LIGHT COLORS */}
      <div>
        <h4 className="font-semibold text-sm">Light Mode Colors</h4>
        <div className="grid grid-cols-2 gap-4">
          <ColorPickerRow
            label="Primary"
            value={draft.lightPrimaryColor}
            onChange={(v) => setField("lightPrimaryColor", v)}
          />
          <ColorPickerRow
            label="Secondary"
            value={draft.lightSecondaryColor}
            onChange={(v) => setField("lightSecondaryColor", v)}
          />
          <ColorPickerRow
            label="Text"
            value={draft.lightTextColor}
            onChange={(v) => setField("lightTextColor", v)}
          />
          <ColorPickerRow
            label="Background"
            value={draft.lightBackgroundColor}
            onChange={(v) => setField("lightBackgroundColor", v)}
          />
        </div>
      </div>

      {/* DARK COLORS */}
      <div>
        <h4 className="font-semibold text-sm">Dark Mode Colors</h4>
        <div className="grid grid-cols-2 gap-4">
          <ColorPickerRow
            label="Primary"
            value={draft.darkPrimaryColor}
            onChange={(v) => setField("darkPrimaryColor", v)}
          />
          <ColorPickerRow
            label="Secondary"
            value={draft.darkSecondaryColor}
            onChange={(v) => setField("darkSecondaryColor", v)}
          />
          <ColorPickerRow
            label="Text"
            value={draft.darkTextColor}
            onChange={(v) => setField("darkTextColor", v)}
          />
          <ColorPickerRow
            label="Background"
            value={draft.darkBackgroundColor}
            onChange={(v) => setField("darkBackgroundColor", v)}
          />
        </div>
      </div>

      {/* META (optional) */}
      <div>
        <label className="text-sm">Meta (JSON)</label>
        <textarea
          rows={4}
          className="w-full border rounded px-3 py-2 font-mono text-xs"
          value={JSON.stringify(draft.meta, null, 2)}
          onChange={(e) => {
            try {
              const parsed = JSON.parse(e.target.value);
              setField("meta", parsed);
            } catch {
              /* ignore invalid JSON */
            }
          }}
        />
      </div>

      {/* STATUS */}
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={draft.isActive}
          onChange={(e) => setField("isActive", e.target.checked)}
        />
        <label className="text-sm">Active</label>
      </div>

      {/* SAVE */}
      <button
        onClick={handleSave}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
      >
        Save Theme
      </button>
    </div>
  );
}
