import { Trash2 } from "lucide-react";

export default function RuleActionRow({
  action,
  updateAction,
  removeAction,
  processedQuestions,
  actionTypes,
  showRemove = true,
}) {
  return (
    <div className="flex items-center space-x-3 p-3 bg-white rounded-lg border border-slate-200">
      {/* Action Type Selector */}
      <select
        value={action.type}
        onChange={(e) => updateAction(action.id, "type", e.target.value)}
        className="px-3 py-2 text-sm border border-slate-300 rounded-md"
      >
        {actionTypes.map((type) => (
          <option key={type.value} value={type.value}>
            {type.icon} {type.label}
          </option>
        ))}
      </select>
{action.type === 'goto' && (
  <select
    value={action.target}
    onChange={(e) => updateAction(action.id, 'target', e.target.value)}
    className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-md"
  >
    <option value="END">END Survey</option>
    {processedQuestions.map((q) => (
      <option key={q.id} value={q.id}>
        {q.title}
      </option>
    ))}
  </select>
)}

{action.type === 'skip' && (
  <select
    multiple
    value={Array.isArray(action.target) ? action.target : []}
    onChange={(e) =>
      updateAction(action.id, 'target', Array.from(e.target.selectedOptions, (option) => option.value))
    }
    className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-md"
  >
    {processedQuestions.map((q) => (
      <option key={q.id} value={q.id}>
        {q.title}
      </option>
    ))}
  </select>
)}


      {/* Message for "show_message" */}
      {action.type === "show_message" && (
        <input
          type="text"
          value={action.target}
          onChange={(e) => updateAction(action.id, "target", e.target.value)}
          placeholder="Enter message..."
          className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-md"
        />
      )}

      {/* Formula input for "calculate" */}
      {action.type === "calculate" && (
        <input
          type="text"
          value={action.target}
          onChange={(e) => updateAction(action.id, "target", e.target.value)}
          placeholder="Enter formula..."
          className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-md"
        />
      )}

      {/* Variable + Value for "set_variable" */}
      {action.type === "set_variable" && (
        <div className="flex-1 flex space-x-2">
          <input
            type="text"
            value={action.target}
            onChange={(e) =>
              updateAction(action.id, "target", e.target.value)
            }
            placeholder="Variable name..."
            className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-md"
          />
          <input
            type="text"
            value={action.parameters?.value || ""}
            onChange={(e) =>
              updateAction(action.id, "parameters", {
                ...action.parameters,
                value: e.target.value,
              })
            }
            placeholder="Value..."
            className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-md"
          />
        </div>
      )}

      {/* Remove Action Button */}
      {showRemove && (
        <button
          onClick={() => removeAction(action.id)}
          className="p-2 text-red-600 hover:bg-red-50 rounded-md"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
