"use client";
import React, { useRef, useState } from "react";
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { useThemes } from "./ThemesProvider";
import { storage } from "@/firebase/firebase";

export default function LogoUploader() {
  const { theme, saveTheme } = useThemes();
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(null);
  const inputRef = useRef(null);

  const onPick = async (file) => {
    if (!file) return;
    if (!theme?.id) {
      console.error("Missing theme.id; cannot build storage path.");
      return;
    }

    setBusy(true);
    setProgress(0);
    try {
      const path = `org-logos/${theme.id}/${Date.now()}-${file.name}`;
      const r = ref(storage, path);

      const uploadTask = uploadBytesResumable(r, file, {
        contentType: file.type || "image/*",
        cacheControl: "public,max-age=31536000,immutable",
      });

      await new Promise((resolve, reject) => {
        uploadTask.on(
          "state_changed",
          (snap) => {
            const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
            setProgress(pct);
          },
          reject,
          () => resolve()
        );
      });

      const url = await getDownloadURL(r);

      // Save BOTH url and alt together to avoid overwriting one or the other
      const nextAlt = theme?.logo?.alt || "";
      await saveTheme({ logo: { url, alt: nextAlt } });
    } catch (err) {
      console.error("Logo upload failed:", err);
      alert("Upload failed. Please check console & storage rules.");
    } finally {
      setBusy(false);
      setProgress(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const onAltChange = async (alt) => {
    await saveTheme({ logo: { url: theme?.logo?.url || "", alt } });
  };

  return (
    <div>
      <div className="flex items-center gap-3">
        {theme?.logo?.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={theme.logo.url}
            alt={theme.logo.alt || "Logo"}
            className="h-10 w-10 rounded object-contain border"
          />
        ) : (
          <div className="h-10 w-10 rounded bg-gray-100 border" />
        )}

        <label className="px-3 py-1.5 border rounded-lg cursor-pointer hover:bg-gray-50 text-sm">
          {busy ? (progress !== null ? `Uploading… ${progress}%` : "Uploading…") : "Upload Logo"}
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => onPick(e.target.files?.[0])}
            disabled={busy}
          />
        </label>
      </div>

      <input
        className="mt-2 w-full border rounded-lg px-3 py-2 text-sm"
        placeholder="Logo alt text"
        value={theme?.logo?.alt || ""}
        onChange={(e) => onAltChange(e.target.value)}
        disabled={busy}
      />
    </div>
  );
}
