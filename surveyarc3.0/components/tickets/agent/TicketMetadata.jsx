"use client";

import { useState, useEffect } from "react";
import { useQuestion } from "@/providers/questionPProvider";
import { useUser } from "@/providers/postGresPorviders/UserProvider";
import { Clock, AlertTriangle, CheckCircle, Pause, MessageSquare } from "lucide-react";

function MetaField({ label, value, variant = "default" }) {
  const variantStyles = {
    default: "text-gray-800",
    success: "text-emerald-700",
    warning: "text-amber-700",
    danger: "text-red-700",
  };

  return (
    <div className="space-y-1 min-w-0">
      <div className="text-xs text-gray-500">{label}</div>
      <div className={`text-sm font-medium truncate ${variantStyles[variant]}`}>
        {value || "—"}
      </div>
    </div>
  );
}

function formatDateTime(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return "—";
  }
}

function formatMinutes(minutes) {
  if (minutes == null || isNaN(minutes)) return "—";
  const abs = Math.max(0, Math.floor(Math.abs(minutes)));
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
}

function getSLAStatus(slaStatus) {
  if (!slaStatus) return { text: "No SLA", variant: "default", icon: null };
  
  const resolution = {
    paused: slaStatus.resolution_paused || slaStatus.resolutionPaused || false,
    breached: slaStatus.breached_resolution || slaStatus.breachedResolution || false,
    completed: slaStatus.resolution_completed_at || slaStatus.resolutionCompletedAt || null,
    dueAt: slaStatus.resolution_due_at || slaStatus.resolutionDueAt || null,
  };

  const firstResponse = {
    paused: slaStatus.first_response_paused || slaStatus.firstResponsePaused || false,
    breached: slaStatus.breached_first_response || slaStatus.breachedFirstResponse || false,
    completed: slaStatus.first_response_completed_at || slaStatus.firstResponseCompletedAt || null,
  };

  if (resolution.breached) {
    return { 
      text: "Breached", 
      variant: "danger", 
      icon: <AlertTriangle className="w-3 h-3 inline-block mr-1" /> 
    };
  }

  if (firstResponse.breached && !firstResponse.completed) {
    return { 
      text: "FR Breached", 
      variant: "danger", 
      icon: <AlertTriangle className="w-3 h-3 inline-block mr-1" /> 
    };
  }

  if (resolution.paused) {
    return { 
      text: "Paused", 
      variant: "warning", 
      icon: <Pause className="w-3 h-3 inline-block mr-1" /> 
    };
  }

  if (resolution.completed) {
    return { 
      text: "Resolved", 
      variant: "success", 
      icon: <CheckCircle className="w-3 h-3 inline-block mr-1" /> 
    };
  }

  if (resolution.dueAt) {
    const now = new Date();
    const due = new Date(resolution.dueAt);
    const timeRemaining = due - now;
    
    if (timeRemaining < 0) {
      return { 
        text: "Overdue", 
        variant: "danger", 
        icon: <AlertTriangle className="w-3 h-3 inline-block mr-1" /> 
      };
    }
    
    const totalTime = due - new Date(slaStatus.resolution_started_at || slaStatus.resolutionStartedAt);
    const percentRemaining = (timeRemaining / totalTime) * 100;
    
    if (percentRemaining < 20) {
      return { 
        text: "At Risk", 
        variant: "warning", 
        icon: <Clock className="w-3 h-3 inline-block mr-1" /> 
      };
    }
  }

  return { 
    text: "Active", 
    variant: "success", 
    icon: <CheckCircle className="w-3 h-3 inline-block mr-1" /> 
  };
}

function getTimeRemaining(slaStatus) {
  if (!slaStatus) return "—";
  
  const dueAt = slaStatus.resolution_due_at || slaStatus.resolutionDueAt;
  const paused = slaStatus.resolution_paused || slaStatus.resolutionPaused;
  const completed = slaStatus.resolution_completed_at || slaStatus.resolutionCompletedAt;
  
  if (completed) return "Completed";
  if (!dueAt) return "—";
  
  const now = new Date();
  const due = new Date(dueAt);
  const diffMs = due - now;
  
  if (paused) {
    const remainingMinutes = Math.ceil(diffMs / 60000);
    return `${formatMinutes(remainingMinutes)} (paused)`;
  }
  
  if (diffMs < 0) {
    const overdueMinutes = Math.abs(Math.floor(diffMs / 60000));
    return `${formatMinutes(overdueMinutes)} overdue`;
  }
  
  const remainingMinutes = Math.ceil(diffMs / 60000);
  return formatMinutes(remainingMinutes);
}

