import { Code, Eye, EyeOff, Play } from "lucide-react";
import React from "react";

export default function XmlLogicEditor({
  viewMode,
  xmlText,
  setXmlText,
  showPreview,
  setShowPreview,
  parsedRules,
  addToHistory,
  parseRulesFromXML,
}) {
  if (viewMode !== "xml") return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-900">XML Logic Editor</h3>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => {
              addToHistory(xmlText);
              parseRulesFromXML(xmlText);
            }}
            className="flex items-center px-3 py-1.5 text-sm bg-green-600 text-white rounded-md hover:bg-green-700"
          >
            <Play className="h-4 w-4 mr-1" />
            Parse &amp; Validate
          </button>
          <button
            onClick={() => setShowPreview(!showPreview)}
            className="flex items-center px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            {showPreview ? <EyeOff className="h-4 w-4 mr-1" /> : <Eye className="h-4 w-4 mr-1" />}
            {showPreview ? "Hide" : "Show"} Preview
          </button>
        </div>
      </div>

      <div className={showPreview ? "grid grid-cols-2 gap-6" : ""}>
        <div>
          <textarea
            className="w-full h-96 p-4 border border-slate-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            value={xmlText}
            onChange={(e) => setXmlText(e.target.value)}
            placeholder={`<Logic>
  <Rule>
    <Condition questionId="q1" operator="equals">value</Condition>
    <Goto>q2</Goto>
  </Rule>
</Logic>`}
          />
        </div>

        {showPreview && (
          <div>
            <h4 className="font-medium text-slate-800 mb-3">Preview</h4>
            <div className="h-96 overflow-y-auto border border-slate-300 rounded-lg p-4 bg-slate-50">
              {parsedRules.length === 0 ? (
                <div className="text-center text-slate-500 py-8">
                  <Code className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No valid rules parsed</p>
                  <p className="text-sm">Check your XML syntax</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {parsedRules.map((rule) => (
                    <div key={rule.id} className="bg-white rounded border p-3">
                      <h5 className="font-medium text-slate-900 mb-2">{rule.name}</h5>
                      <div className="text-sm text-slate-600">
                        <div>Conditions: {rule.conditions.length}</div>
                        <div>Actions: {rule.actions.length}</div>
                        <div>Priority: {rule.priority}</div>
                        <div>Status: {rule.enabled ? "Enabled" : "Disabled"}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
