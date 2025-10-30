import React, { useState } from 'react';
import { Info, HelpCircle, X } from 'lucide-react';

const PRIORITIES = ['low', 'medium', 'high', 'urgent'];
const SEVERITIES = ['minor', 'major', 'critical', 'blocker'];

export const SLAFormDialog = ({ open, onClose, editing = false, formData, onUpdate, onSave, busy = false }) => {
  const [showHelp, setShowHelp] = useState(true);

  if (!open) return null;

  const updateField = (field, value) => {
    onUpdate(field, value);
  };

  const isValid = formData.name && formData.first_response_minutes && formData.resolution_minutes;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">
            {editing ? "Edit SLA Policy" : "Create New SLA Policy"}
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowHelp(!showHelp)}
              className="px-3 py-1 text-sm bg-blue-50 text-blue-700 rounded-full hover:bg-blue-100 flex items-center gap-1"
            >
              <Info size={14} />
              {showHelp ? "Hide Help" : "Show Help"}
            </button>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="space-y-6">
            {/* Info Banner */}
            {showHelp && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex gap-3">
                  <Info size={20} className="text-blue-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-blue-900 mb-1">What is an SLA?</h3>
                    <p className="text-sm text-blue-800">
                      A Service Level Agreement (SLA) defines response and resolution time commitments for tickets. 
                      Set base times, then optionally override them based on priority or severity levels.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Basic Information */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h3>
              <div className="space-y-4">
                {/* Name */}
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <label className="text-sm font-medium text-gray-700">Name *</label>
                    <div className="group relative">
                      <HelpCircle size={14} className="text-gray-400 cursor-help" />
                      <div className="absolute left-0 top-6 hidden group-hover:block w-64 bg-gray-900 text-white text-xs rounded p-2 z-10">
                        This name will be displayed when assigning SLAs to tickets
                      </div>
                    </div>
                  </div>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => updateField("name", e.target.value)}
                    placeholder="e.g., Standard Support SLA"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <p className="text-xs text-gray-500 mt-1">A descriptive name for this SLA policy</p>
                </div>

                {/* Slug */}
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <label className="text-sm font-medium text-gray-700">Slug</label>
                    <div className="group relative">
                      <HelpCircle size={14} className="text-gray-400 cursor-help" />
                      <div className="absolute left-0 top-6 hidden group-hover:block w-64 bg-gray-900 text-white text-xs rounded p-2 z-10">
                        Used for API calls and internal references. Must be unique within your organization
                      </div>
                    </div>
                  </div>
                  <input
                    type="text"
                    value={formData.slug}
                    onChange={(e) => updateField("slug", e.target.value)}
                    placeholder="e.g., standard-support"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <p className="text-xs text-gray-500 mt-1">Optional: A unique identifier (lowercase, hyphens allowed). Auto-generated if left blank</p>
                </div>

                {/* Description */}
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <label className="text-sm font-medium text-gray-700">Description</label>
                    <div className="group relative">
                      <HelpCircle size={14} className="text-gray-400 cursor-help" />
                      <div className="absolute left-0 top-6 hidden group-hover:block w-64 bg-gray-900 text-white text-xs rounded p-2 z-10">
                        Help team members understand when to apply this SLA
                      </div>
                    </div>
                  </div>
                  <textarea
                    value={formData.description}
                    onChange={(e) => updateField("description", e.target.value)}
                    placeholder="Describe when this SLA should be used..."
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <p className="text-xs text-gray-500 mt-1">Explain the purpose and use case for this SLA</p>
                </div>

                {/* Active Checkbox */}
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="active"
                    checked={!!formData.active}
                    onChange={(e) => updateField("active", e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="active" className="text-sm font-medium text-gray-700 flex items-center gap-1">
                    Active
                    <div className="group relative">
                      <HelpCircle size={14} className="text-gray-400 cursor-help" />
                      <div className="absolute left-0 top-6 hidden group-hover:block w-64 bg-gray-900 text-white text-xs rounded p-2 z-10">
                        Only active SLAs can be assigned to tickets
                      </div>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            <hr className="border-gray-200" />

            {/* Default Times */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Default Time Targets (in minutes)</h3>
              {showHelp && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                  <p className="text-xs text-blue-800">
                    <strong>First Response:</strong> Time to send initial reply to customer<br/>
                    <strong>Resolution:</strong> Time to fully resolve the ticket
                  </p>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <label className="text-sm font-medium text-gray-700">First Response Time *</label>
                    <div className="group relative">
                      <HelpCircle size={14} className="text-gray-400 cursor-help" />
                      <div className="absolute left-0 top-6 hidden group-hover:block w-64 bg-gray-900 text-white text-xs rounded p-2 z-10">
                        How quickly must an agent first respond to a new ticket?
                      </div>
                    </div>
                  </div>
                  <input
                    type="number"
                    min="1"
                    value={formData.first_response_minutes}
                    onChange={(e) => updateField("first_response_minutes", e.target.value)}
                    placeholder="60"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <p className="text-xs text-gray-500 mt-1">Minutes until first response required</p>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <label className="text-sm font-medium text-gray-700">Resolution Time *</label>
                    <div className="group relative">
                      <HelpCircle size={14} className="text-gray-400 cursor-help" />
                      <div className="absolute left-0 top-6 hidden group-hover:block w-64 bg-gray-900 text-white text-xs rounded p-2 z-10">
                        Maximum time allowed to completely resolve the ticket
                      </div>
                    </div>
                  </div>
                  <input
                    type="number"
                    min="1"
                    value={formData.resolution_minutes}
                    onChange={(e) => updateField("resolution_minutes", e.target.value)}
                    placeholder="480"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <p className="text-xs text-gray-500 mt-1">Minutes until ticket must be resolved</p>
                </div>
              </div>
            </div>

            <hr className="border-gray-200" />

            {/* Priority Overrides */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <h3 className="text-lg font-semibold text-gray-900">Priority-Based Resolution Overrides</h3>
                <div className="group relative">
                  <Info size={16} className="text-gray-400 cursor-help" />
                  <div className="absolute left-0 top-6 hidden group-hover:block w-80 bg-gray-900 text-white text-xs rounded p-2 z-10">
                    Override the default resolution time for specific priority levels
                  </div>
                </div>
              </div>
              {showHelp && (
                <p className="text-xs text-gray-600 mb-3">
                  Optional: Set different resolution times based on ticket priority. Leave blank to use default resolution time.
                </p>
              )}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {PRIORITIES.map((p) => (
                  <div key={p}>
                    <label className="text-sm font-medium text-gray-700 capitalize mb-1 block">{p}</label>
                    <input
                      type="number"
                      min="1"
                      value={formData.rules?.priority_map?.[p] ?? ""}
                      onChange={(e) => updateField("rules", { 
                        ...formData.rules, 
                        priority_map: { 
                          ...(formData.rules?.priority_map || {}), 
                          [p]: e.target.value ? Number(e.target.value) : undefined 
                        } 
                      })}
                      placeholder="Default"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    />
                  </div>
                ))}
              </div>
            </div>

            <hr className="border-gray-200" />

            {/* Severity Overrides */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <h3 className="text-lg font-semibold text-gray-900">Severity-Based Resolution Overrides</h3>
                <div className="group relative">
                  <Info size={16} className="text-gray-400 cursor-help" />
                  <div className="absolute left-0 top-6 hidden group-hover:block w-80 bg-gray-900 text-white text-xs rounded p-2 z-10">
                    Override the default resolution time for specific severity levels
                  </div>
                </div>
              </div>
              {showHelp && (
                <p className="text-xs text-gray-600 mb-3">
                  Optional: Set different resolution times based on ticket severity. Leave blank to use default resolution time.
                </p>
              )}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {SEVERITIES.map((s) => (
                  <div key={s}>
                    <label className="text-sm font-medium text-gray-700 capitalize mb-1 block">{s}</label>
                    <input
                      type="number"
                      min="1"
                      value={formData.rules?.severity_map?.[s] ?? ""}
                      onChange={(e) => updateField("rules", { 
                        ...formData.rules, 
                        severity_map: { 
                          ...(formData.rules?.severity_map || {}), 
                          [s]: e.target.value ? Number(e.target.value) : undefined 
                        } 
                      })}
                      placeholder="Default"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Reference */}
            {showHelp && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex gap-3">
                  <Info size={20} className="text-green-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-green-900 text-sm mb-1">Quick Reference:</h4>
                    <p className="text-xs text-green-800">
                      15 min • 30 min • 1 hour = 60 min • 2 hours = 120 min • 4 hours = 240 min • 8 hours = 480 min • 24 hours = 1440 min
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={busy}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={busy || !isValid}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy ? "Saving..." : editing ? "Save Changes" : "Create SLA"}
          </button>
        </div>
      </div>
    </div>
  );
};