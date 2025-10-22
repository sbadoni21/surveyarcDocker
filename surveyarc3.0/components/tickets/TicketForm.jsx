// components/tickets/TicketForm.jsx
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
import { useTicketTaxonomies } from "@/providers/postGresPorviders/TicketTaxonomyProvider";
import BizCalendarModel from "@/models/postGresModels/bizCalendarModel";
import BusinessCalendarPreview from "./BusinessCalendarPreview";

const ReactQuill = dynamic(() => import("react-quill-new"), { ssr: false });

const formatMinutes = (minutes) => {
  if (!minutes) return "";
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  return `${Math.floor(minutes / 1440)}d ${Math.floor((minutes % 1440) / 60)}h`;
};

/* ----------------------- calendar helpers (safe & normalized) ----------------------- */

// normalize BE calendar -> FE shape we expect
// BE: hours: [{weekday, start_min, end_min}], holidays: [{date_iso, name}]
const normalizeCalendar = (raw) => {
  if (!raw) return null;
  const hours = Array.isArray(raw.hours)
    ? raw.hours.map(h => ({
        weekday: typeof h.weekday === "number" ? h.weekday : h.day,
        startMin: typeof h.start_min === "number" ? h.start_min : (h.startMin ?? 0),
        endMin: typeof h.end_min === "number" ? h.end_min : (h.endMin ?? 0),
      }))
    : [];
  const holidays = Array.isArray(raw.holidays)
    ? raw.holidays.map(h => ({ dateIso: h.date_iso ?? h.dateIso, name: h.name }))
    : [];

  return {
    calendarId: raw.calendar_id ?? raw.calendarId ?? raw.id ?? null,
    name: raw.name,
    timezone: raw.timezone ?? "UTC",
    hours,
    holidays,
  };
};

const isHoliday = (dateObj, calendar) => {
  // dateObj treated in UTC for simplicity
  const y = dateObj.getUTCFullYear();
  const m = String(dateObj.getUTCMonth() + 1).padStart(2, "0");
  const d = String(dateObj.getUTCDate()).padStart(2, "0");
  const iso = `${y}-${m}-${d}`;
  return (calendar?.holidays || []).some(h => h.dateIso === iso);
};

// Return array of working windows for weekday Mon=0..Sun=6, each as [startMin,endMin]
const windowsForWeekday = (weekday, calendar) => {
  const rows = (calendar?.hours || []).filter(h => h.weekday === weekday);
  return rows.sort((a, b) => a.startMin - b.startMin).map(r => [r.startMin, r.endMin]);
};

// Move a Date (UTC) to the next working start
const moveToNextWorkingStart = (dt, calendar) => {
  for (let i = 0; i < 14; i++) { // 2-week hard cap to avoid infinite loop
    const weekday = (dt.getUTCDay() + 6) % 7; // JS: 0=Sun..6=Sat -> 0=Mon..6=Sun
    if (!isHoliday(dt, calendar)) {
      const minsFromMidnight = dt.getUTCHours() * 60 + dt.getUTCMinutes();
      const windows = windowsForWeekday(weekday, calendar);
      for (const [start] of windows) {
        if (minsFromMidnight < start) {
          dt.setUTCHours(0, 0, 0, 0);
          dt = new Date(dt.getTime() + start * 60 * 1000);
          return dt;
        }
      }
      // If currently inside a window, return now
      for (const [start, end] of windows) {
        if (minsFromMidnight >= start && minsFromMidnight < end) return dt;
      }
    }
    // jump to next day midnight UTC
    dt = new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate() + 1, 0, 0, 0));
  }
  return dt;
};

