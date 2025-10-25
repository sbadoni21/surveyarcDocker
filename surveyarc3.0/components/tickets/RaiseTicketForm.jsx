// components/tickets/TicketForm.jsx - CORRECTED VERSION
"use client";
import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Clock,
  CheckCircle,
  AlertCircle,
  Edit,
  Clipboard,
  Tag,
  Flag,
  Upload,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Save,
  Target,
  X,
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

/* ----------------------- CORRECTED CALENDAR HELPERS ----------------------- */

/**
 * Normalize backend calendar to frontend shape
 * BE: hours: [{weekday, start_min, end_min}], holidays: [{date_iso, name}]
 * Weekday: 0=Monday, 1=Tuesday, ..., 6=Sunday (ISO 8601 standard)
 */
const normalizeCalendar = (raw) => {
  if (!raw) return null;

  const hours = Array.isArray(raw.hours)
    ? raw.hours
        .map((h) => {
          const weekday = typeof h.weekday === "number" ? h.weekday : h.day;
          const startMin =
            typeof h.start_min === "number" ? h.start_min : h.startMin ?? 0;
          const endMin =
            typeof h.end_min === "number" ? h.end_min : h.endMin ?? 0;

          // Validate ranges
          if (weekday < 0 || weekday > 6) {
            console.warn(`Invalid weekday: ${weekday}`);
            return null;
          }
          if (startMin < 0 || startMin >= 1440 || endMin < 0 || endMin > 1440) {
            console.warn(`Invalid time range: ${startMin}-${endMin}`);
            return null;
          }
          if (startMin >= endMin) {
            console.warn(
              `Invalid time range: start ${startMin} >= end ${endMin}`
            );
            return null;
          }

          return { weekday, startMin, endMin };
        })
        .filter(Boolean)
    : [];

  const holidays = Array.isArray(raw.holidays)
    ? raw.holidays
        .map((h) => {
          const dateIso = h.date_iso ?? h.dateIso;
          if (!dateIso || !/^\d{4}-\d{2}-\d{2}$/.test(dateIso)) {
            console.warn(`Invalid holiday date: ${dateIso}`);
            return null;
          }
          return { dateIso, name: h.name || "Holiday" };
        })
        .filter(Boolean)
    : [];

  return {
    calendarId: raw.calendar_id ?? raw.calendarId ?? raw.id ?? null,
    name: raw.name || "Unnamed Calendar",
    timezone: raw.timezone || "UTC",
    hours,
    holidays,
  };
};

/**
 * Convert Date object to YYYY-MM-DD in calendar's timezone
 */
const dateToISOString = (date, timezone) => {
  try {
    // Use Intl.DateTimeFormat for proper timezone conversion
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    return formatter.format(date); // Returns YYYY-MM-DD
  } catch (e) {
    console.warn(`Timezone ${timezone} not supported, falling back to UTC`);
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, "0");
    const d = String(date.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
};

/**
 * Check if a date is a holiday in the calendar's timezone
 */
const isHoliday = (date, calendar) => {
  if (!calendar?.holidays?.length) return false;
  const dateStr = dateToISOString(date, calendar.timezone);
  return calendar.holidays.some((h) => h.dateIso === dateStr);
};

/**
 * Get working windows for a weekday
 * Weekday: 0=Monday, 1=Tuesday, ..., 6=Sunday
 */
const windowsForWeekday = (weekday, calendar) => {
  if (!calendar?.hours) return [];

  const rows = calendar.hours.filter((h) => h.weekday === weekday);
  return rows
    .sort((a, b) => a.startMin - b.startMin)
    .map((r) => [r.startMin, r.endMin]);
};

/**
 * Get ISO weekday from Date (0=Monday, 1=Tuesday, ..., 6=Sunday)
 */
const getISOWeekday = (date, timezone) => {
  try {
    // Get day of week in calendar's timezone
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      weekday: "short",
    });
    const dayName = formatter.format(date);
    const dayMap = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
    return dayMap[dayName] ?? (date.getUTCDay() + 6) % 7;
  } catch (e) {
    // Fallback to UTC
    return (date.getUTCDay() + 6) % 7;
  }
};

/**
 * Get minutes from midnight in calendar's timezone
 */
