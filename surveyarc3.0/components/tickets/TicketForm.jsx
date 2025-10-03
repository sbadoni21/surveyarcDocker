"use client";
import { useEffect, useMemo, useState } from "react";
import {
  Plus, Clock, CheckCircle, AlertCircle, Edit, Clipboard, Tag, Flag,
  Upload, ChevronLeft, ChevronRight, RefreshCw, Save, Target, X
} from "lucide-react";
import dynamic from "next/dynamic";
import "react-quill-new/dist/quill.snow.css";

import AssigneeSelect from "./AssigneeSelect";
import GroupSelect from "./GroupSelect";
import CollaboratorsSelect from "./CollaboratorsSelect";
import TagMultiSelect from "./TagMultiSelect";
import { CategorySelector } from "./CategorySelector";

import { useSLA } from "@/providers/slaProvider";
import { useTags } from "@/providers/postGresPorviders/TagProvider";
import AttachmentModel from "@/models/postGresModels/attachmentModel";
import { TicketFileUpload } from "../common/FileUpload";
import { useTicketCategories } from "@/providers/postGresPorviders/TicketCategoryProvider";
import SupportTeamModel from "@/models/postGresModels/supportTeamModel";
import TeamSelect from "./TeamMultiSelect";
import AgentSelect from "./AgentMultiSelect";
import { useUser } from "@/providers/postGresPorviders/UserProvider";

const ReactQuill = dynamic(() => import("react-quill-new"), { ssr: false });

const formatMinutes = (minutes) => {
  if (!minutes) return "";
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  return `${Math.floor(minutes / 1440)}d ${Math.floor((minutes % 1440) / 60)}h`;
};

