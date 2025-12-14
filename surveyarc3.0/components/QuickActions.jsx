import React, { useState } from 'react';
import { MoreVertical } from 'lucide-react';
import DummyGeneratorPanel from './dummydata-generator/DummyGeneratorPanel';

export const QuickActions = ({ survey, loading, handleToggleStatus, orgId, projectId }) => {
  const [anchorEl, setAnchorEl] = useState(null);
  const [generationProgress, setGenerationProgress] = useState({
    isGenerating: false,
    completed: 0,
    total: 0
  });
  
  const open = Boolean(anchorEl);

  const handleClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const onToggleStatus = () => {
    handleToggleStatus();
    handleClose();
  };

  const handleProgressUpdate = (progress) => {
    setGenerationProgress(progress);
  };

  const progressPercent = generationProgress.total > 0 
    ? Math.round((generationProgress.completed / generationProgress.total) * 100)
    : 0;

  return (
    <div className="w-full border border-gray-300 rounded-lg bg-white shadow-sm">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-gray-700">Status:</span>
          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
            survey?.status === "test" 
              ? "bg-yellow-100 text-yellow-800" 
              : "bg-green-100 text-green-800"
          }`}>
            {survey?.status === "test" ? "Test" : "Live"}
          </span>

          {/* Generation Progress Indicator */}
          {generationProgress.isGenerating && (
            <div className="flex items-center gap-2 ml-4 px-3 py-1 bg-emerald-50 border border-emerald-200 rounded-full">
              <Loader2 className="w-4 h-4 text-emerald-600 animate-spin" />
              <span className="text-xs font-semibold text-emerald-700">
                Generating: {generationProgress.completed}/{generationProgress.total} ({progressPercent}%)
              </span>
            </div>
          )}
        </div>

        <div className="relative">
          <button
            onClick={handleClick}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            aria-label="Quick actions"
          >
            <MoreVertical className="w-5 h-5 text-gray-600" />
          </button>

          {open && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={handleClose}
              />
              <div className="absolute right-0 mt-1 w-56 bg-white rounded-md shadow-lg z-20 border border-gray-200">
                <div className="py-1">
                  <button
                    onClick={onToggleStatus}
                    disabled={loading}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {survey?.status === "test"
                      ? "Change Status to Published"
                      : "Change Status to Test"}
                  </button>
                  
                  <DummyGeneratorPanel
                    orgId={orgId}
                    projectId={projectId}
                    surveyId={survey?.surveyId}
                    onProgressUpdate={handleProgressUpdate}
                  />
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};