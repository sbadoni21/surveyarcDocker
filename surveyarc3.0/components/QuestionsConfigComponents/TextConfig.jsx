// components/QuestionConfigComponents/TextConfig.tsx
'use client';
import React from 'react';

export default function TextConfig({ config, updateConfig }) {
  const placeholder = config.placeholder || '';
  const maxLength = config.maxLength ?? 200;

  return (
    <div className="space-y-4 dark:bg-[#1A1A1E] dark:text-[#96949C]">
      <div>
        <label className="block text-sm">Placeholder</label>
        <input
          type="text"
          className="border p-2 dark:bg-[#1A1A1E] dark:text-[#CBC9DE] rounded w-full"
          value={placeholder}
          onChange={e => updateConfig('placeholder', e.target.value)}
          placeholder="Enter placeholder text"
        />
      </div>
      <div>
        <label className="block text-sm">Max Length</label>
        <input
          type="number"
          className="border p-2 dark:bg-[#1A1A1E] dark:text-[#CBC9DE] rounded w-full"
          value={maxLength}
          onChange={e => updateConfig('maxLength', parseInt(e.target.value, 10) || 0)}
        />
      </div>
    </div>
  );
}
