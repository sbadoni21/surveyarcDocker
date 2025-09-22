import React from 'react';

export default function WebsiteConfig({ config, updateConfig }) {
  return (
    <div className='dark:bg-[#1A1A1E]'>
      <label className='text-sm dark:text-[#96949C]'>URL Placeholder</label>
      <input
        className="border dark:bg-[#1A1A1E] p-2 dark:text-[#CBC9DE] rounded w-full"
        value={config.placeholder || "https://"}
        onChange={(e) => updateConfig("placeholder", e.target.value)}
      />
    </div>
  );
}