import React, { useState, useEffect } from 'react';
import { Info, HelpCircle, X, Check, AlertCircle } from 'lucide-react';

const PRIORITIES = ['low', 'medium', 'high', 'urgent'];
const SEVERITIES = ['minor', 'major', 'critical', 'blocker'];

const clampMinutes = (val) => {
  const num = Number(val);
  if (!Number.isFinite(num) || num < 0) return null;
  return Math.round(num);
};

const TimeInput = ({ value, onChange, placeholder, error, showError }) => {
  const [unit, setUnit] = useState("hours");

  const toUnit = (mins) => {
    if (mins == null) return "";
    if (unit === "minutes") return mins;
    if (unit === "days") return mins / 1440;
    return mins / 60;
  };

  const fromUnit = (val) => {
    if (val === "") return null;
    const num = Number(val);
    if (!Number.isFinite(num) || num < 0) return null;

    if (unit === "minutes") return clampMinutes(num);
    if (unit === "days") return clampMinutes(num * 1440);
    return clampMinutes(num * 60);
  };

  return (
    <div className="space-y-1">
      <div className="flex gap-1.5">
        <input
          type="number"
          min="0"
          step="0.5"
          value={toUnit(value)}
          onChange={(e) => onChange(fromUnit(e.target.value))}
          placeholder={placeholder}
          className={`flex-1 px-2 py-1.5 text-sm border rounded focus:ring-1 focus:ring-blue-500 ${
            showError && error ? 'border-red-300 bg-red-50' : 'border-gray-300'
          }`}
        />
        <select
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
          className="px-2 py-1.5 text-sm border border-gray-300 rounded bg-white"
        >
          <option value="minutes">min</option>
          <option value="hours">hr</option>
          <option value="days">day</option>
        </select>
      </div>
      {showError && error && (
        <div className="flex items-center gap-1 text-xs text-red-600">
          <AlertCircle size={12} />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};

const OverrideTimeInputs = ({ type, values = {}, onChange, label, errors = {}, touchedFields = {} }) => {
  const items = type === 'priority' ? PRIORITIES : SEVERITIES;
  
  return (
    <div className="space-y-2">
      {items.map((item) => {
        const fieldKey = `${type}_${item}`;
        const showError = touchedFields[fieldKey];
        
        return (
          <div key={item} className="flex items-center gap-3">
            <div className="w-20 flex-shrink-0">
              <span className="text-xs font-medium text-gray-700 capitalize flex items-center gap-1">
                {item}
                {values?.[item] && !errors[item] && <Check size={10} className="text-green-600" />}
                {showError && errors[item] && <AlertCircle size={10} className="text-red-600" />}
              </span>
            </div>
            <div className="flex-1">
              <TimeInput
                value={values?.[item] ?? null}
                onChange={(val) => {
                  const newValues = { ...values };
                  if (val) {
                    newValues[item] = val;
                  } else {
                    delete newValues[item];
                  }
                  onChange(newValues);
                }}
                placeholder="Default"
                error={errors[item]}
                showError={showError}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};

export const SLAFormDialog = ({ 
  open, 
  onClose, 
  editing = false, 
  formData, 
  onUpdate, 
  onSave, 
  busy = false,
  serverError = null
}) => {
  const [showHelp, setShowHelp] = useState(false);
  const [touchedFields, setTouchedFields] = useState({});
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);

  // Reset touched state when dialog opens/closes
  useEffect(() => {
    if (open) {
      setTouchedFields({});
      setAttemptedSubmit(false);
    }
  }, [open]);

  if (!open) return null;

  const updateField = (field, value) => {
    // Mark this specific field as touched
    setTouchedFields(prev => ({ ...prev, [field]: true }));
    onUpdate(field, value);
  };

  const isPositive = (n) => Number.isFinite(n) && n > 0;

  // Calculate all validation errors
  const getErrors = () => {
    const errors = {};
    const fr = formData.first_response_minutes;
    const res = formData.resolution_minutes;

    // Name validation
    if (!formData.name || formData.name.trim().length < 3) {
      errors.name = "Name must be at least 3 characters";
    }

    // First Response validation
    if (!isPositive(fr)) {
      errors.first_response = "First response time is required";
    }

    // Resolution validation
    if (!isPositive(res)) {
      errors.resolution = "Resolution time is required";
    } else if (fr && res < fr) {
      errors.resolution = "Must be greater than or equal to first response time";
    }

    // Priority overrides validation (these override final resolution time only)
    const priorityMap = formData.rules?.priority_map || {};
    errors.priority_overrides = {};
    for (const [key, val] of Object.entries(priorityMap)) {
      if (!isPositive(val)) {
        errors.priority_overrides[key] = "Must be a positive number";
      }
    }

    // Severity overrides validation (these override final resolution time only)
    const severityMap = formData.rules?.severity_map || {};
    errors.severity_overrides = {};
    for (const [key, val] of Object.entries(severityMap)) {
      if (!isPositive(val)) {
        errors.severity_overrides[key] = "Must be a positive number";
      }
    }

    return errors;
  };

  const errors = getErrors();
  const hasValidationErrors = !!(
    errors.name ||
    errors.first_response ||
    errors.resolution ||
    Object.keys(errors.priority_overrides || {}).length > 0 ||
    Object.keys(errors.severity_overrides || {}).length > 0
  );

  const isValid = !hasValidationErrors;

  // Get error summary for display (only count errors for touched fields or after submit attempt)
  const getErrorSummary = () => {
    if (!attemptedSubmit) return [];
    
    const issues = [];
    if (errors.name) issues.push("Name is invalid");
    if (errors.first_response) issues.push("First response time is missing");
    if (errors.resolution) issues.push("Resolution time is invalid");
    
    const priorityErrors = Object.keys(errors.priority_overrides || {}).length;
    if (priorityErrors > 0) issues.push(`${priorityErrors} priority override(s) invalid`);
    
    const severityErrors = Object.keys(errors.severity_overrides || {}).length;
    if (severityErrors > 0) issues.push(`${severityErrors} severity override(s) invalid`);
    
    return issues;
  };

  const handleSave = () => {
    setAttemptedSubmit(true);
    
    // Mark all fields as touched to show all errors
    if (!isValid) {
      const allFields = {
        name: true,
        first_response_minutes: true,
        resolution_minutes: true,
      };
      
      // Mark all priority overrides as touched
      PRIORITIES.forEach(p => {
        allFields[`priority_${p}`] = true;
      });
      
      // Mark all severity overrides as touched
      SEVERITIES.forEach(s => {
        allFields[`severity_${s}`] = true;
      });
      
      setTouchedFields(allFields);
      return;
    }
    
    if (busy || serverError) return;
    onSave();
  };

  const handleCancel = () => {
    // Always allow cancel - close the form
    onClose();
  };

  const errorSummary = getErrorSummary();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-3 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            {editing ? "Edit SLA Policy" : "Create New SLA Policy"}
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowHelp(!showHelp)}
              className="px-2.5 py-1 text-xs bg-blue-50 text-blue-700 rounded-full hover:bg-blue-100 flex items-center gap-1"
            >
              <Info size={12} />
              {showHelp ? "Hide Tips" : "Show Tips"}
            </button>
            {/* Remove X button from header - only allow Cancel button */}
          </div>
        </div>

        {/* Server Error Banner */}
        {serverError && (
          <div className="mx-6 mt-4 bg-red-50 border border-red-200 rounded-md p-3">
            <div className="flex gap-2">
              <AlertCircle size={16} className="text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-medium text-red-900 text-sm mb-1">Server Error</h3>
                <p className="text-xs text-red-800">{serverError}</p>
              </div>
              <button
                onClick={() => onUpdate('_clearServerError', true)}
                className="text-red-400 hover:text-red-600"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        )}

        {/* Validation Error Summary Banner */}
        {attemptedSubmit && errorSummary.length > 0 && !serverError && (
          <div className="mx-6 mt-4 bg-red-50 border border-red-200 rounded-md p-3">
            <div className="flex gap-2">
              <AlertCircle size={16} className="text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-medium text-red-900 text-sm mb-1">Please fix the following issues:</h3>
                <ul className="text-xs text-red-800 space-y-0.5">
                  {errorSummary.map((issue, idx) => (
                    <li key={idx}>• {issue}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-gray-200">
            {/* Left Panel */}
            <div className="px-6 py-4 space-y-5">
              {/* Info Banner */}
              {showHelp && (
                <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                  <div className="flex gap-2">
                    <Info size={16} className="text-blue-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <h3 className="font-medium text-blue-900 text-sm mb-0.5">What is an SLA?</h3>
                      <p className="text-xs text-blue-800">
                        Defines response and resolution time commitments. Set base times, then override by priority/severity.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Basic Information */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Basic Information</h3>
                <div className="space-y-3">
                  {/* Name */}
                  <div>
                    <label className="text-xs font-medium text-gray-700 flex items-center gap-1 mb-1">
                      Name *
                      {formData.name && !errors.name && <Check size={12} className="text-green-600" />}
                      {touchedFields.name && errors.name && <AlertCircle size={12} className="text-red-600" />}
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => updateField("name", e.target.value)}
                      placeholder="e.g., Standard Support SLA"
                      className={`w-full px-2 py-1.5 text-sm border rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent ${
                        touchedFields.name && errors.name ? 'border-red-300 bg-red-50' : 'border-gray-300'
                      }`}
                    />
                    {touchedFields.name && errors.name && (
                      <div className="flex items-center gap-1 text-xs text-red-600 mt-1">
                        <AlertCircle size={12} />
                        <span>{errors.name}</span>
                      </div>
                    )}
                  </div>

                  {/* Slug */}
                  <div>
                    <label className="text-xs font-medium text-gray-700 flex items-center gap-1 mb-1">
                      Slug
                      <div className="group relative">
                        <HelpCircle size={11} className="text-gray-400 cursor-help" />
                        <div className="absolute left-0 top-5 hidden group-hover:block w-52 bg-gray-900 text-white text-xs rounded p-2 z-10">
                          For API calls. Auto-generated if blank
                        </div>
                      </div>
                    </label>
                    <input
  type="text"
  value={formData.slug}
  onChange={(e) => {
    let cleaned = e.target.value.toLowerCase();

    // Allow a-z, 0-9 and hyphen
    cleaned = cleaned.replace(/[^a-z0-9-]/g, "");

    // Collapse multiple hyphens (safe during typing)
    cleaned = cleaned.replace(/--+/g, "-");

    updateField("slug", cleaned);
  }}
  onBlur={() => {
    // FINAL cleanup only when user leaves field
    let finalSlug = formData.slug || "";

    finalSlug = finalSlug
      .replace(/^-+/, "")   // remove leading -
      .replace(/-+$/, "");  // remove trailing -

    updateField("slug", finalSlug);
  }}
  placeholder="standard-support"
  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded
             focus:ring-1 focus:ring-blue-500 focus:border-transparent"
/>

                  </div>

                  {/* Description */}
                  <div>
                    <label className="text-xs font-medium text-gray-700 mb-1 block">Description</label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => updateField("description", e.target.value)}
                      placeholder="When should this SLA be used?"
                      rows={2}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  {/* Active Checkbox */}
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="active"
                      checked={!!formData.active}
                      onChange={(e) => updateField("active", e.target.checked)}
                      className="w-3.5 h-3.5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="active" className="text-xs font-medium text-gray-700 flex items-center gap-1">
                      Active
                      {formData.active && <Check size={12} className="text-green-600" />}
                    </label>
                  </div>
                </div>
              </div>

              <hr className="border-gray-200" />

              {/* Default Times */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Default Time Targets</h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-gray-700 flex items-center gap-1 mb-1">
                      First Response *
                      {formData.first_response_minutes && !errors.first_response && <Check size={12} className="text-green-600" />}
                      {touchedFields.first_response_minutes && errors.first_response && <AlertCircle size={12} className="text-red-600" />}
                    </label>
                    <TimeInput
                      value={formData.first_response_minutes}
                      onChange={(val) => updateField("first_response_minutes", val)}
                      placeholder="1"
                      error={errors.first_response}
                      showError={touchedFields.first_response_minutes}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-700 flex items-center gap-1 mb-1">
                      Resolution *
                      {formData.resolution_minutes && !errors.resolution && <Check size={12} className="text-green-600" />}
                      {touchedFields.resolution_minutes && errors.resolution && <AlertCircle size={12} className="text-red-600" />}
                    </label>
                    <TimeInput
                      value={formData.resolution_minutes}
                      onChange={(val) => updateField("resolution_minutes", val)}
                      placeholder="8"
                      error={errors.resolution}
                      showError={touchedFields.resolution_minutes}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Right Panel */}
            <div className="px-6 py-4 space-y-5">
              {/* Priority Overrides */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-900">Priority Overrides</h3>
                  <span className="text-xs text-gray-500">Optional</span>
                </div>
                {showHelp && (
                  <p className="text-xs text-gray-600 mb-3">
                    Override final resolution time for specific priorities. Leave blank to use default resolution time.
                  </p>
                )}
                <OverrideTimeInputs
                  type="priority"
                  values={formData.rules?.priority_map}
                  onChange={(newMap) => {
                    // Mark all priority fields as touched when any changes
                    const newTouched = {};
                    PRIORITIES.forEach(p => {
                      if (newMap[p] !== undefined) {
                        newTouched[`priority_${p}`] = true;
                      }
                    });
                    setTouchedFields(prev => ({ ...prev, ...newTouched }));
                    updateField("rules", { 
                      ...formData.rules, 
                      priority_map: newMap
                    });
                  }}
                  errors={errors.priority_overrides || {}}
                  touchedFields={touchedFields}
                />
              </div>

              <hr className="border-gray-200" />

              {/* Severity Overrides */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-900">Severity Overrides</h3>
                  <span className="text-xs text-gray-500">Optional</span>
                </div>
                {showHelp && (
                  <p className="text-xs text-gray-600 mb-3">
                    Override final resolution time for specific severities. Leave blank to use default resolution time.
                  </p>
                )}
                <OverrideTimeInputs
                  type="severity"
                  values={formData.rules?.severity_map}
                  onChange={(newMap) => {
                    // Mark all severity fields as touched when any changes
                    const newTouched = {};
                    SEVERITIES.forEach(s => {
                      if (newMap[s] !== undefined) {
                        newTouched[`severity_${s}`] = true;
                      }
                    });
                    setTouchedFields(prev => ({ ...prev, ...newTouched }));
                    updateField("rules", { 
                      ...formData.rules, 
                      severity_map: newMap
                    });
                  }}
                  errors={errors.severity_overrides || {}}
                  touchedFields={touchedFields}
                />
              </div>

              {showHelp && (
                <div className="bg-green-50 border border-green-200 rounded-md p-3 mt-4">
                  <div className="flex gap-2">
                    <Info size={16} className="text-green-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-green-900 text-xs mb-0.5">Quick Reference:</h4>
                      <p className="text-xs text-green-800">
                        15 min • 30 min • 1 hr = 60 min • 4 hr = 240 min • 8 hr = 480 min • 1 day = 1440 min
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-200 flex justify-between items-center">
          <div className="flex-1">
            {attemptedSubmit && (hasValidationErrors || serverError) && (
              <div className="flex items-center gap-1.5 text-xs text-red-600">
                <AlertCircle size={14} />
                <span>
                  {serverError 
                    ? "Server error - please check the message above" 
                    : `Please fix ${errorSummary.length} issue(s) to continue`
                  }
                </span>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCancel}
              disabled={busy}
              className="px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={busy || !isValid || !!serverError}
              className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              {busy ? "Saving..." : (
                <>
                  {editing ? "Save Changes" : "Create SLA"}
                  {isValid && !serverError && <Check size={14} />}
                </> 
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};