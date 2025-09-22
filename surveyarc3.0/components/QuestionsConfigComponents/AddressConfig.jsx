import React from 'react';

export default function AddressConfig({ config, updateConfig }) {
  return (
    <div className="flex items-center justify-between rounded-md bg-white dark:bg-[#1A1A1E]">
      {/* <label htmlFor="include-pincode" className="text-sm font-medium text-gray-700 dark:text-gray-300">
        Include Pincode?
      </label>
      
      <input
        id="include-pincode"
        type="checkbox"
        checked={config.includePincode || false}
        onChange={(e) => updateConfig("includePincode", e.target.checked)}
        className="w-5 h-5 text-blue-600 bg-white border-gray-300 rounded focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:focus:ring-orange-500"
      /> */}
    </div>
  );
}
