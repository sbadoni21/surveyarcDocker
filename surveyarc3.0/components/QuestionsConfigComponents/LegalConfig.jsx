// components/QuestionConfigComponents/LegalConfig.tsx
'use client';
import React from 'react';

export default function LegalConfig({ config, updateConfig }) {
  const handleTextChange = (e) => updateConfig('legalText', e.target.value);
  const handleRequiredChange = (e) => updateConfig('required', e.target.checked);

  return (
    <div className="space-y-2 dark:bg-[#1A1A1E] dark:text-[#96949C]">
      <label className="block text-sm">Legal Text</label>
      <textarea
        className="border p-2 dark:text-[#CBC9DE] dark:bg-[#1A1A1E] dark:border-[#D5D5D5] outline-none text-sm rounded w-full"
        value={config.legalText || ''}
        onChange={handleTextChange}
        placeholder="Enter terms and conditions"
      />
      <div className="flex items-center gap-2">
        <input
          type="checkbox" 
          checked={config.required ?? false}
          onChange={handleRequiredChange}
          id="legal-required"
        />
        <label htmlFor="legal-required text-sm">Require acceptance</label>
      </div>
    </div>
  );
}
