'use client';
import React, { useState, useEffect } from 'react';

export default function SubmitConfig({ config, updateConfig }) {
  const [buttonText, setButtonText] = useState(config.buttonText || 'Submit');
  const [confirmationMessage, setConfirmationMessage] = useState(config.confirmationMessage || 'Your responses have been saved.');

  useEffect(() => {
    setButtonText(config.buttonText || 'Submit');
    setConfirmationMessage(config.confirmationMessage || 'Your responses have been saved.');
  }, [config]);

  const handleChange = (field, value) => {
    if (field === 'buttonText') setButtonText(value);
    if (field === 'confirmationMessage') setConfirmationMessage(value);
    updateConfig(field, value);
  };

  return (
    <div className="space-y-4 dark:text-[#96949C] dark:bg-[#1A1A1E]">
      <div>
        <label className="block text-sm mb-1">Submit Button Text</label>
        <input
          type="text"
          className="border rounded p-2 w-full dark:bg-[#1A1A1E] dark:text-[#CBC9DE]"
          value={buttonText}
          onChange={(e) => handleChange('buttonText', e.target.value)}
          placeholder="e.g. Save and Continue"
        />
      </div>

      <div>
        <label className="block text-sm mb-1">Confirmation Message</label>
        <textarea
          className="border rounded p-2 w-full dark:bg-[#1A1A1E] dark:text-[#CBC9DE]"
          rows={3}
          value={confirmationMessage}
          onChange={(e) => handleChange('confirmationMessage', e.target.value)}
          placeholder="Message shown after partial submit"
        />
      </div>
    </div>
  );
}
