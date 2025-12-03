"use client";
import { useState, useMemo, useEffect } from "react";
import TicketModel from "@/models/ticketModel";
import { useSurvey } from "@/providers/surveyPProvider";
import { usePathname } from "next/navigation";

export default function AgentFollowupPanel({ ticket, onTicketUpdated }) {
  const followup = ticket.followup;

  const { selectedSurvey, getSurvey } = useSurvey();
  const path = usePathname();
  const orgId = path.split("/")[3];

  const [saving, setSaving] = useState(false);
  const [answers, setAnswers] = useState(() => {
    if (!followup?.questions) return {};
    const map = {};
    for (const q of followup.questions) {
      map[q.id] = q.answer ?? "";
    }
    return map;
  });

  // load survey details when mode = "survey"
  useEffect(() => {
    if (followup?.mode === "survey" && followup.surveyId) {
      getSurvey(followup.surveyId).catch((err) =>
        console.error("Failed to load followup survey", err)
      );
    }
  }, [followup?.mode, followup?.surveyId, getSurvey]);

  const hasInlineFollowup =
    followup &&
    followup.mode === "inline" &&
    Array.isArray(followup.questions) &&
    followup.questions.length > 0;

  const hasSurveyFollowup =
    followup && followup.mode === "survey" && !!followup.surveyId;

  const allAnsweredInline = useMemo(() => {
    if (!hasInlineFollowup) return true;
    return followup.questions.every((q) => {
      const val = (answers[q.id] ?? "").toString().trim();
      return val.length > 0;
    });
  }, [followup, answers, hasInlineFollowup]);

  if (!followup) return null;

  const handleChange = (qid, value) => {
    setAnswers((prev) => ({ ...prev, [qid]: value }));
  };

  const domain =
    process.env.NEXT_PUBLIC_DOMAIN || "https://surveyarc-docker.vercel.app";

  const publicSurveyUrl =
    followup?.surveyId && orgId && selectedSurvey
      ? `${domain}/en/form?org_id=${orgId}&project_id=${selectedSurvey.project_id}&survey_id=${selectedSurvey.survey_id}&ticket_id=${ticket.ticketId}&followup=true`
      : null;

  const handleSave = async () => {
    if (!ticket.ticketId) return;
    setSaving(true);
    try {
      const updatedFollowup = {
        ...followup,
        questions: (followup.questions || []).map((q) => ({
          ...q,
          answer: answers[q.id] ?? "",
        })),
      };

      const updated = await TicketModel.update(ticket.ticketId, {
        followup: updatedFollowup,
      });

      onTicketUpdated?.(updated);
    } catch (err) {
      console.error("Failed to save followup answers", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="border-b bg-slate-50 px-4 py-3 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-800">Follow-up</h3>

        {followup.mode === "inline" ? (
          allAnsweredInline ? (
            <span className="text-xs px-2 py-1 rounded-full bg-emerald-100 text-emerald-700">
              Completed
            </span>
          ) : (
            <span className="text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-700">
              Required to close ticket
            </span>
          )
        ) : (
          <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700">
            Survey based
          </span>
        )}
      </div>

      {/* 🔹 MODE: SURVEY */}
      {hasSurveyFollowup && (
        <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-slate-800">Linked Survey</div>
              <div className="text-xs text-slate-500">
                {selectedSurvey?.name || followup.surveyId}
              </div>

              {/* ✅ Show response id status here */}
              <div className="text-[11px] mt-1">
                {followup.responseId ? (
                  <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700 border border-emerald-200">
                    Response ID:&nbsp;
                    <span className="font-mono text-[10px]">
                      {followup.responseId}
                    </span>
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-amber-700 border border-amber-200">
                    No response recorded yet
                  </span>
                )}
              </div>
            </div>
          </div>

          {publicSurveyUrl && (
            <a
              href={publicSurveyUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center text-xs mt-2 px-2 py-1 rounded border border-slate-300 hover:bg-slate-100"
            >
              Open survey
            </a>
          )}

          <p className="text-[11px] text-slate-500 mt-1">
            This ticket’s follow-up will be collected through the linked survey
            instead of inline questions.
          </p>
        </div>
      )}

      {/* 🔹 MODE: INLINE */}
      {hasInlineFollowup && (
        <>
          <div className="space-y-3">
            {followup.questions.map((q) => (
              <div key={q.id} className="text-sm">
                <div className="font-medium text-slate-800 mb-1">
                  {q.label}
                </div>

                {q.type === "mcq" && Array.isArray(q.options) ? (
                  <div className="space-y-1">
                    {q.options.map((opt) => (
                      <label
                        key={opt}
                        className="flex items-center space-x-2 cursor-pointer"
                      >
                        <input
                          type="radio"
                          name={q.id}
                          className="h-4 w-4"
                          checked={answers[q.id] === opt}
                          onChange={() => handleChange(q.id, opt)}
                        />
                        <span className="text-slate-700">{opt}</span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <textarea
                    className="w-full border rounded-md px-2 py-1 text-sm"
                    rows={3}
                    value={answers[q.id] ?? ""}
                    onChange={(e) =>
                      handleChange(q.id, e.target.value )
                    }
                  />
                )}
              </div>
            ))}
          </div>

          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !allAnsweredInline}
              className="text-sm px-3 py-1.5 rounded-md border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save answers"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
