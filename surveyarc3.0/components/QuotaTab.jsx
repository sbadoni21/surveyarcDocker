// components/quota/QuotaTab.jsx
"use client";

import React, { useEffect, useState } from "react";
import quotaModel from "@/models/postGresModels/quotaModel";
import QuotaCreateForm from "./QuotaCreateForm";

export default function QuotaTab({
  surveyId,
  orgId,
  questions = [],
  onQuotaAssigned,
}) {
  const [quotas, setQuotas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeCreate, setActiveCreate] = useState(false);
  const [editing, setEditing] = useState(null);
  const [attachQuestionForNew, setAttachQuestionForNew] = useState(null);
  const [error, setError] = useState("");

  const load = async () => {
    if (!surveyId) return;
    setLoading(true);
    setError("");
    try {
      const res = await quotaModel.listBySurvey(surveyId);
      setQuotas(Array.isArray(res) ? res : []);
    } catch (e) {
      console.error("load quotas failed", e);
      setError(e?.message || "Failed to load quotas");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [surveyId]);

  const openCreateForQuestion = (q) => {
    setAttachQuestionForNew(q?.questionId || null);
    setEditing(null);
    setActiveCreate(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const startEdit = (quota) => {
    setEditing(quota);
    setAttachQuestionForNew(quota?.questionId ?? null);
    setActiveCreate(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleCreatedOrUpdated = (quota) => {
    load();
    setActiveCreate(false);
    setEditing(null);
    setAttachQuestionForNew(null);
    if (quota?.questionId && typeof onQuotaAssigned === "function") {
      onQuotaAssigned(quota, quota.questionId);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this quota? This cannot be undone.")) return;
    try {
      await quotaModel.delete(id);
      load();
    } catch (e) {
      console.error(e);
      alert("Delete failed: " + (e?.message || e));
    }
  };

  const attachedQuestion =
    questions.find((q) => q.questionId === attachQuestionForNew) || null;

  return (
    <div className="h-full flex bg-white dark:bg-[#07101a] text-black dark:text-white">
      {/* LEFT: QUESTIONS */}
      <aside className="w-[34%] border-r dark:border-gray-800 p-4 overflow-auto">
        <h3 className="font-semibold mb-4">Questions</h3>

        <div className="space-y-3">
          {Array.isArray(questions) && questions.length ? (
            questions.map((q) => {
              const qType = q.type || q.questionType || q.qType || "unknown";
              const qQuotas = quotas.filter(
                (zz) => zz.questionId === q.questionId
              );
              const hasOptions =
                Array.isArray(q.options) && q.options.length > 0;

              return (
                <div
                  key={q.questionId}
                  className="p-3 rounded border bg-white dark:bg-[#07101a]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-sm font-medium">
                        {`Question - ${q.label ?? q.questionId}`}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        ID: {q.questionId}
                      </div>
                      <div className="text-xs text-gray-500">Type: {qType}</div>
                    </div>

                    <div className="flex flex-col gap-1 items-end">
                      {/* Add Quota button for every question */}
                      <button
                        onClick={() => {
                          setAttachQuestionForNew(q.questionId);
                          setEditing(null);
                          setActiveCreate(true);
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }}
                        className="px-2 py-1 text-xs border rounded"
                      >
                        Add Quota
                      </button>

                      {/* Create with options only if question has options */}
                      {hasOptions && (
                        <button
                          onClick={() => openCreateForQuestion(q)}
                          className="px-2 py-1 text-xs border rounded"
                        >
                          Create (with options)
                        </button>
                      )}
                    </div>
                  </div>

                  {qQuotas.length > 0 && (
                    <div className="mt-2 border-t pt-2 text-xs">
                      <div className="font-semibold mb-1">Applied Quotas:</div>
                      {qQuotas.map((qq) => (
                        <div key={qq.id} className="flex justify-between">
                          <span>{qq.name}</span>
                          <button
                            onClick={() => startEdit(qq)}
                            className="text-blue-600 underline text-[10px]"
                          >
                            Edit
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="text-sm text-gray-500">No questions available</div>
          )}
        </div>
      </aside>

      {/* RIGHT: QUOTAS */}
      <main className="flex-1 p-6 overflow-auto">
        <div className="max-w-[1200px] mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Quotas</h2>
              <div className="text-sm text-gray-500">
                Define quotas globally or per-question
              </div>
            </div>
            <button className="px-3 py-1 border rounded" onClick={load}>
              Refresh
            </button>
          </div>

          {error && <div className="text-sm text-red-600">{error}</div>}

          {activeCreate ? (
            <div className="border rounded bg-white dark:bg-[#07101a]">
              <div className="flex items-center justify-between px-4 py-2 border-b">
                <div className="font-semibold">
                  {editing ? "Edit Quota" : "Create Quota"}
                </div>
                <div>
                  <button
                    onClick={() => {
                      setActiveCreate(false);
                      setEditing(null);
                      setAttachQuestionForNew(null);
                    }}
                    className="px-2 py-1 text-sm"
                  >
                    Close
                  </button>
                </div>
              </div>

              <div style={{ minHeight: 420 }}>
                <QuotaCreateForm
                  surveyId={surveyId}
                  orgId={orgId}
                  questionId={attachQuestionForNew}
                  question={attachedQuestion}
                  questionOptions={attachedQuestion?.options || []}
                  initial={editing}
                  onCreated={handleCreatedOrUpdated}
                  onCancel={() => {
                    setActiveCreate(false);
                    setEditing(null);
                    setAttachQuestionForNew(null);
                  }}
                />
              </div>
            </div>
          ) : (
            <>
              {loading ? (
                <div className="text-sm text-gray-500">Loading quotas…</div>
              ) : quotas.length === 0 ? (
                <div className="text-sm text-gray-500">
                  No quotas created yet.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {quotas.map((q) => (
                    <div
                      key={q.id}
                      className="p-4 border rounded bg-white dark:bg-[#07101a] shadow-sm"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-medium">{q.name}</h3>
                          <div className="text-sm text-gray-500 mt-2">
                            {q.description || "—"}
                          </div>
                          <div className="mt-2 text-xs text-gray-500">
                            Cells: {q.cells?.length ?? 0} • Type:{" "}
                            {q.quotaType ?? q.quota_type ?? "n/a"}
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-2">
                          <button
                            onClick={() => startEdit(q)}
                            className="px-2 py-1 text-sm border rounded"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(q.id)}
                            className="px-2 py-1 text-sm text-red-600"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
