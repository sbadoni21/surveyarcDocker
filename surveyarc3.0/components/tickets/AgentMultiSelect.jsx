// components/tickets/AgentSelect.jsx
"use client";

export default function AgentSelect({ 
  options = [],
  value = "", 
  onChange, 
  label = "Agent", 
  disabled,
  placeholder = "Select an agent",
  helperText,
  multiple = false
}) {
  // Handle both formats: {value, label} and full user objects
  const normalizedOptions = options.map(option => {
    // If it's already in {value, label} format
    if (option.value !== undefined && option.label !== undefined) {
      return option;
    }
    
    // If it's a full user object, normalize it
    return {
      value: option.userId || option.uid || option.user_id,
      label: option.displayName || option.display_name || option.name || option.email || option.userId || option.uid || option.user_id
    };
  });
console.log(options)
  return (
    
    <div className="space-y-2">
      {label && (
        <label className="block text-sm font-medium text-gray-700">
          {label}
        </label>
      )}
      <select
        value={value || ""}
        onChange={(e) => {
          const newValue = e.target.value;
          onChange?.(newValue || null);
        }}
        disabled={disabled || normalizedOptions.length === 0}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed text-sm"
      >
        <option value="">{placeholder}</option>
        {normalizedOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {helperText && (
        <p className="text-sm text-gray-500">{helperText}</p>
      )}
      {normalizedOptions.length === 0 && !disabled && (
        <p className="text-sm text-gray-500">Select a team first to see available members</p>
      )}
    </div>
  );
}