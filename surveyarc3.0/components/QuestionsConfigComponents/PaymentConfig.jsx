// components/QuestionConfigComponents/PaymentConfig.tsx
'use client';
import React, { useState, useEffect } from 'react';

export default function PaymentConfig({ config, updateConfig }) {
  const [currency, setCurrency] = useState(config.currency || 'USD');
  const [amount, setAmount] = useState(config.amount ?? 0);
  const [description, setDescription] = useState(config.description || '');

  // Sync local state when config prop changes
  useEffect(() => {
    setCurrency(config.currency || 'USD');
    setAmount(config.amount ?? 0);
    setDescription(config.description || '');
  }, [config]);

  const handleCurrencyChange = (e) => {
    const val = e.target.value.toUpperCase();
    setCurrency(val);
    updateConfig('currency', val);
  };

  const handleAmountChange = (e) => {
    const val = parseFloat(e.target.value);
    setAmount(isNaN(val) ? 0 : val);
    updateConfig('amount', isNaN(val) ? 0 : val);
  };

  const handleDescriptionChange = (e) => {
    const val = e.target.value;
    setDescription(val);
    updateConfig('description', val);
  };

  return (
    <div className="space-y-4 dark:bg-[#1A1A1E] dark:text-[#96949C]">
      <div>
        <label className="block text-sm">Currency</label>
        <input
          type="text"
          className="border p-2 rounded w-full dark:bg-[#1A1A1E] dark:text-[#CBC9DE]"
          value={currency}
          onChange={handleCurrencyChange}
          placeholder="e.g. USD, EUR"
        />
      </div>

      <div>
        <label className="block text-sm">Amount</label>
        <input
          type="number"
          className="border p-2 rounded w-full dark:bg-[#1A1A1E] dark:text-[#CBC9DE]"
          value={amount}
          onChange={handleAmountChange}
          placeholder="e.g. 19.99"
          step="0.01"
        />
      </div>

      <div>
        <label className="block text-sm">Description (optional)</label>
        <input
          type="text"
          className="border p-2 rounded w-full dark:bg-[#1A1A1E] dark:text-[#CBC9DE]"
          value={description}
          onChange={handleDescriptionChange}
          placeholder="e.g. Subscription fee"
        />
      </div>
    </div>
  );
}
