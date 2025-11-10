// components/tickets/TicketTemplateForm.jsx
"use client";
import { useEffect, useState, useMemo } from "react";
import {
  Plus, Clock, CheckCircle, AlertCircle, Edit, Tag, Flag,
  ChevronLeft, ChevronRight, RefreshCw, Save, X, Key, Code, Settings,
  Eye, Copy, Check
} from "lucide-react";
import dynamic from "next/dynamic";
import "react-quill-new/dist/quill.snow.css";

import GroupSelect from "./GroupSelect";
import TagMultiSelect from "./TagMultiSelect";
import { CategorySelector } from "./CategorySelector";
import { useSLA } from "@/providers/slaProvider";
import { useTags } from "@/providers/postGresPorviders/TagProvider";
import SupportTeamModel from "@/models/postGresModels/supportTeamModel";
import TeamSelect from "./TeamMultiSelect";
import { useUser } from "@/providers/postGresPorviders/UserProvider";
import { useTicketTemplate } from "@/providers/postGresPorviders/ticketTemplateProvider";

const ReactQuill = dynamic(() => import("react-quill-new"), { ssr: false });

const formatMinutes = (minutes) => {
  if (!minutes) return "";
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  return `${Math.floor(minutes / 1440)}d ${Math.floor((minutes % 1440) / 60)}h`;
};

