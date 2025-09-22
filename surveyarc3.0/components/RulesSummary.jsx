import React from "react";

export default function RulesSummary({ parsedRules }) {
  const totalRules = parsedRules.length;
  const enabledRules = parsedRules.filter(r => r.enabled).length;
  const totalConditions = parsedRules.reduce((sum, r) => sum + r.conditions.length, 0);
  const totalActions = parsedRules.reduce((sum, r) => sum + r.actions.length, 0);

  return (
    <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
      <StatCard count={totalRules} label="Total Rules" bgColor="blue" />
      <StatCard count={enabledRules} label="Enabled" bgColor="green" />
      <StatCard count={totalConditions} label="Conditions" bgColor="slate" />
      <StatCard count={totalActions} label="Actions" bgColor="purple" />
    </div>
  );
}

function StatCard({ count, label, bgColor }) {
  const bg = {
    blue: "bg-blue-50",
    green: "bg-green-50",
    slate: "bg-slate-50",
    purple: "bg-purple-50",
  }[bgColor];

  const text = {
    blue: "text-blue-600",
    green: "text-green-600",
    slate: "text-slate-600",
    purple: "text-purple-600",
  }[bgColor];

  const textSecondary = {
    blue: "text-blue-700",
    green: "text-green-700",
    slate: "text-slate-700",
    purple: "text-purple-700",
  }[bgColor];

  return (
    <div className={`${bg} rounded-lg p-4 text-center`}>
      <div className={`text-2xl font-bold ${text}`}>{count}</div>
      <div className={`text-sm ${textSecondary}`}>{label}</div>
    </div>
  );
}
