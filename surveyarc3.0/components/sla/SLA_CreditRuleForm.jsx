import React, { useEffect, useMemo, useState } from "react";

/**
 Props:
  - open (bool)
  - onClose (fn)
  - editingCredit: { sla, rule } | { sla } | null
  - DIMENSIONS (array)
  - BREACH_GRADES (array)
  - CREDIT_UNITS (array of {value,label})
  - CreditRulesTable (component)
  - onEditCredit, onDeleteCredit (fn)
  - onSaveCredit(payload, sla) (fn)
*/
export default function CreditRulesDialog({
  open,
  onClose,
  editingCredit,
  DIMENSIONS = [],
  BREACH_GRADES = [],
  CREDIT_UNITS = [],
  CreditRulesTable,
  onEditCredit,
  onDeleteCredit,
  onSaveCredit,
}) {
  const initial = {
    objective: "",
    grade: "",
    credit_unit: CREDIT_UNITS?.[0]?.value || "",
    credit_value: "",
    cap_per_period: "",
    period_days: "",
    active: true,
  };
  const [form, setForm] = useState(initial);
  const [touched, setTouched] = useState({});
  const [saving, setSaving] = useState(false);
  const [showExamples, setShowExamples] = useState(false);

  // populate on open / editingCredit change
  useEffect(() => {
    if (editingCredit?.rule) {
      const r = editingCredit.rule;
      setForm({
        objective: r.objective || "",
        grade: r.grade || "",
        credit_unit: r.credit_unit || CREDIT_UNITS?.[0]?.value || "",
        credit_value: r.credit_value ?? "",
        cap_per_period: r.cap_per_period ?? "",
        period_days: r.period_days ?? "",
        active: r.active !== false,
      });
    } else {
      setForm(initial);
    }
    setTouched({});
    setShowExamples(false);
  }, [editingCredit, open]); // eslint-disable-line

  // basic validation
  const errors = useMemo(() => {
    const e = {};
    if (!form.objective) e.objective = "Pick the objective this credit ties to.";
    if (!form.grade) e.grade = "Select which breach grade triggers this credit.";
    if (!form.credit_unit) e.credit_unit = "Choose a unit for credits.";
    if (form.credit_value === "" || Number.isNaN(Number(form.credit_value))) e.credit_value = "Enter a numeric credit value.";
    else if (Number(form.credit_value) < 0) e.credit_value = "Must be 0 or greater.";
    if (form.cap_per_period !== "" && Number.isNaN(Number(form.cap_per_period))) e.cap_per_period = "Must be numeric or empty.";
    if (form.period_days !== "" && Number.isNaN(Number(form.period_days))) e.period_days = "Must be numeric or empty.";
    return e;
  }, [form]);

  const canSave = Object.keys(errors).length === 0;

  const previewLabel = useMemo(() => {
    const dim = DIMENSIONS?.find(d => d.value === form.objective)?.label || form.objective || "—";
    const unit = CREDIT_UNITS?.find(u => u.value === form.credit_unit)?.label || form.credit_unit || "";
    const value = form.credit_value !== "" ? form.credit_value : "—";
    const gradeLabel = form.grade || "—";
    return { dim, gradeLabel, value, unit };
  }, [form, DIMENSIONS, CREDIT_UNITS]);

  // keyboard close (ESC)
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  async function handleSave(e) {
    e?.preventDefault?.();
    setTouched({ all: true });
    if (!canSave) return;
    setSaving(true);
    const payload = {
      objective: form.objective,
      grade: form.grade,
      credit_unit: form.credit_unit,
      credit_value: Number(form.credit_value),
      cap_per_period: form.cap_per_period === "" ? null : Number(form.cap_per_period),
      period_days: form.period_days === "" ? null : Number(form.period_days),
      active: !!form.active,
    };
    try {
      await onSaveCredit?.(payload, editingCredit?.sla);
    } catch (err) {
      console.error("save credit failed", err);
    } finally {
      setSaving(false);
      onClose?.();
    }
  }

  if (!open) return null;

  const isEditing = !!editingCredit?.rule;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center animate-in fade-in duration-200">
      {/* backdrop */}
      <div
        className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm"
        onClick={() => !saving && onClose?.()}
        aria-hidden="true"
      />

      {/* dialog */}
      <form
        onSubmit={handleSave}
        role="dialog"
        aria-modal="true"
        className="relative z-10 max-w-5xl w-full mx-4 bg-white rounded-2xl shadow-2xl overflow-hidden grid grid-cols-1 lg:grid-cols-3 animate-in zoom-in-95 duration-200"
      >
        {/* left column: form */}
        <div className="lg:col-span-2 p-8 space-y-6 max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-200">
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isEditing ? 'bg-amber-100' : 'bg-sky-100'}`}>
                  <svg className={`w-5 h-5 ${isEditing ? 'text-amber-600' : 'text-sky-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    {isEditing ? (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    )}
                  </svg>
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-slate-900">
                    {isEditing ? "Edit Credit Rule" : "Add Credit Rule"}
                  </h3>
                  {editingCredit?.sla && (
                    <p className="text-sm text-slate-500 mt-0.5">
                      SLA: <span className="font-medium text-slate-700">{editingCredit.sla.name}</span>
                    </p>
                  )}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => !saving && onClose?.()}
              disabled={saving}
              aria-label="Close"
              className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-50"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Help card */}
          <div className="rounded-xl border border-sky-200 bg-gradient-to-br from-sky-50 to-blue-50 p-5 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 mt-0.5">
                <div className="w-8 h-8 rounded-lg bg-sky-100 flex items-center justify-center">
                  <svg className="w-5 h-5 text-sky-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-sky-900">What are Credit Rules?</h4>
                <p className="text-sm text-sky-800 mt-1.5 leading-relaxed">
                  Attach business outcomes when an SLA objective breaches — refunds, fixed compensations, or service-day credits. Use caps to limit exposure.
                </p>
                <div className="mt-3 flex items-center gap-2 text-xs text-sky-700 bg-sky-100/50 rounded-lg px-3 py-2">
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  <span className="font-medium">Tip: Keep one credit rule per objective+grade for predictability.</span>
                </div>
              </div>
            </div>
          </div>

          {/* Form grid */}
          <div className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {/* Objective */}
              <label className="block">
                <span className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
                  Objective
                  <span className="text-rose-500">*</span>
                </span>
                <select
                  value={form.objective}
                  onChange={(e) => setForm(f => ({ ...f, objective: e.target.value }))}
                  onBlur={() => setTouched(t => ({ ...t, objective: true }))}
                  className={`mt-2 block w-full rounded-xl border-2 px-4 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-sky-500/20 transition-all ${
                    touched.all && errors.objective 
                      ? "border-rose-300 bg-rose-50 text-rose-900" 
                      : "border-slate-200 bg-white text-slate-900 hover:border-slate-300"
                  }`}
                >
                  <option value="">Choose objective</option>
                  {DIMENSIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                </select>
                {touched.all && errors.objective ? (
                  <p className="mt-2 text-xs text-rose-600 flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    {errors.objective}
                  </p>
                ) : (
                  <p className="mt-2 text-xs text-slate-500">Which metric this credit applies to</p>
                )}
              </label>

              {/* Breach grade */}
              <label className="block">
                <span className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
                  Breach Grade
                  <span className="text-rose-500">*</span>
                </span>
                <select
                  value={form.grade}
                  onChange={(e) => setForm(f => ({ ...f, grade: e.target.value }))}
                  onBlur={() => setTouched(t => ({ ...t, grade: true }))}
                  className={`mt-2 block w-full rounded-xl border-2 px-4 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-sky-500/20 transition-all ${
                    touched.all && errors.grade 
                      ? "border-rose-300 bg-rose-50 text-rose-900" 
                      : "border-slate-200 bg-white text-slate-900 hover:border-slate-300"
                  }`}
                >
                  <option value="">Choose grade</option>
                  {BREACH_GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
                {touched.all && errors.grade ? (
                  <p className="mt-2 text-xs text-rose-600 flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    {errors.grade}
                  </p>
                ) : (
                  <p className="mt-2 text-xs text-slate-500">Which breach severity triggers this rule</p>
                )}
              </label>

              {/* Credit unit */}
              <label className="block">
                <span className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
                  Credit Unit
                  <span className="text-rose-500">*</span>
                </span>
                <select
                  value={form.credit_unit}
                  onChange={(e) => setForm(f => ({ ...f, credit_unit: e.target.value }))}
                  onBlur={() => setTouched(t => ({ ...t, credit_unit: true }))}
                  className={`mt-2 block w-full rounded-xl border-2 px-4 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-sky-500/20 transition-all ${
                    touched.all && errors.credit_unit 
                      ? "border-rose-300 bg-rose-50 text-rose-900" 
                      : "border-slate-200 bg-white text-slate-900 hover:border-slate-300"
                  }`}
                >
                  <option value="">Choose unit</option>
                  {CREDIT_UNITS.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
                </select>
                {touched.all && errors.credit_unit ? (
                  <p className="mt-2 text-xs text-rose-600 flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    {errors.credit_unit}
                  </p>
                ) : (
                  <p className="mt-2 text-xs text-slate-500">Percent / Fixed / Service days</p>
                )}
              </label>

              {/* Credit value */}
              <label className="block">
                <span className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
                  Credit Value
                  <span className="text-rose-500">*</span>
                </span>
                <input
                  type="number"
                  inputMode="numeric"
                  value={form.credit_value}
                  onChange={(e) => setForm(f => ({ ...f, credit_value: e.target.value }))}
                  onBlur={() => setTouched(t => ({ ...t, credit_value: true }))}
                  className={`mt-2 block w-full rounded-xl border-2 px-4 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-sky-500/20 transition-all ${
                    touched.all && errors.credit_value 
                      ? "border-rose-300 bg-rose-50 text-rose-900" 
                      : "border-slate-200 bg-white text-slate-900 hover:border-slate-300"
                  }`}
                  placeholder="e.g. 10"
                />
                {touched.all && errors.credit_value ? (
                  <p className="mt-2 text-xs text-rose-600 flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    {errors.credit_value}
                  </p>
                ) : (
                  <p className="mt-2 text-xs text-slate-500">Amount in chosen unit</p>
                )}
              </label>
            </div>

            {/* Optional fields section */}
            <div className="pt-4 border-t border-slate-200">
              <h5 className="text-sm font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                </svg>
                Optional Limits
              </h5>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {/* Cap per period */}
                <label className="block">
                  <span className="text-sm font-semibold text-slate-800">Cap per Period</span>
                  <input
                    type="number"
                    value={form.cap_per_period}
                    onChange={(e) => setForm(f => ({ ...f, cap_per_period: e.target.value }))}
                    onBlur={() => setTouched(t => ({ ...t, cap_per_period: true }))}
                    className={`mt-2 block w-full rounded-xl border-2 px-4 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-sky-500/20 transition-all ${
                      touched.all && errors.cap_per_period 
                        ? "border-rose-300 bg-rose-50 text-rose-900" 
                        : "border-slate-200 bg-white text-slate-900 hover:border-slate-300"
                    }`}
                    placeholder="e.g. 100"
                  />
                  {touched.all && errors.cap_per_period ? (
                    <p className="mt-2 text-xs text-rose-600 flex items-center gap-1">
                      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      {errors.cap_per_period}
                    </p>
                  ) : (
                    <p className="mt-2 text-xs text-slate-500">Max credits inside the period</p>
                  )}
                </label>

                {/* Period days */}
                <label className="block">
                  <span className="text-sm font-semibold text-slate-800">Period (days)</span>
                  <input
                    type="number"
                    value={form.period_days}
                    onChange={(e) => setForm(f => ({ ...f, period_days: e.target.value }))}
                    onBlur={() => setTouched(t => ({ ...t, period_days: true }))}
                    className={`mt-2 block w-full rounded-xl border-2 px-4 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-sky-500/20 transition-all ${
                      touched.all && errors.period_days 
                        ? "border-rose-300 bg-rose-50 text-rose-900" 
                        : "border-slate-200 bg-white text-slate-900 hover:border-slate-300"
                    }`}
                    placeholder="e.g. 30"
                  />
                  {touched.all && errors.period_days ? (
                    <p className="mt-2 text-xs text-rose-600 flex items-center gap-1">
                      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      {errors.period_days}
                    </p>
                  ) : (
                    <p className="mt-2 text-xs text-slate-500">Cap window length</p>
                  )}
                </label>
              </div>
            </div>

            {/* Active toggle */}
            <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
              <div className="relative inline-flex items-center">
                <input
                  id="credit-active"
                  type="checkbox"
                  checked={!!form.active}
                  onChange={(e) => setForm(f => ({ ...f, active: e.target.checked }))}
                  className="peer sr-only"
                />
                <label
                  htmlFor="credit-active"
                  className="flex h-6 w-11 cursor-pointer items-center rounded-full bg-slate-300 px-0.5 transition-colors peer-checked:bg-emerald-500 peer-focus:ring-2 peer-focus:ring-emerald-500/20"
                >
                  <span className="h-5 w-5 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-5" />
                </label>
              </div>
              <div className="flex-1">
                <label htmlFor="credit-active" className="text-sm font-semibold text-slate-800 cursor-pointer">
                  Rule Active
                </label>
                <p className="text-xs text-slate-500 mt-0.5">Enable this rule to apply credits</p>
              </div>
            </div>
          </div>

          {/* Preview */}
          <div className="rounded-xl border-2 border-slate-200 bg-gradient-to-br from-slate-50 to-slate-100 p-5">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-4 h-4 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </div>
              <div className="flex-1">
                <h5 className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">Preview</h5>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-3 py-1.5 rounded-lg bg-white text-sm font-semibold text-slate-900 border border-slate-200">
                    {previewLabel.dim}
                  </span>
                  <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  <span className="px-3 py-1.5 rounded-lg bg-amber-100 text-sm font-semibold text-amber-900 border border-amber-200">
                    {previewLabel.gradeLabel}
                  </span>
                  <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                  <span className="px-3 py-1.5 rounded-lg bg-emerald-100 text-sm font-semibold text-emerald-900 border border-emerald-200">
                    {previewLabel.value} {previewLabel.unit}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Examples - collapsible */}
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <button
              type="button"
              onClick={() => setShowExamples(!showExamples)}
              className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 transition-colors"
            >
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                <h5 className="text-sm font-semibold text-slate-800">Examples & Best Practices</h5>
              </div>
              <svg 
                className={`w-5 h-5 text-slate-400 transition-transform ${showExamples ? 'rotate-180' : ''}`} 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {showExamples && (
              <div className="p-5 space-y-4 bg-white border-t border-slate-200">
                <div className="space-y-3">
                  <div className="flex items-start gap-3 p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                    <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-xs font-bold text-white">1</span>
                    </div>
                    <div>
                      <h6 className="text-sm font-semibold text-emerald-900">10% of Fee Refund</h6>
                      <p className="text-xs text-emerald-700 mt-1">Resolution time → major breach. Use <code className="px-1.5 py-0.5 bg-emerald-100 rounded text-emerald-900 font-mono">percent_fee</code> for percentage-based refunds.</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-xs font-bold text-white">2</span>
                    </div>
                    <div>
                      <h6 className="text-sm font-semibold text-blue-900">Fixed $20 Compensation</h6>
                      <p className="text-xs text-blue-700 mt-1">First Response → critical breach. Use <code className="px-1.5 py-0.5 bg-blue-100 rounded text-blue-900 font-mono">fixed_usd</code> for flat compensations.</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3 p-3 bg-violet-50 rounded-lg border border-violet-200">
                    <div className="w-6 h-6 rounded-full bg-violet-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-xs font-bold text-white">3</span>
                    </div>
                    <div>
                      <h6 className="text-sm font-semibold text-violet-900">1 Service Day Credit</h6>
                      <p className="text-xs text-violet-700 mt-1">Uptime → major breach. Use <code className="px-1.5 py-0.5 bg-violet-100 rounded text-violet-900 font-mono">service_days</code> to add time credit.</p>
                    </div>
                  </div>
                </div>
                
                <div className="pt-3 border-t border-slate-200">
                  <div className="flex items-start gap-2 text-xs text-slate-600">
                    <svg className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    <p className="leading-relaxed">If you set a cap, pair it with a period (e.g. cap 100 per 30 days) to limit exposure and prevent runaway costs.</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-between gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={() => { setForm(initial); setTouched({}); }}
              className="px-4 py-2.5 border-2 border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Reset Form
            </button>
            
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onClose?.()}
                disabled={saving}
                className="px-4 py-2.5 border-2 border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!canSave || saving}
                className={`px-6 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${
                  canSave 
                    ? "bg-sky-600 hover:bg-sky-700 text-white shadow-lg shadow-sky-500/25 hover:shadow-xl hover:shadow-sky-500/30" 
                    : "bg-slate-200 text-slate-400 cursor-not-allowed"
                }`}
              >
                {saving ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Saving...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {isEditing ? "Save Changes" : "Add Rule"}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* right column: sidebar */}
        <aside className="hidden lg:block lg:col-span-1 border-l border-slate-200 bg-slate-50 max-h-[90vh] overflow-y-auto">
          <div className="sticky top-0 p-6 space-y-6">
            {editingCredit?.sla && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-slate-200 flex items-center justify-center">
                    <svg className="w-4 h-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                  <h6 className="text-sm font-semibold text-slate-800">Existing Rules</h6>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                  {CreditRulesTable ? (
                    <CreditRulesTable
                      slaId={editingCredit.sla.sla_id}
                      onEdit={(r) => onEditCredit?.(editingCredit.sla, r)}
                      onDelete={(ruleId) => onDeleteCredit?.(editingCredit.sla.sla_id, ruleId)}
                    />
                  ) : (
                    <div className="p-4 text-center text-xs text-slate-500">No table component provided</div>
                  )}
                </div>
              </div>
            )}

            <div className="rounded-xl bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-200 p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center">
                  <svg className="w-4 h-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h6 className="text-sm font-semibold text-indigo-900">Quick Tips</h6>
              </div>
              <ul className="space-y-2.5">
                <li className="flex items-start gap-2 text-xs text-indigo-800">
                  <svg className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>Keep credit rules simple: one objective + grade per rule</span>
                </li>
                <li className="flex items-start gap-2 text-xs text-indigo-800">
                  <svg className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>Use caps to avoid runaway refunds and protect margins</span>
                </li>
                <li className="flex items-start gap-2 text-xs text-indigo-800">
                  <svg className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>Prefer percent refunds for billing, fixed for logistics, service-days for operations</span>
                </li>
              </ul>
            </div>
          </div>
        </aside>
      </form>
    </div>
  );
}