const getMinutesFromMidnight = (date, timezone) => {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const parts = formatter.formatToParts(date);
    const hour = parseInt(parts.find((p) => p.type === "hour")?.value || "0");
    const minute = parseInt(
      parts.find((p) => p.type === "minute")?.value || "0"
    );
    return hour * 60 + minute;
  } catch (e) {
    // Fallback to UTC
    return date.getUTCHours() * 60 + date.getUTCMinutes();
  }
};

/**
 * Move date to start of next day in calendar's timezone
 */
const moveToNextDay = (date, timezone) => {
  try {
    // Add 24 hours and truncate to midnight
    const next = new Date(date.getTime() + 24 * 60 * 60 * 1000);
    const dateStr = dateToISOString(next, timezone);
    return new Date(`${dateStr}T00:00:00Z`);
  } catch (e) {
    // Fallback: simple day increment
    return new Date(
      Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate() + 1,
        0,
        0,
        0,
        0
      )
    );
  }
};

/**
 * Move a Date to the next working start time
 */
const moveToNextWorkingStart = (dt, calendar) => {
  const maxIterations = 365; // Max 1 year of searching

  for (let i = 0; i < maxIterations; i++) {
    const weekday = getISOWeekday(dt, calendar.timezone);

    if (!isHoliday(dt, calendar)) {
      const windows = windowsForWeekday(weekday, calendar);

      if (windows.length === 0) {
        // No working hours this day, move to next day
        dt = moveToNextDay(dt, calendar.timezone);
        continue;
      }

      const minsFromMidnight = getMinutesFromMidnight(dt, calendar.timezone);

      // Check if we need to jump to first window
      const firstWindowStart = windows[0][0];
      if (minsFromMidnight < firstWindowStart) {
        // Jump to start of first window
        const dateStr = dateToISOString(dt, calendar.timezone);
        dt = new Date(`${dateStr}T00:00:00Z`);
        dt = new Date(dt.getTime() + firstWindowStart * 60 * 1000);
        return dt;
      }

      // Check if we're currently inside a working window
      for (const [start, end] of windows) {
        if (minsFromMidnight >= start && minsFromMidnight < end) {
          return dt; // Already in working hours
        }
        if (minsFromMidnight < start) {
          // Jump to this window start
          const dateStr = dateToISOString(dt, calendar.timezone);
          dt = new Date(`${dateStr}T00:00:00Z`);
          dt = new Date(dt.getTime() + start * 60 * 1000);
          return dt;
        }
      }
    }

    // Move to next day midnight
    dt = moveToNextDay(dt, calendar.timezone);
  }

  console.error("[moveToNextWorkingStart] Max iterations reached");
  return dt;
};

/**
 * Add business minutes respecting calendar hours & holidays
 */
const addBusinessMinutes = (startISO, minutes, calendar) => {
  if (!minutes || minutes <= 0) return startISO;

  // Fallback: if no hours configured, treat as 24x7
  const hasAnyHours =
    Array.isArray(calendar?.hours) && calendar.hours.length > 0;
  if (!hasAnyHours) {
    return new Date(
      new Date(startISO).getTime() + minutes * 60000
    ).toISOString();
  }

  // Fast path for very large SLAs (> 1 year) - fallback to simple calculation
  if (minutes > 525600) {
    // 365 days
    console.warn("[addBusinessMinutes] SLA > 1 year, using simple calculation");
    return new Date(
      new Date(startISO).getTime() + minutes * 60000
    ).toISOString();
  }

  let dt = new Date(startISO);
  dt = moveToNextWorkingStart(dt, calendar);

  let remaining = minutes;
  const maxIterations = Math.ceil(minutes / 60) * 2 + 1000; // Dynamic based on minutes
  let iterations = 0;

  while (remaining > 0) {
    iterations++;
    if (iterations > maxIterations) {
      console.error(
        "[addBusinessMinutes] Max iterations reached, falling back to 24x7"
      );
      return new Date(
        new Date(startISO).getTime() + minutes * 60000
      ).toISOString();
    }

    const weekday = getISOWeekday(dt, calendar.timezone);
    const windows = isHoliday(dt, calendar)
      ? []
      : windowsForWeekday(weekday, calendar);

    if (!windows.length) {
      // No working hours today, move to next day
      dt = moveToNextWorkingStart(
        moveToNextDay(dt, calendar.timezone),
        calendar
      );
      continue;
    }

    const minsFromMidnight = getMinutesFromMidnight(dt, calendar.timezone);
    let advancedToday = false;

    for (const [start, end] of windows) {
      let nowMins = getMinutesFromMidnight(dt, calendar.timezone);

      // If before window start, jump to start
      if (nowMins < start) {
        const dateStr = dateToISOString(dt, calendar.timezone);
        dt = new Date(`${dateStr}T00:00:00Z`);
        dt = new Date(dt.getTime() + start * 60 * 1000);
        nowMins = start;
      }

      // If within window, consume time
      if (nowMins >= start && nowMins < end) {
        const availableInWindow = end - nowMins;
        const toConsume = Math.min(availableInWindow, remaining);
        dt = new Date(dt.getTime() + toConsume * 60 * 1000);
        remaining -= toConsume;
        advancedToday = true;

        if (remaining === 0) break; // Done!
      }
    }

    // If we didn't advance, move to next day
    if (!advancedToday && remaining > 0) {
      dt = moveToNextWorkingStart(
        moveToNextDay(dt, calendar.timezone),
        calendar
      );
    }
  }

  return dt.toISOString();
};

