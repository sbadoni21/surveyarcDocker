import { Zap, CheckCircle, XCircle } from "lucide-react";

export default function RuleLogicHeader({ validationErrors = [] }) {
  return (
    <div className="border-b border-slate-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Zap className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Advanced Rule Logic Editor
            </h1>
            <p className="text-slate-600">
              Create sophisticated conditional logic with visual rule builder
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {validationErrors.length === 0 ? (
            <div className="flex items-center text-green-600 text-sm">
              <CheckCircle className="h-4 w-4 mr-1" />
              Valid
            </div>
          ) : (
            <div className="flex items-center text-red-600 text-sm">
              <XCircle className="h-4 w-4 mr-1" />
              {validationErrors.length} errors
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