export default function TicketTemplateForm({
  open,
  onClose,
  onSuccess,
  initial,
  orgId,
  currentUserId,
  title = "Create Ticket Template",
}) {
  const [activeStep, setActiveStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [createdApiKey, setCreatedApiKey] = useState(null);
  const [copied, setCopied] = useState(false);
  const [teamMembers, setTeamMembers] = useState([]);
  const [loadingTeamMembers, setLoadingTeamMembers] = useState(false);

  // Providers
  const { slasByOrg, listSLAs } = useSLA();
  const { getCachedTags, list: listTags } = useTags();
  const { create, previewTemplate } = useTicketTemplate();
  const { getUsersByIds } = useUser();

  // Load data on mount
  useEffect(() => {
    if (!orgId) return;
    Promise.all([
      listSLAs(orgId),
      listTags({ orgId }),
    ]).catch(console.error);
  }, [orgId, listSLAs, listTags]);

  const [form, setForm] = useState(() => ({
    name: initial?.name || "",
    description: initial?.description || "",
    subjectTemplate: initial?.subjectTemplate || "",
    descriptionTemplate: initial?.descriptionTemplate || "",
    defaultPriority: initial?.defaultPriority || "normal",
    defaultSeverity: initial?.defaultSeverity || "sev4",
    defaultStatus: initial?.defaultStatus || "new",
    defaultGroupId: initial?.defaultGroupId || "",
    defaultTeamId: initial?.defaultTeamId || "",
    defaultAgentId: initial?.defaultAgentId || "",
    defaultAssigneeId: initial?.defaultAssigneeId || "",
    defaultCategoryId: initial?.defaultCategoryId || "",
    defaultSubcategoryId: initial?.defaultSubcategoryId || "",
    defaultProductId: initial?.defaultProductId || "",
    defaultFeatureId: initial?.defaultFeatureId || "",
    defaultImpactId: initial?.defaultImpactId || "",
    defaultSlaId: initial?.defaultSlaId || "",
    defaultTagIds: initial?.defaultTagIds || [],
    defaultCustomFields: initial?.defaultCustomFields || {},
    allowedVariables: initial?.allowedVariables || [],
    validationRules: initial?.validationRules || {},
    isActive: initial?.isActive !== undefined ? initial.isActive : true,
    // Variable form
    newVariableName: "",
    newVariableRequired: false,
    newVariableType: "text",
    newVariableMinLength: "",
    newVariableMaxLength: "",
    // Preview
    previewVariables: {},
  }));

  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  // Fetch team members when teamId changes
  useEffect(() => {
    let mounted = true;
    let abortController = new AbortController();
    
    (async () => {
      if (!form.defaultTeamId) {
        if (mounted) {
          setTeamMembers([]);
          setLoadingTeamMembers(false);
        }
        return;
      }

      setLoadingTeamMembers(true);
      try {
        const members = await SupportTeamModel.listMembers(form.defaultTeamId);
        const ids = (members || []).map((m) => m.user_id ?? m.userId ?? m.uid).filter(Boolean);
        
        if (!ids.length) {
          if (mounted && !abortController.signal.aborted) {
            setTeamMembers([]);
            setLoadingTeamMembers(false);
          }
          return;
        }
        
        const profiles = await getUsersByIds(ids);
        const normalized = profiles.map((u) => ({
          userId: u.user_id ?? u.userId ?? u.uid,
          displayName:
            u.display_name ??
            u.displayName ??
            u.full_name ??
            u.name ??
            u.email ??
            (u.user_id ?? u.userId ?? u.uid),
          email: u.email,
        }));
        
        if (mounted && !abortController.signal.aborted) {
          setTeamMembers(normalized);
          setLoadingTeamMembers(false);
        }
      } catch (err) {
        console.error("Failed to fetch team members:", err);
        if (mounted && !abortController.signal.aborted) {
          setTeamMembers([]);
          setLoadingTeamMembers(false);
        }
      }
    })();
    
    return () => {
      mounted = false;
      abortController.abort();
    };
  }, [form.defaultTeamId, getUsersByIds]);

  const availableSLAOptions = (slasByOrg?.[orgId] || []).filter((sla) => sla.active);
  const availableTagOptions = getCachedTags(orgId) || [];
  const selectedSLA = availableSLAOptions.find((s) => s.sla_id === form.defaultSlaId);

  // Add variable to allowed list
  const addVariable = () => {
    const varName = form.newVariableName.trim();
    if (!varName) return;
    
    if (form.allowedVariables.includes(varName)) {
      alert("Variable already exists");
      return;
    }

    const rules = {};
    if (form.newVariableRequired) rules.required = true;
    if (form.newVariableType !== "text") rules.type = form.newVariableType;
    if (form.newVariableMinLength) rules.min_length = parseInt(form.newVariableMinLength);
    if (form.newVariableMaxLength) rules.max_length = parseInt(form.newVariableMaxLength);

    setForm((f) => ({
      ...f,
      allowedVariables: [...f.allowedVariables, varName],
      validationRules: Object.keys(rules).length > 0 ? { ...f.validationRules, [varName]: rules } : f.validationRules,
      newVariableName: "",
      newVariableRequired: false,
      newVariableType: "text",
      newVariableMinLength: "",
      newVariableMaxLength: "",
    }));
  };

  // Remove variable
  const removeVariable = (varName) => {
    setForm((f) => {
      const newRules = { ...f.validationRules };
      delete newRules[varName];
      return {
        ...f,
        allowedVariables: f.allowedVariables.filter((v) => v !== varName),
        validationRules: newRules,
      };
    });
  };

  // Preview template with test variables
  const preview = useMemo(() => {
    return previewTemplate(
      {
        subjectTemplate: form.subjectTemplate,
        descriptionTemplate: form.descriptionTemplate,
      },
      form.previewVariables
    );
  }, [form.subjectTemplate, form.descriptionTemplate, form.previewVariables, previewTemplate]);

  // Validation
  const validations = {
    basic: form.name.trim().length > 0 && form.subjectTemplate.trim().length > 0,
    variables: true, // Variables are optional
    defaults: true, // Defaults are optional
    advanced: true,
  };
  
  const stepValidation = [
    validations.basic,
    validations.variables,
    validations.defaults,
    validations.advanced,
  ];
  
  const canProceed = (step) => stepValidation[step];
  const canSubmit = Object.values(validations).every(Boolean);

  const handleSubmit = async () => {
    if (!canSubmit) return;

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        subjectTemplate: form.subjectTemplate.trim(),
        descriptionTemplate: form.descriptionTemplate.trim() || null,
        defaultStatus: form.defaultStatus,
        defaultPriority: form.defaultPriority,
        defaultSeverity: form.defaultSeverity,
        defaultGroupId: form.defaultGroupId || null,
        defaultTeamId: form.defaultTeamId || null,
        defaultAgentId: form.defaultAgentId || null,
        defaultAssigneeId: form.defaultAssigneeId || null,
        defaultCategoryId: form.defaultCategoryId || null,
        defaultSubcategoryId: form.defaultSubcategoryId || null,
        defaultProductId: form.defaultProductId || null,
        defaultFeatureId: form.defaultFeatureId || null,
        defaultImpactId: form.defaultImpactId || null,
        defaultSlaId: form.defaultSlaId || null,
        defaultTagIds: form.defaultTagIds,
        defaultCustomFields: form.defaultCustomFields,
        allowedVariables: form.allowedVariables,
        validationRules: form.validationRules,
        isActive: form.isActive,
        userId:currentUserId,
        orgId:orgId
      };

      console.log("Creating template:", payload);
      const created = await create(payload);
      
      // Show API key
      setCreatedApiKey(created.apiKey);
      
      if (onSuccess) onSuccess(created);
    } catch (error) {
      console.error("Failed to create template:", error);
      alert("Failed to create template: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCopyApiKey = () => {
    if (createdApiKey) {
      navigator.clipboard.writeText(createdApiKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClose = () => {
    setCreatedApiKey(null);
    setCopied(false);
    setActiveStep(0);
    setForm({
      name: "",
      description: "",
      subjectTemplate: "",
      descriptionTemplate: "",
      defaultPriority: "normal",
      defaultSeverity: "sev4",
      defaultStatus: "new",
      defaultGroupId: "",
      defaultTeamId: "",
      defaultAgentId: "",
      defaultAssigneeId: "",
      defaultCategoryId: "",
      defaultSubcategoryId: "",
      defaultProductId: "",
      defaultFeatureId: "",
      defaultImpactId: "",
      defaultSlaId: "",
      defaultTagIds: [],
      defaultCustomFields: {},
      allowedVariables: [],
      validationRules: {},
      isActive: true,
      newVariableName: "",
      newVariableRequired: false,
      newVariableType: "text",
      newVariableMinLength: "",
      newVariableMaxLength: "",
      previewVariables: {},
    });
    onClose?.();
  };

  const steps = [
    { label: "Basic Information", icon: Edit, description: "Template name and structure" },
    { label: "Variables", icon: Code, description: "Define template variables" },
    { label: "Default Values", icon: Settings, description: "Set default ticket properties" },
    { label: "Preview & Create", icon: Eye, description: "Review and generate API key" },
  ];

  const handleNext = () => {
    if (activeStep < steps.length - 1) {
      setActiveStep((s) => s + 1);
    }
  };

  const handleBack = () => {
    if (activeStep > 0) {
      setActiveStep((s) => s - 1);
    }
  };

  const renderStepContent = (step) => {
    switch (step) {
      case 0:
        return (
          <div className="space-y-6">
            <div className="bg-white dark:bg-[#242428] border border-gray-200 dark:border-gray-700 rounded-lg p-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                    Template Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => update("name", e.target.value)}
                    placeholder="e.g., Customer Bug Report, Server Alert"
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-[#1A1A1E] dark:border-gray-700 dark:text-white ${
                      !validations.basic && form.name ? "border-red-300" : "border-gray-300"
                    }`}
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                    Description
                  </label>
                  <textarea
                    value={form.description}
                    onChange={(e) => update("description", e.target.value)}
                    placeholder="What is this template for? When should it be used?"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-[#1A1A1E] dark:text-white"
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                    Subject Template <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.subjectTemplate}
                    onChange={(e) => update("subjectTemplate", e.target.value)}
                    placeholder="Bug: {{issue_title}} from {{customer_name}}"
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-[#1A1A1E] dark:border-gray-700 dark:text-white ${
                      !validations.basic && form.subjectTemplate ? "border-red-300" : "border-gray-300"
                    }`}
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Use {`{{variable_name}}`} for dynamic values
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                    Description Template
                  </label>
                  <div className="border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-[#1A1A1E] focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent">
                    <ReactQuill
                      theme="snow"
                      value={form.descriptionTemplate}
                      onChange={(html) => update("descriptionTemplate", html)}
                      placeholder="Customer: {{customer_name}}\nEmail: {{customer_email}}\n\nIssue:\n{{description}}"
                      modules={{
                        toolbar: [
                          [{ header: [1, 2, 3, false] }],
                          ["bold", "italic", "underline"],
                          [{ list: "ordered" }, { list: "bullet" }],
                          ["code-block"],
                          ["clean"],
                        ],
                      }}
                      style={{ minHeight: 150 }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Variables work here too: {`{{variable_name}}`}
                  </p>
                </div>
              </div>
            </div>
          </div>
        );

      case 1:
        return (
          <div className="space-y-6">
            <div className="bg-white dark:bg-[#242428] border border-gray-200 dark:border-gray-700 rounded-lg p-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-200">
                    Template Variables
                  </h3>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    Define variables that can be passed when creating tickets
                  </span>
                </div>

                {/* Add Variable Form */}
                <div className="p-4 bg-gray-50 dark:bg-[#1A1A1E] rounded-lg border border-gray-200 dark:border-gray-700">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                        Variable Name
                      </label>
                      <input
                        type="text"
                        value={form.newVariableName}
                        onChange={(e) => update("newVariableName", e.target.value.replace(/\s+/g, "_"))}
                        placeholder="customer_email"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-[#242428] dark:text-white"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                        Type
                      </label>
                      <select
                        value={form.newVariableType}
                        onChange={(e) => update("newVariableType", e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-[#242428] dark:text-white"
                      >
                        <option value="text">Text</option>
                        <option value="email">Email</option>
                        <option value="number">Number</option>
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                        Min Length
                      </label>
                      <input
                        type="number"
                        value={form.newVariableMinLength}
                        onChange={(e) => update("newVariableMinLength", e.target.value)}
                        placeholder="Optional"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-[#242428] dark:text-white"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                        Max Length
                      </label>
                      <input
                        type="number"
                        value={form.newVariableMaxLength}
                        onChange={(e) => update("newVariableMaxLength", e.target.value)}
                        placeholder="Optional"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-[#242428] dark:text-white"
                      />
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between">
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={form.newVariableRequired}
                        onChange={(e) => update("newVariableRequired", e.target.checked)}
                        className="rounded border-gray-300"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-200">Required</span>
                    </label>

                    <button
                      onClick={addVariable}
                      disabled={!form.newVariableName}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                    >
                      <Plus className="h-4 w-4" />
                      <span>Add Variable</span>
                    </button>
                  </div>
                </div>

                {/* Variables List */}
                {form.allowedVariables.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-200">
                      Defined Variables ({form.allowedVariables.length})
                    </h4>
                    <div className="space-y-2">
                      {form.allowedVariables.map((varName) => {
                        const rules = form.validationRules[varName] || {};
                        return (
                          <div
                            key={varName}
                            className="flex items-center justify-between p-3 bg-white dark:bg-[#1A1A1E] border border-gray-200 dark:border-gray-700 rounded-lg"
                          >
                            <div className="flex-1">
                              <code className="text-sm text-blue-600 dark:text-blue-400">
                                {`{{${varName}}}`}
                              </code>
                              <div className="flex flex-wrap gap-2 mt-1">
                                {rules.required && (
                                  <span className="text-xs px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400 rounded">
                                    Required
                                  </span>
                                )}
                                {rules.type && (
                                  <span className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400 rounded">
                                    {rules.type}
                                  </span>
                                )}
                                {rules.min_length && (
                                  <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-400 rounded">
                                    min: {rules.min_length}
                                  </span>
                                )}
                                {rules.max_length && (
                                  <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-400 rounded">
                                    max: {rules.max_length}
                                  </span>
                                )}
                              </div>
                            </div>
                            <button
                              onClick={() => removeVariable(varName)}
                              className="ml-4 p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {form.allowedVariables.length === 0 && (
                  <div className="p-4 text-center text-sm text-gray-500 dark:text-gray-400 border border-dashed border-gray-300 dark:border-gray-700 rounded-lg">
                    No variables defined. Variables are optional but recommended for dynamic tickets.
                  </div>
                )}
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div className="bg-white dark:bg-[#242428] border border-gray-200 dark:border-gray-700 rounded-lg p-6 space-y-6">
              <div>
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-4">
                  Default Ticket Properties
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                  These values will be used when creating tickets from this template (can be overridden via API)
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                    Default Status
                  </label>
                  <select
                    value={form.defaultStatus}
                    onChange={(e) => update("defaultStatus", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-[#1A1A1E] dark:text-white"
                  >
                    <option value="new">New</option>
                    <option value="open">Open</option>
                    <option value="pending">Pending</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                    Default Priority
                  </label>
                  <select
                    value={form.defaultPriority}
                    onChange={(e) => update("defaultPriority", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-[#1A1A1E] dark:text-white"
                  >
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                    <option value="blocker">Blocker</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                    Default Severity
                  </label>
                  <select
                    value={form.defaultSeverity}
                    onChange={(e) => update("defaultSeverity", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-[#1A1A1E] dark:text-white"
                  >
                    <option value="sev4">SEV4 (Low)</option>
                    <option value="sev3">SEV3 (Medium)</option>
                    <option value="sev2">SEV2 (High)</option>
                    <option value="sev1">SEV1 (Critical)</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                    Default SLA
                  </label>
                  <select
                    value={form.defaultSlaId}
                    onChange={(e) => update("defaultSlaId", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-[#1A1A1E] dark:text-white"
                  >
                    <option value="">No SLA</option>
                    {availableSLAOptions.map((sla) => (
                      <option key={sla.sla_id} value={sla.sla_id}>
                        {sla.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {selectedSLA && (
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-900 rounded-lg">
                  <div className="flex items-center space-x-2 mb-2">
                    <CheckCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    <span className="text-sm font-medium text-blue-900 dark:text-blue-200">
                      {selectedSLA.name}
                    </span>
                  </div>
                  <p className="text-xs text-blue-700 dark:text-blue-300">
                    {selectedSLA.description}
                  </p>
                </div>
              )}

              <div className="space-y-4">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-200">
                  Default Assignment (Optional)
                </h4>

                <GroupSelect
                  orgId={orgId}
                  value={form.defaultGroupId}
                  onChange={(v) => update("defaultGroupId", v)}
                  label="Default Group"
                />

                <TeamSelect
                  groupId={form.defaultGroupId || undefined}
                  value={form.defaultTeamId}
                  onChange={(teamId) => update("defaultTeamId", teamId)}
                  label="Default Team"
                  disabled={!form.defaultGroupId}
                />
              </div>

              <div className="space-y-4">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-200">
                  Default Tags
                </h4>
                <TagMultiSelect
                  orgId={orgId}
                  value={form.defaultTagIds}
                  onChange={(tagIds) => update("defaultTagIds", tagIds)}
                  label="Select default tags"
                  placeholder="Search tags..."
                />
              </div>

              <div className="space-y-4">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-200">
                  Default Classification
                </h4>
                <CategorySelector
                  orgId={orgId}
                  value={{
                    category: form.defaultCategoryId,
                    subcategory: form.defaultSubcategoryId,
                    product: form.defaultProductId,
                    featureId: form.defaultFeatureId,
                    impactId: form.defaultImpactId,
                  }}
                  onChange={(categoryId) => {
                    update("defaultCategoryId", categoryId);
                    if (categoryId !== form.defaultCategoryId) {
                      update("defaultSubcategoryId", "");
                    }
                  }}
                  onFeatureChange={(featureId) => update("defaultFeatureId", featureId)}
                  onImpactChange={(impactId) => update("defaultImpactId", impactId)}
                  onSubcategoryChange={(subcategoryId) => update("defaultSubcategoryId", subcategoryId)}
                  onProductChange={(productId) => update("defaultProductId", productId)}
                />
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            {/* Preview Section */}
            <div className="bg-white dark:bg-[#242428] border border-gray-200 dark:border-gray-700 rounded-lg p-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-200">
                    Template Preview
                  </h3>
                  <Eye className="h-5 w-5 text-gray-400" />
                </div>

                {form.allowedVariables.length > 0 && (
                  <div className="p-4 bg-gray-50 dark:bg-[#1A1A1E] rounded-lg border border-gray-200 dark:border-gray-700">
                    <p className="text-xs font-medium text-gray-700 dark:text-gray-200 mb-3">
                      Test Variables (for preview only)
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {form.allowedVariables.map((varName) => (
                        <div key={varName} className="space-y-1">
                          <label className="block text-xs text-gray-600 dark:text-gray-400">
                            {varName}
                          </label>
                          <input
                            type="text"
                            value={form.previewVariables[varName] || ""}
                            onChange={(e) =>
                              update("previewVariables", {
                                ...form.previewVariables,
                                [varName]: e.target.value,
                              })
                            }
                            placeholder={`Enter ${varName}...`}
                            className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-700 rounded focus:ring-1 focus:ring-blue-500 dark:bg-[#242428] dark:text-white"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-900 rounded-lg">
                    <p className="text-xs font-medium text-blue-900 dark:text-blue-200 mb-2">
                      Subject Preview:
                    </p>
                    <p className="text-sm text-blue-800 dark:text-blue-300">
                      {preview.subject || "(Empty subject)"}
                    </p>
                  </div>

                  {preview.description && (
                    <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-900 rounded-lg">
                      <p className="text-xs font-medium text-green-900 dark:text-green-200 mb-2">
                        Description Preview:
                      </p>
                      <div
                        className="text-sm text-green-800 dark:text-green-300 prose prose-sm max-w-none"
                        dangerouslySetInnerHTML={{ __html: preview.description }}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Template Summary */}
            <div className="bg-white dark:bg-[#242428] border border-gray-200 dark:border-gray-700 rounded-lg p-6">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-4">
                Template Summary
              </h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Name:</span>
                  <span className="font-medium text-gray-900 dark:text-white">{form.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Variables:</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {form.allowedVariables.length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Default Priority:</span>
                  <span className="font-medium text-gray-900 dark:text-white capitalize">
                    {form.defaultPriority}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Default Severity:</span>
                  <span className="font-medium text-gray-900 dark:text-white uppercase">
                    {form.defaultSeverity}
                  </span>
                </div>
                {form.defaultSlaId && (
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">SLA:</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {selectedSLA?.name || form.defaultSlaId}
                    </span>
                  </div>
                )}
                {form.defaultTagIds.length > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Default Tags:</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {form.defaultTagIds.length} tag{form.defaultTagIds.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Validation Warnings */}
            {!canSubmit && (
              <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-900 rounded-lg">
                <div className="flex items-start space-x-2">
                  <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-yellow-900 dark:text-yellow-200">
                      Cannot Create Template
                    </p>
                    <ul className="mt-1 text-xs text-yellow-700 dark:text-yellow-300 list-disc pl-5">
                      {!validations.basic && <li>Template name and subject are required</li>}
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  // API Key Display Modal
  if (createdApiKey) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-[#242428] rounded-2xl max-w-2xl w-full shadow-2xl border border-gray-200 dark:border-gray-700">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-full">
                <Key className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  Template Created Successfully!
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Save your API key - it will only be shown once
                </p>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-4">
            <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-900 rounded-lg">
              <div className="flex items-start space-x-2">
                <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-yellow-900 dark:text-yellow-200">
                    Important: Save This API Key
                  </p>
                  <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                    This is the only time you'll see this key. Store it securely - you'll need it to create tickets from this template.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                Your API Key:
              </label>
              <div className="flex items-center space-x-2">
                <code className="flex-1 p-3 bg-gray-100 dark:bg-[#1A1A1E] border border-gray-300 dark:border-gray-700 rounded-lg text-sm font-mono text-gray-900 dark:text-white break-all">
                  {createdApiKey}
                </code>
                <button
                  onClick={handleCopyApiKey}
                  className="p-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  title="Copy to clipboard"
                >
                  {copied ? (
                    <Check className="h-5 w-5" />
                  ) : (
                    <Copy className="h-5 w-5" />
                  )}
                </button>
              </div>
              {copied && (
                <p className="text-xs text-green-600 dark:text-green-400">
                  ✓ Copied to clipboard!
                </p>
              )}
            </div>

            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-900 rounded-lg">
              <p className="text-xs font-medium text-blue-900 dark:text-blue-200 mb-2">
                Example Usage:
              </p>
              <pre className="text-xs text-blue-800 dark:text-blue-300 overflow-x-auto">
{`curl -X POST https://your-api.com/api/ticket-templates/create-ticket \\
  -H "X-API-Key: ${createdApiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "requester_id": "user_123",
    "variables": {
      "customer_name": "John Doe"
    }
  }'`}
              </pre>
            </div>
          </div>

          <div className="p-6 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={handleClose}
              className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Close and Continue
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-[#242428] rounded-2xl max-w-6xl w-full max-h-[95vh] overflow-hidden flex flex-col shadow-2xl border border-gray-200 dark:border-gray-700">
        {/* Header */}
        <div className="border-b border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">{title}</h2>
            <button
              onClick={handleClose}
              className="p-2 text-gray-400 hover:text-gray-600 dark:text-gray-300 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-4">
            <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400 mb-2">
              <span>Step {activeStep + 1} of {steps.length}</span>
              <span>{Math.round(((activeStep + 1) / steps.length) * 100)}% Complete</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${((activeStep + 1) / steps.length) * 100}%` }}
              />
            </div>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <div className="w-80 border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#1A1A1E] p-4 overflow-y-auto">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-4">Template Steps</h3>
            <div className="space-y-2">
              {steps.map((s, i) => {
                const Icon = s.icon;
                const isActive = i === activeStep;
                const canAccess = i <= activeStep;
                const ok = stepValidation[i];
                return (
                  <button
                    key={s.label}
                    onClick={() => canAccess && setActiveStep(i)}
                    disabled={!canAccess}
                    className={`w-full text-left p-3 rounded-xl border transition-colors ${
                      isActive
                        ? "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900/50 text-blue-900 dark:text-blue-200"
                        : canAccess
                        ? "bg-white dark:bg-[#242428] border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/60"
                        : "bg-gray-100 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed"
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div
                        className={`p-1 rounded ${
                          isActive
                            ? "bg-blue-100 dark:bg-blue-900/40"
                            : ok
                            ? "bg-green-100 dark:bg-green-900/30"
                            : "bg-gray-100 dark:bg-gray-800"
                        }`}
                      >
                        {ok && i < activeStep ? (
                          <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                        ) : (
                          <Icon
                            className={`h-4 w-4 ${
                              isActive
                                ? "text-blue-600 dark:text-blue-400"
                                : ok
                                ? "text-green-600 dark:text-green-400"
                                : "text-gray-400 dark:text-gray-500"
                            }`}
                          />
                        )}
                      </div>
                      <div>
                        <div className="text-sm font-medium">{s.label}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{s.description}</div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 p-6 overflow-y-auto">
            {renderStepContent(activeStep)}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600 dark:text-gray-300">
              {canSubmit ? "Ready to create template!" : "Complete required fields to continue"}
            </div>

            <div className="flex items-center space-x-3">
              <button
                onClick={handleBack}
                disabled={activeStep === 0}
                className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
                <span>Back</span>
              </button>

              {activeStep < steps.length - 1 ? (
                <button
                  onClick={handleNext}
                  disabled={!canProceed(activeStep)}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 transition-colors"
                >
                  <span>Next</span>
                  <ChevronRight className="h-4 w-4" />
                </button>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={saving || !canSubmit}
                  className="px-6 py-2 text-sm bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 min-w-[140px] transition-colors"
                >
                  {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  <span>{saving ? "Creating..." : "Create Template"}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}