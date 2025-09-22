'use client';
import React, { useState, useEffect } from 'react';

export default function EndScreenConfig({ config, updateConfig }) {
  const [text, setText] = useState(config.text || '');

  useEffect(() => {
    setText(config.text || '');
  }, [config]);

  const handleChange = (value) => {
    setText(value);
    updateConfig('text', value);
  };

  return (
    <div className='dark:text-[#96949C] dark:bg-[#1A1A1E]'>
      <label className="block text-sm mb-1">End Screen Text</label>
      <textarea
        className="border rounded p-2 dark:bg-[#1A1A1E] dark:text-[#CBC9DE] w-full"
        rows={4}
        value={text}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="Thank you message or end screen content"
      />
    </div>
  );
}
