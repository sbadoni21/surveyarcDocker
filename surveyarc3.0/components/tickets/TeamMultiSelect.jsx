// components/tickets/TeamSelect.jsx
"use client";
import { useEffect, useState } from "react";
import { useSupportTeams } from "@/providers/postGresPorviders/SupportTeamProvider";

export default function TeamSelect({ 
  groupId, 
  value = "", 
  onChange, 
  label = "Team", 
  disabled,
  placeholder = "Select a team"
}) {
  const { listByGroup } = useSupportTeams();
  const [options, setOptions] = useState([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const arr = groupId ? await listByGroup(groupId) : [];
      if (mounted) setOptions(arr);
    })();
    return () => { mounted = false; };
  }, [groupId, listByGroup]);

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
        disabled={disabled || !groupId}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
      >
        <option value="">{placeholder}</option>
        {options.map((t) => (
          <option key={t.teamId} value={t.teamId}>
            {t.name}
          </option>
        ))}
      </select>
      {!groupId && (
        <p className="text-sm text-gray-500">Select a group first</p>
      )}
    </div>
  );
}
