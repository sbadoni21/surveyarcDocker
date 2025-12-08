// components/quota/QuestionQuotaModal.jsx
"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import QuotaCreateForm from "./QuotaCreateForm";

export default function QuestionQuotaModal({
  open,
  setOpen,
  surveyId,
  orgId,
  questionId,
  questionOptions = [], 
  onQuotaAssigned, 
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // body scroll lock
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => (document.body.style.overflow = prev);
  }, [open]);

  // Escape to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  if (!open) return null;

  const handleCreated = async (quota) => {
    try {
      setLoading(true);
      if (!quota || !quota.id) {
        setError("Quota created but response did not contain an id.");
        return;
      }
      if (onQuotaAssigned) onQuotaAssigned(quota);
      setOpen(false);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const modal = (
    <div
      className="fixed inset-0 z-[9999] flex flex-col bg-transparent"
      role="dialog"
      aria-modal="true"
    >
      {/* backdrop */}
      <div
        className="absolute inset-0 bg-black/70"
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />

      {/* content full-bleed */}
      <div
        className="relative z-10 w-full h-screen flex flex-col bg-white dark:bg-[#07101a] text-black dark:text-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div className="flex items-center justify-between px-6 py-3 border-b dark:border-gray-800 bg-white/90 dark:bg-[#07101a]/90">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold">Quota Editor</h3>
            {questionId && <span className="text-sm text-gray-600 dark:text-gray-400">Question: {questionId}</span>}
          </div>

          <div className="flex items-center gap-2">
            {loading && <div className="text-sm text-gray-600 dark:text-gray-400">Assigning…</div>}
            <button onClick={() => setOpen(false)} className="px-3 py-1 rounded border text-sm">Close</button>
          </div>
        </div>

        {/* body */}
        <div className="flex-1 overflow-auto">
          <div className="w-full h-full">
            <QuotaCreateForm
              surveyId={surveyId}
              orgId={orgId}
              questionId={questionId}
              questionOptions={questionOptions}
              onCreated={handleCreated}
            />
          </div>
        </div>

        {/* footer */}
        <div className="px-6 py-3 border-t dark:border-gray-800 bg-white/90 dark:bg-[#07101a]/90">
          <div className="flex justify-end">
            <button onClick={() => setOpen(false)} className="px-3 py-1 rounded border text-sm">Close</button>
          </div>
        </div>

        {error && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20">
            <div className="bg-red-600 text-white px-4 py-2 rounded">{error}</div>
          </div>
        )}
      </div>
    </div>
  );

  // render into body to avoid parent clipping
  return createPortal(modal, document.body);
}
