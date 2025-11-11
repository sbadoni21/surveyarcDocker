"use client";
import React, { useState, useCallback, useEffect } from "react";
import { useTheme } from "@/providers/postGresPorviders/themeProvider";
import firebaseStorageService from "@/services/firebaseStorage";

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

    // Validate using the service
    const validation = firebaseStorageService.validateFile(file);
    if (!validation.isValid) {
      setUploadError(validation.errors.join(", "));
      return;
    }

    // Check if it's an image
    if (!firebaseStorageService.allowedTypes.images.includes(file.type)) {
      setUploadError("Please select an image file");
      return;
    }

    setUploadError("");
    setUploading(true);
    setUploadProgress(0);

    try {
      // Upload with progress tracking
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

      // Update preview and call onChange with Firebase URL
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

    try {
      // The storageKey should be stored alongside the URL
      // For now, we'll skip deletion if we don't have the key
      if (value.includes("firebasestorage.googleapis.com")) {
        // Could implement deletion if storageKey is tracked
        console.log("Logo removed from theme, but file kept in storage for safety");
      }
    } catch (error) {
      console.error("Remove failed:", error);
    }

    setPreview("");
    onChange("", "");
  };

  return (
    <div className="flex flex-col items-center gap-3">
      {preview ? (
        <div className="relative group">
          <img 
            src={preview} 
            alt="logo" 
            className="h-20 w-20 border-2 rounded-lg object-contain bg-white shadow-sm"
          />
          <button
            onClick={handleRemove}
            disabled={uploading}
            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-7 h-7 flex items-center justify-center hover:bg-red-600 disabled:opacity-50 shadow-lg transition-all opacity-0 group-hover:opacity-100"
            title="Remove logo"
          >
            ×
          </button>
        </div>
      ) : (
        <div className="h-20 w-20 border-2 border-dashed rounded-lg bg-gray-50 flex items-center justify-center">
          <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
      )}
      
      <div className="flex flex-col items-center gap-2 w-full">
        <label className="cursor-pointer px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
          {uploading ? `Uploading ${uploadProgress}%` : "Choose Logo"}
          <input
            type="file"
            accept="image/*"
            onChange={handlePick}
            disabled={uploading}
            className="hidden"
          />
        </label>
        
        {uploading && (
          <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
            <div 
              className="bg-blue-600 h-full transition-all duration-300 ease-out"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        )}
        
        {uploadError && (
          <span className="text-xs text-red-500 text-center">{uploadError}</span>
        )}
        
        <span className="text-xs text-gray-500 text-center">
          Max 100MB • PNG, JPG, GIF, WebP, SVG
        </span>
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
    logoStorageKey: "", // Store the storage key for deletion
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

  /* ✅ Load theme when currentId changes */
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

  /* ----- handle logo change ----- */
  const handleLogoChange = useCallback((url, storageKey) => {
    setDraft((prev) => ({
      ...prev,
      logoUrl: url,
      logoStorageKey: storageKey || ""
    }));
  }, []);

  /* ----- save logic ----- */
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
      <div className="bg-white rounded-xl border shadow-sm p-6">
        <div className="flex items-center justify-center gap-2 text-gray-500">
          <div className="w-5 h-5 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
          <span>Loading theme...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border shadow-sm p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-lg">Theme Editor</h3>
        {draft.themeId && (
          <span className="text-xs text-gray-500">Editing: {draft.name}</span>
        )}
      </div>

      {/* NAME */}
      <div>
        <label className="text-sm font-medium block mb-1">Theme Name *</label>
        <input
          className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={draft.name}
          onChange={(e) => setField("name", e.target.value)}
          placeholder="Enter theme name"
        />
      </div>

      {/* LOGO */}
      <div>
        <label className="text-sm font-medium block mb-2">Logo</label>
        <LogoUploader
          value={draft.logoUrl}
          onChange={handleLogoChange}
          orgId="default"
          themeId={draft.themeId || "new"}
        />
      </div>

      {/* LIGHT COLORS */}
      <div>
        <h4 className="font-semibold text-sm mb-3">Light Mode Colors</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
        <h4 className="font-semibold text-sm mb-3">Dark Mode Colors</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
        <label className="text-sm font-medium block mb-1">Meta (JSON)</label>
        <textarea
          rows={4}
          className="w-full border rounded-lg px-3 py-2 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
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
          id="isActive"
          checked={draft.isActive}
          onChange={(e) => setField("isActive", e.target.checked)}
          className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
        />
        <label htmlFor="isActive" className="text-sm cursor-pointer select-none">
          Active Theme
        </label>
      </div>

      {/* SAVE */}
      <button
        onClick={handleSave}
        className="w-full px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-sm hover:shadow"
      >
        {draft.themeId ? "Update Theme" : "Create Theme"}
      </button>
    </div>
  );
}