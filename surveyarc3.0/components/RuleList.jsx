"use client";

import {
  Eye,
  EyeOff,
  Copy,
  Trash2,
  FileText,
  AlertTriangle,
} from "lucide-react";

export default function RuleList({
  filteredRules,
  selectedRuleId,
  setSelectedRuleId,
  toggleRuleEnabled,
  duplicateRule,
  deleteRule,
  validationErrors = [],
}) {
  if (!filteredRules || filteredRules.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500">
        <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>No rules found matching your criteria</p>
        <p className="text-sm">Create your first rule using the builder above</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {filteredRules.map((rule) => (
        <div
          key={rule.id}
          className={`border rounded-lg p-4 transition-all ${
            rule.enabled
              ? "border-slate-200 bg-white"
              : "border-slate-200 bg-slate-50 opacity-75"
          } ${selectedRuleId === rule.id ? "ring-2 ring-blue-500" : ""}`}
          onClick={() =>
            setSelectedRuleId(selectedRuleId === rule.id ? null : rule.id)
          }
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-3">
              <div
                className={`w-3 h-3 rounded-full ${
                  rule.enabled ? "bg-green-500" : "bg-slate-400"
                }`}
              ></div>
              <h4 className="font-medium text-slate-900">{rule.name}</h4>
              <span className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded-full">
                Priority: {rule.priority}
              </span>
              {validationErrors.some((e) => e.includes(rule.name)) && (
                <AlertTriangle className="h-4 w-4 text-red-500" />
              )}
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleRuleEnabled(rule.id);
                }}
                className={`p-1.5 rounded-md ${
                  rule.enabled
                    ? "text-green-600 hover:bg-green-50"
                    : "text-slate-400 hover:bg-slate-100"
                }`}
                title={rule.enabled ? "Disable rule" : "Enable rule"}
              >
                {rule.enabled ? (
                  <Eye className="h-4 w-4" />
                ) : (
                  <EyeOff className="h-4 w-4" />
                )}
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  duplicateRule(rule.id);
                }}
                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md"
                title="Duplicate rule"
              >
                <Copy className="h-4 w-4" />
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteRule(rule.id);
                }}
                className="p-1.5 text-red-600 hover:bg-red-50 rounded-md"
                title="Delete rule"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Summary */}
          <div className="text-sm text-slate-600 mb-2">
            <div className="flex items-center space-x-2">
              <span className="font-medium">IF:</span>
              <span>
                {rule.conditions.map((condition, index) => (
                  <span key={condition.id}>
                    {index > 0 && ` ${rule.conditionLogic} `}
                    <span className="font-mono bg-slate-100 px-1 rounded">
                      {condition.questionId} {condition.operator} "
                      {condition.value}"
                    </span>
                  </span>
                ))}
              </span>
            </div>

            <div className="flex items-center space-x-2 mt-1">
              <span className="font-medium">THEN:</span>
              <span>
                {rule.actions.map((action, index) => (
                  <span key={action.id}>
                    {index > 0 && ", "}
                    <span className="font-mono bg-slate-100 px-1 rounded">
                      {action.type === "goto"
                        ? `Go to ${action.target}`
                        : `${action.type}: ${action.target}`}
                    </span>
                  </span>
                ))}
              </span>
            </div>
          </div>

          {/* Expanded Details */}
          {selectedRuleId === rule.id && (
            <div className="mt-4 pt-4 border-t border-slate-200 space-y-3">
              <div>
                <h5 className="font-medium text-slate-800 mb-2">
                  Conditions ({rule.conditionLogic})
                </h5>
                <div className="space-y-2">
                  {rule.conditions.map((condition, index) => (
                    <div
                      key={condition.id}
                      className="flex items-center space-x-2 text-sm"
                    >
                      {index > 0 && (
                        <span className="px-2 py-1 bg-slate-200 text-slate-700 rounded text-xs font-mono">
                          {rule.conditionLogic}
                        </span>
                      )}
                      <div className="flex-1 p-2 bg-slate-50 rounded border">
                        <span className="font-medium">
                          {condition.questionId}
                        </span>
                        <span className="mx-2 text-slate-500">
                          {condition.operator}
                        </span>
                        <span className="font-mono">"{condition.value}"</span>
                        <span className="ml-2 text-xs text-slate-500">
                          ({condition.dataType})
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h5 className="font-medium text-slate-800 mb-2">Actions</h5>
                <div className="space-y-2">
                  {rule.actions.map((action, index) => (
                    <div
                      key={action.id}
                      className="flex items-center space-x-2 text-sm"
                    >
                      <span className="text-slate-500">{index + 1}.</span>
                      <div className="flex-1 p-2 bg-slate-50 rounded border">
                        <span className="font-medium capitalize">
                          {action.type.replace("_", " ")}
                        </span>
                        {action.target && (
                          <>
                            <span className="mx-2 text-slate-500">→</span>
                            <span className="font-mono">{action.target}</span>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
