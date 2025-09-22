// components/QuestionConfigComponents/RatingConfig.tsx
'use client';
import React from 'react';

export default function RatingConfig({ config, updateConfig }) {
  const handleMinChange = (e) => updateConfig('min', parseInt(e.target.value) || 0);
  const handleMaxChange = (e) => updateConfig('max', parseInt(e.target.value) || 10);
  const handleMinLabelChange = (e) => updateConfig('minLabel', e.target.value);
  const handleMaxLabelChange = (e) => updateConfig('maxLabel', e.target.value);

  return (
    <div className="space-y-4 dark:bg-[#1A1A1E] dark:text-[#96949C]">
      <div className="flex gap-4">
        <div className="flex-1">
          <label className="block text-sm">Min Value</label>
          <input
            type="number"
            className="w-full dark:bg-[#1A1A1E] dark:text-[#96949C] border p-2 rounded"
            value={config.min ?? 0}
            onChange={handleMinChange}
          />
        </div>
        <div className="flex-1">
          <label className="block text-sm">Max Value</label>
          <input
            type="number"
            className="w-full dark:bg-[#1A1A1E] dark:text-[#96949C] border p-2 rounded"
            value={config.max ?? 10}
            onChange={handleMaxChange}
          />
        </div>
      </div>

      <div className="flex gap-4">
        <div className="flex-1">
          <label className="block text-sm">Min Label</label>
          <input
            type="text"
            className="w-full dark:bg-[#1A1A1E] dark:text-[#CBC9DE] border p-2 rounded"
            value={config.minLabel || ''}
            onChange={handleMinLabelChange}
            placeholder="e.g., Not Likely"
          />
        </div>
        <div className="flex-1">
          <label className="block text-sm">Max Label</label>
          <input
            type="text"
            className="w-full dark:bg-[#1A1A1E] dark:text-[#CBC9DE] border p-2 rounded"
            value={config.maxLabel || ''}
            onChange={handleMaxLabelChange}
            placeholder="e.g., Extremely Likely"
          />
        </div>
      </div>
    </div>
  );
}
