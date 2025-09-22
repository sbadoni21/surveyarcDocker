// components/QuestionConfigComponents/WelcomeConfig.tsx
'use client';
import React, { useState, useEffect } from 'react';

export default function WelcomeConfig({ config, updateConfig }) {
  const [title, setTitle] = useState(config.title || 'Welcome!');
  const [description, setDescription] = useState(config.description || '');
  const [buttonText, setButtonText] = useState(config.buttonText || 'Start');

  useEffect(() => {
    setTitle(config.title || 'Welcome!');
    setDescription(config.description || '');
    setButtonText(config.buttonText || 'Start');
  }, [config]);

  const handleChange = (field, value) => {
    if (field === 'title') setTitle(value);
    if (field === 'description') setDescription(value);
    if (field === 'buttonText') setButtonText(value);
    updateConfig(field, value);
  };

  return (
    <div className="space-y-4 dark:text-[#96949C] dark:bg-[#1A1A1E]">
      <div>
        <label className="block font-medium">Title</label>
        <input
          type="text"
          className="border p-2 rounded w-full dark:bg-[#1A1A1E] dark:text-[#CBC9DE]"
          value={title}
          onChange={(e) => handleChange('title', e.target.value)}
          placeholder="Enter welcome title"
        />
      </div>

      <div>
        <label className="block font-medium">Description</label>
        <textarea
          className="border p-2 rounded w-full dark:bg-[#1A1A1E] dark:text-[#CBC9DE]"
          rows={3}
          value={description}
          onChange={(e) => handleChange('description', e.target.value)}
          placeholder="Enter a short description"
        />
      </div>

      <div>
        <label className="block font-medium">Start Button Text</label>
        <input
          type="text"
          className="border p-2 rounded w-full dark:bg-[#1A1A1E] dark:text-[#CBC9DE]"
          value={buttonText}
          onChange={(e) => handleChange('buttonText', e.target.value)}
          placeholder="e.g. Begin, Start Survey"
        />
      </div>
    </div>
  );
}
