

// components/tickets/AgentSelect.jsx
"use client";

export default function AgentSelect({ 
  options = [],
  value = "", 
  onChange, 
  label = "Agent", 
  disabled,
  placeholder = "Select an agent",
  helperText
}) {
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
        onChange={(e) => onChange?.(e.target.value)}
        disabled={disabled || options.length === 0}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
      >
        <option value="">{placeholder}</option>
        {options.map((agent) => (
          <option key={agent.userId || agent.uid} value={agent.userId || agent.uid}>
            {agent.displayName || agent.name || agent.email || agent.userId || agent.uid}
          </option>
        ))}
      </select>
      {helperText && (
        <p className="text-sm text-gray-500">{helperText}</p>
      )}
      {options.length === 0 && !disabled && (
        <p className="text-sm text-gray-500">Select a team first to see available members</p>
      )}
    </div>
  );
}