import { useMemo } from "react";

import {
  Plus,
  Trash2,
  X,
  Save,
  Sparkles,
} from "lucide-react";

export function RuleEditor({
  rule,
  setRule,
  onSave,
  onDelete,
  emptyAction,
  saving,
  blocksResolved,
  questionsById,
  availableTags,
  openTicketFormForAction,
  ticketOpen,
  setTicketOpen,
  ticketInitial,
  setTicketInitial,
  ticketActIndex,
  setTicketActIndex,
  orgId,
  currentUserId,
}) {
  const blockOrder = useMemo(
    () => blocksResolved.map((b) => b.blockId),
    [blocksResolved]
  );
  const blocksById = useMemo(
    () => Object.fromEntries(blocksResolved.map((b) => [b.blockId, b])),
    [blocksResolved]
  );

  const questionsByBlock = useMemo(() => {
    const m = {};
    blocksResolved.forEach((b) => (m[b.blockId] = b._questions));
    return m;
  }, [blocksResolved]);

  function getConditionValueOptions(question) {
    if (!question) return null;

    const type = question.type?.toLowerCase();

    if (type === "yes_no" || type === "yesno" || type === "boolean") {
      return [
        { value: "yes", label: "Yes" },
        { value: "no", label: "No" },
      ];
    }

    if (
      type === "multiple_choice" ||
      type === "single_select" ||
      type === "radio" ||
      type === "dropdown" ||
      type === "select"
    ) {
      const rawOpts =
        question.options ??
        question.config?.options ??
        question.choices ??
        question.answers ??
        [];

      if (Array.isArray(rawOpts) && rawOpts.length > 0) {
        return rawOpts.map((opt) => {
          if (opt == null) return { value: "", label: "" };
          if (typeof opt === "string" || typeof opt === "number") {
            return { value: String(opt), label: String(opt) };
          }
          return {
            value: String(opt.value ?? opt.id ?? opt.key ?? opt.option ?? ""),
            label: String(opt.label ?? opt.text ?? opt.name ?? opt.value ?? ""),
          };
        });
      }
    }

    if (type === "checkbox" || type === "multi_select") {
      const rawOpts =
        question.options ??
        question.config?.options ??
        question.choices ??
        question.answers ??
        [];

      if (Array.isArray(rawOpts) && rawOpts.length > 0) {
        return rawOpts.map((opt) => {
          if (opt == null) return { value: "", label: "" };
          if (typeof opt === "string" || typeof opt === "number") {
            return { value: String(opt), label: String(opt) };
          }
          return {
            value: String(opt.value ?? opt.id ?? opt.key ?? opt.option ?? ""),
            label: String(opt.label ?? opt.text ?? opt.name ?? opt.value ?? ""),
          };
        });
      }
    }
    return null;
  }

  const getOperatorsForType = (type) => {
    const base = [
      { label: "Equals", value: "equals" },
      { label: "Not Equals", value: "not_equals" },
    ];

    switch (type) {
      case "contact_email":
      case "contact_phone":
      case "contact_address":
      case "contact_website":
      case "short_text":
      case "long_text":
        return [
          ...base,
          { label: "Contains", value: "contains" },
          { label: "Does Not Contain", value: "not_contains" },
          { label: "Starts With", value: "starts_with" },
          { label: "Ends With", value: "ends_with" },
          { label: "Is Empty", value: "is_empty" },
          { label: "Is Not Empty", value: "is_not_empty" },
        ];

      case "number":
      case "rating":
      case "opinion_scale":
        return [
          ...base,
          { label: "Greater Than", value: "greater_than" },
          { label: "Less Than", value: "less_than" },
          { label: "≥ (At Least)", value: "gte" },
          { label: "≤ (At Most)", value: "lte" },
          { label: "Between (Inclusive)", value: "between" },
          { label: "Is Empty", value: "is_empty" },
          { label: "Is Not Empty", value: "is_not_empty" },
        ];

      case "date":
        return [
          ...base,
          { label: "Before", value: "before" },
          { label: "After", value: "after" },
          { label: "On", value: "on" },
          { label: "Between", value: "between" },
          { label: "Is Empty", value: "is_empty" },
          { label: "Is Not Empty", value: "is_not_empty" },
        ];

      case "multiple_choice":
      case "dropdown":
      case "picture_choice":
      case "checkbox":
      case "ranking":
      case "matrix":
        return [
          ...base,
          { label: "Contains", value: "contains" },
          { label: "Does Not Contain", value: "not_contains" },
          { label: "Includes Any Of", value: "includes_any" },
          { label: "Includes All Of", value: "includes_all" },
          { label: "Is Empty", value: "is_empty" },
          { label: "Is Not Empty", value: "is_not_empty" },
        ];

      case "yes_no":
      case "legal":
        return [
          { label: "Equals", value: "equals" },
          { label: "Not Equals", value: "not_equals" },
        ];

      case "file_upload":
      case "google_drive":
      case "video":
      case "calendly":
        return [
          { label: "Is Uploaded / Present", value: "is_present" },
          { label: "Is Not Uploaded", value: "is_not_present" },
        ];

      case "nps":
        return [
          { label: "Is Promoter (9–10)", value: "nps_is_promoter" },
          { label: "Is Passive (6–8)", value: "nps_is_passive" },
          { label: "Is Detractor (0–5)", value: "nps_is_detractor" },
          { label: "Equals", value: "equals" },
          { label: "Not Equals", value: "not_equals" },
          { label: "≥ (At Least)", value: "nps_gte" },
          { label: "≤ (At Most)", value: "nps_lte" },
          { label: "Between (Inclusive)", value: "nps_between" },
        ];

      case "welcome_screen":
      case "end_screen":
      case "redirect_url":
        return [];

      default:
        return base;
    }
  };

  return (
    <div className="space-y-5 text-sm">
      <div className="flex items-center justify-between pb-4 border-b-2 border-gray-200">
        <h3 className="font-bold text-xl text-slate-900">
          {rule.ruleId ? "Edit Branch" : "Create Branch"}
        </h3>
        <button
          className="text-gray-400 hover:text-gray-700 hover:bg-gray-100 p-2 rounded-lg transition-colors"
          onClick={() => setRule(null)}
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-2 uppercase tracking-wide">
            Branch Name
          </label>
          <input
            className="w-full border-2 border-gray-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 p-3 rounded-lg text-sm transition-all outline-none"
            placeholder="Enter a descriptive name..."
            value={rule.name}
            onChange={(e) => setRule({ ...rule, name: e.target.value })}
          />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2 uppercase tracking-wide">
              Applies to Block
            </label>
            <select
              className="w-full border-2 border-gray-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 p-3 rounded-lg text-sm transition-all outline-none bg-white"
              value={rule.blockId}
              onChange={(e) => {
                const newBlockId = e.target.value;
                setRule((prev) => ({
                  ...prev,
                  blockId: newBlockId,
                  conditions: (prev.conditions || []).map((c) => ({
                    ...c,
                    questionId: "",
                    value: "",
                  })),
                  actions: (prev.actions || []).map((a) => ({
                    ...a,
                    questionId: "",
                    questionIds: [],
                  })),
                }));
              }}
            >
              {blockOrder.map((bid) => (
                <option key={bid} value={bid}>
                  {blocksById[bid]?.name || bid}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2 uppercase tracking-wide">
              Priority
            </label>
            <input
              type="number"
              className="w-full border-2 border-gray-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 p-3 rounded-lg text-sm transition-all outline-none"
              value={rule.priority}
              onWheel={(e) => e.target.blur()}
              onChange={(e) =>
                setRule({ ...rule, priority: Number(e.target.value) })
              }
            />
          </div>
        </div>

        <label className="inline-flex items-center gap-2.5 text-sm cursor-pointer group">
          <div className="relative">
            <input
              type="checkbox"
              checked={rule.enabled !== false}
              onChange={(e) => setRule({ ...rule, enabled: e.target.checked })}
              className="w-5 h-5 rounded border-2 border-gray-300 text-indigo-600 focus:ring-2 focus:ring-indigo-200 cursor-pointer"
            />
          </div>
          <span className="font-medium text-slate-700 group-hover:text-slate-900">
            Enabled
          </span>
        </label>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <h4 className="text-base font-bold text-slate-900">Conditions</h4>
            <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded-full font-medium">
              IF
            </span>
          </div>

          {rule.conditions.map((cond, index) => {
            const allQs =
              (questionsByBlock[rule.blockId] || []).filter(
                (q) => !q.__isPageBreak
              ) || [];

            const selectedQ =
              allQs.find((q) => q.questionId === cond.questionId) || null;

            return (
              <div
                key={index}
                className="p-4 rounded-xl border-2 border-gray-200 bg-gray-50 space-y-3 hover:border-indigo-300 transition-colors"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-bold text-gray-500">
                    #{index + 1}
                  </span>
                  {index > 0 && (
                    <select
                      className="text-xs border-2 border-gray-300 focus:border-indigo-500 px-2 py-1 rounded-md font-semibold bg-white outline-none"
                      value={cond.conditionLogic || "AND"}
                      onChange={(e) => {
                        const copy = [...rule.conditions];
                        copy[index].conditionLogic = e.target.value;
                        setRule({ ...rule, conditions: copy });
                      }}
                    >
                      <option value="AND">AND</option>
                      <option value="OR">OR</option>
                    </select>
                  )}
                </div>

                <div className="grid gap-2">
                  <select
                    className="w-full border-2 border-gray-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 p-2.5 rounded-lg text-sm transition-all outline-none bg-white"
                    value={cond.questionId}
                    onChange={(e) => {
                      const copy = [...rule.conditions];
                      copy[index].questionId = e.target.value;
                      copy[index].value = "";
                      setRule({ ...rule, conditions: copy });
                    }}
                  >
                    <option value="">Select Question</option>
                    {allQs.map((q) => (
                      <option key={q.questionId} value={q.questionId}>
                        {q.label}
                      </option>
                    ))}
                  </select>

                  {selectedQ && (
                    <>
                      <select
                        className="w-full border-2 border-gray-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 p-2.5 rounded-lg text-sm transition-all outline-none bg-white"
                        value={cond.operator}
                        onChange={(e) => {
                          const copy = [...rule.conditions];
                          copy[index].operator = e.target.value;
                          setRule({ ...rule, conditions: copy });
                        }}
                      >
                        {getOperatorsForType(selectedQ.type).map((op) => (
                          <option key={op.value} value={op.value}>
                            {op.label}
                          </option>
                        ))}
                      </select>

                      {(() => {
                        const qType = selectedQ?.type?.toLowerCase();

                        if (qType === "nps") {
                          return (
                            <input
                              type="number"
                              min={0}
                              max={10}
                              className="w-full border-2 border-gray-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 p-2.5 rounded-lg text-sm transition-all outline-none"
                              placeholder="0–10"
                              value={cond.value ?? ""}
                              onWheel={(e) => e.target.blur()}
                              onChange={(e) => {
                                const val =
                                  e.target.value === ""
                                    ? ""
                                    : Number(e.target.value);
                                const copy = [...rule.conditions];
                                copy[index].value = val;
                                setRule({ ...rule, conditions: copy });
                              }}
                            />
                          );
                        }

                        const valueOptions =
                          getConditionValueOptions(selectedQ);

                        if (valueOptions && valueOptions.length > 0) {
                          return (
                            <select
                              className="w-full border-2 border-gray-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 p-2.5 rounded-lg text-sm transition-all outline-none bg-white"
                              value={cond.value ?? ""}
                              onChange={(e) => {
                                const copy = [...rule.conditions];
                                copy[index].value = e.target.value;
                                setRule({ ...rule, conditions: copy });
                              }}
                            >
                              <option value="">Select Answer</option>
                              {valueOptions.map((opt, i) => (
                                <option key={i} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                          );
                        }

                        return (
                          <input
                            type={qType === "number" ? "number" : "text"}
                            className="w-full border-2 border-gray-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 p-2.5 rounded-lg text-sm transition-all outline-none"
                            placeholder="Enter value..."
                            value={cond.value ?? ""}
                            onChange={(e) => {
                              const copy = [...rule.conditions];
                              copy[index].value = e.target.value;
                              setRule({ ...rule, conditions: copy });
                            }}
                          />
                        );
                      })()}
                    </>
                  )}
                </div>

                <div className="flex gap-2 pt-2">
                  {index === rule.conditions.length - 1 && (
                    <button
                      className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
                      onClick={() =>
                        setRule((r) => ({
                          ...r,
                          conditions: [...r.conditions, { ...emptyCondition }],
                        }))
                      }
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add Condition
                    </button>
                  )}

                  {rule.conditions.length > 1 && (
                    <button
                      className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-red-50 hover:bg-red-100 text-red-600 border-2 border-red-200 rounded-lg transition-colors"
                      onClick={() =>
                        setRule((r) => ({
                          ...r,
                          conditions: r.conditions.filter(
                            (_, i) => i !== index
                          ),
                        }))
                      }
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Remove
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <h4 className="text-base font-bold text-slate-900">Actions</h4>
            <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full font-medium">
              THEN
            </span>
          </div>

          {rule.actions.map((act, index) => (
            <div
              key={index}
              className="p-4 rounded-xl border-2 border-gray-200 bg-gray-50 space-y-3 hover:border-emerald-300 transition-colors"
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-bold text-gray-500">
                  #{index + 1}
                </span>
              </div>

              <select
                className="w-full border-2 border-gray-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 p-2.5 rounded-lg text-sm font-medium transition-all outline-none bg-white"
                value={act.type}
                onChange={(e) => {
                  const copy = [...rule.actions];
                  copy[index] = { ...emptyAction, type: e.target.value };
                  setRule({ ...rule, actions: copy });
                }}
              >
                <option value="goto_block">Go To Block</option>
                <option value="goto_block_question">
                  Go To Block → Question
                </option>
                <option value="goto_question">
                  Go To Question (this block)
                </option>
                <option value="skip_block">Skip Blocks</option>
                <option value="skip_questions">
                  Skip Questions (this block)
                </option>
                <option value="show_message">Show Message</option>
                <option value="end">End Survey</option>
                <option value="raise_ticket">Raise Ticket</option>
              </select>

              {act.type === "goto_block" && (
                <select
                  className="w-full border-2 border-gray-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 p-2.5 rounded-lg text-sm transition-all outline-none bg-white"
                  value={act.blockId || ""}
                  onChange={(e) => {
                    const copy = [...rule.actions];
                    copy[index].blockId = e.target.value;
                    setRule({ ...rule, actions: copy });
                  }}
                >
                  <option value="">Select Block</option>
                  {blocksResolved.map((b) => (
                    <option key={b.blockId} value={b.blockId}>
                      {b.name}
                    </option>
                  ))}
                </select>
              )}

              {act.type === "goto_block_question" && (
                <div className="grid gap-2">
                  <select
                    className="w-full border-2 border-gray-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 p-2.5 rounded-lg text-sm transition-all outline-none bg-white"
                    value={act.targetBlockId || ""}
                    onChange={(e) => {
                      const copy = [...rule.actions];
                      copy[index].targetBlockId = e.target.value;
                      copy[index].targetQuestionId = "";
                      setRule({ ...rule, actions: copy });
                    }}
                  >
                    <option value="">Select Block</option>
                    {blocksResolved.map((b) => (
                      <option key={b.blockId} value={b.blockId}>
                        {b.name}
                      </option>
                    ))}
                  </select>

                  <select
                    className="w-full border-2 border-gray-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 p-2.5 rounded-lg text-sm transition-all outline-none bg-white"
                    value={act.targetQuestionId || ""}
                    onChange={(e) => {
                      const copy = [...rule.actions];
                      copy[index].targetQuestionId = e.target.value;
                      setRule({ ...rule, actions: copy });
                    }}
                    disabled={!act.targetBlockId}
                  >
                    <option value="">Select Question</option>
                    {(
                      blocksResolved.find(
                        (b) => b.blockId === act.targetBlockId
                      )?._questions || []
                    )
                      .filter((q) => !q.__isPageBreak)
                      .map((q) => (
                        <option key={q.questionId} value={q.questionId}>
                          {q.label}
                        </option>
                      ))}
                  </select>
                </div>
              )}

              {act.type === "goto_question" && (
                <select
                  className="w-full border-2 border-gray-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 p-2.5 rounded-lg text-sm transition-all outline-none bg-white"
                  value={act.questionId || ""}
                  onChange={(e) => {
                    const copy = [...rule.actions];
                    copy[index].questionId = e.target.value;
                    setRule({ ...rule, actions: copy });
                  }}
                >
                  <option value="">Select Question</option>
                  {(
                    blocksResolved.find((b) => b.blockId === rule.blockId)
                      ?._questions || []
                  )
                    .filter((q) => !q.__isPageBreak)
                    .map((q) => (
                      <option key={q.questionId} value={q.questionId}>
                        {q.label}
                      </option>
                    ))}
                </select>
              )}

              {act.type === "skip_block" && (
                <div className="w-full border-2 border-gray-300 p-3 rounded-lg bg-white min-h-[100px]">
                  <div
                    className="grid gap-2 pr-2 overflow-auto"
                    style={{ maxHeight: 220 }}
                  >
                    {blocksResolved.map((b) => {
                      const checked =
                        Array.isArray(act.blockIds) &&
                        act.blockIds.includes(b.blockId);
                      return (
                        <label
                          key={b.blockId}
                          className="flex items-center gap-2 text-sm cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              const copy = [...rule.actions];
                              const current = { ...(copy[index] || {}) };
                              const prevIds = Array.isArray(current.blockIds)
                                ? [...current.blockIds]
                                : [];
                              if (e.target.checked) prevIds.push(b.blockId);
                              else {
                                const pos = prevIds.indexOf(b.blockId);
                                if (pos !== -1) prevIds.splice(pos, 1);
                              }
                              current.blockIds = prevIds;
                              copy[index] = current;
                              setRule({ ...rule, actions: copy });
                            }}
                            className="w-4 h-4 rounded border-gray-300 flex-shrink-0"
                          />
                          <span className="whitespace-normal break-words">
                            {b.name}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {act.type === "skip_questions" && (
                <div className="w-full border-2 border-gray-300 p-3 rounded-lg bg-white min-h-[100px]">
                  <div className="flex items-center justify-between mb-2 gap-2">
                    <div className="text-sm font-medium text-gray-700">
                      Choose questions
                    </div>
                  </div>
                  <div className="flex gap-2 mb-2">
                    <button
                      type="button"
                      className="text-xs px-2 py-1 bg-gray-100 rounded-md hover:bg-gray-200"
                      onClick={() => {
                        // select all visible questions
                        const visible = (
                          blocksResolved.find((b) => b.blockId === rule.blockId)
                            ?._questions || []
                        )
                          .filter((q) => !q.__isPageBreak)
                          .map((q) => q.questionId);
                        const copy = [...rule.actions];
                        copy[index] = {
                          ...(copy[index] || {}),
                          questionIds: visible,
                        };
                        setRule({ ...rule, actions: copy });
                      }}
                    >
                      Select all
                    </button>
                    <button
                      type="button"
                      className="text-xs px-2 py-1 bg-gray-50 rounded-md hover:bg-gray-100"
                      onClick={() => {
                        const copy = [...rule.actions];
                        copy[index] = {
                          ...(copy[index] || {}),
                          questionIds: [],
                        };
                        setRule({ ...rule, actions: copy });
                      }}
                    >
                      Clear
                    </button>
                  </div>

                  <div
                    className="grid gap-2 pr-2 overflow-auto"
                    style={{ maxHeight: 220 }} /* desktop cap */
                  >
                    {(
                      blocksResolved.find((b) => b.blockId === rule.blockId)
                        ?._questions || []
                    )
                      .filter((q) => !q.__isPageBreak)
                      .map((q) => {
                        const checked =
                          Array.isArray(act.questionIds) &&
                          act.questionIds.includes(q.questionId);
                        return (
                          <label
                            key={q.questionId}
                            className="flex items-start gap-2 text-sm cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                const copy = [...rule.actions];
                                const current = { ...(copy[index] || {}) };
                                const prevIds = Array.isArray(
                                  current.questionIds
                                )
                                  ? [...current.questionIds]
                                  : [];
                                if (e.target.checked) {
                                  prevIds.push(q.questionId);
                                } else {
                                  const pos = prevIds.indexOf(q.questionId);
                                  if (pos !== -1) prevIds.splice(pos, 1);
                                }
                                current.questionIds = prevIds;
                                copy[index] = current;
                                setRule({ ...rule, actions: copy });
                              }}
                              className="mt-1 w-4 h-4 rounded border-gray-300 flex-shrink-0"
                            />
                            <span className="whitespace-normal break-words text-sm">
                              {q.label}
                            </span>
                          </label>
                        );
                      })}
                  </div>
                </div>
              )}

              {act.type === "show_message" && (
                <textarea
                  className="w-full border-2 border-gray-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 p-2.5 rounded-lg text-sm transition-all outline-none resize-none"
                  placeholder="Message to display to user..."
                  rows={3}
                  value={act.message || ""}
                  onChange={(e) => {
                    const copy = [...rule.actions];
                    copy[index].message = e.target.value;
                    setRule({ ...rule, actions: copy });
                  }}
                />
              )}

              {act.type === "raise_ticket" && (
                <button
                  type="button"
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors"
                  onClick={() => openTicketFormForAction(act, index)}
                >
                  <Sparkles className="w-4 h-4" />
                  Configure Ticket
                </button>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-red-50 hover:bg-red-100 text-red-600 border-2 border-red-200 rounded-lg transition-colors"
                  onClick={() =>
                    setRule((r) => ({
                      ...r,
                      actions: r.actions.filter((_, i) => i !== index),
                    }))
                  }
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Remove
                </button>
              </div>
            </div>
          ))}

          <button
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors"
            onClick={() =>
              setRule((r) => ({
                ...r,
                actions: [...r.actions, { ...emptyAction }],
              }))
            }
          >
            <Plus className="w-4 h-4" />
            Add Action
          </button>
        </div>

        <div className="flex gap-3 pt-4 border-t-2 border-gray-200">
          <button
            className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={onSave}
            disabled={saving}
          >
            <Save className="w-4 h-4" />
            {saving
              ? "Saving..."
              : rule.ruleId
              ? "Update Branch"
              : "Save Branch"}
          </button>
          {rule.ruleId && (
            <button
              className="px-6 py-3 rounded-lg border-2 border-red-500 text-red-600 font-semibold hover:bg-red-50 transition-colors flex items-center gap-2"
              onClick={() => onDelete(rule.ruleId)}
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          )}
        </div>
        <button
          className="w-full px-6 py-3 rounded-lg border-2 border-gray-300 text-gray-700 font-semibold hover:bg-gray-50 transition-colors"
          onClick={() => setRule(null)}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
