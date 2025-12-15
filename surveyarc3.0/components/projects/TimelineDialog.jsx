import React, { useState } from "react";
import { X, Plus, Trash2, Upload, Link as LinkIcon } from "lucide-react";
import { timeformater } from "@/utils/timeformater";

export function TimelineDialog({
  open,
  onClose,
  project,
  data,
  onToggleMilestone,
  onDeleteMilestone,
  onAddMilestone,
  onAddAttachment,
  onAddSurvey,
  onRemoveSurvey,
}) {
  const [newMilestoneTitle, setNewMilestoneTitle] = useState("");
  const [attachName, setAttachName] = useState("");
  const [attachUrl, setAttachUrl] = useState("");
  const [surveyInput, setSurveyInput] = useState("");

  if (!open) return null;

  const handleAddMilestone = async () => {
    if (!newMilestoneTitle) return;
    await onAddMilestone(newMilestoneTitle);
    setNewMilestoneTitle("");
  };

  const handleAddAttachment = async () => {
    if (!attachName || !attachUrl) return;
    await onAddAttachment(attachName, attachUrl);
    setAttachName("");
    setAttachUrl("");
  };

  const handleAddSurvey = async () => {
    if (!surveyInput) return;
    await onAddSurvey(surveyInput);
    setSurveyInput("");
  };

  const handleRemoveSurvey = async () => {
    if (!surveyInput) return;
    await onRemoveSurvey(surveyInput);
    setSurveyInput("");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Directory Timeline</h2>
            {project && (
              <p className="text-sm text-gray-600 mt-1">{project.name}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* Milestones */}
          <section className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Milestones</h3>
            
            {(data.milestones || []).length === 0 ? (
              <p className="text-sm text-gray-500 italic py-4">
                No milestones yet. Add one below.
              </p>
            ) : (
              <div className="space-y-2 mb-4">
                {(data.milestones || []).map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={m.done}
                        onChange={() => onToggleMilestone(m.id, m.done)}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                      />
                      <div>
                        <div className={`font-medium ${m.done ? "line-through text-gray-500" : "text-gray-900"}`}>
                          {m.title}
                        </div>
                        <div className="text-xs text-gray-500">
                          Due: {m.due ? timeformater(m.due) : "Not set"}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => onDeleteMilestone(m.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add Milestone */}
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="New milestone title..."
                value={newMilestoneTitle}
                onChange={(e) => setNewMilestoneTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddMilestone()}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                onClick={handleAddMilestone}
                disabled={!newMilestoneTitle}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="w-4 h-4" />
                Add
              </button>
            </div>
          </section>

          {/* Attachments */}
          <section className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Attachments</h3>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Name"
                value={attachName}
                onChange={(e) => setAttachName(e.target.value)}
                className="w-48 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <input
                type="url"
                placeholder="URL"
                value={attachUrl}
                onChange={(e) => setAttachUrl(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                onClick={handleAddAttachment}
                disabled={!attachName || !attachUrl}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Upload className="w-4 h-4" />
                Add
              </button>
            </div>
          </section>

          {/* Survey Links */}
          <section className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Survey Links</h3>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Survey ID"
                value={surveyInput}
                onChange={(e) => setSurveyInput(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                onClick={handleAddSurvey}
                disabled={!surveyInput}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="w-4 h-4" />
                Add
              </button>
              <button
                onClick={handleRemoveSurvey}
                disabled={!surveyInput}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Trash2 className="w-4 h-4" />
                Remove
              </button>
            </div>
          </section>

          {/* Activity Log */}
          <section>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Recent Activity</h3>
            {(data.activities || []).length === 0 ? (
              <p className="text-sm text-gray-500 italic py-4">
                No recent activity
              </p>
            ) : (
              <div className="space-y-2">
                {(data.activities || []).map((a, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex-shrink-0 w-2 h-2 mt-2 bg-blue-500 rounded-full" />
                    <div className="flex-1">
                      <div className="text-sm text-gray-900">{a.activity}</div>
                      <div className="text-xs text-gray-500 mt-1">
                        {timeformater(a.timestamp)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}