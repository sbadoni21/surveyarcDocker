import { Trash2 } from "lucide-react";

export default function RuleConditionRow({
  index,
  condition,
  conditionLogic,
  processedQuestions,
  operatorsByType,
  updateCondition,
  removeCondition,
  showRemove = true,
}) {
  return (
    <div className="flex items-center space-x-3 p-3 bg-white rounded-lg border border-slate-200">
      {index > 0 && (
        <div className="text-sm font-medium text-slate-600 px-2">
          {conditionLogic}
        </div>
      )}

      {/* Question selector */}
      <select
        value={condition.questionId}
        onChange={(e) => updateCondition(condition.id, "questionId", e.target.value)}
        className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-md"
      >
        <option value="">Select Question</option>
        {processedQuestions.map((q) => (
          <option key={q.id} value={q.id}>
            {q.title}
          </option>
        ))}
      </select>

      {/* Data type selector */}
      <select
        value={condition.dataType}
        onChange={(e) => updateCondition(condition.id, "dataType", e.target.value)}
        className="px-3 py-2 text-sm border border-slate-300 rounded-md"
      >
        <option value="string">Text</option>
        <option value="number">Number</option>
        <option value="boolean">Boolean</option>
        <option value="date">Date</option>
        <option value="array">Array</option>
      </select>

      {/* Operator selector */}
      <select
        value={condition.operator}
        onChange={(e) => updateCondition(condition.id, "operator", e.target.value)}
        className="px-3 py-2 text-sm border border-slate-300 rounded-md"
      >
        {operatorsByType[condition.dataType]?.map((op) => (
          <option key={op} value={op}>
            {op.replace(/_/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2")}
          </option>
        ))}
      </select>

      {/* Value input */}
      <input
        type={condition.dataType === "number" ? "number" : "text"}
        value={condition.value}
        onChange={(e) => updateCondition(condition.id, "value", e.target.value)}
        placeholder="Value..."
        className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-md"
      />

      {/* Remove button */}
      {showRemove && (
        <button
          onClick={() => removeCondition(condition.id)}
          className="p-2 text-red-600 hover:bg-red-50 rounded-md"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
