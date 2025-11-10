"use client";
import React, { useState, useEffect, useCallback } from "react";
import { useTheme } from "@/providers/postGresPorviders/themeProvider";

/* ====================== HELPER COMPONENTS ====================== */
const ColorPickerRow = ({ label, value, onChange }) => (
  <div className="flex items-center justify-between gap-3 border rounded-lg p-2">
    <span className="text-sm">{label}</span>
    <div className="flex items-center gap-2">
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} />
      <input className="w-28 border rounded px-2 py-1 text-xs" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  </div>
);

const LogoUploader = ({ value, onChange }) => {
  const [preview, setPreview] = useState(value || "");

  const handlePick = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreview(url);
    onChange(url);
  };

  const handleClear = () => {
    setPreview("");
    onChange("");
  };

  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview]);

  return (
    <div className="flex flex-col items-center gap-3">
      {preview ? <img src={preview} alt="Logo" className="h-8 w-8 rounded border object-contain" /> : <div className="h-8 w-8 rounded border bg-gray-50" />}
      <input type="file" accept="image/*" onChange={handlePick} value="" />
      <button type="button" className="px-2 py-1 text-sm border rounded" onClick={handleClear}>Clear</button>
    </div>
  );
};

/* ====================== THEME EDITOR ====================== */
export default function ThemeEditor({ initialTheme = null }) {
  const { create, update } = useTheme();
  const [draft, setDraft] = useState(initialTheme || {
    name: "",
    logo: { url: "" },
    palette: { primary: "#3b82f6", secondary: "#6b7280", background: "#fff", surface: "#f8f9fa", text: "#000", muted: "#6b7280" },
    typography: { headingFont: "", bodyFont: "", baseSize: 16 },
    controls: { radius: 12, shadow: "sm", buttonStyle: "solid", progressBar: "thin" },
    header: { showTitle: true, align: "left" },
    footer: { text: "" },
  });

  const setField = useCallback((path, value) => {
    setDraft((prev) => {
      const keys = path.split(".");
      const newDraft = { ...prev };
      let cur = newDraft;
      keys.forEach((k, i) => {
        if (i === keys.length - 1) cur[k] = value;
        else cur[k] = { ...cur[k] };
        cur = cur[k];
      });
      return newDraft;
    });
  }, []);

  const handleSave = async () => {
    if (draft.themeId) {
      await update(draft.themeId, draft);
      alert("Theme updated successfully");
    } else {
      await create(draft);
      alert("Theme created successfully");
    }
  };

  return (
    <div className="bg-white rounded-xl border shadow-sm p-6 space-y-6">
      <h3 className="font-semibold text-lg">Theme Editor</h3>

      {/* Basics */}
      <div className="space-y-3">
        <label className="block text-sm">Theme Name</label>
        <input className="w-full border rounded-lg px-3 py-2" value={draft.name} onChange={(e) => setField("name", e.target.value)} />

        <label className="block text-sm mt-2">Logo</label>
        <LogoUploader value={draft.logo.url} onChange={(url) => setField("logo.url", url)} />
      </div>

      {/* Palette */}
      <div className="space-y-3 mt-4">
        <h4 className="font-semibold text-sm">Palette</h4>
        <div className="grid grid-cols-2 gap-3">
          {Object.entries(draft.palette).map(([k, v]) => (
            <ColorPickerRow key={k} label={k} value={v} onChange={(val) => setField(`palette.${k}`, val)} />
          ))}
        </div>
      </div>

      {/* Typography */}
      <div className="space-y-3 mt-4">
        <h4 className="font-semibold text-sm">Typography</h4>
        <input placeholder="Heading Font" className="w-full border rounded px-3 py-2" value={draft.typography.headingFont} onChange={(e) => setField("typography.headingFont", e.target.value)} />
        <input placeholder="Body Font" className="w-full border rounded px-3 py-2" value={draft.typography.bodyFont} onChange={(e) => setField("typography.bodyFont", e.target.value)} />
        <input type="number" min={12} max={22} className="w-24 border rounded px-3 py-2" value={draft.typography.baseSize} onChange={(e) => setField("typography.baseSize", Number(e.target.value))} />
      </div>

      {/* Controls */}
      <div className="space-y-3 mt-4">
        <h4 className="font-semibold text-sm">Controls</h4>
        <input type="number" min={0} max={24} className="border rounded px-2 py-1" value={draft.controls.radius} onChange={(e) => setField("controls.radius", Number(e.target.value))} placeholder="Radius" />
        <select value={draft.controls.shadow} onChange={(e) => setField("controls.shadow", e.target.value)} className="border rounded px-2 py-1">
          <option value="none">None</option>
          <option value="sm">Small</option>
          <option value="md">Medium</option>
          <option value="lg">Large</option>
        </select>
        <select value={draft.controls.buttonStyle} onChange={(e) => setField("controls.buttonStyle", e.target.value)} className="border rounded px-2 py-1">
          <option value="solid">Solid</option>
          <option value="outline">Outline</option>
        </select>
        <select value={draft.controls.progressBar} onChange={(e) => setField("controls.progressBar", e.target.value)} className="border rounded px-2 py-1">
          <option value="thin">Thin</option>
          <option value="thick">Thick</option>
        </select>
      </div>

      {/* Header & Footer */}
      <div className="space-y-3 mt-4">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={draft.header.showTitle} onChange={(e) => setField("header.showTitle", e.target.checked)} />
          Show Title
        </label>
        <select value={draft.header.align} onChange={(e) => setField("header.align", e.target.value)} className="border rounded px-2 py-1">
          <option value="left">Left</option>
          <option value="center">Center</option>
        </select>

        <textarea rows={2} className="w-full border rounded px-3 py-2" placeholder="Footer text" value={draft.footer.text} onChange={(e) => setField("footer.text", e.target.value)} />
      </div>

      <button onClick={handleSave} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
        Save Theme
      </button>
    </div>
  );
}