export default function TicketForm({
  open,
  onClose,
  onSubmit,
  initial,
  orgId,
  requestorId,
  currentUserId,
  title = "New Ticket",
}) {
  const [activeStep, setActiveStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [stagedUploads, setStagedUploads] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [loadingTeamMembers, setLoadingTeamMembers] = useState(false);

  // Providers
  const { slasByOrg, listSLAs } = useSLA();
  const { getCachedTags, list: listTags } = useTags();
  const { listCategories, listProducts } = useTicketCategories();
  const { getUsersByIds } = useUser();

  // Load data on mount
  useEffect(() => {
    if (!orgId) return;
    Promise.all([
      listSLAs(orgId),
      listTags({ orgId }),
      listCategories(orgId),
      listProducts(orgId),
    ]).catch(console.error);
  }, [orgId, listSLAs, listTags, listCategories, listProducts]);

  const [form, setForm] = useState(() => ({
    subject: initial?.subject || "",
    description: initial?.description || "",
    queueOwned: Boolean(!initial?.assigneeId && initial?.groupId),
    groupId: initial?.groupId || "",
    teamId: initial?.teamId || "",
    agentId: initial?.agentId || "",
    assigneeId: initial?.assigneeId || "",
    categoryId: initial?.categoryId || "",
    subcategoryId: initial?.subcategoryId || "",
    productId: initial?.productId || "",
    slaId: initial?.slaId || "",
    slaMode: "priority",
    priority: "normal",
    severity: "sev4",
    dueAt: initial?.dueAt || "",
    firstResponseDueAt: initial?.firstResponseDueAt || "",
    resolutionDueAt: initial?.resolutionDueAt || "",
    tagIds: Array.isArray(initial?.tags)
      ? initial.tags
          .map((t) => (typeof t === "string" ? t : t.tag_id ?? t.tagId))
          .filter(Boolean)
      : [],
    collaboratorIds: initial?.collaboratorIds || [],
  }));

  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const isQueueOwned = form.queueOwned === true;

  // Clear team and agent when group changes
  useEffect(() => {
    setForm((f) => ({ ...f, teamId: "", agentId: "" }));
  }, [form.groupId]);

  // Clear assignee if switching to queue-owned
  useEffect(() => {
    if (isQueueOwned && form.assigneeId) {
      setForm((f) => ({ ...f, assigneeId: "" }));
    }
  }, [isQueueOwned, form.assigneeId]);

  // Fetch team members when teamId changes
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!form.teamId) {
        if (mounted) {
          setTeamMembers([]);
          setLoadingTeamMembers(false);
        }
        return;
      }

      if (mounted) setLoadingTeamMembers(true);

      try {
        // Get team membership rows
        const members = await SupportTeamModel.listMembers(form.teamId);
        const ids = (members || [])
          .map((m) => m.user_id ?? m.userId ?? m.uid)
          .filter(Boolean);

        if (ids.length === 0) {
          if (mounted) {
            setTeamMembers([]);
            setLoadingTeamMembers(false);
          }
          return;
        }

        // Hydrate with user profiles
        const profiles = await getUsersByIds(ids);

        // Normalize for AgentSelect
        const normalized = profiles.map((u) => ({
          userId: u.user_id ?? u.userId ?? u.uid,
          displayName: u.display_name ?? u.displayName ?? u.full_name ?? u.name ?? u.email ?? (u.user_id ?? u.userId ?? u.uid),
          email: u.email,
        }));

        if (mounted) {
          setTeamMembers(normalized);
          setLoadingTeamMembers(false);
        }
      } catch (err) {
        console.error("Failed to fetch team members:", err);
        if (mounted) {
          setTeamMembers([]);
          setLoadingTeamMembers(false);
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, [form.teamId, getUsersByIds]);

  // SLA options filtered by group
  const availableSLAOptions = (slasByOrg?.[orgId] || []).filter((sla) => {
    if (!sla.active) return false;
    if (sla.rules?.applies_to?.group_id_in) {
      if (!form.groupId || !sla.rules.applies_to.group_id_in.includes(form.groupId)) {
        return false;
      }
    }
    return true;
  });

  const availableTagOptions = getCachedTags(orgId) || [];

  const selectedSLA = availableSLAOptions.find((s) => s.sla_id === form.slaId);
  const hasPriorityMap =
    selectedSLA?.rules?.priority_map && Object.keys(selectedSLA.rules.priority_map).length > 0;
  const hasSeverityMap =
    selectedSLA?.rules?.severity_map && Object.keys(selectedSLA.rules.severity_map).length > 0;

  const currentResolutionTime = useMemo(() => {
    if (!selectedSLA) return null;
    if (form.slaMode === "priority" && hasPriorityMap) {
      return selectedSLA.rules.priority_map[form.priority] || selectedSLA.resolution_minutes;
    }
    if (form.slaMode === "severity" && hasSeverityMap) {
      return selectedSLA.rules.severity_map[form.severity] || selectedSLA.resolution_minutes;
    }
    return selectedSLA.resolution_minutes;
  }, [selectedSLA, form.slaMode, form.priority, form.severity, hasPriorityMap, hasSeverityMap]);

  const firstResponseTime = selectedSLA?.first_response_minutes;

  // Helper to calculate SLA due dates
  const calculateDueDate = (minutes) => {
    if (!minutes) return null;
    const now = new Date();
    const due = new Date(now.getTime() + minutes * 60000);
    return due.toISOString();
  };

  // Calculate display dates for SLA targets
  const calculatedFirstResponseDue = useMemo(() => {
    if (!selectedSLA?.sla_id || !firstResponseTime) return null;
    const dueDate = calculateDueDate(firstResponseTime);
    console.log('First Response Due:', dueDate);
    return dueDate;
  }, [selectedSLA?.sla_id, firstResponseTime]);

  const calculatedResolutionDue = useMemo(() => {
    if (!selectedSLA?.sla_id || !currentResolutionTime) return null;
    const dueDate = calculateDueDate(currentResolutionTime);
    console.log('Resolution Due:', dueDate);
    return dueDate;
  }, [selectedSLA?.sla_id, currentResolutionTime]);

  // Auto-fill form fields with calculated dates
  useEffect(() => {
    if (calculatedFirstResponseDue) {
      setForm((f) => ({ ...f, firstResponseDueAt: calculatedFirstResponseDue }));
    }
    if (calculatedResolutionDue) {
      setForm((f) => ({ 
        ...f, 
        resolutionDueAt: calculatedResolutionDue,
        dueAt: calculatedResolutionDue // Also set main dueAt
      }));
    }
  }, [calculatedFirstResponseDue, calculatedResolutionDue]);

  // Validation
  const validations = {
    basic: form.subject.trim().length > 0,
    assignment: !isQueueOwned || (isQueueOwned && form.groupId.trim().length > 0),
    sla: !selectedSLA || (selectedSLA && (hasPriorityMap || hasSeverityMap || true)),
  };
  const stepValidation = [validations.basic, validations.assignment, true, true, true, true];
  const canProceed = (step) => stepValidation[step];
  const canSubmit = Object.values(validations).every(Boolean);

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const knownSlaIds = new Set((availableSLAOptions || []).map((s) => s?.sla_id));
      const safeSlaId = form.slaId && knownSlaIds.has(form.slaId) ? form.slaId : null;

      const payload = {
        orgId,
        requesterId: requestorId,
        subject: form.subject.trim(),
        description: form.description || "",
        priority: form.priority,
        severity: form.severity,
        groupId: form.groupId || null,
        teamId: form.teamId || null,
        agentId: form.agentId || null,
        assigneeId: isQueueOwned ? null : form.assigneeId || null,
        categoryId: form.categoryId || null,
        subcategoryId: form.subcategoryId || null,
        productId: form.productId || null,
        slaId: safeSlaId,
        sla_processing: safeSlaId ? {
          sla_mode: form.slaMode,
          calendar_id: selectedSLA?.calendar_id || null,
          first_response_due_at: calculatedFirstResponseDue,
          resolution_due_at: calculatedResolutionDue,
        } : null,
        dueAt: calculatedResolutionDue || (form.dueAt && form.dueAt.trim()) || null,
        firstResponseDueAt: calculatedFirstResponseDue || null,
        resolutionDueAt: calculatedResolutionDue || null,
        slaMode: form.slaMode,
        tags: form.tagIds?.length ? form.tagIds : undefined,
        collaboratorIds: form.collaboratorIds || [],
      };

      console.log('=== SUBMITTING TICKET ===');
      console.log('SLA ID:', safeSlaId);
      console.log('Selected SLA Object:', selectedSLA);
      console.log('SLA Mode:', form.slaMode);
      console.log('Priority:', form.priority);
      console.log('Severity:', form.severity);
      console.log('First Response Time (minutes):', firstResponseTime);
      console.log('Current Resolution Time (minutes):', currentResolutionTime);
      console.log('Calculated First Response Due:', calculatedFirstResponseDue);
      console.log('Calculated Resolution Due:', calculatedResolutionDue);
      console.log('Has Priority Map:', hasPriorityMap);
      console.log('Has Severity Map:', hasSeverityMap);
      if (selectedSLA?.rules?.severity_map) {
        console.log('Severity Map:', selectedSLA.rules.severity_map);
      }
      if (selectedSLA?.rules?.priority_map) {
        console.log('Priority Map:', selectedSLA.rules.priority_map);
      }
      console.log('Full Payload:', JSON.stringify(payload, null, 2));
      console.log('========================');

      const created = await onSubmit(payload);
      const ticketId = created?.ticketId ?? created?.ticket_id;

      // Adopt staged uploads
      if (ticketId && stagedUploads.length) {
        await Promise.all(
          stagedUploads.map(async (u) => {
            if (u?.attachmentRecord) return;
            await AttachmentModel.create(ticketId, {
              ticketId,
              filename: u.filename,
              contentType: u.contentType,
              sizeBytes: u.sizeBytes,
              storageKey: u.storageKey,
              url: u.downloadURL,
              uploadedBy: currentUserId,
            });
          })
        );
      }

      onClose?.();
      setForm({
        subject: "",
        description: "",
        queueOwned: false,
        groupId: "",
        teamId: "",
        agentId: "",
        assigneeId: "",
        categoryId: "",
        subcategoryId: "",
        productId: "",
        slaId: "",
        slaMode: "priority",
        priority: "normal",
        severity: "sev4",
        dueAt: "",
        firstResponseDueAt: "",
        resolutionDueAt: "",
        tagIds: [],
        collaboratorIds: [],
      });
      setStagedUploads([]);
      setActiveStep(0);

      return created;
    } finally {
      setSaving(false);
    }
  };

  const steps = [
    { label: "Basic Information", icon: Edit, description: "Subject and description" },
    { label: "Assignment", icon: Clipboard, description: "Who will handle this ticket" },
    { label: "Classification", icon: Tag, description: "Categorize the issue" },
    { label: "SLA & Priority", icon: Flag, description: "Set response targets" },
    { label: "Attachments", icon: Upload, description: "Add supporting files" },
    { label: "Additional Options", icon: Plus, description: "Tags and collaborators" },
  ];

  const handleNext = () => {
    console.log(form)
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
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Subject <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.subject}
                  onChange={(e) => update("subject", e.target.value)}
                  placeholder="Brief description of the issue"
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    !validations.basic ? "border-red-300" : "border-gray-300"
                  }`}
                />
                {!validations.basic && (
                  <p className="text-sm text-red-600">Subject is required</p>
                )}
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Description</label>
                <div className="border border-gray-300 rounded-lg bg-white focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent">
                  <ReactQuill
                    theme="snow"
                    value={form.description}
                    onChange={(html) => update("description", html)}
                    placeholder="Details, steps to reproduce, expected vs actual…"
                    modules={{
                      toolbar: [
                        [{ header: [1, 2, 3, false] }],
                        ["bold", "italic", "underline", "strike"],
                        [{ list: "ordered" }],
                        [{ color: [] }, { background: [] }],
                        [{ align: [] }],
                        ["link", "code-block"],
                        ["clean"],
                      ],
                    }}
                    formats={[
                      "header",
                      "bold", "italic", "underline", "strike",
                      "list", "bullet",
                      "color", "background",
                      "align",
                      "link", "code-block",
                    ]}
                    style={{ minHeight: 200 }}
                  />
                </div>
              </div>
            </div>
          </div>
        );

      case 1:
        return (
          <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
            <label className="flex items-start space-x-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <input
                type="checkbox"
                checked={isQueueOwned}
                onChange={(e) => update("queueOwned", e.target.checked)}
                className="mt-1"
              />
              <div>
                <span className="text-sm font-medium text-gray-900">Queue Assignment</span>
                <p className="text-sm text-gray-600">
                  Assign to a group queue instead of a specific person
                </p>
              </div>
            </label>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <GroupSelect orgId={orgId} value={form.groupId} onChange={(v) => update("groupId", v)} />
              {!isQueueOwned ? (
                <AssigneeSelect
                  orgId={orgId}
                  groupId={form.groupId || undefined}
                  value={form.assigneeId}
                  onChange={(v) => update("assigneeId", v)}
                  label="Assignee"
                  placeholder={isQueueOwned ? "Will be auto-assigned from queue" : "Select assignee"}
                  disabled={isQueueOwned}
                />
              ) : null}
            </div>

            {!validations.assignment && (
              <div className="flex items-center space-x-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                <AlertCircle className="h-5 w-5 text-red-600" />
                <span className="text-sm text-red-800">
                  Group selection is required for queue-owned tickets.
                </span>
              </div>
            )}

            {!isQueueOwned ? (
              <div className="space-y-4">
                <h4 className="text-sm font-medium text-gray-900">Team Involvement (Optional)</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <TeamSelect
                    groupId={form.groupId || undefined}
                    value={form.teamId}
                    onChange={(teamId) => update("teamId", teamId)}
                    label="Team"
                    disabled={!form.groupId}
                  />
                  <AgentSelect
                    options={teamMembers}
                    value={form.agentId}
                    onChange={(agentId) => update("agentId", agentId)}
                    label="Additional Agent"
                    disabled={!form.teamId || loadingTeamMembers}
                    loading={loadingTeamMembers}
                    placeholder={form.teamId ? "Select an agent" : "Select a team first"}
                    helperText={
                      loadingTeamMembers 
                        ? "Loading team members..." 
                        : form.teamId && teamMembers.length === 0
                        ? "No members found in this team"
                        : form.teamId 
                        ? undefined 
                        : "Select a team first to see available members"
                    }
                  />
                </div>
              </div>
            ) : null}
          </div>
        );

      case 2:
        return (
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-gray-700">
                  Categorize the Issue
                </h3>
                <span className="text-xs text-gray-500">
                  Select category, subcategory, and affected product
                </span>
              </div>

              <CategorySelector
                orgId={orgId}
                value={{
                  category: form.categoryId,
                  subcategory: form.subcategoryId,
                  product: form.productId
                }}
                onChange={(categoryId) => {
                  update("categoryId", categoryId);
                  if (categoryId !== form.categoryId) {
                    update("subcategoryId", "");
                  }
                }}
                onSubcategoryChange={(subcategoryId) => update("subcategoryId", subcategoryId)}
                onProductChange={(productId) => update("productId", productId)}
              />

              {(form.categoryId || form.subcategoryId || form.productId) && (
                <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200">
                  <p className="text-xs font-medium text-gray-700 mb-2">Selected Classification:</p>
                  <div className="flex flex-wrap gap-2">
                    {form.categoryId && (
                      <span className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-800 text-sm font-medium rounded-full">
                        {form.categoryId}
                      </span>
                    )}
                    {form.subcategoryId && (
                      <span className="inline-flex items-center px-3 py-1 bg-green-100 text-green-800 text-sm font-medium rounded-full">
                        {form.subcategoryId}
                      </span>
                    )}
                    {form.productId && (
                      <span className="inline-flex items-center px-3 py-1 bg-purple-100 text-purple-800 text-sm font-medium rounded-full">
                        {form.productId}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        );

      case 3:
        return (
          <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Service Level Agreement</label>
              <select
                value={form.slaId}
                onChange={(e) => update("slaId", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">No SLA — Manual priority/severity only</option>
                {availableSLAOptions.map((sla) => (
                  <option key={sla.sla_id} value={sla.sla_id}>
                    {sla.name} — {sla.description}
                  </option>
                ))}
              </select>
            </div>

            {selectedSLA && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center space-x-2 mb-3">
                  <CheckCircle className="h-5 w-5 text-blue-600" />
                  <span className="text-sm font-medium text-blue-900">{selectedSLA.name} Selected</span>
                </div>

                <div className="flex flex-wrap gap-2 mb-3">
                  {firstResponseTime && (
                    <span className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                      <Clock className="h-3 w-3 mr-1" />
                      Response: {formatMinutes(firstResponseTime)}
                    </span>
                  )}
                  {selectedSLA.resolution_minutes && (
                    <span className="inline-flex items-center px-2 py-1 bg-orange-100 text-orange-800 text-xs rounded-full">
                      <Target className="h-3 w-3 mr-1" />
                      Base Resolution: {formatMinutes(selectedSLA.resolution_minutes)}
                    </span>
                  )}
                </div>

                {(hasPriorityMap || hasSeverityMap) && (
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">Resolution Time Calculation</label>
                    <div className="flex space-x-4">
                      <label className="flex items-center">
                        <input
                          type="radio"
                          value="priority"
                          checked={form.slaMode === "priority"}
                          onChange={(e) => update("slaMode", e.target.value)}
                          disabled={!hasPriorityMap}
                          className="mr-2"
                        />
                        <span className={`text-sm ${!hasPriorityMap ? "text-gray-400" : "text-gray-700"}`}>
                          Priority-based {!hasPriorityMap && "(not available)"}
                        </span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          value="severity"
                          checked={form.slaMode === "severity"}
                          onChange={(e) => update("slaMode", e.target.value)}
                          disabled={!hasSeverityMap}
                          className="mr-2"
                        />
                        <span className={`text-sm ${!hasSeverityMap ? "text-gray-400" : "text-gray-700"}`}>
                          Severity-based {!hasSeverityMap && "(not available)"}
                        </span>
                      </label>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {selectedSLA && form.slaMode === "priority" && hasPriorityMap ? (
                <div className="md:col-span-2 space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Priority</label>
                  <select
                    value={form.priority}
                    onChange={(e) => update("priority", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {Object.keys(selectedSLA.rules.priority_map || {}).map((p) => (
                      <option key={p} value={p}>
                        {p.charAt(0).toUpperCase() + p.slice(1)} — {formatMinutes(selectedSLA.rules.priority_map[p])}
                      </option>
                    ))}
                  </select>
                </div>
              ) : selectedSLA && form.slaMode === "severity" && hasSeverityMap ? (
                <div className="md:col-span-2 space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Severity</label>
                  <select
                    value={form.severity}
                    onChange={(e) => update("severity", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {Object.keys(selectedSLA.rules.severity_map || {}).map((s) => (
                      <option key={s} value={s}>
                        {s.toUpperCase()} — {formatMinutes(selectedSLA.rules.severity_map[s])}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">Priority</label>
                    <select
                      value={form.priority}
                      onChange={(e) => update("priority", e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      {["low", "normal", "high", "urgent", "blocker"].map((p) => (
                        <option key={p} value={p}>
                          {p.charAt(0).toUpperCase() + p.slice(1)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">Severity</label>
                    <select
                      value={form.severity}
                      onChange={(e) => update("severity", e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      {["sev4", "sev3", "sev2", "sev1"].map((s) => (
                        <option key={s} value={s}>
                          {s.toUpperCase()}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}
            </div>

            {selectedSLA && currentResolutionTime && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <h4 className="text-sm font-medium text-green-900 mb-3">Active SLA Targets</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {firstResponseTime && (
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="text-xs text-blue-600 font-medium">First Response</div>
                      <div className="text-lg font-bold text-blue-700">
                        {formatMinutes(firstResponseTime)}
                      </div>
                    </div>
                  )}
                  <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                    <div className="text-xs text-orange-600 font-medium">Resolution Target</div>
                    <div className="text-lg font-bold text-orange-700">
                      {formatMinutes(currentResolutionTime)}
                    </div>
                  </div>
                </div>

                {(calculatedFirstResponseDue || calculatedResolutionDue) && (
                  <div className="mt-3 pt-3 border-t border-green-300">
                    <h5 className="text-xs font-medium text-green-800 mb-2">Calculated Due Dates:</h5>
                    <div className="space-y-2 text-sm">
                      {calculatedFirstResponseDue && (
                        <div className="flex justify-between items-center">
                          <span className="text-gray-700">First Response Due:</span>
                          <span className="font-medium text-blue-700">
                            {new Date(calculatedFirstResponseDue).toLocaleString()}
                          </span>
                        </div>
                      )}
                      {calculatedResolutionDue && (
                        <div className="flex justify-between items-center">
                          <span className="text-gray-700">Resolution Due:</span>
                          <span className="font-medium text-orange-700">
                            {new Date(calculatedResolutionDue).toLocaleString()}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {selectedSLA && !currentResolutionTime && (
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-center space-x-2">
                  <AlertCircle className="h-5 w-5 text-yellow-600" />
                  <div>
                    <p className="text-sm font-medium text-yellow-900">SLA Configuration Issue</p>
                    <p className="text-xs text-yellow-700 mt-1">
                      The selected SLA doesn't have time targets configured for the current {form.slaMode} mode.
                      Due dates won't be automatically calculated.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Custom Due Date (Optional)</label>
              <input
                type="datetime-local"
                value={form.dueAt ? form.dueAt.slice(0, 16) : ""}
                onChange={(e) => update("dueAt", e.target.value ? `${e.target.value}:00Z` : "")}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500">
                Leave empty to use SLA-calculated dates, or set a custom due date to override
              </p>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
            <TicketFileUpload
              orgId={orgId}
              ticketId={null}
              currentUserId={currentUserId}
              onFilesUploaded={(uploaded) => {
                setStagedUploads((prev) => [...prev, ...uploaded]);
              }}
              maxFiles={10}
            />
            {stagedUploads.length > 0 && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
                  {stagedUploads.length} file{stagedUploads.length === 1 ? "" : "s"} ready to be attached
                </p>
              </div>
            )}
          </div>
        );

      case 5:
        return (
          <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-6">
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700">Tags</label>
              <TagMultiSelect
                orgId={orgId}
                value={form.tagIds}
                onChange={(tagIds) => update("tagIds", tagIds)}
                label="Select tags"
                placeholder="Search and select tags..."
              />
              <p className="text-sm text-gray-500">
                {availableTagOptions.length} tags available
              </p>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Collaborators</label>
              <CollaboratorsSelect
                orgId={orgId}
                value={form.collaboratorIds}
                onChange={(ids) => update("collaboratorIds", ids)}
              />
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-6xl w-full max-h-[95vh] overflow-hidden flex flex-col">
        <div className="border-b border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">{title}</h2>
            <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="mt-4">
            <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
              <span>Step {activeStep + 1} of {steps.length}</span>
              <span>{Math.round(((activeStep + 1) / steps.length) * 100)}% Complete</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${((activeStep + 1) / steps.length) * 100}%` }}
              />
            </div>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          <div className="w-80 border-r border-gray-200 bg-gray-50 p-4 overflow-y-auto">
            <h3 className="text-sm font-medium text-gray-700 mb-4">Form Steps</h3>
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
                    className={`w-full text-left p-3 rounded-lg border transition-colors ${
                      isActive
                        ? "bg-blue-50 border-blue-200 text-blue-900"
                        : canAccess
                        ? "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
                        : "bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed"
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className={`p-1 rounded ${isActive ? "bg-blue-100" : ok ? "bg-green-100" : "bg-gray-100"}`}>
                        {ok && i < activeStep ? (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        ) : (
                          <Icon className={`h-4 w-4 ${isActive ? "text-blue-600" : ok ? "text-green-600" : "text-gray-400"}`} />
                        )}
                      </div>
                      <div>
                        <div className="text-sm font-medium">{s.label}</div>
                        <div className="text-xs text-gray-500">{s.description}</div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex-1 p-6 overflow-y-auto">{renderStepContent(activeStep)}</div>
        </div>

        <div className="border-t border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              {canSubmit ? "Ready to create ticket!" : "Complete required fields to continue"}
              {stagedUploads.length > 0 && (
                <span className="ml-2 text-blue-600">
                  • {stagedUploads.length} staged file{stagedUploads.length === 1 ? "" : "s"} will be attached
                </span>
              )}
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={handleBack}
                disabled={activeStep === 0}
                className="px-4 py-2 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                <ChevronLeft className="h-4 w-4" />
                <span>Back</span>
              </button>

              {activeStep < steps.length - 1 ? (
                <button
                  onClick={handleNext}
                  disabled={!canProceed(activeStep)}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  <span>Next</span>
                  <ChevronRight className="h-4 w-4" />
                </button>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={saving || !canSubmit}
                  className="px-6 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 min-w-[120px]"
                >
                  {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  <span>{saving ? "Creating..." : "Create Ticket"}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}