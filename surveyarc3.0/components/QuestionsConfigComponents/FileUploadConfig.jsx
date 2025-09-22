// components/QuestionConfigComponents/FileUploadConfig.tsx
"use client";
import React, { useState, useEffect } from "react";

export default function FileUploadConfig({ config, updateConfig }) {
  // Local state synchronized with parent config
  const [maxFiles, setMaxFiles] = useState(config.maxFiles ?? 1);
  const [allowedTypes, setAllowedTypes] = useState(
    Array.isArray(config.allowedTypes) ? config.allowedTypes : []
  );
  const [typesInput, setTypesInput] = useState(allowedTypes.join(", "));

  useEffect(() => {
    setMaxFiles(config.maxFiles ?? 1);
    const at = Array.isArray(config.allowedTypes) ? config.allowedTypes : [];
    setAllowedTypes(at);
    setTypesInput(at.join(", "));
  }, [config]);

  const onMaxFilesChange = (e) => {
    const val = parseInt(e.target.value, 10);
    setMaxFiles(isNaN(val) ? 1 : val);
    updateConfig("maxFiles", isNaN(val) ? 1 : val);
  };

  const onTypesChange = (e) => {
    const input = e.target.value;
    setTypesInput(input);
    const typesArr = input
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t);
    setAllowedTypes(typesArr);
    updateConfig("allowedTypes", typesArr);
  };

  return (
    <div className="space-y-4 dark:bg-[#1A1A1E] dark:text-[#96949C]">
      <div>
        <label className="block text-sm">Max Files</label>
        <input
          type="number"
          className="border p-2 rounded w-full dark:bg-[#1A1A1E] dark:text-[#CBC9DE]"
          value={maxFiles}
          onChange={onMaxFilesChange}
          min={1}
        />
      </div>

      <div>
        <label className="block text-sm">Allowed File Types</label>
        <input
          type="text"
          className="border p-2 rounded w-full dark:bg-[#1A1A1E] dark:text-[#CBC9DE]"
          value={typesInput}
          onChange={onTypesChange}
          placeholder="e.g. pdf, docx, jpg"
        />
        <p className="text-sm text-gray-500">
          Enter extensions or MIME types, separated by commas.
        </p>
      </div>
    </div>
  );
}