function getTotalPausedTime(slaStatus) {
  if (!slaStatus) return null;
  
  const pausedMinutes = 
    slaStatus.total_paused_resolution_minutes || 
    slaStatus.totalPausedResolutionMinutes || 
    0;
  
  return pausedMinutes > 0 ? formatMinutes(pausedMinutes) : null;
}

function QuestionAnswer({ question, answer }) {
  const getDisplayValue = () => {
    if (answer === null || answer === undefined) return "—";
    
    switch (question?.type) {
      case "rating":
      case "number":
        return `${answer} / 5`;
      case "checkbox":
      case "multiselect":
        return Array.isArray(answer) ? answer.join(", ") : answer;
      case "boolean":
        return answer ? "Yes" : "No";
      default:
        return String(answer);
    }
  };

  return (
    <div className="border-l-2 border-blue-400 pl-4 py-2">
      <div className="text-xs text-gray-500 mb-1">
        {question?.label || question?.question_id || "Unknown Question"}
      </div>
      <div className="text-sm text-gray-800 break-words">
        {getDisplayValue()}
      </div>
      {question?.description && (
        <div className="text-xs text-gray-400 mt-1 italic">
          {question.description}
        </div>
      )}
    </div>
  );
}

// 🔹 helper to format enum-ish priority/severity safely
const formatEnumValue = (value) => {
  if (!value) return "—";
  return String(value).toUpperCase();
};

