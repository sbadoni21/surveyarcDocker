import { AlertCircle } from "lucide-react";
import React from "react";

export default function ValidationErrors({ validationErrors }) {
  if (!validationErrors || validationErrors.length === 0) return null;

  return (
    <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
      <div className="flex items-start">
        <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 mr-3 flex-shrink-0" />
        <div>
          <h4 className="font-medium text-red-800 mb-2">Validation Errors</h4>
          <ul className="space-y-1 text-sm text-red-700">
            {validationErrors.map((error, index) => (
              <li key={index} className="flex items-start">
                <span className="w-2 h-2 bg-red-400 rounded-full mt-2 mr-2 flex-shrink-0"></span>
                {error}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
