// components/QuestionConfigComponents/GoogleDriveConfig.tsx
'use client';
import React, { useState, useEffect } from 'react';

export default function GoogleDriveConfig({ config, updateConfig }) {
  const [folderId, setFolderId] = useState(config.folderId || '');
  const [viewMode, setViewMode] = useState(config.viewMode || 'list');

  // Sync with incoming config
  useEffect(() => {
    setFolderId(config.folderId || '');
    setViewMode(config.viewMode || 'list');
  }, [config]);

  const handleFolderIdChange = (e) => {
    const val = e.target.value;
    setFolderId(val);
    updateConfig('folderId', val);
  };

  const handleViewModeChange = (e) => {
    const val = e.target.value;
    setViewMode(val);
    updateConfig('viewMode', val);
  };

  return (
    <div className="space-y-4 dark:text-[#96949C] dark:bg-[#1A1A1E]">
      <div>
        <label className="block text-sm">Google Drive Folder ID</label>
        <input
          type="text"
          className="border p-2 rounded w-full dark:text-[#CBC9DE] dark:bg-[#1A1A1E]"
          placeholder="e.g. 1a2B3cD4eF5g"
          value={folderId}
          onChange={handleFolderIdChange}
        />
        <p className="text-sm text-gray-500">
          Specify the Drive folder or file ID to embed.
        </p>
      </div>

      <div>
        <label className="block text-sm">Display Mode</label>
        <select
          className="border p-2 rounded w-full dark:text-[#CBC9DE] dark:bg-[#1A1A1E]"
          value={viewMode}
          onChange={handleViewModeChange}
        >
          <option value="list">List View</option>
          <option value="grid">Grid View</option>
          <option value="picker">Picker UI</option>
        </select>
      </div>
    </div>
  );
}
