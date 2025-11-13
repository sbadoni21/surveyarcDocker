"use client";
import React, { useState, useCallback, useEffect } from "react";
import { useTheme } from "@/providers/postGresPorviders/themeProvider";
import firebaseStorageService from "@/services/firebaseStorage";

/* ---------- Helper ---------- */
const ColorPickerRow = ({ label, value, onChange }) => (
  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
    <span className="text-sm font-medium text-gray-700 min-w-[90px]">{label}</span>
    <div className="flex items-center gap-3 ml-auto">
      <input 
        type="color" 
        value={value} 
        onChange={(e) => onChange(e.target.value)}
        className="w-12 h-10 rounded border border-gray-300 cursor-pointer"
      />
      <input
        className="w-28 border border-gray-300 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="#000000"
      />
    </div>
  </div>
);

/* ---------- Logo Uploader with Firebase Storage Service ---------- */
const LogoUploader = ({ value, onChange, orgId = "default", themeId = "new" }) => {
  const [preview, setPreview] = useState(value || "");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState("");

  useEffect(() => {
    setPreview(value || "");
  }, [value]);

  const handlePick = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = firebaseStorageService.validateFile(file);
    if (!validation.isValid) {
      setUploadError(validation.errors.join(", "));
      return;
    }

    if (!firebaseStorageService.allowedTypes.images.includes(file.type)) {
      setUploadError("Please select an image file");
      return;
    }

    setUploadError("");
    setUploading(true);
    setUploadProgress(0);

    try {
      const result = await firebaseStorageService.uploadFile(
        file,
        orgId,
        `theme-${themeId}`,
        "theme-editor",
        {
          onProgress: (progress) => {
            setUploadProgress(Math.round(progress));
          }
        }
      );

      setPreview(result.downloadURL);
      onChange(result.downloadURL, result.storageKey);
      setUploadProgress(100);
    } catch (error) {
      console.error("Upload failed:", error);
      setUploadError(error.message || "Failed to upload image. Please try again.");
    } finally {
      setTimeout(() => {
        setUploading(false);
        setUploadProgress(0);
      }, 500);
    }
  };

  const handleRemove = async () => {
    if (!value) return;
    setPreview("");
    onChange("", "");
  };

  return (
    <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
      {preview ? (
        <div className="relative group flex-shrink-0">
          <img 
            src={preview} 
            alt="logo" 
            className="h-24 w-24 border-2 border-gray-200 rounded-lg object-contain bg-white shadow-sm"
          />
          <button
            onClick={handleRemove}
            disabled={uploading}
            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600 disabled:opacity-50 shadow-lg transition-all opacity-0 group-hover:opacity-100"
            title="Remove logo"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ) : (
        <div className="h-24 w-24 border-2 border-dashed border-gray-300 rounded-lg bg-white flex items-center justify-center flex-shrink-0">
          <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
      )}
      
      <div className="flex flex-col gap-2 flex-1">
        <label className="cursor-pointer inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          {uploading ? `Uploading ${uploadProgress}%` : "Upload Logo"}
          <input
            type="file"
            accept="image/*"
            onChange={handlePick}
            disabled={uploading}
            className="hidden"
          />
        </label>
        
        {uploading && (
          <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
            <div 
              className="bg-blue-600 h-full transition-all duration-300 ease-out"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        )}
        
        {uploadError ? (
          <span className="text-xs text-red-600 font-medium">{uploadError}</span>
        ) : (
          <span className="text-xs text-gray-500">
            PNG, JPG, GIF, WebP, SVG • Max 100MB
          </span>
        )}
      </div>
    </div>
  );
};

/* ---------- EDITOR ---------- */
export default function ThemeEditor({ initialTheme }) {
  const { currentId, create, update, getById } = useTheme();

  const defaultTheme = {
    name: "",
    logoUrl: "",
    logoStorageKey: "",
    createdAt: "",
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
  };

  const [draft, setDraft] = useState(initialTheme ?? defaultTheme);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const loadTheme = async () => {
      if (!currentId) {
        setDraft(defaultTheme);
        return;
      }

      setIsLoading(true);
      try {
        const themeData = await getById(currentId);
        if (themeData) {
          setDraft(themeData);
        }
      } catch (error) {
        console.error("Failed to load theme:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadTheme();
  }, [currentId]);

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

  const handleLogoChange = useCallback((url, storageKey) => {
    setDraft((prev) => ({
      ...prev,
      logoUrl: url,
      logoStorageKey: storageKey || ""
    }));
  }, []);

  const handleSave = async () => {
    if (!draft.name.trim()) {
      alert("Please enter a theme name");
      return;
    }

    const payloadCreated = { createdAt: Date.now(), ...draft };
    const payloadUpdated = { updatedAt: Date.now(), ...draft };

    try {
      if (draft.themeId) {
        await update(draft.themeId, payloadUpdated);
      } else {
        await create(payloadCreated);
      }
      alert("Theme saved ✅");
    } catch (error) {
      console.error("Save failed:", error);
      alert("Failed to save theme ❌");
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8">
        <div className="flex items-center justify-center gap-3 text-gray-600">
          <div className="w-5 h-5 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
          <span className="font-medium">Loading theme...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
      {/* HEADER */}
      <div className="flex items-center justify-between px-6 py-5 border-b border-gray-200">
        <div>
          <h3 className="font-semibold text-xl text-gray-900">Theme Editor</h3>
          {draft.themeId && (
            <p className="text-sm text-gray-500 mt-0.5">Editing: {draft.name}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="isActive"
            checked={draft.isActive}
            onChange={(e) => setField("isActive", e.target.checked)}
            className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500 cursor-pointer"
          />
          <label htmlFor="isActive" className="text-sm font-medium text-gray-700 cursor-pointer select-none">
            Active
          </label>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* NAME & LOGO */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <label className="text-sm font-semibold text-gray-900 block mb-2">Theme Name / Company Name *</label>
            <input
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={draft.name}
              onChange={(e) => setField("name", e.target.value)}
              placeholder="Enter theme name"
            />
          </div>
        </div>

        {/* LOGO */}
        <div>
          <label className="text-sm font-semibold text-gray-900 block mb-2">Logo</label>
          <LogoUploader
            value={draft.logoUrl}
            onChange={handleLogoChange}
            orgId="default"
            themeId={draft.themeId || "new"}
          />
        </div>

        {/* COLOR SECTION */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* LIGHT MODE */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-3">
              <svg className="w-5 h-5 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              <h4 className="font-semibold text-base text-gray-900">Light Mode</h4>
            </div>
            <div className="space-y-2">
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

          {/* DARK MODE */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-3">
              <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
              <h4 className="font-semibold text-base text-gray-900">Dark Mode</h4>
            </div>
            <div className="space-y-2">
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
        </div>

        {/* META */}
        <div>
          <label className="text-sm font-semibold text-gray-900 block mb-2">Metadata (JSON)</label>
          <textarea
            rows={4}
            className="w-full border border-gray-300 rounded-lg px-4 py-3 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50"
            value={JSON.stringify(draft.meta, null, 2)}
            onChange={(e) => {
              try {
                const parsed = JSON.parse(e.target.value);
                setField("meta", parsed);
              } catch {
                /* ignore invalid JSON */
              }
            }}
            placeholder='{"key": "value"}'
          />
        </div>
      </div>

      {/* FOOTER */}
      <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 rounded-b-xl flex items-center justify-end gap-3">
        <button
          onClick={handleSave}
          className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-sm hover:shadow flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          {draft.themeId ? "Update Theme" : "Create Theme"}
        </button>
      </div>
    </div>
  );
}