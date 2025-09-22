import React from 'react';

export default function EmailConfig({ config, updateConfig }) {
  return (
    <div className='flex space-y-3 flex-col dark:bg-[#1A1A1E]  '>
      <label className='text-sm dark:text-[#96949C]'>Placeholder</label>
      <input
        className="border border-[#8C8A97] dark:text-[#CBC9DE] outline-none dark:bg-[#1A1A1E] p-2 rounded w-full"
        value={config.placeholder || ""}
        onChange={(e) => updateConfig("placeholder", e.target.value)}
      />
    </div>
  );
}