// Add minutes respecting calendar hours & holidays (UTC-based, guarded)
const addBusinessMinutes = (startISO, minutes, calendar) => {
  if (!minutes || minutes <= 0) return startISO;

  // Fallback: if no hours configured, treat as 24x7
  const hasAnyHours = Array.isArray(calendar?.hours) && calendar.hours.length > 0;
  if (!hasAnyHours) return new Date(new Date(startISO).getTime() + minutes * 60000).toISOString();

  let dt = new Date(startISO);
  dt = moveToNextWorkingStart(dt, calendar);

  let remaining = minutes;
  let safety = 0; // safety hard cap to avoid infinite loops

  while (remaining > 0) {
    safety++;
    if (safety > 20000) {
      console.warn("[addBusinessMinutes] safety cap reached; falling back to 24x7");
      return new Date(new Date(startISO).getTime() + minutes * 60000).toISOString();
    }

    const weekday = (dt.getUTCDay() + 6) % 7;
    const windows = isHoliday(dt, calendar) ? [] : windowsForWeekday(weekday, calendar);

    if (!windows.length) {
      // move to next workday start
      dt = moveToNextWorkingStart(new Date(Date.UTC(
        dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate() + 1, 0, 0, 0
      )), calendar);
      continue;
    }

    const minsFromMidnight = dt.getUTCHours() * 60 + dt.getUTCMinutes();

    let advancedToday = false;

    for (const [start, end] of windows) {
      let nowMins = dt.getUTCHours() * 60 + dt.getUTCMinutes();

      if (nowMins < start) {
        // jump forward to start
        dt.setUTCHours(0, 0, 0, 0);
        dt = new Date(dt.getTime() + start * 60 * 1000);
        nowMins = start;
      }

      if (nowMins >= start && nowMins < end) {
        const cap = end - nowMins;
        const take = Math.min(cap, remaining);
        dt = new Date(dt.getTime() + take * 60 * 1000);
        remaining -= take;
        advancedToday = true;
        if (remaining === 0) break; // done today
        // else try next window today
      }
    }

    if (!advancedToday && remaining > 0) {
      // move to next day
      dt = moveToNextWorkingStart(new Date(Date.UTC(
        dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate() + 1, 0, 0, 0
      )), calendar);
    }
  }

  return dt.toISOString();
};

