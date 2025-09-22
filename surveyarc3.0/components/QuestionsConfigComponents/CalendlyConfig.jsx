// components/QuestionConfigComponents/CalendlyConfig.tsx
'use client';
import React, { useState, useEffect } from 'react';

export default function CalendlyConfig({ config, updateConfig }) {
  const [url, setUrl] = useState(config.url || '');
  const [embedType, setEmbedType] = useState(config.embedType || 'inline');

  // Sync with incoming config
  useEffect(() => {
    setUrl(config.url || '');
    setEmbedType(config.embedType || 'inline');
  }, [config]);

  const handleUrlChange = (e) => {
    const val = e.target.value;
    setUrl(val);
    updateConfig('url', val);
  };

  const handleEmbedTypeChange = (e) => {
    const val = e.target.value;
    setEmbedType(val);
    updateConfig('embedType', val);
  };

  return (
    <div className="space-y-4 dark:bg-[#1A1A1E] dark:text-[#96949C]">
      <div>
        <label className="block font-medium">Calendly Event URL</label>
        <input
          type="url"
          className="border p-2 rounded w-full dark:bg-[#1A1A1E] dark:text-[#CBC9DE]"
          placeholder="https://calendly.com/username/event"
          value={url}
          onChange={handleUrlChange}
        />
        <p className="text-sm text-gray-500">
          Paste your Calendly scheduling link here.
        </p>
      </div>

      <div>
        <label className="block font-medium">Embed Style</label>
        <select
          className="border p-2 rounded w-full dark:bg-[#1A1A1E] dark:text-[#CBC9DE]"
          value={embedType}
          onChange={handleEmbedTypeChange}
        >
          <option value="inline">Inline Embed</option>
          <option value="popup_text">Popup Text</option>
          <option value="popup_button">Popup Button</option>
        </select>
      </div>
    </div>
  );
}
