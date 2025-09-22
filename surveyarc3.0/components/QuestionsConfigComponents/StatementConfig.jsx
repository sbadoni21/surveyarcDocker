'use client';
import React, { useState, useEffect } from 'react';

export default function StatementConfig({ config, updateConfig }) {
  const [text, setText] = useState(config.text || '');

  useEffect(() => {
    setText(config.text || '');
  }, [config]);

  const handleChange = (value) => {
    setText(value);
    updateConfig('text', value);
  };

  return (
    <div className='dark:bg-[#1A1A1E] dark:text-[#96949C]'>
      <label className="block text-sm mb-1">Statement Text</label>
      <textarea
        className="border rounded p-2 w-full dark:bg-[#1A1A1E] dark:text-[#CBC9DE]"
        rows={4}
        value={text}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="Enter your statement or informational text here"
      />
    </div>
  );
}
