'use client';
import React, { useState, useEffect } from 'react';

export default function RedirectConfig({ config, updateConfig }) {
  const [url, setUrl] = useState(config.url || '');

  useEffect(() => {
    setUrl(config.url || '');
  }, [config]);

  const handleChange = (value) => {
    setUrl(value);
    updateConfig('url', value);
  };

  return (
    <div className='dark:text-[#96949C] dark:bg-[#1A1A1E]'>
      <label className="block text-sm mb-1">Redirect URL</label>
      <input
        type="url"
        className="border rounded dark:bg-[#1A1A1E] dark:text-[#CBC9DE] p-2 w-full"
        value={url}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="https://example.com"
      />
    </div>
  );
}
