"use client";

import React, { useEffect, useState } from "react";
import { X } from "lucide-react";

export default function ProjectForm({
  initialData = {},
  onSubmit,
  onCancel,
  loading,
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState(null);

  useEffect(() => {
    setName(initialData?.name || "");
    setDescription(initialData?.description || "");
  }, [initialData]);

  function handleSubmit() {
    if (!name.trim()) {
      setError("Directory name is required.");
      return;
    }
    setError(null);
    onSubmit({ name, description });
    // keep fields if editing; clear on create UX below is fine
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-orange-50 dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md mx-auto">
        <div className="flex items-center justify-between p-6 border-b border-orange-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-amber-100">
            {initialData?.project_id || initialData?.projectId ? "Edit Directory" : "Create New Directory"}
          </h2>
          <button
            onClick={onCancel}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 
                     hover:bg-orange-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-600 rounded-lg">
              <p className="text-red-700 dark:text-red-400 text-sm font-medium">{error}</p>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <div className="block text-sm font-medium text-gray-900 dark:text-amber-100 mb-2">
                Directory Name
              </div>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter project name"
                className="w-full px-3 py-2 border border-orange-300 dark:border-gray-600 rounded-lg 
                         bg-white dark:bg-gray-700 text-gray-900 dark:text-amber-100
                         placeholder-gray-500 dark:placeholder-gray-400
                         focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none
                         transition-colors"
              />
            </div>

            <div>
              <div className="block text-sm font-medium text-gray-900 dark:text-amber-100 mb-2">
                Description
              </div>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional project description"
                rows="3"
                className="w-full px-3 py-2 border border-orange-300 dark:border-gray-600 rounded-lg 
                         bg-white dark:bg-gray-700 text-gray-900 dark:text-amber-100
                         placeholder-gray-500 dark:placeholder-gray-400
                         focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none
                         transition-colors resize-none"
              />
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="flex-1 px-4 py-2 bg-orange-500 hover:bg-orange-600 dark:bg-orange-600 dark:hover:bg-orange-500 
                       text-white font-semibold rounded-lg transition-colors
                       disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading
                ? "Saving..."
                : initialData?.project_id || initialData?.projectId
                ? "Update Directory"
                : "Create Directory"}
            </button>
            <button
              onClick={onCancel}
              className="flex-1 px-4 py-2 bg-orange-200 hover:bg-orange-300 dark:bg-gray-600 dark:hover:bg-gray-500 
                       text-gray-900 dark:text-amber-100 font-semibold rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
