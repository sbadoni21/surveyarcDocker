// components/QuestionConfigComponents/DateConfig.tsx
'use client';
import React, { useState, useEffect } from 'react';

export default function DateConfig({ config, updateConfig }) {
  const [placeholder, setPlaceholder] = useState(config.placeholder || '');
  const [minDate, setMinDate] = useState(config.minDate || '');
  const [maxDate, setMaxDate] = useState(config.maxDate || '');
  const [dateFormat, setDateFormat] = useState(config.dateFormat || 'YYYY-MM-DD');

  // Keep local state in sync with parent
  useEffect(() => {
    setPlaceholder(config.placeholder || '');
    setMinDate(config.minDate || '');
    setMaxDate(config.maxDate || '');
    setDateFormat(config.dateFormat || 'YYYY-MM-DD');
  }, [config]);

  const onPlaceholderChange = (e) => {
    setPlaceholder(e.target.value);
    updateConfig('placeholder', e.target.value);
  };
  const onMinDateChange = (e) => {
    setMinDate(e.target.value);
    updateConfig('minDate', e.target.value);
  };
  const onMaxDateChange = (e) => {
    setMaxDate(e.target.value);
    updateConfig('maxDate', e.target.value);
  };
  const onFormatChange = (e) => {
    setDateFormat(e.target.value);
    updateConfig('dateFormat', e.target.value);
  };

  return (
    <div className="space-y-4 dark:text-[#96949C] dark:bg-[#1A1A1E]">
      <div>
        <label className="block text-sm">Placeholder</label>
        <input
          type="text"
          className="border p-2 rounded w-full dark:bg-[#1A1A1E] dark:text-[#CBC9DE]"
          value={placeholder}
          onChange={onPlaceholderChange}
          placeholder="e.g. Select a date"
        />
      </div>
      <div className="flex gap-4">
        <div className="flex-1">
          <label className="block text-sm">Min Date</label>
          <input
            type="date"
            className="border p-2 rounded w-full dark:bg-[#1A1A1E] dark:text-[#CBC9DE]"
            value={minDate}
            onChange={onMinDateChange}
          />
        </div>
        <div className="flex-1">
          <label className="block text-sm">Max Date</label>
          <input
            type="date"
            className="border p-2 rounded w-full dark:bg-[#1A1A1E] dark:text-[#CBC9DE]"
            value={maxDate}
            onChange={onMaxDateChange}
          />
        </div>
      </div>
      <div>
        <label className="block text-sm">Date Format</label>
        <input
          type="text"
          className="border p-2 rounded w-full dark:bg-[#1A1A1E] dark:text-[#CBC9DE]"
          value={dateFormat}
          onChange={onFormatChange}
          placeholder="e.g. YYYY-MM-DD"
        />
      </div>
    </div>
  );
}