/* ------------------------------------------------------------------------------------ */

export default function RaiseTicketForm({
  open,
  onClose,
  onSaveTemplate,
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
  const [calendarError, setCalendarError] = useState(null);

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
  }, [
    orgId,
    listSLAs,
    listTags,
    listCategories,
    listProducts,
    listFeatures,
    listImpacts,
    listRootCauses,
  ]);

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
      ? initial.tags
          .map((t) => (typeof t === "string" ? t : t.tag_id ?? t.tagId))
          .filter(Boolean)
      : [],
    collaboratorIds: initial?.collaboratorIds || [],
  }));

  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const isQueueOwned = form.queueOwned === true;

  /* --------------------- Fetch team's BizCalendar with proper error handling --------------------- */
  useEffect(() => {
    let mounted = true;
    let abortController = new AbortController();

    (async () => {
      setTeamCalendar(null);
      setCalendarError(null);

      if (!form.teamId) return;

      try {
        const team = await SupportTeamModel.get(form.teamId);

        const calId = team?.calendarId;

        if (!calId) {
          if (mounted) {
            setTeamCalendar(null);
            setCalendarError("No calendar configured for this team");
          }
          return;
        }

        const rawCal = await BizCalendarModel.get(calId);
        const cal = normalizeCalendar(rawCal);

        if (!cal) {
          throw new Error("Invalid calendar data");
        }

        if (cal.hours.length === 0) {
          console.warn("Calendar has no working hours defined");
        }

        if (mounted && !abortController.signal.aborted) {
          setTeamCalendar(cal);
          setCalendarError(null);
        }
      } catch (e) {
        console.error("Failed to load team/calendar:", e);
        if (mounted && !abortController.signal.aborted) {
          setTeamCalendar(null);
          setCalendarError(e.message || "Failed to load calendar");
        }
      }
    })();

    return () => {
      mounted = false;
      abortController.abort();
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
    let abortController = new AbortController();

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
        const ids = (members || [])
          .map((m) => m.user_id ?? m.userId ?? m.uid)
          .filter(Boolean);

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
            u.user_id ??
            u.userId ??
            u.uid,
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
  }, [form.teamId, getUsersByIds]);

  // SLA options filtered by group
  const availableSLAOptions = (slasByOrg?.[orgId] || []).filter((sla) => {
    if (!sla.active) return false;
    if (sla.rules?.applies_to?.group_id_in) {
      if (
        !form.groupId ||
        !sla.rules.applies_to.group_id_in.includes(form.groupId)
      ) {
        return false;
      }
    }
    return true;
  });

  const availableTagOptions = getCachedTags(orgId) || [];
  const selectedSLA = availableSLAOptions.find((s) => s.sla_id === form.slaId);

  const hasPriorityMap =
    selectedSLA?.rules?.priority_map &&
    Object.keys(selectedSLA.rules.priority_map).length > 0;
  const hasSeverityMap =
    selectedSLA?.rules?.severity_map &&
    Object.keys(selectedSLA.rules.severity_map).length > 0;

  const currentResolutionTime = useMemo(() => {
    if (!selectedSLA) return null;
    if (form.slaMode === "priority" && hasPriorityMap) {
      return (
        selectedSLA.rules.priority_map[form.priority] ||
        selectedSLA.resolution_minutes
      );
    }
    if (form.slaMode === "severity" && hasSeverityMap) {
      return (
        selectedSLA.rules.severity_map[form.severity] ||
        selectedSLA.resolution_minutes
      );
    }
    return selectedSLA.resolution_minutes;
  }, [
    selectedSLA,
    form.slaMode,
    form.priority,
    form.severity,
    hasPriorityMap,
    hasSeverityMap,
  ]);

  const firstResponseTime = selectedSLA?.first_response_minutes;

  /* -------------------- Async SLA due date computation with debouncing -------------------- */
  const [computedDue, setComputedDue] = useState({
    first: null,
    resolution: null,
    computing: false,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    let timeoutId = null;

    if (!selectedSLA?.sla_id) {
      setComputedDue({
        first: null,
        resolution: null,
        computing: false,
        error: null,
      });
      return;
    }

    const first = firstResponseTime;
    const res = currentResolutionTime;

    if (!first && !res) {
      setComputedDue({
        first: null,
        resolution: null,
        computing: false,
        error: null,
      });
      return;
    }

    setComputedDue((prev) => ({ ...prev, computing: true, error: null }));

    // Debounce calculation by 300ms
    timeoutId = setTimeout(() => {
      try {
        const nowISO = new Date().toISOString();
        const useBiz = Boolean(form.teamId && teamCalendar?.hours?.length);

        const calc = (minutes) => {
          if (!minutes) return null;
          if (!useBiz)
            return new Date(Date.now() + minutes * 60000).toISOString();
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
        if (!cancelled) {
          setComputedDue((prev) => ({
            ...prev,
            computing: false,
            error: String(e?.message || e),
          }));
        }
      }
    }, 300); // 300ms debounce

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [
    selectedSLA?.sla_id,
    firstResponseTime,
    currentResolutionTime,
    form.teamId,
    teamCalendar,
  ]);

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
    assignment:
      !isQueueOwned || (isQueueOwned && form.groupId.trim().length > 0),
    sla:
      !selectedSLA ||
      (selectedSLA && (hasPriorityMap || hasSeverityMap || true)),
  };

  const stepValidation = [
    validations.basic,
    validations.assignment,
    true,
    true,
    true,
    true,
  ];
  const canProceed = (step) => stepValidation[step];
  const canSubmit = Object.values(validations).every(Boolean);

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const knownSlaIds = new Set(
        (availableSLAOptions || []).map((s) => s?.sla_id)
      );
      const safeSlaId =
        form.slaId && knownSlaIds.has(form.slaId) ? form.slaId : null;

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
        dueAt:
          computedDue.resolution || (form.dueAt && form.dueAt.trim()) || null,
        firstResponseDueAt: computedDue.first || null,
        resolutionDueAt: computedDue.resolution || null,
        slaMode: form.slaMode,
        tags: form.tagIds?.length ? form.tagIds : undefined,
        collaboratorIds: form.collaboratorIds || [],
      };
      console.log("Submitting ticket payload:", payload);
      onSaveTemplate?.(payload);

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
    } finally {
      setSaving(false);
    }
  };

  const steps = [
    {
      label: "Basic Information",
      icon: Edit,
      description: "Subject and description",
    },
    {
      label: "Assignment",
      icon: Clipboard,
      description: "Who will handle this ticket",
    },
    { label: "Classification", icon: Tag, description: "Categorize the issue" },
    {
      label: "SLA & Priority",
      icon: Flag,
      description: "Set response targets",
    },
    { label: "Attachments", icon: Upload, description: "Add supporting files" },
    {
      label: "Additional Options",
      icon: Plus,
      description: "Tags and collaborators",
    },
  ];

  const handleNext = () => {
    console.log("Moving to next step", form);
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
          <div className="bg-white dark:bg-[#242428]  border border-gray-200 rounded-lg p-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="block text-sm dark:text-white font-medium text-gray-700">
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
                <label className="block text-sm font-medium text-gray-700">
                  Description
                </label>
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
                      "bold",
                      "italic",
                      "underline",
                      "strike",
                      "list",
                      "color",
                      "background",
                      "align",
                      "link",
                      "code-block",
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
                <span className="text-sm font-medium text-gray-900">
                  Queue Assignment
                </span>
                <p className="text-sm text-gray-600">
                  Assign to a group queue instead of a specific person
                </p>
              </div>
            </label>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <GroupSelect
                orgId={orgId}
                value={form.groupId}
                onChange={(v) => update("groupId", v)}
              />
              {!isQueueOwned ? (
                <AssigneeSelect
                  orgId={orgId}
                  groupId={form.groupId || undefined}
                  value={form.assigneeId}
                  onChange={(v) => update("assigneeId", v)}
                  label="Assignee"
                  placeholder={
                    isQueueOwned
                      ? "Will be auto-assigned from queue"
                      : "Select assignee"
                  }
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
                <h4 className="text-sm font-medium text-gray-900">
                  Team Involvement (Optional)
                </h4>
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
                    placeholder={
                      form.teamId ? "Select an agent" : "Select a team first"
                    }
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

                {calendarError && (
                  <div className="flex items-center space-x-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <AlertCircle className="h-5 w-5 text-yellow-600" />
                    <span className="text-sm text-yellow-800">
                      Calendar issue: {calendarError}
                    </span>
                  </div>
                )}
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
                  product: form.productId,
                  featureId: form.featureId,
                  impactId: form.impactId,
                  rcaId: form.rcaId,
                  rcaNote: form.rcaNote,
                }}
                onChange={(categoryId) => {
                  update("categoryId", categoryId);
                  if (categoryId !== form.categoryId)
                    update("subcategoryId", "");
                }}
                onFeatureChange={(featureId) => update("featureId", featureId)}
                onImpactChange={(impactId) => update("impactId", impactId)}
                onRCAChange={(rcaId) => update("rcaId", rcaId)}
                onRCANoteChange={(note) => update("rcaNote", note)}
                onSubcategoryChange={(subcategoryId) =>
                  update("subcategoryId", subcategoryId)
                }
                onProductChange={(productId) => update("productId", productId)}
              />

              {(form.categoryId ||
                form.subcategoryId ||
                form.productId ||
                form.featureId ||
                form.impactId ||
                form.rcaId) && (
                <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200">
                  <p className="text-xs font-medium text-gray-700 mb-2">
                    Selected Classification:
                  </p>
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
              <label className="block text-sm font-medium text-gray-700">
                Service Level Agreement
              </label>
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
                  <span className="text-sm font-medium text-blue-900">
                    {selectedSLA.name} Selected
                  </span>
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
                      Base Resolution:{" "}
                      {formatMinutes(selectedSLA.resolution_minutes)}
                    </span>
                  )}
                </div>

                <div className="mt-4">
                  {teamCalendar?.hours?.length ? (
                    <BusinessCalendarPreview calendar={teamCalendar} />
                  ) : (
                    <div className="text-xs text-gray-500">
                      {calendarError
                        ? `Calendar error: ${calendarError}`
                        : "No team calendar attached (24×7 calculation)"}
                    </div>
                  )}
                </div>

                {(hasPriorityMap || hasSeverityMap) && (
                  <div className="space-y-2 mt-4">
                    <label className="block text-sm font-medium text-gray-700">
                      Resolution Time Calculation
                    </label>
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
                        <span
                          className={`text-sm ${
                            !hasPriorityMap ? "text-gray-400" : "text-gray-700"
                          }`}
                        >
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
                        <span
                          className={`text-sm ${
                            !hasSeverityMap ? "text-gray-400" : "text-gray-700"
                          }`}
                        >
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
                  <label className="block text-sm font-medium text-gray-700">
                    Priority
                  </label>
                  <select
                    value={form.priority}
                    onChange={(e) => update("priority", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {Object.keys(selectedSLA.rules.priority_map || {}).map(
                      (p) => (
                        <option key={p} value={p}>
                          {p.charAt(0).toUpperCase() + p.slice(1)} —{" "}
                          {formatMinutes(selectedSLA.rules.priority_map[p])}
                        </option>
                      )
                    )}
                  </select>
                </div>
              ) : selectedSLA &&
                form.slaMode === "severity" &&
                hasSeverityMap ? (
                <div className="md:col-span-2 space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Severity
                  </label>
                  <select
                    value={form.severity}
                    onChange={(e) => update("severity", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {Object.keys(selectedSLA.rules.severity_map || {}).map(
                      (s) => (
                        <option key={s} value={s}>
                          {s.toUpperCase()} —{" "}
                          {formatMinutes(selectedSLA.rules.severity_map[s])}
                        </option>
                      )
                    )}
                  </select>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Priority
                    </label>
                    <select
                      value={form.priority}
                      onChange={(e) => update("priority", e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      {["low", "normal", "high", "urgent", "blocker"].map(
                        (p) => (
                          <option key={p} value={p}>
                            {p.charAt(0).toUpperCase() + p.slice(1)}
                          </option>
                        )
                      )}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Severity
                    </label>
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
                  <span className="text-[11px] text-gray-500 flex items-center gap-1">
                    <RefreshCw className="h-3 w-3 animate-spin" />
                    calculating…
                  </span>
                )}
                {computedDue.error && (
                  <span className="text-[11px] text-red-600">
                    SLA math error: {computedDue.error}
                  </span>
                )}
              </div>
            )}

            {selectedSLA &&
              (computedDue.first || computedDue.resolution) &&
              !computedDue.computing && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg mt-3">
                  <h4 className="text-sm font-medium text-green-900 mb-3">
                    Calculated Due Dates
                  </h4>
                  <div className="space-y-2 text-sm">
                    {computedDue.first && (
                      <div className="flex justify-between items-center">
                        <span className="text-gray-700">
                          First Response Due:
                        </span>
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
                      ? `Due times account for team working hours (${teamCalendar.timezone}) and holidays.`
                      : "Due times are calculated in real elapsed minutes (24×7)."}
                  </p>
                </div>
              )}

            {selectedSLA && !currentResolutionTime && (
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-center space-x-2">
                  <AlertCircle className="h-5 w-5 text-yellow-600" />
                  <div>
                    <p className="text-sm font-medium text-yellow-900">
                      SLA Configuration Issue
                    </p>
                    <p className="text-xs text-yellow-700 mt-1">
                      The selected SLA doesn't have time targets configured for
                      the current {form.slaMode} mode. Due dates won't be
                      automatically calculated.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Custom Due Date (Optional)
              </label>
              <input
                type="datetime-local"
                value={form.dueAt ? form.dueAt.slice(0, 16) : ""}
                onChange={(e) =>
                  update("dueAt", e.target.value ? `${e.target.value}:00Z` : "")
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500">
                Leave empty to use SLA-calculated dates, or set a custom due
                date to override
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
              onFilesUploaded={(uploaded) =>
                setStagedUploads((prev) => [...prev, ...uploaded])
              }
              maxFiles={10}
            />
            {stagedUploads.length > 0 && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
                  {stagedUploads.length} file
                  {stagedUploads.length === 1 ? "" : "s"} ready to be attached
                </p>
              </div>
            )}
          </div>
        );

      case 5:
        return (
          <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-6">
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700">
                Tags
              </label>
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
              <label className="block text-sm font-medium text-gray-700">
                Collaborators
              </label>
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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-[#242428] rounded-2xl max-w-6xl w-full max-h-[95vh] overflow-hidden flex flex-col shadow-2xl border border-gray-200 dark:border-gray-700">
        {/* Header */}
        <div className="border-b border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              {title}
            </h2>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 dark:text-gray-300 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-4">
            <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400 mb-2">
              <span>
                Step {activeStep + 1} of {steps.length}
              </span>
              <span>
                {Math.round(((activeStep + 1) / steps.length) * 100)}% Complete
              </span>
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
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-4">
              Form Steps
            </h3>
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
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {s.description}
                        </div>
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
              {canSubmit
                ? "Ready to create ticket!"
                : "Complete required fields to continue"}
              {stagedUploads.length > 0 && (
                <span className="ml-2 text-blue-600 dark:text-blue-400">
                  • {stagedUploads.length} staged file
                  {stagedUploads.length === 1 ? "" : "s"} will be attached
                </span>
              )}
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
                  className="px-6 py-2 text-sm bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 min-w-[120px] transition-colors"
                >
                  {saving ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
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