/* ------------------------------------------------------------------------------------ */

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
  const [teamCalendar, setTeamCalendar] = useState(null);

  // Providers
  const { slasByOrg, listSLAs } = useSLA();
  const { getCachedTags, list: listTags } = useTags();
  const { listCategories, listProducts } = useTicketCategories();
  const { getUsersByIds } = useUser();
  const { listFeatures, listImpacts, listRootCauses } = useTicketTaxonomies();

  // Load data on mount
  useEffect(() => {
    if (!orgId) return;
    Promise.all([
      listSLAs(orgId),
      listTags({ orgId }),
      listCategories(orgId),
      listProducts(orgId),
      listFeatures(orgId),
      listImpacts(orgId),
      listRootCauses(orgId),
    ]).catch(console.error);
  }, [orgId, listSLAs, listTags, listCategories, listProducts, listFeatures, listImpacts, listRootCauses]);

  const [form, setForm] = useState(() => ({
    subject: initial?.subject || "",
    featureId: initial?.featureId || "",
    impactId: initial?.impactId || "",
    rcaId: initial?.rcaId || "",
    rcaNote: initial?.rcaNote || "",

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
      ? initial.tags.map((t) => (typeof t === "string" ? t : t.tag_id ?? t.tagId)).filter(Boolean)
      : [],
    collaboratorIds: initial?.collaboratorIds || [],
  }));

  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const isQueueOwned = form.queueOwned === true;

  /* --------------------- ALWAYS fetch team’s BizCalendar by calendarId --------------------- */
  useEffect(() => {
    let mounted = true;

    (async () => {
      setTeamCalendar(null);
      if (!form.teamId) return;

      try {
        const team = await SupportTeamModel.get(form.teamId);

        // Derive calendarId safely
        const calId =
          team?.calendarId ??
          team?.calendar_id ??
          team?.calendar?.calendarId ??
          team?.calendar?.calendar_id ??
          team?.teamCalendar?.calendarId ??
          team?.teamCalendar?.calendar_id;

        if (!calId) {
          if (mounted) setTeamCalendar(null);
          return;
        }

        const rawCal = await BizCalendarModel.get(calId);
        const cal = normalizeCalendar(rawCal);
        if (mounted) setTeamCalendar(cal);
      } catch (e) {
        console.error("Failed to load team/calendar:", e);
        if (mounted) setTeamCalendar(null);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [form.teamId]);

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

      setLoadingTeamMembers(true);
      try {
        const members = await SupportTeamModel.listMembers(form.teamId);
        const ids = (members || []).map((m) => m.user_id ?? m.userId ?? m.uid).filter(Boolean);
        if (!ids.length) {
          if (mounted) {
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

  /* -------------------- async, non-blocking SLA due date computation -------------------- */
  const [computedDue, setComputedDue] = useState({
    first: null,
    resolution: null,
    computing: false,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    if (!selectedSLA?.sla_id) {
      setComputedDue({ first: null, resolution: null, computing: false, error: null });
      return;
    }

    const first = firstResponseTime;
    const res = currentResolutionTime;

    if (!first && !res) {
      setComputedDue({ first: null, resolution: null, computing: false, error: null });
      return;
    }

    setComputedDue((prev) => ({ ...prev, computing: true, error: null }));

    const id = setTimeout(() => {
      try {
        const nowISO = new Date().toISOString();
        const useBiz = Boolean(form.teamId && teamCalendar?.hours?.length);

        // fast-path for absurdly large SLAs
        const calc = (minutes) => {
          if (!minutes) return null;
          if (!useBiz) return new Date(Date.now() + minutes * 60000).toISOString();
          if (minutes > 100000) return new Date(Date.now() + minutes * 60000).toISOString();
          return addBusinessMinutes(nowISO, minutes, teamCalendar);
        };

        const next = {
          first: first ? calc(first) : null,
          resolution: res ? calc(res) : null,
          computing: false,
          error: null,
        };

        if (!cancelled) setComputedDue(next);
      } catch (e) {
        console.error("[SLA calc] failed:", e);
        if (!cancelled) setComputedDue((prev) => ({ ...prev, computing: false, error: String(e?.message || e) }));
      }
    }, 0); // yield to paint

    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [selectedSLA?.sla_id, firstResponseTime, currentResolutionTime, form.teamId, teamCalendar]);

  // Auto-fill form fields with computed due dates
  useEffect(() => {
    if (computedDue.first) {
      setForm((f) => ({ ...f, firstResponseDueAt: computedDue.first }));
    }
    if (computedDue.resolution) {
      setForm((f) => ({
        ...f,
        resolutionDueAt: computedDue.resolution,
        dueAt: computedDue.resolution,
      }));
    }
  }, [computedDue.first, computedDue.resolution]);

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
        featureId: form.featureId || null,
        impactId: form.impactId || null,
        rcaId: form.rcaId || null,
        rcaNote: form.rcaNote || null,
        sla_processing: safeSlaId
          ? {
              sla_mode: form.slaMode,
              calendar_id:
                teamCalendar?.calendarId ??
                teamCalendar?.calendar_id ??
                selectedSLA?.calendar_id ??
                null,
              first_response_due_at: computedDue.first || null,
              resolution_due_at: computedDue.resolution || null,
            }
          : null,
        dueAt: computedDue.resolution || (form.dueAt && form.dueAt.trim()) || null,
        firstResponseDueAt: computedDue.first || null,
        resolutionDueAt: computedDue.resolution || null,
        slaMode: form.slaMode,
        tags: form.tagIds?.length ? form.tagIds : undefined,
        collaboratorIds: form.collaboratorIds || [],
      };

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
        featureId: "",
        impactId: "",
        rcaId: "",
        rcaNote: "",
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
                <h3 className="text-sm font-medium text-gray-700">Categorize the Issue</h3>
                <span className="text-xs text-gray-500">Select category, subcategory, and affected product</span>
              </div>

              <CategorySelector
                orgId={orgId}
                value={{
                  category: form.categoryId,
                  subcategory: form.subcategoryId,
                  product: form.productId,
                  featureId: form.featureId,
                  impactId: form.impactId,
                  rcaId: form.rcaId,
                  rcaNote: form.rcaNote,
                }}
                onChange={(categoryId) => {
                  update("categoryId", categoryId);
                  if (categoryId !== form.categoryId) update("subcategoryId", "");
                }}
                onFeatureChange={(featureId) => update("featureId", featureId)}
                onImpactChange={(impactId) => update("impactId", impactId)}
                onRCAChange={(rcaId) => update("rcaId", rcaId)}
                onRCANoteChange={(note) => update("rcaNote", note)}
                onSubcategoryChange={(subcategoryId) => update("subcategoryId", subcategoryId)}
                onProductChange={(productId) => update("productId", productId)}
              />

              {(form.categoryId || form.subcategoryId || form.productId || form.featureId || form.impactId || form.rcaId) && (
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
                    {form.featureId && (
                      <span className="inline-flex items-center px-3 py-1 bg-amber-100 text-amber-800 text-sm font-medium rounded-full">
                        Feature: {form.featureId}
                      </span>
                    )}
                    {form.impactId && (
                      <span className="inline-flex items-center px-3 py-1 bg-pink-100 text-pink-800 text-sm font-medium rounded-full">
                        Impact: {form.impactId}
                      </span>
                    )}
                    {form.rcaId && (
                      <span className="inline-flex items-center px-3 py-1 bg-slate-100 text-slate-800 text-sm font-medium rounded-full">
                        RCA: {form.rcaId}
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

                <div className="mt-4">
                  {teamCalendar?.hours?.length ? (
                    <BusinessCalendarPreview calendar={teamCalendar} />
                  ) : (
                    <div className="text-xs text-gray-500">No team calendar attached.</div>
                  )}
                </div>

                {(hasPriorityMap || hasSeverityMap) && (
                  <div className="space-y-2 mt-4">
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

            {selectedSLA && (
              <div className="mt-2 flex flex-wrap gap-2 items-center">
                {form.teamId && teamCalendar?.hours?.length ? (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-emerald-100 text-emerald-800 border border-emerald-200">
                    Calendar applied • {teamCalendar.timezone || "UTC"}
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-700 border border-gray-200">
                    No calendar • straight minutes
                  </span>
                )}
                {computedDue.computing && (
                  <span className="text-[11px] text-gray-500">calculating…</span>
                )}
                {computedDue.error && (
                  <span className="text-[11px] text-red-600">SLA math error: {computedDue.error}</span>
                )}
              </div>
            )}

            {selectedSLA && (computedDue.first || computedDue.resolution) && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg mt-3">
                <h4 className="text-sm font-medium text-green-900 mb-3">Calculated Due Dates</h4>
                <div className="space-y-2 text-sm">
                  {computedDue.first && (
                    <div className="flex justify-between items-center">
                      <span className="text-gray-700">First Response Due:</span>
                      <span className="font-medium text-blue-700">
                        {new Date(computedDue.first).toLocaleString()}
                      </span>
                    </div>
                  )}
                  {computedDue.resolution && (
                    <div className="flex justify-between items-center">
                      <span className="text-gray-700">Resolution Due:</span>
                      <span className="font-medium text-orange-700">
                        {new Date(computedDue.resolution).toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
                <p className="mt-2 text-[11px] text-gray-500">
                  {form.teamId && teamCalendar?.hours?.length
                    ? "Due times account for team working hours and holidays."
                    : "Due times are calculated in real elapsed minutes (24×7)."}
                </p>
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
              onFilesUploaded={(uploaded) => setStagedUploads((prev) => [...prev, ...uploaded])}
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
              <p className="text-sm text-gray-500">{availableTagOptions.length} tags available</p>
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