export default function TicketMetadata({ ticket }) {
  const [questions, setQuestions] = useState([]);
  const [qaLoading, setQaLoading] = useState(false);
  const [qaError, setQaError] = useState(null);

  const [requesterUser, setRequesterUser] = useState(null);
  const [assigneeUser, setAssigneeUser] = useState(null);
  const [userLoading, setUserLoading] = useState(false);

  const { getBulkQuestions } = useQuestion();
  const { getUsersByIds } = useUser();

  const slaStatus = ticket?.sla_status || ticket?.slaStatus;
  const hasSLA = !!(ticket?.sla_id || ticket?.slaId);
  
  const submittedAnswers = 
    ticket?.submittedAnswers || 
    ticket?.meta?.submittedAnswers || 
    ticket?.Meta?.submittedAnswers || 
    {};
  
  const status = getSLAStatus(slaStatus);
  const timeRemaining = getTimeRemaining(slaStatus);
  const totalPaused = getTotalPausedTime(slaStatus);
  const dueAt = slaStatus?.resolution_due_at || slaStatus?.resolutionDueAt;

  const requesterId = ticket?.requesterId || ticket?.requester_id;
  const assigneeId  = ticket?.assigneeId  || ticket?.assignee_id;

  // 🔹 PRIORITY & SEVERITY: prefer ticket values if not null
  const priorityRaw =
    ticket?.priority ??
    ticket?.priorityId ??
    slaStatus?.meta?.basis_priority ??
    null;

  const severityRaw =
    ticket?.severity ??
    ticket?.severityId ??
    slaStatus?.meta?.basis_severity ??
    null;

  // Load requester + assignee user objects
  useEffect(() => {
    const loadUsers = async () => {
      const ids = [requesterId, assigneeId].filter(Boolean);
      if (!ids.length) {
        setRequesterUser(null);
        setAssigneeUser(null);
        return;
      }

      try {
        setUserLoading(true);
        const users = await getUsersByIds(ids);
        const byId = {};
        for (const u of users || []) {
          const key = u.uid || u.id || u.userId;
          if (key) byId[key] = u;
        }

        setRequesterUser(byId[requesterId] || null);
        setAssigneeUser(byId[assigneeId] || null);
      } catch (e) {
        console.error("TicketMetadata: loadUsers failed", e);
        setRequesterUser(null);
        setAssigneeUser(null);
      } finally {
        setUserLoading(false);
      }
    };

    loadUsers();
  }, [requesterId, assigneeId, getUsersByIds]);

  // Fetch questions for survey answers
  useEffect(() => {
    const fetchQuestions = async () => {
      const questionIds = Object.keys(submittedAnswers);
      if (questionIds.length === 0) {
        setQuestions([]);
        return;
      }

      setQaLoading(true);
      setQaError(null);
      
      try {
        const fetchedQuestions = await getBulkQuestions(questionIds);
        if (Array.isArray(fetchedQuestions)) {
          setQuestions(fetchedQuestions);
        } else {
          console.warn("getBulkQuestions did not return an array:", fetchedQuestions);
          setQuestions([]);
        }
      } catch (err) {
        console.error("Error fetching questions:", err);
        setQaError(err.message);
        setQuestions([]);
      } finally {
        setQaLoading(false);
      }
    };

    fetchQuestions();
  }, [JSON.stringify(submittedAnswers), getBulkQuestions]);

  const questionsMap = Array.isArray(questions) 
    ? questions.reduce((acc, q) => {
        acc[q.questionId || q.question_id] = q;
        return acc;
      }, {})
    : {};

  const hasAnswers = Object.keys(submittedAnswers).length > 0;

  const formatUser = (u, fallbackId) => {
    if (!u) return fallbackId || "—";
    return (
      <>
        <span className="block truncate">
          {u.fullName || u.name || u.displayName || u.email || fallbackId}
        </span>
        {u.email && (
          <span className="block text-[11px] text-gray-400 truncate">
            {u.email}
          </span>
        )}
      </>
    );
  };

  return (
    <>
      {/* Metadata Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-4 border-b">
        {/* Row 1: people */}
        <MetaField
          label={userLoading ? "Requester (loading…)" : "Requester"}
          value={formatUser(requesterUser, requesterId)}
        />
        <MetaField label="Group" value={ticket.groupId || ticket.group_id} />
        <MetaField
          label={userLoading ? "Assignee (loading…)" : "Assignee"}
          value={formatUser(assigneeUser, assigneeId)}
        />

        {/* Row 2: priority / severity + SLA */}
        <MetaField
          label="Priority"
          value={formatEnumValue(priorityRaw)}
        />
        <MetaField
          label="Severity"
          value={formatEnumValue(severityRaw)}
        />
        
        {hasSLA ? (
          <>
            <MetaField 
              label="SLA Status" 
              value={
                <>
                  {status.icon}
                  {status.text}
                </>
              }
              variant={status.variant}
            />
            <MetaField 
              label="Time Remaining" 
              value={timeRemaining}
              variant={
                typeof timeRemaining === "string" && timeRemaining.includes("overdue") ? "danger" : 
                typeof timeRemaining === "string" && timeRemaining.includes("paused") ? "warning" : 
                "default"
              }
            />
          </>
        ) : (
          <>
            <MetaField label="SLA" value="Not Assigned" />
            <MetaField label="Due" value="—" />
          </>
        )}

        {/* Row 3 - Only show if SLA exists */}
        {hasSLA && (
          <>
            <MetaField 
              label="Due Date" 
              value={formatDateTime(dueAt)} 
            />
            <MetaField 
              label="SLA ID" 
              value={ticket.sla_id || ticket.slaId} 
            />
            {totalPaused && (
              <MetaField 
                label="Total Paused" 
                value={totalPaused}
                variant="warning"
              />
            )}
          </>
        )}
      </div>

      {/* Survey Answers Section */}
      {hasAnswers && (
        <div className="p-4 border-b bg-gray-50">
          <div className="flex items-center gap-2 mb-4">
            <MessageSquare className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-800">Survey Responses</h3>
          </div>

          {qaLoading ? (
            <div className="text-sm text-gray-500 italic">Loading questions...</div>
          ) : qaError ? (
            <div className="text-sm text-red-600">Error: {qaError}</div>
          ) : (
            <div className="space-y-3">
              {Object.entries(submittedAnswers).map(([questionId, answer]) => (
                <QuestionAnswer 
                  key={questionId}
                  question={questionsMap[questionId]}
                  answer={answer}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {process.env.NODE_ENV === "development" && (
        <details className="p-4 border-b">
          <summary className="cursor-pointer text-sm text-gray-600 font-medium">
            Debug Info (Dev Only)
          </summary>
          <pre className="mt-2 text-xs bg-gray-100 p-3 rounded overflow-auto max-h-96">
            {JSON.stringify(
              { 
                submittedAnswers,
                questions, 
                questionsIsArray: Array.isArray(questions),
                questionsType: typeof questions,
                ticketKeys: Object.keys(ticket || {}),
                requesterId,
                assigneeId,
                requesterUser,
                assigneeUser,
                priorityRaw,
                severityRaw,
              },
              null,
              2
            )}
          </pre>
        </details>
      )}
    </>
  );
}
