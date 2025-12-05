// File: components/RenderQuestion.js
"use client";

import QUESTION_TYPES from "@/enums/questionTypes";
import {
  CheckCircle,
  Circle,
  CheckSquare,
  Square,
  Star,
  Upload,
  GripVertical,
} from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

function SortableItem({ id }) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="flex items-center gap-2 p-3 rounded-lg border border-[color:var(--secondary-light)] dark:border-[color:var(--secondary-dark)] bg-[color:var(--bg-light)] dark:bg-[color:var(--bg-dark)] text-[color:var(--text-light)] dark:text-[color:var(--text-dark)] cursor-move"
    >
      <GripVertical className="text-[color:var(--secondary-light)]]" />
      <span className="font-medium">{id}</span>
    </li>
  );
}

/* --------------------------
   Helpers: normalize options
   -------------------------- */
const normalizeOptions = (opts = []) =>
  (opts || []).map((o, idx) =>
    typeof o === "string"
      ? { id: `opt_${idx}`, label: o }
      : {
          id: o.id ?? `opt_${idx}`,
          label: o.label ?? "",
          isOther: !!o.isOther,
          isNone: !!o.isNone,
        }
  );

const getSingleValue = (val) => {
  if (!val) return "";
  if (typeof val === "string") return val;
  if (typeof val === "object" && "value" in val) return val.value;
  return "";
};

const getCheckboxValues = (val) => {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  if (typeof val === "object" && Array.isArray(val.values)) return val.values;
  return [];
};

export default function RenderQuestion({
  question,
  value,
  onChange,
  config = {},
  inputClasses,
}) {
  const questionType = question.type;
  const options = useMemo(
    () => normalizeOptions(config.options || []),
    [config.options]
  );

  // derived special options
  const otherOpt = options.find((o) => o.isOther);
  const noneOpt = options.find((o) => o.isNone);

  // local other text state to keep input snappy
  const [localOtherText, setLocalOtherText] = useState(() => {
    if (value && typeof value === "object") return value.otherText ?? "";
    return "";
  });
// --- Helpers for deterministic randomization (no hooks needed) ---
const hashString = (str) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) | 0;
  }
  return hash >>> 0; // unsigned
};

const deterministicShuffle = (arr, seed = "") => {
  const withKey = arr.map((item, idx) => {
    const h = hashString(seed + "::" + item + "::" + idx);
    return { item, key: h };
  });

  withKey.sort((a, b) => a.key - b.key);
  return withKey.map((x) => x.item);
};
const pickWeighted = (items) => {
  if (!items.length) return null;
  const total = items.reduce(
    (sum, x) => sum + (Number(x.weight) > 0 ? Number(x.weight) : 0),
    0
  );
  if (!total) return items[Math.floor(Math.random() * items.length)];
  let r = Math.random() * total;
  for (const item of items) {
    const w = Number(item.weight) > 0 ? Number(item.weight) : 0;
    if (r < w) return item;
    r -= w;
  }
  return items[items.length - 1];
};
  useEffect(() => {
    if (value && typeof value === "object") {
      const ot = value.otherText ?? "";
      if (ot !== localOtherText) setLocalOtherText(ot);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  switch (questionType) {
    case QUESTION_TYPES.CONTACT_EMAIL:
    case QUESTION_TYPES.CONTACT_WEBSITE:
      return (
        <input
          type="email"
          placeholder={config.placeholder}
          className={inputClasses}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case QUESTION_TYPES.CONTACT_PHONE:
      return (
        <input
          type="tel"
          placeholder={config.placeholder}
          className={inputClasses}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case QUESTION_TYPES.CONTACT_ADDRESS:
    case QUESTION_TYPES.LONG_TEXT:
      return (
        <textarea
          placeholder={config.placeholder}
          className={`${inputClasses} min-h-[120px] bg-[color:var(--bg-light)] dark:bg-[color:var(--bg-dark)]"
  resize-none`}
          value={value ?? ""}
          maxLength={config.maxLength}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case QUESTION_TYPES.PRICE_SENSITIVITY: {
      const currency = config.currency || "₹";
      const min = config.min ?? 0;
      const max = config.max ?? undefined;
      const step = config.step ?? 1;

      const labels = {
        tooCheap: config.tooCheapLabel || "Too cheap",
        cheap: config.cheapLabel || "Cheap / good value",
        expensive: config.expensiveLabel || "Expensive but still acceptable",
        tooExpensive:
          config.tooExpensiveLabel || "Too expensive",
      };

      // store as object: { tooCheap, cheap, expensive, tooExpensive }
      const current = value || {
        tooCheap: "",
        cheap: "",
        expensive: "",
        tooExpensive: "",
      };

      const handleChange = (key, raw) => {
        const num = raw === "" ? "" : Number(raw);
        const next = { ...current, [key]: num };
        onChange(next);
      };

      const inputProps = {
        type: "number",
        className: inputClasses,
        min,
        step,
        ...(max != null ? { max } : {}),
      };

      const rows = [
        ["tooCheap", labels.tooCheap],
        ["cheap", labels.cheap],
        ["expensive", labels.expensive],
        ["tooExpensive", labels.tooExpensive],
      ];

      return (
        <div className="space-y-4">
          {config.showHelperText && (
            <p className="text-sm text-center text-gray-600 dark:text-gray-300">
              Please enter the price ({currency}) at which each statement
              becomes true for you.
            </p>
          )}

          <div className="space-y-3">
            {rows.map(([key, label]) => (
              <div
                key={key}
                className="flex items-center gap-3 p-3 rounded-xl border border-[color:var(--secondary-light)] dark:border-[color:var(--secondary-dark)] bg-[color:var(--bg-light)] dark:bg-[color:var(--bg-dark)]"
              >
                <div className="flex-1 text-sm font-medium text-[color:var(--text-light)] dark:text-[color:var(--text-dark)]">
                  {label}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">{currency}</span>
                  <input
                    {...inputProps}
                    value={
                      current[key] === "" || current[key] == null
                        ? ""
                        : current[key]
                    }
                    onChange={(e) => handleChange(key, e.target.value)}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    case QUESTION_TYPES.SHORT_TEXT:
    case QUESTION_TYPES.NUMBER:
      return (
        <input
          type={questionType === QUESTION_TYPES.NUMBER ? "number" : "text"}
          placeholder={config.placeholder}
          className={inputClasses}
          value={value ?? ""}
          maxLength={config.maxLength}
          onChange={(e) =>
            onChange(
              questionType === QUESTION_TYPES.NUMBER
                ? e.target.value === ""
                  ? ""
                  : Number(e.target.value)
                : e.target.value
            )
          }
        />
      );

    case QUESTION_TYPES.RATING: {
      const max = config.maxStars || 5;
      return (
        <div className="flex gap-2">
          {Array.from({ length: max }, (_, i) => i + 1).map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => onChange(star)}
              className="focus:outline-none"
            >
              <Star
                className={`w-8 h-8 transition-transform transform hover:scale-110 ${
                  (value ?? 0) >= star
                    ? "text-[color:var(--primary-light)] "
                    : "text-[color:var(--text-light)]  dark:text-[color:var(--text-dark)]"
                }`}
                fill={(value ?? 0) >= star ? "#f97316" : "none"}
              />
            </button>
          ))}
        </div>
      );
    }
case QUESTION_TYPES.SEQUENTIAL_MONADIC: {
  const concepts = Array.isArray(config.concepts) ? config.concepts : [];
  const metrics = Array.isArray(config.metrics) ? config.metrics : [];

  const showProgressBar = Boolean(config.showProgressBar);
  const showConceptIndex = Boolean(config.showConceptIndex);
  const showOpenEndedPerConcept = Boolean(config.showOpenEndedPerConcept);
  const openEndedLabel =
    config.openEndedLabel ||
    "What did you like or dislike about this concept?";
  const showSummaryScreen = Boolean(config.showSummaryScreen);
  const summaryQuestionLabel =
    config.summaryQuestionLabel ||
    "Now that you’ve seen all concepts, which one do you prefer overall?";
  const summaryMetricId = config.summaryMetricId || "overall_choice";

  // value structure:
  // {
  //   answers: {
  //     [conceptId]: {
  //       ratings: { [metricId]: number },
  //       openText: string
  //     }
  //   },
  //   summaryChoice: conceptId | null
  // }

  const [sequence, setSequence] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [isSummaryMode, setIsSummaryMode] = useState(false);

  useEffect(() => {
    if (!concepts.length || sequence.length) return;

    let ids = concepts.map((c, i) => c.id || `c_${i + 1}`);

    if (config.sequenceMode === "random" || config.sequenceMode === "random_subset") {
      // Fisher-Yates
      const arr = [...ids];
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      ids = arr;
    }

    if (
      config.sequenceMode === "random_subset" &&
      Number(config.maxConceptsPerRespondent) > 0
    ) {
      const limit = Math.min(
        Number(config.maxConceptsPerRespondent),
        ids.length
      );
      ids = ids.slice(0, limit);
    }

    setSequence(ids);
  }, [concepts, config.sequenceMode, config.maxConceptsPerRespondent, sequence.length]);

  if (!concepts.length) {
    return (
      <p className="text-sm text-red-500">
        No concepts configured for sequential monadic test.
      </p>
    );
  }

  if (!sequence.length) {
    return (
      <p className="text-sm text-gray-500">
        Preparing concept sequence...
      </p>
    );
  }

  const answers = (value && value.answers) || {};
  const summaryChoice = value?.summaryChoice || null;

  const currentConceptId = sequence[currentIdx];
  const currentConcept =
    concepts.find((c) => (c.id || "").toString() === currentConceptId) ||
    concepts[0];

  const currentConceptAnswers = answers[currentConceptId] || {
    ratings: {},
    openText: "",
  };

  const totalSteps = sequence.length + (showSummaryScreen ? 1 : 0);
  const currentStep = isSummaryMode ? sequence.length + 1 : currentIdx + 1;

  const handleMetricChange = (metricId, newVal) => {
    const nextAnswers = {
      ...answers,
      [currentConceptId]: {
        ...(answers[currentConceptId] || { ratings: {}, openText: "" }),
        ratings: {
          ...(answers[currentConceptId]?.ratings || {}),
          [metricId]: newVal,
        },
      },
    };

    onChange({
      ...(value || {}),
      answers: nextAnswers,
    });
  };

  const handleOpenTextChange = (txt) => {
    const nextAnswers = {
      ...answers,
      [currentConceptId]: {
        ...(answers[currentConceptId] || { ratings: {}, openText: "" }),
        openText: txt,
      },
    };

    onChange({
      ...(value || {}),
      answers: nextAnswers,
    });
  };

  const handleSummaryChoice = (conceptId) => {
    onChange({
      ...(value || {}),
      answers,
      summaryChoice: conceptId,
    });
  };

  const goNext = () => {
    if (isSummaryMode) return;
    if (currentIdx < sequence.length - 1) {
      setCurrentIdx((x) => x + 1);
    } else if (showSummaryScreen) {
      setIsSummaryMode(true);
    }
  };

  const goPrev = () => {
    if (isSummaryMode) {
      setIsSummaryMode(false);
      setCurrentIdx(sequence.length - 1);
      return;
    }
    if (currentIdx > 0) {
      setCurrentIdx((x) => x - 1);
    }
  };

  const renderMetricControl = (metric, val) => {
    const min = metric.min ?? 1;
    const max = metric.max ?? 5;

    if (metric.type === "star") {
      return (
        <div className="flex gap-2">
          {Array.from({ length: max - min + 1 }, (_, i) => min + i).map(
            (score) => (
              <button
                key={score}
                type="button"
                onClick={() => handleMetricChange(metric.id, score)}
                className="focus:outline-none"
              >
                <svg
                  className={`w-7 h-7 ${
                    val >= score
                      ? "text-[color:var(--primary-light)]"
                      : "text-gray-300 dark:text-gray-600"
                  }`}
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill={val >= score ? "currentColor" : "none"}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M11.48 3.5a.75.75 0 011.04 0l2.02 2.032a.75.75 0 00.564.22l2.867-.24a.75.75 0 01.79.978l-.94 2.71a.75.75 0 00.222.79l2.144 1.916a.75.75 0 01-.302 1.29l-2.73.77a.75.75 0 00-.52.46l-1.02 2.64a.75.75 0 01-1.4 0l-1.02-2.64a.75.75 0 00-.52-.46l-2.73-.77a.75.75 0 01-.302-1.29l2.144-1.916a.75.75 0 00.222-.79l-.94-2.71a.75.75 0 01.79-.978l2.867.24a.75.75 0 00.564-.22L11.48 3.5z"
                  />
                </svg>
              </button>
            )
          )}
        </div>
      );
    }

    if (metric.type === "slider") {
      return (
        <div className="flex items-center gap-3">
          {metric.leftLabel && (
            <span className="text-xs text-gray-500 w-20 text-right">
              {metric.leftLabel}
            </span>
          )}
          <input
            type="range"
            min={min}
            max={max}
            value={val ?? Math.round((min + max) / 2)}
            onChange={(e) =>
              handleMetricChange(metric.id, Number(e.target.value))
            }
            className="flex-1"
          />
          {metric.rightLabel && (
            <span className="text-xs text-gray-500 w-20">
              {metric.rightLabel}
            </span>
          )}
          <span className="text-xs text-gray-600 w-8 text-right">
            {val ?? "-"}
          </span>
        </div>
      );
    }

    // default: likert buttons
    return (
      <div className="space-y-2">
        <div className="flex justify-between text-[10px] text-gray-500 mb-1">
          <span>{metric.leftLabel}</span>
          <span>{metric.rightLabel}</span>
        </div>
        <div className="flex gap-2 flex-wrap">
          {Array.from({ length: max - min + 1 }, (_, i) => min + i).map(
            (score) => (
              <button
                key={score}
                type="button"
                onClick={() => handleMetricChange(metric.id, score)}
                className={`w-9 h-9 rounded-full text-xs font-medium transition-all ${
                  val === score
                    ? "bg-[color:var(--primary-light)] text-white shadow"
                    : "bg-[color:var(--bg-light)] dark:bg-[color:var(--bg-dark)] text-[color:var(--text-light)] dark:text-[color:var(--text-dark)] hover:bg-[color:var(--primary-light)] hover:text-white"
                }`}
              >
                {score}
              </button>
            )
          )}
        </div>
      </div>
    );
  };

  if (isSummaryMode && showSummaryScreen) {
    return (
      <div className="space-y-4">
        {showProgressBar && (
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 mb-2">
            <div
              className="bg-[color:var(--primary-light)] h-1.5 rounded-full"
              style={{
                width: `${(currentStep / totalSteps) * 100}%`,
              }}
            />
          </div>
        )}

        <p className="text-sm font-medium mb-2">
          {summaryQuestionLabel}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {sequence.map((cid) => {
            const c =
              concepts.find((cc) => (cc.id || "").toString() === cid) ||
              concepts[0];

            const isSelected = summaryChoice === cid;

            return (
              <button
                key={cid}
                type="button"
                onClick={() => handleSummaryChoice(cid)}
                className={`text-left rounded-xl p-3 border transition-all ${
                  isSelected
                    ? "border-[color:var(--primary-light)] bg-[color:var(--primary-light)]/10"
                    : "border-[color:var(--secondary-light)] bg-[color:var(--bg-light)] dark:bg-[color:var(--bg-dark)]"
                }`}
              >
                <div className="font-medium text-sm mb-1">
                  {c.name || cid}
                </div>
                {c.price && (
                  <div className="text-xs text-[color:var(--secondary-light)] dark:text-[color:var(--secondary-dark)]">
                    {c.price}
                  </div>
                )}
                {c.tag && (
                  <div className="mt-1 text-[10px] uppercase tracking-wide inline-flex px-2 py-1 rounded-full bg-[color:var(--primary-light)]/10 text-[color:var(--primary-light)]">
                    {c.tag}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex justify-between pt-4">
          <button
            type="button"
            onClick={goPrev}
            className="px-4 py-2 rounded-lg border text-xs"
          >
            Back to last concept
          </button>
        </div>
      </div>
    );
  }

  // Normal per-concept view
  return (
    <div className="space-y-6">
      {/* Progress */}
      {(showProgressBar || showConceptIndex) && (
        <div className="space-y-1">
          {showProgressBar && (
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
              <div
                className="bg-[color:var(--primary-light)] h-1.5 rounded-full"
                style={{
                  width: `${(currentStep / totalSteps) * 100}%`,
                }}
              />
            </div>
          )}
          {showConceptIndex && (
            <div className="text-xs text-gray-500">
              Concept {currentIdx + 1} of {sequence.length}
              {showSummaryScreen ? ` (Step ${currentStep} of ${totalSteps})` : ""}
            </div>
          )}
        </div>
      )}

      {/* Concept card */}
      <div className="rounded-2xl border border-[color:var(--secondary-light)] dark:border-[color:var(--secondary-dark)] bg-[color:var(--bg-light)] dark:bg-[color:var(--bg-dark)] p-4 sm:p-6 flex flex-col md:flex-row gap-4">
        {currentConcept.imageUrl && (
          <div className="w-full md:w-1/3">
            <img
              src={currentConcept.imageUrl}
              alt={currentConcept.name || "Concept"}
              className="w-full h-40 object-cover rounded-xl shadow-sm"
            />
          </div>
        )}
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            {currentConcept.tag && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-[10px] uppercase tracking-wide bg-[color:var(--primary-light)]/10 text-[color:var(--primary-light)]">
                {currentConcept.tag}
              </span>
            )}
          </div>

          <h3 className="text-lg font-semibold text-[color:var(--text-light)] dark:text-[color:var(--text-dark)]">
            {currentConcept.name}
          </h3>

          {currentConcept.price && (
            <p className="text-sm font-medium text-[color:var(--secondary-light)] dark:text-[color:var(--secondary-dark)]">
              {currentConcept.price}
            </p>
          )}

          {currentConcept.description && (
            <p className="text-sm text-[color:var(--text-light)]/80 dark:text-[color:var(--text-dark)]/80">
              {currentConcept.description}
            </p>
          )}
        </div>
      </div>

      {/* Metrics */}
      <div className="space-y-4">
        {metrics.map((m) => {
          const val =
            currentConceptAnswers.ratings?.[m.id] ?? null;
          return (
            <div key={m.id} className="space-y-2">
              <p className="text-sm font-medium">{m.label}</p>
              {renderMetricControl(m, val)}
            </div>
          );
        })}
      </div>

      {/* Open-ended */}
      {showOpenEndedPerConcept && (
        <div className="space-y-2">
          <p className="text-sm font-medium">{openEndedLabel}</p>
          <textarea
            className={inputClasses}
            rows={4}
            value={currentConceptAnswers.openText || ""}
            onChange={(e) => handleOpenTextChange(e.target.value)}
            placeholder="Type your feedback..."
          />
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between pt-4">
        <button
          type="button"
          onClick={goPrev}
          disabled={currentIdx === 0}
          className="px-4 py-2 rounded-lg border text-xs disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Previous concept
        </button>

        <button
          type="button"
          onClick={goNext}
          className="px-4 py-2 rounded-lg bg-[color:var(--primary-light)] text-white text-xs shadow hover:opacity-90"
        >
          {currentIdx === sequence.length - 1
            ? showSummaryScreen
              ? "Continue to summary"
              : "Next"
            : "Next concept"}
        </button>
      </div>
    </div>
  );
}

    case QUESTION_TYPES.MULTIPLE_CHOICE: {
      const selected = getSingleValue(value);

      // Order: regular options first, then Other, then None
      const nonSpecial = options.filter((o) => !o.isOther && !o.isNone);
      const optionsOrdered = [
        ...nonSpecial,
        ...(otherOpt ? [otherOpt] : []),
        ...(noneOpt ? [noneOpt] : []),
      ];

      return (
        <div className="space-y-3">
          {optionsOrdered.map((opt) => {
            const checked = selected === opt.id;
            return (
              <label
                key={opt.id}
                className={`flex items-center p-4 rounded-3xl lg:rounded-xl lg:border-2  cursor-pointer transition-all duration-200 hover:scale-105 ${
                  checked
                    ? "bg-[color:var(--primary-light)] dark:bg-[color:var(--primary-dark)] lg:border-[color:var(--primary-light)] text-white"
                    : "bg-[color:var(--bg-light)] dark:bg-[color:var(--bg-dark)] shadow-md  border-[color:var(--secondary-light)] text-[color:var(--text-light)] dark:text-[color:var(--text-dark)] hover:bg-[color:var(--primary-light)] dark:hover:bg-[color:var(--primary-dark)]"
                }`}
              >
                <div className="flex items-center">
                  {checked ? (
                    <CheckCircle size={20} className="mr-3" />
                  ) : (
                    <Circle size={20} className="mr-3" />
                  )}
                </div>
                <input
                  type="radio"
                  name={question.questionId}
                  value={opt.id}
                  checked={checked}
                  onChange={() => {
                    if (noneOpt && opt.id === noneOpt.id) {
                      onChange(opt.id);
                      return;
                    }
                    if (otherOpt && opt.id === otherOpt.id) {
                      onChange({
                        value: opt.id,
                        otherText: localOtherText || "",
                      });
                      return;
                    }
                    onChange(opt.id);
                  }}
                  className="sr-only"
                />
                <span className="font-medium text-xs lg:text-base">
                  {opt.label}
                </span>
              </label>
            );
          })}

          {otherOpt && getSingleValue(value) === otherOpt.id && (
            <input
              className={`mt-2 ${inputClasses}`}
              placeholder="Please specify..."
              value={(value && value.otherText) ?? localOtherText ?? ""}
              onChange={(e) => {
                setLocalOtherText(e.target.value);
                const cur = getSingleValue(value);
                if (cur === otherOpt.id) {
                  onChange({ value: cur, otherText: e.target.value });
                }
              }}
            />
          )}
        </div>
      );
    }

    case QUESTION_TYPES.DROPDOWN: {
      const selected = getSingleValue(value);

      const nonSpecial = options.filter((o) => !o.isOther && !o.isNone);
      const optionsOrdered = [
        ...nonSpecial,
        ...(otherOpt ? [otherOpt] : []),
        ...(noneOpt ? [noneOpt] : []),
      ];

      return (
        <div>
          <select
            value={selected || ""}
            onChange={(e) => {
              const val = e.target.value;
              if (noneOpt && val === noneOpt.id) {
                onChange(val);
                return;
              }
              if (otherOpt && val === otherOpt.id) {
                onChange({ value: val, otherText: localOtherText || "" });
                return;
              }
              onChange(val);
            }}
            className={inputClasses}
          >
            <option value="">Select an option...</option>
            {optionsOrdered.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>

          {otherOpt && getSingleValue(value) === otherOpt.id && (
            <input
              className={`mt-2 ${inputClasses}`}
              placeholder="Please specify..."
              value={(value && value.otherText) ?? localOtherText ?? ""}
              onChange={(e) => {
                setLocalOtherText(e.target.value);
                const cur = getSingleValue(value);
                if (cur === otherOpt.id) {
                  onChange({ value: cur, otherText: e.target.value });
                }
              }}
            />
          )}
        </div>
      );
    }
case QUESTION_TYPES.FORCED_EXPOSURE: {
  const {
    contentType = "text",
    title,
    body,
    longText = "",
    imageUrl,
    videoUrl,
    embedUrl,
    minExposureSeconds = 10,
    showCountdown = true,
    showProgressBar = true,
    requireScrollToEnd = true,
    scrollBlockingHeight = 320,
    allowEarlyExitWithReason = false,
    earlyExitLabel = "I cannot view this content",
    earlyExitRequiredReason = true,
    showSystemHint = true,
    systemHint,
  } = config || {};

  const [secondsLeft, setSecondsLeft] = useState(minExposureSeconds);
  const [timerStarted, setTimerStarted] = useState(false);
  const [timerDone, setTimerDone] = useState(false);
  const [scrolledToEnd, setScrolledToEnd] = useState(!requireScrollToEnd);
  const [earlyExitReason, setEarlyExitReason] = useState(
    value?.earlyExitReason || ""
  );
  const [hasEarlyExited, setHasEarlyExited] = useState(
    Boolean(value?.earlyExit)
  );

  const exposureComplete = value?.exposureComplete || false;

  // start / reset when config or question changes
  useEffect(() => {
    setSecondsLeft(minExposureSeconds);
    setTimerStarted(false);
    setTimerDone(false);
    setScrolledToEnd(!requireScrollToEnd);
    setHasEarlyExited(Boolean(value?.earlyExit));
  }, [minExposureSeconds, requireScrollToEnd, question?.questionId]);

  // timer
  useEffect(() => {
    if (timerDone || hasEarlyExited) return;
    if (!timerStarted) {
      setTimerStarted(true);
    }

    if (secondsLeft <= 0) {
      setTimerDone(true);
      return;
    }

    const id = setInterval(() => {
      setSecondsLeft((s) => (s > 0 ? s - 1 : 0));
    }, 1000);

    return () => clearInterval(id);
  }, [secondsLeft, timerDone, hasEarlyExited, timerStarted]);

  // mark exposureComplete once both conditions satisfied
  useEffect(() => {
    const unlocked = (timerDone || minExposureSeconds <= 0) && scrolledToEnd;

    if (unlocked && !exposureComplete && !hasEarlyExited) {
      onChange({
        ...(value || {}),
        exposureComplete: true,
        unlockedAt: new Date().toISOString(),
      });
    }
  }, [
    timerDone,
    scrolledToEnd,
    exposureComplete,
    hasEarlyExited,
    minExposureSeconds,
  ]);

  const handleScroll = (e) => {
    if (!requireScrollToEnd) return;
    const el = e.currentTarget;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 4) {
      setScrolledToEnd(true);
    }
  };

  const handleEarlyExit = () => {
    if (
      earlyExitRequiredReason &&
      !earlyExitReason.trim()
    ) {
      alert("Please provide a reason to continue.");
      return;
    }

    const payload = {
      ...(value || {}),
      earlyExit: true,
      earlyExitReason: earlyExitReason.trim() || null,
      exposureComplete: true, // mark as complete but flagged
      unlockedAt: new Date().toISOString(),
    };

    setHasEarlyExited(true);
    onChange(payload);
  };

  const effectiveHint =
    systemHint ||
    "You’ll be able to continue once the timer finishes and you’ve viewed all content.";

  const lockActive =
    !exposureComplete && !hasEarlyExited && !((timerDone || minExposureSeconds <= 0) && scrolledToEnd);

  const progressRatio =
    minExposureSeconds > 0
      ? (minExposureSeconds - secondsLeft) / minExposureSeconds
      : 1;

  // Render content depending on type
  const renderInnerContent = () => {
    if (contentType === "image" && imageUrl) {
      return (
        <div className="flex justify-center">
          <img
            src={imageUrl}
            alt="Forced exposure asset"
            className="max-h-[480px] w-auto rounded-xl shadow-md"
          />
        </div>
      );
    }

    if (contentType === "video" && videoUrl) {
      const isFile = /\.(mp4|webm|ogg)$/i.test(videoUrl);
      const embedYoutube = (() => {
        try {
          const url = new URL(videoUrl);
          if (
            url.hostname.includes("youtube.com") ||
            url.hostname.includes("youtu.be")
          ) {
            const id =
              url.searchParams.get("v") || url.pathname.split("/").pop();
            return `https://www.youtube.com/embed/${id}`;
          }
          return null;
        } catch {
          return null;
        }
      })();

      if (isFile) {
        return (
          <video
            controls
            className="w-full rounded-xl bg-black"
            onPlay={() => {
              // optional: start timer on first play - already auto started
            }}
          >
            <source src={videoUrl} />
          </video>
        );
      }

      if (embedYoutube) {
        return (
          <div className="w-full aspect-video rounded-xl overflow-hidden">
            <iframe
              src={embedYoutube}
              title="Video"
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        );
      }

      return (
        <div className="w-full aspect-video rounded-xl overflow-hidden">
          <iframe
            src={videoUrl}
            title="Video"
            className="w-full h-full"
          />
        </div>
      );
    }

    if (contentType === "embed" && embedUrl) {
      return (
        <div className="w-full h-[360px] rounded-xl overflow-hidden border">
          <iframe
            src={embedUrl}
            title="Embedded content"
            className="w-full h-full"
          />
        </div>
      );
    }

    // default: scrollable text
    const text = longText || body || "";
    return (
      <div
        style={{ maxHeight: scrollBlockingHeight }}
        className="overflow-y-auto rounded-xl border border-[color:var(--secondary-light)] dark:border-[color:var(--secondary-dark)] bg-[color:var(--bg-light)] dark:bg-[color:var(--bg-dark)] p-4 text-sm leading-relaxed"
        onScroll={handleScroll}
      >
        {text.split("\n").map((p, i) => (
          <p key={i} className="mb-2">
            {p}
          </p>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Title & body */}
      {title && (
        <h3 className="text-lg font-semibold text-[color:var(--text-light)] dark:text-[color:var(--text-dark)]">
          {title}
        </h3>
      )}
      {body && contentType !== "text" && (
        <p className="text-sm text-[color:var(--text-light)]/80 dark:text-[color:var(--text-dark)]/80">
          {body}
        </p>
      )}

      {/* Content wrapper */}
      {requireScrollToEnd && (contentType === "text" || contentType === "embed") && (
        <p className="text-xs text-gray-500 mb-1">
          Scroll to the bottom to unlock.
        </p>
      )}

      {renderInnerContent()}

      {/* Timer + status */}
      <div className="space-y-2 mt-2">
        {(showCountdown || showProgressBar) && (
          <div className="flex flex-col gap-1">
            {showProgressBar && minExposureSeconds > 0 && (
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                <div
                  className="bg-[color:var(--primary-light)] h-1.5 rounded-full transition-all"
                  style={{ width: `${Math.min(100, Math.max(0, progressRatio * 100))}%` }}
                />
              </div>
            )}

            {showCountdown && minExposureSeconds > 0 && !hasEarlyExited && (
              <div className="text-xs text-gray-600 dark:text-gray-300">
                {timerDone
                  ? "Time requirement complete."
                  : `Please wait at least ${secondsLeft}s before continuing.`}
              </div>
            )}
          </div>
        )}

        {showSystemHint && (
          <div className="text-[11px] text-gray-500">
            {effectiveHint}
          </div>
        )}

        {requireScrollToEnd && !scrolledToEnd && (
          <div className="text-[11px] text-orange-600 dark:text-orange-300">
            Please scroll to the bottom of the content.
          </div>
        )}

        {lockActive && (
          <div className="text-[11px] text-red-500">
            You won&apos;t be able to move forward until the time and scroll
            requirements are satisfied.
          </div>
        )}
      </div>

      {/* Early exit */}
      {allowEarlyExitWithReason && !hasEarlyExited && (
        <div className="mt-3 space-y-2">
          <p className="text-xs text-gray-500">
            If you cannot view this content due to technical reasons, you can
            request to skip, but your reason will be logged.
          </p>

          {earlyExitRequiredReason && (
            <textarea
              className={inputClasses}
              rows={3}
              placeholder="Describe the issue (e.g., video won’t load, corporate firewall, etc.)"
              value={earlyExitReason}
              onChange={(e) => setEarlyExitReason(e.target.value)}
            />
          )}

          <button
            type="button"
            onClick={handleEarlyExit}
            className="px-4 py-2 rounded-lg border text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
          >
            {earlyExitLabel || "I cannot view this content"}
          </button>
        </div>
      )}

      {hasEarlyExited && (
        <p className="mt-2 text-xs text-yellow-600 dark:text-yellow-300">
          You have marked this content as not viewable. The survey may route
          you differently based on this.
        </p>
      )}
    </div>
  );
}

    case QUESTION_TYPES.LEGAL:
      return (
        <div className="space-y-5">
          <div className="bg-[color:var(--primary-light)] dark:bg-[color:var(--primary-dark)] p-4 rounded-xl border-l-4 border-[color:var(--secondary-light)] dark:border-[color:var(--secondary-dark)] text-[color:var(--text-light)] dark:text-[color:var(--text-dark)] text-sm">
            {config.legalText ||
              "Please review and accept the terms and conditions before continuing."}
          </div>
          <label className="flex items-center gap-2 text-sm text-[color:var(--text-light)] dark:text-[color:var(--text-dark)]">
            <input
              type="checkbox"
              checked={value === true}
              onChange={(e) => onChange(e.target.checked)}
              className="accent-[color:var(--primary-light)]"
            />
            <span>
              {config.checkboxLabel || "I agree to the terms and conditions."}
            </span>
          </label>
        </div>
      );
    case QUESTION_TYPES.SEMANTIC_DIFF: {
      const items = config.items || [];
      const min = config.scaleMin ?? 1;
      const max = config.scaleMax ?? 7;
      const showNumbers = config.showNumbers ?? true;
      const current = value || {};

      const scaleValues = Array.from(
        { length: max - min + 1 },
        (_, i) => min + i
      );

      const handleClick = (itemId, score) => {
        onChange({
          ...(current || {}),
          [itemId]: score,
        });
      };

      return (
        <div className="space-y-4 w-full">
          {items.map((item) => {
            const selected = current[item.id];

            return (
              <div
                key={item.id}
                className="flex flex-col gap-2 p-3 rounded-xl border border-[color:var(--secondary-light)] dark:border-[color:var(--secondary-dark)] bg-[color:var(--bg-light)] dark:bg-[color:var(--bg-dark)]"
              >
                <div className="flex justify-between text-xs sm:text-sm text-[color:var(--text-light)] dark:text-[color:var(--text-dark)]">
                  <span>{item.left}</span>
                  <span>{item.right}</span>
                </div>

                <div className="flex justify-center gap-2 mt-1 flex-wrap">
                  {scaleValues.map((score) => {
                    const isActive = selected === score;
                    return (
                      <button
                        key={score}
                        type="button"
                        onClick={() => handleClick(item.id, score)}
                        className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full text-xs sm:text-sm font-medium transition-all border ${
                          isActive
                            ? "bg-[color:var(--primary-light)] text-white border-[color:var(--primary-light)]"
                            : "bg-[color:var(--bg-light)] dark:bg-[color:var(--bg-dark)] text-[color:var(--text-light)] dark:text-[color:var(--text-dark)] border-[color:var(--secondary-light)] hover:bg-[color:var(--primary-light)] hover:text-white"
                        }`}
                      >
                        {showNumbers ? score : ""}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      );
    }
    // ...
    case QUESTION_TYPES.GABOR_GRANGER: {
      // config from GaborGrangerConfig
      const prices = Array.isArray(config.pricePoints) ? config.pricePoints : [];
      const currency = config.currencySymbol || "₹";
      const scaleMode = config.scaleMode || "likert";
      const likertOptions =
        config.likertOptions && config.likertOptions.length
          ? config.likertOptions
          : [
              "Definitely would buy",
              "Probably would buy",
              "Might or might not buy",
              "Probably would not buy",
              "Definitely would not buy",
            ];
      const yesLabel = config.yesLabel || "Yes";
      const noLabel = config.noLabel || "No";

      // store answers as: { responses: { [price]: selectedValue } }
      const responses = (value && value.responses) || {};

      const [currentIndex, setCurrentIndex] = useState(0);
      const currentPrice = prices[currentIndex];

      if (!prices.length) {
        return (
          <div className="p-4 rounded-xl bg-yellow-50 dark:bg-yellow-900 text-sm text-yellow-800 dark:text-yellow-200">
            No price points configured. Please add them in the designer.
          </div>
        );
      }

      const handleSelect = (answerValue) => {
        const next = {
          ...responses,
          [currentPrice]: answerValue,
        };
        onChange({ responses: next });
      };

      const canGoPrev = currentIndex > 0;
      const canGoNext = currentIndex < prices.length - 1;

      const goPrev = () => {
        if (!canGoPrev) return;
        setCurrentIndex((i) => i - 1);
      };

      const goNext = () => {
        if (!canGoNext) return;
        setCurrentIndex((i) => i + 1);
      };

      const currentResponse = responses[currentPrice];

      return (
        <div className="space-y-5">
          {/* current price pill */}
          <div className="text-center">
            <div className="inline-flex items-baseline gap-1 px-5 py-3 rounded-full bg-[color:var(--primary-light)] text-white text-lg font-semibold shadow-md">
              <span>{currency}</span>
              <span>{currentPrice}</span>
            </div>
            <p className="mt-2 text-xs text-[color:var(--text-light)] dark:text-[color:var(--text-dark)]">
              Price {currentIndex + 1} of {prices.length}
            </p>
          </div>

          {/* response options */}
          {scaleMode === "likert" ? (
            <div className="flex flex-col gap-3">
              {likertOptions.map((opt, idx) => {
                const selected = currentResponse === opt;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelect(opt)}
                    className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition-all ${
                      selected
                        ? "bg-[color:var(--primary-light)] text-white border-[color:var(--primary-light)] shadow-md"
                        : "bg-[color:var(--bg-light)] dark:bg-[color:var(--bg-dark)] border-[color:var(--secondary-light)] dark:border-[color:var(--secondary-dark)] text-[color:var(--text-light)] dark:text-[color:var(--text-dark)] hover:bg-[color:var(--primary-light)] hover:text-white"
                    }`}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="flex gap-4 justify-center">
              {[{ key: "yes", label: yesLabel }, { key: "no", label: noLabel }].map(
                (opt) => {
                  const selected = currentResponse === opt.key;
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => handleSelect(opt.key)}
                      className={`flex-1 max-w-xs px-4 py-3 rounded-xl border font-medium text-sm transition-all ${
                        selected
                          ? "bg-[color:var(--primary-light)] text-white border-[color:var(--primary-light)] shadow-md"
                          : "bg-[color:var(--bg-light)] dark:bg-[color:var(--bg-dark)] border-[color:var(--secondary-light)] dark:border-[color:var(--secondary-dark)] text-[color:var(--text-light)] dark:text-[color:var(--text-dark)] hover:bg-[color:var(--primary-light)] hover:text-white"
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                }
              )}
            </div>
          )}

          {/* navigation between price points */}
          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={goPrev}
              disabled={!canGoPrev}
              className="px-3 py-2 rounded-lg text-xs border border-gray-300 disabled:opacity-40 disabled:cursor-not-allowed dark:border-gray-600 dark:text-[#CBC9DE]"
            >
              Previous price
            </button>
            <div className="flex gap-1">
              {prices.map((p, idx) => (
                <div
                  key={`${p}-${idx}`}
                  className={`w-2 h-2 rounded-full ${
                    idx === currentIndex
                      ? "bg-[color:var(--primary-light)]"
                      : "bg-gray-300 dark:bg-gray-600"
                  }`}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={goNext}
              disabled={!canGoNext}
              className="px-3 py-2 rounded-lg text-xs border border-gray-300 disabled:opacity-40 disabled:cursor-not-allowed dark:border-gray-600 dark:text-[#CBC9DE]"
            >
              Next price
            </button>
          </div>
        </div>
      );
    }

    case QUESTION_TYPES.YES_NO:
      return (
        <div className="flex gap-4">
          {["yes", "no"].map((opt) => (
            <label
              key={opt}
              className={`flex-1 flex items-center justify-center p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 hover:scale-105 ${
                value === opt
                  ? "bg-[color:var(--primary-light)] dark:bg-[color:var(--primary-dark)] text-white"
                  : "bg-[color:var(--bg-light)] dark:bg-[color:var(--bg-dark)] border-[color:var(--secondary-light)] dark:border-[color:var(--secondary-dark)] text-[color:var(--text-light)] dark:text-[color:var(--text-dark)] hover:bg-[color:var(--primary-light)] dark:hover:bg-[color:var(--primary-dark)]"
              }`}
            >
              <input
                type="radio"
                value={opt}
                checked={value === opt}
                onChange={() => onChange(opt)}
                className="sr-only"
              />
              <span className="font-medium">
                {opt === "yes"
                  ? config.yesLabel || "Yes"
                  : config.noLabel || "No"}
              </span>
            </label>
          ))}
        </div>
      );

    case QUESTION_TYPES.CHECKBOX: {
      const selected = getCheckboxValues(value);

      const nonSpecial = options.filter((o) => !o.isOther && !o.isNone);
      const optionsOrdered = [
        ...nonSpecial,
        ...(otherOpt ? [otherOpt] : []),
        ...(noneOpt ? [noneOpt] : []),
      ];

      return (
        <div className="space-y-3">
          {optionsOrdered.map((opt) => {
            const checked = selected.includes(opt.id);
            return (
              <label
                key={opt.id}
                className={`flex items-center p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 hover:scale-105 ${
                  checked
                    ? "bg-[color:var(--secondary-light)] border-[color:var(--secondary-dark)] text-white"
                    : "bg-[color:var(--primary-light)] dark:bg-[color:var(--primary-dark)] border-[color:var(--secondary-light)] dark:border-[color:var(--secondary-dark)] text-[color:var(--text-light)] dark:text-[color:var(--text-dark)] hover:bg-[color:var(--primary-light)] dark:hover:bg-[color:var(--primary-dark)]"
                }`}
              >
                <div className="flex items-center">
                  {checked ? (
                    <CheckSquare size={20} className="mr-3" />
                  ) : (
                    <Square size={20} className="mr-3" />
                  )}
                </div>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => {
                    const prev = selected.slice();
                    let next;
                    if (e.target.checked) {
                      next = [...prev, opt.id];
                    } else {
                      next = prev.filter((id) => id !== opt.id);
                    }

                    if (noneOpt) {
                      if (next.includes(noneOpt.id)) {
                        next = [noneOpt.id];
                      } else {
                        next = next.filter((id) => id !== noneOpt.id);
                      }
                    }

                    if (otherOpt && next.includes(otherOpt.id)) {
                      onChange({
                        values: next,
                        otherText: localOtherText || "",
                      });
                    } else {
                      onChange(next);
                    }
                  }}
                  className="sr-only"
                />
                <span className="font-medium">{opt.label}</span>
              </label>
            );
          })}

          {otherOpt && getCheckboxValues(value).includes(otherOpt.id) && (
            <input
              className={`mt-2 ${inputClasses}`}
              placeholder="Please specify..."
              value={(value && value.otherText) ?? localOtherText ?? ""}
              onChange={(e) => {
                setLocalOtherText(e.target.value);
                const prev = getCheckboxValues(value);
                if (prev.includes(otherOpt.id)) {
                  onChange({ values: prev, otherText: e.target.value });
                }
              }}
            />
          )}
        </div>
      );
    }

    case QUESTION_TYPES.PICTURE_CHOICE:
      return (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {config.images?.map((img, index) => (
            <button
              key={index}
              type="button"
              onClick={() => onChange(img.url)}
              className={`border-2 rounded-xl p-2 flex flex-col items-center justify-center shadow-sm transition-all ${
                value === img.url
                  ? "border-[color:var(--secondary-light)]]"
                  : "border-[color:var(--secondary-light)]] dark:border-[color:var(--secondary-dark)]]"
              }`}
            >
              <img
                src={img.url}
                alt={img.label || `Option ${index + 1}`}
                className="w-full h-32 object-cover rounded-md"
              />
              {img.label && (
                <span className="mt-2 text-sm font-medium text-[color:var(--text-light)] dark:text-[color:var(--text-dark)]">
                  {img.label}
                </span>
              )}
            </button>
          ))}
        </div>
      );

    case QUESTION_TYPES.OSAT: {
      const min = config.min || 1;
      const max = config.max || 5;
      const scaleLabels = config.labels || {};

      const [hoverValue, setHoverValue] = useState(null);

      return (
        <div className="flex flex-col items-center gap-3 w-full mt-4">
          <div className="flex gap-2">
            {Array.from({ length: max - min + 1 }, (_, i) => {
              const score = i + min;
              const activeValue = hoverValue || value;

              return (
                <button
                  key={score}
                  type="button"
                  onMouseEnter={() => setHoverValue(score)}
                  onMouseLeave={() => setHoverValue(null)}
                  onClick={() => onChange(score)}
                  className="focus:outline-none relative"
                >
                  <Star
                    className={`w-8 h-8 transition-transform transform hover:scale-110 ${
                      activeValue >= score
                        ? "text-[color:var(--primary-light)]"
                        : "text-[color:var(--text-light)] dark:text-[color:var(--text-dark)]"
                    }`}
                    fill={activeValue >= score ? "#f97316" : "none"}
                  />

                  {hoverValue === score && (
                    <div
                      className="
                  absolute -bottom-8 left-1/2 -translate-x-1/2 
                  px-2 py-1 text-xs rounded-md whitespace-nowrap 
                  bg-[color:var(--primary-light)] text-white shadow-md
                "
                    >
                      {scaleLabels[score] || ""}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {value && (
            <div className="text-sm  mt-4 text-[color:var(--text-light)] dark:text-[color:var(--text-dark)]">
              {scaleLabels[value] || `Selected: ${value}`}
            </div>
          )}
        </div>
      );
    }
    case QUESTION_TYPES.CONJOINT: {
      const cfg = config || {};
      const attributes = Array.isArray(cfg.attributes) ? cfg.attributes : [];
      const cardsPerTask = cfg.cardsPerTask || 3;

      // 🔹 Generate simple profiles using attribute levels
      const profiles = Array.from({ length: cardsPerTask }, (_, cardIndex) => ({
        id: `card_${cardIndex}`,
        attributes: attributes.map((attr, attrIdx) => {
          const levels = Array.isArray(attr.levels) ? attr.levels : [];
          const levelIdx =
            levels.length > 0 ? (cardIndex + attrIdx) % levels.length : 0;

          return {
            name: attr.name || `Attribute ${attrIdx + 1}`,
            level: levels[levelIdx] || "",
          };
        }),
      }));

      // 🔹 Read current selection (we store { chosenIndex, profiles })
      const selectedIdx =
        value && typeof value === "object" && value.chosenIndex !== undefined
          ? value.chosenIndex
          : null;

      return (
        <div className="space-y-3">
          <p className="text-xs text-[color:var(--text-light)] dark:text-[color:var(--text-dark)] mb-1">
            Please choose the option you would most likely pick.
          </p>
          <div className="grid gap-4 md:grid-cols-3">
            {profiles.map((profile, idx) => {
              const isSelected = selectedIdx === idx;
              return (
                <button
                  key={profile.id}
                  type="button"
                  onClick={() =>
                    onChange({
                      chosenIndex: idx,
                      profiles,
                    })
                  }
                  className={`w-full text-left rounded-xl border p-4 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 ${
                    isSelected
                      ? "border-[color:var(--primary-light)] ring-1 ring-[color:var(--primary-light)] bg-[color:var(--bg-light)] dark:bg-[color:var(--bg-dark)]"
                      : "border-[color:var(--secondary-light)] dark:border-[color:var(--secondary-dark)] bg-[color:var(--bg-light)] dark:bg-[color:var(--bg-dark)]"
                  }`}
                >
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[color:var(--secondary-light)] dark:text-[color:var(--secondary-dark)]">
                    Option {String.fromCharCode(65 + idx)}
                  </div>

                  <div className="space-y-2">
                    {profile.attributes.map((attr) => (
                      <div
                        key={attr.name}
                        className="flex items-center justify-between text-xs md:text-sm"
                      >
                        <span className="font-medium text-[color:var(--text-light)] dark:text-[color:var(--text-dark)]">
                          {attr.name}
                        </span>
                        <span className="ml-4 text-[color:var(--secondary-light)] dark:text-[color:var(--secondary-dark)]">
                          {attr.level}
                        </span>
                      </div>
                    ))}
                  </div>

                  {isSelected && (
                    <div className="mt-3 text-[11px] font-medium text-[color:var(--primary-light)]">
                      Selected
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      );
    }
    case QUESTION_TYPES.MAXDIFF: {
      const items = config.items || [];
      const setSize = config.setSize || items.length;

      // one static randomized order per render
      const [subset] = useState(() => {
        const clone = [...items];
        if (config.randomize) {
          clone.sort(() => Math.random() - 0.5);
        }
        return clone.slice(0, setSize);
      });

      const selected = value || { best: null, worst: null };

      const handleSelect = (type, item) => {
        // toggle behaviour: click again to unselect
        const updated = {
          ...selected,
          [type]: selected[type] === item ? null : item,
        };
        onChange(updated);
      };

      return (
        <div className="space-y-4">
          {/* helper line under question text */}
          <p className="text-sm text-gray-500 text-center">
            Select one <span className="font-semibold">MOST</span> and one{" "}
            <span className="font-semibold">LEAST</span> important
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {subset.map((item, idx) => {
              const isBest = selected.best === item;
              const isWorst = selected.worst === item;

              return (
                <div
                  key={`${item}-${idx}`}
                  className={[
                    "w-full rounded-3xl md:rounded-2xl border-2 p-4 md:p-6",
                    "transition-all duration-200 shadow-sm",
                    "flex flex-col items-start justify-between",
                    isBest
                      ? "bg-green-500 text-white border-green-500"
                      : "bg-white dark:bg-[color:var(--bg-dark)] border-gray-200 dark:border-gray-700",
                  ].join(" ")}
                >
                  <div className="w-full text-left">
                    <p className="text-base md:text-lg font-semibold">
                      {item}
                    </p>
                  </div>

                  <div className="mt-4 flex gap-3">
                    {/* Best button */}
                    <button
                      type="button"
                      onClick={() => handleSelect("best", item)}
                      className={[
                        "px-3 py-1 rounded-full text-xs font-semibold border",
                        "transition-all duration-150",
                        isBest
                          ? "bg-white text-green-600 border-white"
                          : "bg-green-100 text-green-700 border-green-200",
                      ].join(" ")}
                    >
                      Best
                    </button>

                    {/* Worst button */}
                    <button
                      type="button"
                      onClick={() => handleSelect("worst", item)}
                      className={[
                        "px-3 py-1 rounded-full text-xs font-semibold border",
                        "transition-all duration-150",
                        isWorst
                          ? "bg-white text-red-600 border-white"
                          : "bg-red-100 text-red-700 border-red-200",
                      ].join(" ")}
                    >
                      Worst
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    }


    case QUESTION_TYPES.MAXDIFF: {
      const cfg = config || {};
      const items = Array.isArray(cfg.items) ? cfg.items : [];
      const setSize = cfg.setSize || Math.min(4, items.length || 4);
      const currentSet = items.slice(0, setSize); // 🔹 first set only for now

      const bestIndex =
        value && typeof value === "object" && value.bestIndex !== undefined
          ? value.bestIndex
          : null;
      const worstIndex =
        value && typeof value === "object" && value.worstIndex !== undefined
          ? value.worstIndex
          : null;

      const handleSelect = (idx, which) => {
        const next = {
          bestIndex: which === "best" ? idx : bestIndex,
          worstIndex: which === "worst" ? idx : worstIndex,
        };
        onChange(next);
      };

      if (!currentSet.length) {
        return (
          <p className="text-sm text-[color:var(--text-light)] dark:text-[color:var(--text-dark)]">
            No items configured for MaxDiff question.
          </p>
        );
      }

      return (
        <div className="space-y-4">
          <p className="text-xs text-[color:var(--text-light)] dark:text-[color:var(--text-dark)]">
            Pick one option as <strong>Best</strong> and one option as{" "}
            <strong>Worst</strong>.
          </p>

          <div className="grid gap-3 md:grid-cols-2">
            {currentSet.map((label, idx) => {
              const isBest = bestIndex === idx;
              const isWorst = worstIndex === idx;

              return (
                <div
                  key={idx}
                  className="rounded-xl border border-[color:var(--secondary-light)] dark:border-[color:var(--secondary-dark)] bg-[color:var(--bg-light)] dark:bg-[color:var(--bg-dark)] p-3 flex flex-col gap-3"
                >
                  <div className="text-sm text-[color:var(--text-light)] dark:text-[color:var(--text-dark)]">
                    {label}
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleSelect(idx, "best")}
                      className={`flex-1 rounded-lg py-1 text-xs font-medium border transition-all ${
                        isBest
                          ? "bg-emerald-500 text-white border-emerald-500"
                          : "border-[color:var(--secondary-light)] text-[color:var(--text-light)] dark:text-[color:var(--text-dark)] hover:bg-emerald-50 dark:hover:bg-emerald-900/30"
                      }`}
                    >
                      Best
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSelect(idx, "worst")}
                      className={`flex-1 rounded-lg py-1 text-xs font-medium border transition-all ${
                        isWorst
                          ? "bg-red-500 text-white border-red-500"
                          : "border-[color:var(--secondary-light)] text-[color:var(--text-light)] dark:text-[color:var(--text-dark)] hover:bg-red-50 dark:hover:bg-red-900/30"
                      }`}
                    >
                      Worst
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    }
    case QUESTION_TYPES.LIKERT: {
      // 🔒 safe defaults
      const fallbackLabels = [
        "Strongly Disagree",
        "Disagree",
        "Neutral",
        "Agree",
        "Strongly Agree",
      ];

      const rawLabels =
        Array.isArray(config.labels) && config.labels.length > 0
          ? config.labels
          : fallbackLabels;

      const includeNA = Boolean(config.includeNA);
      const naLabel = config.naLabel || "Not applicable / Don’t know";

      const storeAsNumeric =
        typeof config.storeAsNumeric === "boolean"
          ? config.storeAsNumeric
          : true;

      const numericMin = Number.isFinite(config.numericMin)
        ? config.numericMin
        : 1;

      // 🔀 randomize option order (deterministic per question)
      const orderedLabels = config.randomize
        ? deterministicShuffle(
            rawLabels,
            question.questionId || question.id || "likert"
          )
        : rawLabels;

      const options = includeNA ? [...orderedLabels, naLabel] : orderedLabels;

      const isNASelected = value === "NA";

      // For numeric values we expect a number, otherwise a label string
      const isNumericValue = typeof value === "number";

      return (
        <div className="space-y-3 mt-2">
          {/* Main scale pills */}
          <div className="flex flex-wrap justify-center gap-2">
            {options.map((lbl, idx) => {
              const isNAOption = includeNA && idx === options.length - 1;

              let optionValue;
              if (isNAOption) {
                optionValue = "NA";
              } else if (storeAsNumeric) {
                // numeric coding: min, min+1, ...
                optionValue = numericMin + idx;
              } else {
                // store raw label
                optionValue = lbl;
              }

              const isSelected = isNAOption
                ? isNASelected
                : storeAsNumeric
                ? isNumericValue && value === optionValue
                : value === optionValue;

              return (
                <button
                  key={`${lbl}-${idx}`}
                  type="button"
                  onClick={() => onChange(optionValue)}
                  className={[
                    "px-3 py-2 rounded-full text-xs sm:text-sm font-medium transition-all",
                    "border",
                    isSelected
                      ? "bg-[color:var(--primary-light)] text-white border-[color:var(--primary-light)] shadow-md scale-[1.02]"
                      : "bg-[color:var(--bg-light)] dark:bg-[color:var(--bg-dark)] text-[color:var(--text-light)] dark:text-[color:var(--text-dark)] border-[color:var(--secondary-light)] dark:border-[color:var(--secondary-dark)] hover:bg-[color:var(--primary-light)] hover:text-white hover:border-[color:var(--primary-light)]",
                  ].join(" ")}
                >
                  {lbl}
                </button>
              );
            })}
          </div>

          {/* Helper line / current selection */}
          <p className="text-[11px] text-gray-500 dark:text-gray-400 text-center min-h-[1rem]">
            {includeNA && isNASelected
              ? naLabel
              : storeAsNumeric && isNumericValue
              ? `Selected: ${value}`
              : !storeAsNumeric && value
              ? `Selected: ${String(value)}`
              : "\u00A0"}
          </p>
        </div>
      );
    }
    case QUESTION_TYPES.SMILEY: {
      const faces =
        Number(question.config?.faces ?? config.faces) || 5;

      const fallbackLabels = [
        "Very unhappy",
        "Unhappy",
        "Neutral",
        "Happy",
        "Very happy",
      ];

      const labels = (() => {
        const raw = question.config?.labels ?? config.labels;
        if (Array.isArray(raw) && raw.length > 0) {
          const copy = [...raw];
          while (copy.length < faces) copy.push("");
          return copy.slice(0, faces);
        }
        return fallbackLabels.slice(0, faces);
      })();

      const highlightColor =
        question.config?.highlightColor ??
        config.highlightColor ??
        "#FACC15"; // amber-ish
      const baseColor =
        question.config?.baseColor ?? config.baseColor ?? "#9CA3AF";
      const showLabels =
        question.config?.showLabels ?? config.showLabels ?? true;
      const storeAs =
        question.config?.storeAs ?? config.storeAs ?? "score"; // 'score' | 'label'

      const includeNA =
        question.config?.includeNA ?? config.includeNA ?? false;
      const naLabel =
        question.config?.naLabel ??
        config.naLabel ??
        "Not applicable / Don’t know";

      // Emoji palette by index (from very negative → very positive)
      const emojiScale =
        faces <= 3
          ? ["🙁", "😐", "🙂"]
          : ["😡", "🙁", "😐", "🙂", "😍"];

      const emojis = emojiScale.slice(0, faces);

      // Figure out which index is currently selected from `value`
      const selectedIndex = (() => {
        if (value === "NA") return -1;
        if (storeAs === "score") {
          if (typeof value === "number" && value >= 1 && value <= faces) {
            return value - 1;
          }
          return -1;
        }
        if (storeAs === "label" && typeof value === "string") {
          const idx = labels.indexOf(value);
          return idx >= 0 ? idx : -1;
        }
        return -1;
      })();

      const handleSelect = (idx) => {
        if (storeAs === "score") {
          onChange(idx + 1);
        } else {
          onChange(labels[idx] || `pos_${idx + 1}`);
        }
      };

      const handleNA = () => {
        onChange("NA");
      };

      return (
        <div className="space-y-4 w-full">
          {/* Emojis row */}
          <div className="flex flex-wrap justify-center gap-3 mt-2">
            {emojis.map((emoji, idx) => {
              const isSelected = selectedIndex === idx;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSelect(idx)}
                  className={`flex flex-col items-center justify-center px-3 py-1 rounded-2xl transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                    isSelected
                      ? "shadow-md scale-110"
                      : "hover:scale-105"
                  }`}
                  style={{
                    color: isSelected ? highlightColor : baseColor,
                    border: isSelected
                      ? `1px solid ${highlightColor}`
                      : "1px solid transparent",
                    backgroundColor: isSelected
                      ? "rgba(250, 204, 21, 0.08)"
                      : "transparent",
                  }}
                >
                  <span className="text-3xl sm:text-4xl">{emoji}</span>
                  {showLabels && (
                    <span className="mt-1 text-[11px] sm:text-xs text-[color:var(--text-light)] dark:text-[color:var(--text-dark)] text-center px-1">
                      {labels[idx] || `Option ${idx + 1}`}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* N/A option */}
          {includeNA && (
            <div className="flex justify-center mt-1">
              <button
                type="button"
                onClick={handleNA}
                className={`px-3 py-1 rounded-full border text-xs transition-all ${
                  value === "NA"
                    ? "bg-[color:var(--primary-light)] text-white border-[color:var(--primary-light)]"
                    : "bg-[color:var(--bg-light)] dark:bg-[color:var(--bg-dark)] border-[color:var(--secondary-light)] dark:border-[color:var(--secondary-dark)] text-[color:var(--text-light)] dark:text-[color:var(--text-dark)] hover:bg-[color:var(--primary-light)] hover:text-white"
                }`}
              >
                {naLabel}
              </button>
            </div>
          )}

          {/* Debug / helper text */}
          <div className="text-[11px] text-gray-500 dark:text-gray-400 text-center">
            {value === "NA"
              ? "Selected: Not applicable"
              : selectedIndex >= 0
              ? storeAs === "score"
                ? `Selected: ${selectedIndex + 1} / ${faces}`
                : `Selected: ${
                    labels[selectedIndex] || `Option ${selectedIndex + 1}`
                  }`
              : "Tap an emoji to select your answer."}
          </div>
        </div>
      );
    }
    case QUESTION_TYPES.TABLE_GRID: {
      const columns = Array.isArray(config.columns) ? config.columns : [];
      const rows = Array.isArray(config.rows) ? config.rows : [];

      // value stored as: { [rowLabel]: selectedColumnLabel }
      const answers =
        value && typeof value === "object" && !Array.isArray(value)
          ? value
          : {};

      const handleChange = (rowLabel, colLabel) => {
        const next = { ...answers, [rowLabel]: colLabel };
        onChange(next);
      };

      const isCompact = config.layout === "compact";

      return (
        <div className="space-y-4">
          <div className="overflow-x-auto rounded-xl shadow-xl">
            <table
              className={`min-w-full text-sm text-left ${
                isCompact ? "text-xs" : "text-sm"
              }`}
            >
              <thead className="bg-[color:var(--bg-light)] dark:bg-[color:var(--bg-dark)]">
                <tr>
                  <th className="p-3 font-medium text-[color:var(--text-light)] dark:text-[color:var(--text-dark)]">
                    &nbsp;
                  </th>
                  {columns.map((col, idx) => (
                    <th
                      key={idx}
                      className="p-3 text-xs font-normal text-center text-nowrap text-[color:var(--text-light)] dark:text-[color:var(--text-dark)]"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, rowIndex) => (
                  <tr
                    key={rowIndex}
                    className="border-t border-[color:var(--secondary-light)] dark:border-[color:var(--secondary-dark)]"
                  >
                    <td className="p-3 text-xs text-nowrap text-[color:var(--text-light)] dark:text-[color:var(--text-dark)]">
                      {config.showRowNumbers ? `${rowIndex + 1}. ` : ""}
                      {row}
                    </td>
                    {columns.map((col, colIndex) => {
                      const checked = answers[row] === col;
                      return (
                        <td key={colIndex} className="p-3 text-center">
                          <label className="inline-flex items-center justify-center cursor-pointer">
                            <input
                              type="radio"
                              name={`${question.questionId}-${rowIndex}`}
                              value={col}
                              checked={!!checked}
                              onChange={() => handleChange(row, col)}
                              className="hidden peer"
                            />
                            <div className="w-5 h-5 rounded-full border border-[color:var(--secondary-light)] bg-[color:var(--bg-light)] dark:bg-[color:var(--bg-dark)] peer-checked:bg-[color:var(--primary-light)] peer-checked:border-[color:var(--primary-light)] transition-colors duration-200" />
                          </label>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-[10px] text-gray-500 dark:text-gray-400">
            One answer per row. This is a standard single-select grid; rows =
            items, columns = response options.
          </p>
        </div>
      );
    }
    case QUESTION_TYPES.MULTI_GRID: {
      const baseRows = Array.isArray(config.rows) ? config.rows : [];
      const baseCols = Array.isArray(config.columns) ? config.columns : [];

      // Note: if you later add per-respondent randomization here, 
      // do it with useMemo + a seeded RNG.
      const rows = baseRows;
      const columns = baseCols;

      // value shape: { [rowLabel]: [colLabel, ...] }
      const answers =
        value && typeof value === "object" && !Array.isArray(value)
          ? value
          : {};

      const maxPerRow =
        typeof config.maxSelectionsPerRow === "number"
          ? config.maxSelectionsPerRow
          : null;

      const layoutCompact = config.layout === "compact";
      const tdPadding = layoutCompact ? "p-2" : "p-3";
      const textSize = layoutCompact ? "text-xs" : "text-sm";

      const handleCellToggle = (rowLabel, colLabel) => {
        const currentRowValues = Array.isArray(answers[rowLabel])
          ? answers[rowLabel]
          : [];

        const hasAlready = currentRowValues.includes(colLabel);
        let nextRowValues;

        if (hasAlready) {
          // remove
          nextRowValues = currentRowValues.filter((c) => c !== colLabel);
        } else {
          // add
          if (
            maxPerRow &&
            currentRowValues.length >= maxPerRow
          ) {
            // enforce limit
            return;
          }
          nextRowValues = [...currentRowValues, colLabel];
        }

        const next = { ...answers, [rowLabel]: nextRowValues };
        onChange(next);
      };

      return (
        <div className="space-y-4">
          <div className="overflow-x-auto rounded-xl shadow-xl">
            <table className={`min-w-full ${textSize} text-left`}>
              <thead className="bg-[color:var(--bg-light)] dark:bg-[color:var(--bg-dark)]">
                <tr>
                  <th
                    className={`${tdPadding} font-medium text-[color:var(--text-light)] dark:text-[color:var(--text-dark)]`}
                  >
                    &nbsp;
                  </th>
                  {columns.map((col, idx) => (
                    <th
                      key={idx}
                      className={`${tdPadding} text-xs font-normal text-center text-nowrap text-[color:var(--text-light)] dark:text-[color:var(--text-dark)]`}
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, rowIndex) => (
                  <tr
                    key={rowIndex}
                    className="border-t border-[color:var(--secondary-light)] dark:border-[color:var(--secondary-dark)]"
                  >
                    <td
                      className={`${tdPadding} text-xs text-nowrap text-[color:var(--text-light)] dark:text-[color:var(--text-dark)]`}
                    >
                      {config.showRowNumbers ? `${rowIndex + 1}. ` : ""}
                      {row}
                    </td>

                    {columns.map((col, colIndex) => {
                      const rowValues = Array.isArray(answers[row])
                        ? answers[row]
                        : [];
                      const checked = rowValues.includes(col);

                      const atLimit =
                        maxPerRow &&
                        !checked &&
                        rowValues.length >= maxPerRow;

                      return (
                        <td key={colIndex} className={`${tdPadding} text-center`}>
                          <label className="inline-flex items-center justify-center cursor-pointer">
                            <input
                              type="checkbox"
                              className="hidden peer"
                              checked={checked}
                              disabled={atLimit}
                              onChange={() =>
                                handleCellToggle(row, col)
                              }
                            />
                            <div
                              className={[
                                "w-5 h-5 rounded border transition-colors duration-200",
                                "border-[color:var(--secondary-light)] bg-[color:var(--bg-light)] dark:bg-[color:var(--bg-dark)]",
                                checked
                                  ? "bg-[color:var(--primary-light)] border-[color:var(--primary-light)]"
                                  : "",
                                atLimit ? "opacity-40 cursor-not-allowed" : "",
                              ].join(" ")}
                            >
                              {checked && (
                                <svg
                                  className="w-4 h-4 text-white mx-auto mt-[1px]"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="3"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M5 13l4 4L19 7"
                                  />
                                </svg>
                              )}
                            </div>
                          </label>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {maxPerRow && (
            <p className="text-[10px] text-gray-500 dark:text-gray-400">
              You can select up to {maxPerRow} option
              {maxPerRow > 1 ? "s" : ""} per row.
            </p>
          )}
        </div>
      );
    }

case QUESTION_TYPES.IMAGE_CLICK_RATING: {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      {config.images.map((img, i) => (
        <button key={i} onClick={() => onChange(img.score)}
          className={`rounded-xl p-2 border-2 transition-transform hover:scale-105 
            ${value === img.score ? "border-orange-500" : "border-gray-300"}`}>
          <img src={img.url} className="w-full h-32 object-cover rounded-md"/>
          <p className="text-sm text-center mt-1">{img.label}</p>
        </button>
      ))}
    </div>
  );
}
    case QUESTION_TYPES.MATRIX_RATING: {
      const baseRows = Array.isArray(config.rows) ? config.rows : [];
      const baseCols = Array.isArray(config.columns) ? config.columns : [];

      const rows = baseRows;
      const columns = baseCols;

      const scaleMin =
        typeof config.scaleMin === "number" ? config.scaleMin : 1;
      const scaleMax =
        typeof config.scaleMax === "number" ? config.scaleMax : 5;

      const showNumbers = config.showNumbers !== false;
      const colorMode =
        config.colorMode === "mono" || config.colorMode === "diverging"
          ? config.colorMode
          : "diverging";

      const lowLabel = config.lowLabel || "";
      const neutralLabel = config.neutralLabel || "";
      const highLabel = config.highLabel || "";

      // value: { [row]: { [col]: number } }
      const answers =
        value && typeof value === "object" && !Array.isArray(value)
          ? value
          : {};

      const layoutCompact = config.layout === "compact";
      const tdPadding = layoutCompact ? "p-2" : "p-3";
      const textSize = layoutCompact ? "text-xs" : "text-sm";

      const allValues = Array.from({ length: scaleMax - scaleMin + 1 }, (_, i) =>
        scaleMin + i
      );

      const getCellValue = (row, col) =>
        answers?.[row]?.[col] ?? null;

      // Map rating to heatmap class (static strings so Tailwind is happy)
      const heatClass = (rating) => {
        if (!rating) return "";
        const span = scaleMax - scaleMin || 1;
        const pos = (rating - scaleMin) / span; // 0..1

        if (colorMode === "mono") {
          if (pos < 0.2) return "bg-slate-100 dark:bg-slate-800";
          if (pos < 0.4) return "bg-slate-200 dark:bg-slate-700";
          if (pos < 0.6) return "bg-slate-300 dark:bg-slate-600";
          if (pos < 0.8) return "bg-slate-400 dark:bg-slate-500";
          return "bg-slate-500 dark:bg-slate-400";
        }

        // diverging red → amber → green
        if (pos < 0.2) return "bg-red-100 dark:bg-red-900/40";
        if (pos < 0.4) return "bg-orange-100 dark:bg-orange-900/40";
        if (pos < 0.6) return "bg-yellow-100 dark:bg-yellow-900/40";
        if (pos < 0.8) return "bg-lime-100 dark:bg-lime-900/40";
        return "bg-emerald-100 dark:bg-emerald-900/40";
      };

      const handleSelect = (row, col, rating) => {
        const prevRow = answers[row] || {};
        const nextRow = { ...prevRow, [col]: rating };
        const next = { ...answers, [row]: nextRow };
        onChange(next);
      };

      return (
        <div className="space-y-4">
          {/* Legend */}
          {(lowLabel || neutralLabel || highLabel) && (
            <div className="flex flex-wrap gap-4 text-[11px] text-gray-500 dark:text-gray-400">
              {lowLabel && (
                <div className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-full bg-red-300 dark:bg-red-800" />
                  <span>{lowLabel}</span>
                </div>
              )}
              {neutralLabel && (
                <div className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-full bg-yellow-300 dark:bg-yellow-700" />
                  <span>{neutralLabel}</span>
                </div>
              )}
              {highLabel && (
                <div className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-full bg-emerald-300 dark:bg-emerald-700" />
                  <span>{highLabel}</span>
                </div>
              )}
            </div>
          )}

          <div className="overflow-x-auto rounded-xl shadow-xl">
            <table className={`min-w-full ${textSize} text-left`}>
              <thead className="bg-[color:var(--bg-light)] dark:bg-[color:var(--bg-dark)]">
                <tr>
                  <th
                    className={`${tdPadding} font-medium text-[color:var(--text-light)] dark:text-[color:var(--text-dark)]`}
                  >
                    &nbsp;
                  </th>
                  {columns.map((col, idx) => (
                    <th
                      key={idx}
                      className={`${tdPadding} text-xs font-normal text-center text-nowrap text-[color:var(--text-light)] dark:text-[color:var(--text-dark)]`}
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, rowIndex) => (
                  <tr
                    key={rowIndex}
                    className="border-t border-[color:var(--secondary-light)] dark:border-[color:var(--secondary-dark)]"
                  >
                    <td
                      className={`${tdPadding} text-xs text-nowrap text-[color:var(--text-light)] dark:text-[color:var(--text-dark)]`}
                    >
                      {row}
                    </td>

                    {columns.map((col, colIndex) => {
                      const current = getCellValue(row, col);

                      return (
                        <td
                          key={colIndex}
                          className={`${tdPadding} text-center align-middle`}
                        >
                          <div
                            className={[
                              "inline-flex items-center justify-center rounded-full px-2 py-1",
                              "border border-transparent transition-colors duration-200",
                              heatClass(current),
                            ].join(" ")}
                          >
                            <div className="flex gap-1">
                              {allValues.map((rating) => {
                                const selected = current === rating;
                                return (
                                  <button
                                    key={rating}
                                    type="button"
                                    onClick={() =>
                                      handleSelect(row, col, rating)
                                    }
                                    className={[
                                      "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-medium",
                                      "outline-none focus:ring-1 focus:ring-offset-1 focus:ring-orange-400",
                                      selected
                                        ? "bg-[color:var(--primary-light)] text-white shadow-sm"
                                        : "bg-[color:var(--bg-light)] dark:bg-[color:var(--bg-dark)] text-[color:var(--text-light)] dark:text-[color:var(--text-dark)] hover:bg-[color:var(--primary-light)]/80 hover:text-white",
                                    ].join(" ")}
                                  >
                                    {showNumbers ? rating : ""}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    }
     case QUESTION_TYPES.PERSONA_QUIZ: {
      const personas = Array.isArray(config.personas) ? config.personas : [];
      const items = Array.isArray(config.items) ? config.items : [];
      const resultSettings = config.resultSettings || {};

      const [currentIndex, setCurrentIndex] = useState(0);
      const [answers, setAnswers] = useState(() => {
        if (value && typeof value === "object" && value.itemAnswers) {
          return value.itemAnswers;
        }
        return {};
      });

      // recompute persona scores whenever answers change
      const personaScores = useMemo(() => {
        const scores = {};
        personas.forEach((p) => (scores[p.id] = 0));

        items.forEach((item) => {
          const answeredOptId = answers[item.id];
          if (!answeredOptId) return;
          const opt = (item.options || []).find((o) => o.id === answeredOptId);
          if (!opt || !opt.weights) return;
          Object.entries(opt.weights).forEach(([pid, w]) => {
            if (typeof w === "number" && pid in scores) {
              scores[pid] += w;
            }
          });
        });

        return scores;
      }, [answers, items, personas]);

      const sortedPersonas = useMemo(() => {
        return [...personas].sort(
          (a, b) => (personaScores[b.id] || 0) - (personaScores[a.id] || 0)
        );
      }, [personas, personaScores]);

      const allAnswered =
        items.length > 0 &&
        items.every((it) => Boolean(answers[it.id]));

      // Push structured value up
      useEffect(() => {
        const payload = {
          itemAnswers: answers,
          personaScores,
          topPersonaIds: sortedPersonas
            .map((p) => p.id)
            .filter((id) => personaScores[id] === personaScores[sortedPersonas[0]?.id]),
        };
        onChange(payload);
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [answers, JSON.stringify(personaScores)]);

      if (!items.length || !personas.length) {
        return (
          <p className="text-sm text-gray-500">
            Persona quiz not configured. Please define personas and items in the designer.
          </p>
        );
      }

      const item = items[currentIndex];
      const progress = ((currentIndex + 1) / items.length) * 100;

      const handleSelect = (optionId) => {
        const next = { ...answers, [item.id]: optionId };
        setAnswers(next);
      };

      const goNext = () => {
        if (currentIndex < items.length - 1) {
          setCurrentIndex((i) => i + 1);
        }
      };

      const goPrev = () => {
        if (currentIndex > 0) {
          setCurrentIndex((i) => i - 1);
        }
      };

      const showScores = !!resultSettings.showScores;
      const showTopN = resultSettings.showTopN ?? 1;
      const topSubset = sortedPersonas.slice(0, showTopN);

      return (
        <div className="space-y-6">
          {/* Progress bar */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-gray-500">
              <span>
                Item {currentIndex + 1} of {items.length}
              </span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div className="w-full h-2 rounded-full bg-gray-200 dark:bg-gray-800 overflow-hidden">
              <div
                className="h-full bg-[color:var(--primary-light)] transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Current item */}
          <div className="space-y-3">
            <p className="text-sm font-medium text-[color:var(--text-light)] dark:text-[color:var(--text-dark)]">
              {item.text}
            </p>
            <div className="space-y-2">
              {(item.options || []).map((opt) => {
                const selected = answers[item.id] === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleSelect(opt.id)}
                    className={[
                      "w-full text-left px-4 py-3 rounded-xl border text-sm transition-all",
                      selected
                        ? "bg-[color:var(--primary-light)] text-white border-transparent shadow-md scale-[1.01]"
                        : "bg-[color:var(--bg-light)] dark:bg-[color:var(--bg-dark)] border-[color:var(--secondary-light)] dark:border-[color:var(--secondary-dark)] hover:bg-[color:var(--primary-light)] hover:text-white",
                    ].join(" ")}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Nav buttons */}
          <div className="flex justify-between items-center">
            <button
              type="button"
              onClick={goPrev}
              disabled={currentIndex === 0}
              className="px-4 py-2 rounded-lg border text-xs disabled:opacity-50"
            >
              Back
            </button>

            <button
              type="button"
              onClick={goNext}
              disabled={currentIndex === items.length - 1}
              className="px-4 py-2 rounded-lg bg-[color:var(--primary-light)] text-white text-xs disabled:opacity-50"
            >
              Next
            </button>
          </div>

          {/* Live persona preview */}
          {showScores && (
            <div className="mt-4 border rounded-xl p-4 bg-[color:var(--bg-light)] dark:bg-[color:var(--bg-dark)] space-y-2">
              <p className="text-xs font-semibold mb-2 text-[color:var(--text-light)] dark:text-[color:var(--text-dark)]">
                Live persona match (updates as they answer)
              </p>
              {sortedPersonas.map((p) => {
                const score = personaScores[p.id] || 0;
                const maxScore =
                  sortedPersonas.length > 0
                    ? personaScores[sortedPersonas[0].id] || 1
                    : 1;
                const pct = maxScore > 0 ? (score / maxScore) * 100 : 0;
                const color = p.color || "#4B5563";

                return (
                  <div key={p.id} className="space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span>{p.label}</span>
                      <span>{score.toFixed(1)}</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: color,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Completion summary (only if all answered) */}
          {allAnswered && (
            <div className="mt-4 border rounded-xl p-4 bg-emerald-50 dark:bg-emerald-900/20 space-y-2">
              <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                {resultSettings.resultTitle || "Your persona"}
              </p>
              <p className="text-xs text-emerald-700 dark:text-emerald-200">
                {resultSettings.resultSubtitle ||
                  "Based on your answers, you most closely match:"}
              </p>
              <ul className="mt-2 space-y-1 text-xs">
                {topSubset.map((p) => (
                  <li key={p.id} className="flex gap-2 items-start">
                    <span
                      className="mt-0.5 inline-block w-2 h-2 rounded-full"
                      style={{ backgroundColor: p.color || "#4B5563" }}
                    />
                    <span>
                      <span className="font-semibold">{p.label}</span>
                      {p.description && (
                        <span className="text-gray-600 dark:text-gray-300">
                          {" — "}
                          {p.description}
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      );
    }
  
    case QUESTION_TYPES.SEGMENTATION_SELECTOR: {
      const segments = Array.isArray(config.segments) ? config.segments : [];
      const mode = config.mode === "multi" ? "multi" : "single";
      const randomize = Boolean(config.randomizeOrder);
      const showDescriptions = config.showDescriptions !== false;
      const showIcons = config.showIcons !== false;
      const showCodes = Boolean(config.showCodes);

      if (!segments.length) {
        return (
          <div className="p-4 rounded-xl bg-yellow-50 dark:bg-yellow-900/40 text-xs text-yellow-800 dark:text-yellow-200">
            No segments configured. Please add segments in the designer.
          </div>
        );
      }

      // shallow randomization per render – for real per-respondent randomization,
      // you can pre-randomize in SurveyForm based on respondent id.
      const orderedSegments = useMemo(() => {
        if (!randomize) return segments;
        const copy = [...segments];
        for (let i = copy.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [copy[i], copy[j]] = [copy[j], copy[i]];
        }
        return copy;
      }, [segments, randomize]);

      if (mode === "single") {
        const selected = getSingleValue(value);

        return (
          <div className="space-y-3">
            {orderedSegments.map((seg) => {
              const isActive = selected === (seg.id || seg.code);
              const key = seg.id || seg.code || seg.label;

              return (
                <button
                  type="button"
                  key={key}
                  onClick={() => onChange(seg.id || seg.code)}
                  className={[
                    "w-full text-left rounded-2xl border px-4 py-3 transition-all",
                    "flex items-start gap-3",
                    isActive
                      ? "border-[color:var(--primary-light)] bg-[color:var(--primary-light)]/10 shadow-md"
                      : "border-[color:var(--secondary-light)] bg-[color:var(--bg-light)] dark:bg-[color:var(--bg-dark)] hover:border-[color:var(--primary-light)] hover:bg-[color:var(--primary-light)]/5",
                  ].join(" ")}
                >
                  {/* Icon / bullet */}
                  <div className="mt-1">
                    {showIcons && seg.icon ? (
                      <span className="text-xl" aria-hidden="true">
                        {seg.icon}
                      </span>
                    ) : (
                      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-[color:var(--secondary-light)] text-[11px]">
                        {isActive ? "✓" : ""}
                      </span>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-[color:var(--text-light)] dark:text-[color:var(--text-dark)]">
                        {seg.label}
                      </span>
                      {showCodes && (seg.code || seg.id) && (
                        <span
                          className="text-[10px] px-2 py-0.5 rounded-full"
                          style={{
                            backgroundColor: (seg.colorTag || "#4B5563") + "20",
                            color: seg.colorTag || "#4B5563",
                          }}
                        >
                          {seg.code || seg.id}
                        </span>
                      )}
                    </div>

                    {showDescriptions && seg.description && (
                      <p className="mt-1 text-xs text-[color:var(--text-light)]/80 dark:text-[color:var(--text-dark)]/80">
                        {seg.description}
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        );
      }

      // multi-select mode
      const selectedArray = getCheckboxValues(value);

      const toggleSeg = (idOrCode) => {
        const id = idOrCode;
        const exists = selectedArray.includes(id);
        let next = exists
          ? selectedArray.filter((x) => x !== id)
          : [...selectedArray, id];

        const max = Number.isFinite(config.maxSelect)
          ? config.maxSelect
          : segments.length || 99;
        if (next.length > max) {
          next = next.slice(0, max);
        }

        onChange(next);
      };

      const max = Number.isFinite(config.maxSelect)
        ? config.maxSelect
        : segments.length || 99;
      const min = Number.isFinite(config.minSelect) ? config.minSelect : 0;

      return (
        <div className="space-y-2">
          <div className="space-y-3">
            {orderedSegments.map((seg) => {
              const id = seg.id || seg.code;
              const isActive = selectedArray.includes(id);
              const key = seg.id || seg.code || seg.label;

              return (
                <button
                  type="button"
                  key={key}
                  onClick={() => toggleSeg(id)}
                  className={[
                    "w-full text-left rounded-2xl border px-4 py-3 transition-all",
                    "flex items-start gap-3",
                    isActive
                      ? "border-[color:var(--primary-light)] bg-[color:var(--primary-light)]/10 shadow-md"
                      : "border-[color:var(--secondary-light)] bg-[color:var(--bg-light)] dark:bg-[color:var(--bg-dark)] hover:border-[color:var(--primary-light)] hover:bg-[color:var(--primary-light)]/5",
                  ].join(" ")}
                >
                  <div className="mt-1">
                    {showIcons && seg.icon ? (
                      <span className="text-xl" aria-hidden="true">
                        {seg.icon}
                      </span>
                    ) : (
                      <span className="inline-flex h-5 w-5 items-center justify-center rounded border border-[color:var(--secondary-light)] text-[11px]">
                        {isActive ? "✓" : ""}
                      </span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-[color:var(--text-light)] dark:text-[color:var(--text-dark)]">
                        {seg.label}
                      </span>
                      {showCodes && (seg.code || seg.id) && (
                        <span
                          className="text-[10px] px-2 py-0.5 rounded-full"
                          style={{
                            backgroundColor: (seg.colorTag || "#4B5563") + "20",
                            color: seg.colorTag || "#4B5563",
                          }}
                        >
                          {seg.code || seg.id}
                        </span>
                      )}
                    </div>

                    {showDescriptions && seg.description && (
                      <p className="mt-1 text-xs text-[color:var(--text-light)]/80 dark:text-[color:var(--text-dark)]/80">
                        {seg.description}
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="text-[11px] text-gray-500 mt-1">
            {min > 0 || max < 99
              ? `You can select${min ? ` at least ${min}` : ""}${
                  min && max ? " and" : ""
                }${max ? ` up to ${max}` : ""} segment${
                  (max || 0) > 1 ? "s" : ""
                }.`
              : "Select all segments that apply to you."}
          </div>
        </div>
      );
    }


    case QUESTION_TYPES.SIDE_BY_SIDE: {
      const leftLabel = config.leftLabel || "Concept A";
      const rightLabel = config.rightLabel || "Concept B";

      const attributes = Array.isArray(config.attributes)
        ? config.attributes
        : [];

      const mode =
        config.mode === "preference_only" ||
        config.mode === "rate_both" ||
        config.mode === "preference_and_rate"
          ? config.mode
          : "preference_and_rate";

      const scaleMin =
        typeof config.scaleMin === "number" ? config.scaleMin : 1;
      const scaleMax =
        typeof config.scaleMax === "number" ? config.scaleMax : 5;

      const leftBiasLabel =
        config.leftBiasLabel || `${leftLabel} is much better`;
      const rightBiasLabel =
        config.rightBiasLabel || `${rightLabel} is much better`;
      const neutralLabel = config.neutralLabel || "About the same";
      const showTieOption = config.showTieOption !== false;

      // value shape:
      // {
      //   "Overall appeal": { preference: "left" | "right" | "tie" | null,
      //                      leftRating?: number,
      //                      rightRating?: number }
      // }
      const answers =
        value && typeof value === "object" && !Array.isArray(value)
          ? value
          : {};

      const allRatings = Array.from(
        { length: scaleMax - scaleMin + 1 },
        (_, i) => scaleMin + i
      );

      const layoutClass = "space-y-4";

      const setRowValue = (attr, partial) => {
        const prev = answers[attr] || {};
        const next = { ...prev, ...partial };
        onChange({ ...answers, [attr]: next });
      };

      return (
        <div className={layoutClass}>
          {attributes.map((attr, idx) => {
            const row = answers[attr] || {};
            const pref = row.preference || null;
            const leftRating = row.leftRating || null;
            const rightRating = row.rightRating || null;

            return (
              <div
                key={idx}
                className="rounded-xl border border-[color:var(--secondary-light)] dark:border-[color:var(--secondary-dark)] bg-[color:var(--bg-light)] dark:bg-[color:var(--bg-dark)] p-3 sm:p-4 space-y-3"
              >
                {/* Attribute title */}
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-medium text-[color:var(--text-light)] dark:text-[color:var(--text-dark)]">
                    {attr}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                  {/* LEFT concept card */}
                  <div className="rounded-lg border border-transparent bg-white/80 dark:bg-white/5 p-3 shadow-sm">
                    <div className="text-xs font-semibold mb-2 text-[color:var(--text-light)] dark:text-[color:var(--text-dark)] uppercase tracking-wide">
                      {leftLabel}
                    </div>

                    {(mode === "preference_only" ||
                      mode === "preference_and_rate") && (
                      <button
                        type="button"
                        onClick={() =>
                          setRowValue(attr, {
                            preference: pref === "left" ? null : "left",
                          })
                        }
                        className={[
                          "w-full mb-2 px-3 py-2 rounded-lg text-xs font-medium border transition-all",
                          pref === "left"
                            ? "bg-[color:var(--primary-light)] text-white border-[color:var(--primary-light)] shadow"
                            : "bg-[color:var(--bg-light)] dark:bg-[color:var(--bg-dark)] border-[color:var(--secondary-light)] dark:border-[color:var(--secondary-dark)] text-[color:var(--text-light)] dark:text-[color:var(--text-dark)] hover:bg-[color:var(--primary-light)]/80 hover:text-white",
                        ].join(" ")}
                      >
                        {leftBiasLabel}
                      </button>
                    )}

                    {(mode === "rate_both" ||
                      mode === "preference_and_rate") && (
                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px] text-gray-500">
                          <span>
                            Rate {leftLabel} ({scaleMin}-{scaleMax})
                          </span>
                          {leftRating && (
                            <span className="font-semibold text-[color:var(--primary-light)] dark:text-[color:var(--primary-dark)]">
                              {leftRating}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {allRatings.map((r) => {
                            const selected = leftRating === r;
                            return (
                              <button
                                key={r}
                                type="button"
                                onClick={() =>
                                  setRowValue(attr, {
                                    leftRating: r === leftRating ? null : r,
                                  })
                                }
                                className={[
                                  "w-7 h-7 rounded-full text-[11px] flex items-center justify-center border transition-all",
                                  selected
                                    ? "bg-[color:var(--primary-light)] text-white border-[color:var(--primary-light)] shadow-sm"
                                    : "bg-[color:var(--bg-light)] dark:bg-[color:var(--bg-dark)] text-[color:var(--text-light)] dark:text-[color:var(--text-dark)] border-[color:var(--secondary-light)] dark:border-[color:var(--secondary-dark)] hover:bg-[color:var(--primary-light)]/80 hover:text-white",
                                ].join(" ")}
                              >
                                {r}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* RIGHT concept card */}
                  <div className="rounded-lg border border-transparent bg-white/80 dark:bg-white/5 p-3 shadow-sm">
                    <div className="text-xs font-semibold mb-2 text-[color:var(--text-light)] dark:text-[color:var(--text-dark)] uppercase tracking-wide">
                      {rightLabel}
                    </div>

                    {(mode === "preference_only" ||
                      mode === "preference_and_rate") && (
                      <button
                        type="button"
                        onClick={() =>
                          setRowValue(attr, {
                            preference: pref === "right" ? null : "right",
                          })
                        }
                        className={[
                          "w-full mb-2 px-3 py-2 rounded-lg text-xs font-medium border transition-all",
                          pref === "right"
                            ? "bg-[color:var(--primary-light)] text-white border-[color:var(--primary-light)] shadow"
                            : "bg-[color:var(--bg-light)] dark:bg-[color:var(--bg-dark)] border-[color:var(--secondary-light)] dark:border-[color:var(--secondary-dark)] text-[color:var(--text-light)] dark:text-[color:var(--text-dark)] hover:bg-[color:var(--primary-light)]/80 hover:text-white",
                        ].join(" ")}
                      >
                        {rightBiasLabel}
                      </button>
                    )}

                    {(mode === "rate_both" ||
                      mode === "preference_and_rate") && (
                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px] text-gray-500">
                          <span>
                            Rate {rightLabel} ({scaleMin}-{scaleMax})
                          </span>
                          {rightRating && (
                            <span className="font-semibold text-[color:var(--primary-light)] dark:text-[color:var(--primary-dark)]">
                              {rightRating}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {allRatings.map((r) => {
                            const selected = rightRating === r;
                            return (
                              <button
                                key={r}
                                type="button"
                                onClick={() =>
                                  setRowValue(attr, {
                                    rightRating: r === rightRating ? null : r,
                                  })
                                }
                                className={[
                                  "w-7 h-7 rounded-full text-[11px] flex items-center justify-center border transition-all",
                                  selected
                                    ? "bg-[color:var(--primary-light)] text-white border-[color:var(--primary-light)] shadow-sm"
                                    : "bg-[color:var(--bg-light)] dark:bg-[color:var(--bg-dark)] text-[color:var(--text-light)] dark:text-[color:var(--text-dark)] border-[color:var(--secondary-light)] dark:border-[color:var(--secondary-dark)] hover:bg-[color:var(--primary-light)]/80 hover:text-white",
                                ].join(" ")}
                              >
                                {r}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Tie option */}
                {showTieOption &&
                  (mode === "preference_only" ||
                    mode === "preference_and_rate") && (
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() =>
                          setRowValue(attr, {
                            preference: pref === "tie" ? null : "tie",
                          })
                        }
                        className={[
                          "inline-flex items-center px-3 py-1.5 rounded-full text-[11px] border transition-all",
                          pref === "tie"
                            ? "bg-slate-800 text-white border-slate-800"
                            : "bg-[color:var(--bg-light)] dark:bg-[color:var(--bg-dark)] border-[color:var(--secondary-light)] dark:border-[color:var(--secondary-dark)] text-[color:var(--text-light)] dark:text-[color:var(--text-dark)] hover:bg-slate-800 hover:text-white",
                        ].join(" ")}
                      >
                        {neutralLabel}
                      </button>
                    </div>
                  )}
              </div>
            );
          })}
        </div>
      );
    }
    case QUESTION_TYPES.MONADIC_TEST: {
  const concepts = Array.isArray(config.concepts)
    ? config.concepts
    : [];
  const metrics = Array.isArray(config.metrics)
    ? config.metrics
    : [];
  const [assignedConceptId, setAssignedConceptId] = useState(
    value?.conceptId || null
  );

  useEffect(() => {
    if (value?.conceptId && !assignedConceptId) {
      setAssignedConceptId(value.conceptId);
      return;
    }

    if (!assignedConceptId && concepts.length > 0) {
      let chosen = null;

      if (config.allocationMode === "weighted") {
        chosen = pickWeighted(concepts);
      } else {
        // simple random / quota (UI only, real quota in backend)
        chosen =
          concepts[Math.floor(Math.random() * concepts.length)];
      }

      if (chosen) {
        setAssignedConceptId(chosen.id);
        onChange({
          conceptId: chosen.id,
          ratings: {},
          openText: "",
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [concepts.length]);

  if (!concepts.length) {
    return (
      <p className="text-sm text-red-500">
        No concepts configured for monadic test.
      </p>
    );
  }

  const concept =
    concepts.find((c) => c.id === assignedConceptId) ||
    concepts[0];

  const currentRatings = (value && value.ratings) || {};
  const handleRatingChange = (metricId, newVal) => {
    onChange({
      ...(value || {}),
      conceptId: concept.id,
      ratings: {
        ...currentRatings,
        [metricId]: newVal,
      },
    });
  };

  const handleOpenTextChange = (txt) => {
    onChange({
      ...(value || {}),
      conceptId: concept.id,
      ratings: currentRatings,
      openText: txt,
    });
  };

  return (
    <div className="space-y-6">
      {/* Concept card */}
      <div className="rounded-2xl border border-[color:var(--secondary-light)] dark:border-[color:var(--secondary-dark)] bg-[color:var(--bg-light)] dark:bg-[color:var(--bg-dark)] p-4 sm:p-6 flex flex-col md:flex-row gap-4">
        {concept.imageUrl && (
          <div className="w-full md:w-1/3">
            <img
              src={concept.imageUrl}
              alt={concept.name || "Concept"}
              className="w-full h-40 object-cover rounded-xl shadow-sm"
            />
          </div>
        )}
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            {concept.tag && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-[10px] uppercase tracking-wide bg-[color:var(--primary-light)]/10 text-[color:var(--primary-light)]">
                {concept.tag}
              </span>
            )}
            {concept.isControl && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-[10px] uppercase tracking-wide bg-emerald-500/10 text-emerald-600 dark:text-emerald-300">
                CONTROL
              </span>
            )}
          </div>

          <h3 className="text-lg font-semibold text-[color:var(--text-light)] dark:text-[color:var(--text-dark)]">
            {concept.name}
          </h3>

          {concept.price && (
            <p className="text-sm font-medium text-[color:var(--secondary-light)] dark:text-[color:var(--secondary-dark)]">
              {concept.price}
            </p>
          )}

          {concept.description && (
            <p className="text-sm text-[color:var(--text-light)]/80 dark:text-[color:var(--text-dark)]/80">
              {concept.description}
            </p>
          )}
        </div>
      </div>

      {/* Metrics */}
      <div className="space-y-4">
        {metrics.map((m) => {
          const val = currentRatings[m.id] ?? null;
          const min = m.min ?? 1;
          const max = m.max ?? 5;

          if (m.type === "star") {
            return (
              <div key={m.id} className="space-y-2">
                <p className="text-sm font-medium">
                  {m.label}
                </p>
                <div className="flex gap-2">
                  {Array.from({ length: max - min + 1 }, (_, i) => {
                    const score = min + i;
                    return (
                      <button
                        key={score}
                        type="button"
                        onClick={() =>
                          handleRatingChange(m.id, score)
                        }
                        className="focus:outline-none"
                      >
                        <svg
                          className={`w-7 h-7 ${
                            val >= score
                              ? "text-[color:var(--primary-light)]"
                              : "text-gray-300 dark:text-gray-600"
                          }`}
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill={
                            val >= score
                              ? "currentColor"
                              : "none"
                          }
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M11.48 3.5a.75.75 0 011.04 0l2.02 2.032a.75.75 0 00.564.22l2.867-.24a.75.75 0 01.79.978l-.94 2.71a.75.75 0 00.222.79l2.144 1.916a.75.75 0 01-.302 1.29l-2.73.77a.75.75 0 00-.52.46l-1.02 2.64a.75.75 0 01-1.4 0l-1.02-2.64a.75.75 0 00-.52-.46l-2.73-.77a.75.75 0 01-.302-1.29l2.144-1.916a.75.75 0 00.222-.79l-.94-2.71a.75.75 0 01.79-.978l2.867.24a.75.75 0 00.564-.22L11.48 3.5z"
                          />
                        </svg>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          }

          if (m.type === "slider") {
            return (
              <div key={m.id} className="space-y-2">
                <p className="text-sm font-medium">
                  {m.label}
                </p>
                <div className="flex items-center gap-3">
                  {m.leftLabel && (
                    <span className="text-xs text-gray-500 w-20 text-right">
                      {m.leftLabel}
                    </span>
                  )}
                  <input
                    type="range"
                    min={min}
                    max={max}
                    value={val ?? Math.round((min + max) / 2)}
                    onChange={(e) =>
                      handleRatingChange(
                        m.id,
                        Number(e.target.value)
                      )
                    }
                    className="flex-1"
                  />
                  {m.rightLabel && (
                    <span className="text-xs text-gray-500 w-20">
                      {m.rightLabel}
                    </span>
                  )}
                  <span className="text-xs text-gray-600 w-8 text-right">
                    {val ?? "-"}
                  </span>
                </div>
              </div>
            );
          }

          // default: likert buttons
          return (
            <div key={m.id} className="space-y-2">
              <p className="text-sm font-medium">{m.label}</p>
              <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                <span>{m.leftLabel}</span>
                <span>{m.rightLabel}</span>
              </div>
              <div className="flex gap-2 flex-wrap">
                {Array.from(
                  { length: max - min + 1 },
                  (_, i) => min + i
                ).map((score) => (
                  <button
                    key={score}
                    type="button"
                    onClick={() =>
                      handleRatingChange(m.id, score)
                    }
                    className={`w-9 h-9 rounded-full text-xs font-medium transition-all ${
                      val === score
                        ? "bg-[color:var(--primary-light)] text-white shadow"
                        : "bg-[color:var(--bg-light)] dark:bg-[color:var(--bg-dark)] text-[color:var(--text-light)] dark:text-[color:var(--text-dark)] hover:bg-[color:var(--primary-light)] hover:text-white"
                    }`}
                  >
                    {score}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Open-ended */}
      {config.showOpenEnded && (
        <div className="space-y-2">
          <p className="text-sm font-medium">
            {config.openEndedLabel ||
              "What did you like or dislike about this concept?"}
          </p>
          <textarea
            className={inputClasses}
            rows={4}
            value={value?.openText || ""}
            onChange={(e) => handleOpenTextChange(e.target.value)}
            placeholder="Type your feedback..."
          />
        </div>
      )}
    </div>
  );
}
    case QUESTION_TYPES.COMPARISON_GRID: {
      const attributes = Array.isArray(config.attributes)
        ? config.attributes
        : [];
      const brands = Array.isArray(config.brands)
        ? config.brands
        : [];

      const maxSelectionsPerRow =
        typeof config.maxSelectionsPerRow === "number" &&
        config.maxSelectionsPerRow > 0
          ? config.maxSelectionsPerRow
          : 1;

      const allowTies = Boolean(config.allowTies);
      const includeNone = config.includeNone !== false;
      const noneLabel = config.noneLabel || "None of these";

      const requireSelectionEachRow =
        config.requireSelectionEachRow !== false;

      const layoutCompact = config.layout === "compact";
      const tdPadding = layoutCompact ? "p-2" : "p-3";
      const textSize = layoutCompact ? "text-xs" : "text-sm";

      // value shape:
      // {
      //   "Ease of use": ["Brand A"],
      //   "Features": ["Brand B", "Brand C"],
      //   ...
      // }
      const answers =
        value && typeof value === "object" && !Array.isArray(value)
          ? value
          : {};

      const allCols = includeNone ? [...brands, "__none__"] : brands;

      const getRowSelection = (attr) => answers[attr] || [];

      const toggleCell = (attr, brandKey) => {
        const prev = getRowSelection(attr);
        const isNone = brandKey === "__none__";

        // Start from a copy
        let next = [...prev];

        if (isNone) {
          // Selecting "none" clears others
          if (next.includes("__none__")) {
            next = []; // toggle off
          } else {
            next = ["__none__"];
          }
        } else {
          // If "none" was selected, drop it first
          next = next.filter((v) => v !== "__none__");

          const exists = next.includes(brandKey);

          if (exists) {
            // toggling off
            next = next.filter((v) => v !== brandKey);
          } else {
            // toggling on
            if (maxSelectionsPerRow === 1 && !allowTies) {
              next = [brandKey];
            } else if (next.length < maxSelectionsPerRow) {
              next.push(brandKey);
            } else {
              // already at max; replace last
              next[next.length - 1] = brandKey;
            }
          }
        }

        const updated = { ...answers, [attr]: next };
        onChange(updated);
      };

      return (
        <div className="space-y-3">
          {requireSelectionEachRow && (
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              Please assign each attribute to at least one brand.
            </p>
          )}

          <div className="overflow-x-auto rounded-xl shadow-xl">
            <table className={`min-w-full ${textSize} text-left`}>
              <thead className="bg-[color:var(--bg-light)] dark:bg-[color:var(--bg-dark)]">
                <tr>
                  <th
                    className={`${tdPadding} font-medium text-[color:var(--text-light)] dark:text-[color:var(--text-dark)]`}
                  >
                    Attribute
                  </th>
                  {brands.map((b, idx) => (
                    <th
                      key={idx}
                      className={`${tdPadding} text-center text-xs font-normal text-[color:var(--text-light)] dark:text-[color:var(--text-dark)]`}
                    >
                      {b}
                    </th>
                  ))}
                  {includeNone && (
                    <th
                      className={`${tdPadding} text-center text-xs font-normal text-[color:var(--text-light)] dark:text-[color:var(--text-dark)]`}
                    >
                      {noneLabel}
                    </th>
                  )}
                </tr>
              </thead>

              <tbody>
                {attributes.map((attr, rowIdx) => {
                  const rowSel = getRowSelection(attr);
                  const isRowMissing =
                    requireSelectionEachRow && rowSel.length === 0;

                  return (
                    <tr
                      key={rowIdx}
                      className={[
                        "border-t border-[color:var(--secondary-light)] dark:border-[color:var(--secondary-dark)]",
                        isRowMissing
                          ? "bg-red-50/60 dark:bg-red-900/20"
                          : "",
                      ].join(" ")}
                    >
                      <td
                        className={`${tdPadding} text-xs text-[color:var(--text-light)] dark:text-[color:var(--text-dark)] whitespace-nowrap`}
                      >
                        {attr}
                      </td>

                      {brands.map((b, colIdx) => {
                        const checked = rowSel.includes(b);
                        return (
                          <td
                            key={colIdx}
                            className={`${tdPadding} text-center align-middle`}
                          >
                            <button
                              type="button"
                              onClick={() => toggleCell(attr, b)}
                              className={[
                                "w-7 h-7 rounded-md border flex items-center justify-center transition-all",
                                checked
                                  ? "bg-[color:var(--primary-light)] text-white border-[color:var(--primary-light)] shadow-sm"
                                  : "bg-[color:var(--bg-light)] dark:bg-[color:var(--bg-dark)] border-[color:var(--secondary-light)] dark:border-[color:var(--secondary-dark)] text-[color:var(--text-light)] dark:text-[color:var(--text-dark)] hover:bg-[color:var(--primary-light)]/80 hover:text-white",
                              ].join(" ")}
                            >
                              {checked && (
                                <span className="text-[10px] font-bold">
                                  ✓
                                </span>
                              )}
                            </button>
                          </td>
                        );
                      })}

                      {includeNone && (
                        <td
                          className={`${tdPadding} text-center align-middle`}
                        >
                          <button
                            type="button"
                            onClick={() => toggleCell(attr, "__none__")}
                            className={[
                              "px-2 py-1 rounded-full border text-[10px] whitespace-nowrap transition-all",
                              rowSel.includes("__none__")
                                ? "bg-slate-800 text-white border-slate-800"
                                : "bg-[color:var(--bg-light)] dark:bg-[color:var(--bg-dark)] border-[color:var(--secondary-light)] dark:border-[color:var(--secondary-dark)] text-[color:var(--text-light)] dark:text-[color:var(--text-dark)] hover:bg-slate-800 hover:text-white",
                            ].join(" ")}
                          >
                            None
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    case QUESTION_TYPES.VIDEO: {
      const isDirectVideoFile = (url) => /\.(mp4|webm|ogg)$/i.test(url);

      const getTransformedEmbedUrl = (inputUrl) => {
        try {
          const url = new URL(inputUrl);

          if (
            url.hostname.includes("youtube.com") ||
            url.hostname.includes("youtu.be")
          ) {
            const videoId =
              url.searchParams.get("v") || url.pathname.split("/")[1];
            return `https://www.youtube.com/embed/${videoId}`;
          }

          if (url.hostname.includes("vimeo.com")) {
            const videoId = url.pathname.split("/")[1];
            return `https://player.vimeo.com/video/${videoId}`;
          }

          return inputUrl;
        } catch {
          return inputUrl;
        }
      };

      const videoUrl = config?.url || config?.videoUrl || "";
      const embedUrl = getTransformedEmbedUrl(videoUrl);

      return (
        <div className="w-full aspect-video rounded-xl overflow-hidden border-2">
          {isDirectVideoFile(embedUrl) ? (
            <video controls className="w-full h-full bg-[color:var(--bg-dark)]">
              <source src={embedUrl} />
              Your browser does not support the video tag.
            </video>
          ) : (
            <iframe
              className="w-full h-full"
              src={embedUrl}
              title="Embedded Video"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          )}
        </div>
      );
    }

    case QUESTION_TYPES.FILE_UPLOAD: {
      const isImage = value && value.type?.startsWith("image/");
      return (
        <div className="border-2 border-dashed rounded-xl p-6 text-center cursor-pointer hover:bg-[color:var(--primary-light)] dark:hover:bg-[color:var(--primary-dark)] transition-colors">
          <label className="flex flex-col items-center gap-2">
            <Upload className="w-6 h-6 text-[color:var(--text-light)]" />
            <span className="text-sm text-[color:var(--text-light)] dark:text-[color:var(--text-dark)]">
              Click to upload file
            </span>
            <input
              type="file"
              accept={config.allowedTypes?.join(",")}
              onChange={(e) => onChange(e.target.files[0])}
              className="hidden"
            />
          </label>
          {value?.name && (
            <div className="mt-4">
              {isImage ? (
                <img
                  src={URL.createObjectURL(value)}
                  alt="Uploaded preview"
                  className="max-w-xs mx-auto rounded shadow-md border border-[color:var(--secondary-light)]"
                />
              ) : (
                <p className="text-sm text-green-600 dark:text-green-400 font-medium">
                  Selected: {value.name}
                </p>
              )}
            </div>
          )}
        </div>
      );
    }

    case QUESTION_TYPES.DATE:
      return (
        <input
          type="date"
          placeholder={config.placeholder}
          min={config.minDate}
          max={config.maxDate}
          className={inputClasses}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case QUESTION_TYPES.GOOGLE_DRIVE: {
      const folderId = config.folderId;
      const viewMode = config.viewMode || "list"; // 'list', 'grid', or 'picker'

      if (!folderId) {
        return (
          <div className="text-sm text-[color:var(--text-light)] p-4 bg-[color:var(--primary-light)] dark:bg-[color:var(--secondary-light)] rounded">
            Google Drive folder ID not configured.
          </div>
        );
      }

      const embedUrl = (() => {
        switch (viewMode) {
          case "grid":
            return `https://drive.google.com/embeddedfolderview?id=${folderId}#grid`;
          case "picker":
            return null;
          case "list":
          default:
            return `https://drive.google.com/embeddedfolderview?id=${folderId}#list`;
        }
      })();

      if (!embedUrl) {
        return (
          <div className="p-4 rounded bg-yellow-50 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300">
            Picker UI is not supported for embedding directly. Please use List
            or Grid mode.
          </div>
        );
      }

      return (
        <div className="w-full aspect-video bg-[color:var(--primary-light)] dark:bg-[color:var(--primary-dark)] border-2 rounded-xl overflow-hidden">
          <iframe
            src={embedUrl}
            className="w-full h-full"
            title="Google Drive Folder View"
            frameBorder="0"
          ></iframe>
        </div>
      );
    }

    case QUESTION_TYPES.CALENDLY:
      return (
        <div className="w-full h-[400px]">
          <iframe
            src={config.calendlyUrl}
            width="100%"
            height="100%"
            frameBorder="0"
            className="rounded-xl border-2"
            title="Calendly Scheduler"
          ></iframe>
        </div>
      );

    case QUESTION_TYPES.END_SCREEN:
      return <div>{config.text}</div>;

    case QUESTION_TYPES.RANKING: {
      const [items, setItems] = useState(config.items || []);
      const sensors = useSensors(useSensor(PointerSensor));

      return (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={(event) => {
            const { active, over } = event;
            if (active.id !== over.id) {
              const oldIndex = items.indexOf(active.id);
              const newIndex = items.indexOf(over.id);
              const newItems = arrayMove(items, oldIndex, newIndex);
              setItems(newItems);
              onChange(newItems);
            }
          }}
        >
          <SortableContext items={items} strategy={verticalListSortingStrategy}>
            <ul className="space-y-2">
              {items.map((item) => (
                <SortableItem key={item} id={item} />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      );
    }

    case QUESTION_TYPES.OPINION_SCALE: {
      const min = config.min ?? 1;
      const max = config.max ?? 5;
      const minLabel = config.minLabel || "Strongly Disagree";
      const maxLabel = config.maxLabel || "Strongly Agree";

      return (
        <div className="space-y-4 text-center">
          <div className="flex justify-between text-sm text-[color:var(--text-light)] dark:text-[color:var(--text-dark)] px-1">
            <span>{minLabel}</span>
            <span>{maxLabel}</span>
          </div>

          <div className="flex justify-center gap-2 sm:gap-3 flex-wrap">
            {Array.from({ length: max - min + 1 }, (_, i) => min + i).map(
              (val) => (
                <button
                  key={val}
                  onClick={() => onChange(val)}
                  className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-orange-400 ${
                    value === val
                      ? "bg-[color:var(--primary-light)] text-[color:var(--text-light)] shadow-md"
                      : "bg-[color:var(--bg-light)] dark:bg-[color:var(--bg-dark)] text-[color:var(--text-light)] dark:text-[color:var(--text-dark)] hover:bg-[color:var(--primary-light)] dark:hover:bg-[color:var(--primary-dark)]"
                  }`}
                >
                  {val}
                </button>
              )
            )}
          </div>
        </div>
      );
    }

    case QUESTION_TYPES.NPS: {
      const min = config?.min ?? 0;
      const max = config?.max ?? 10;
      const minLabel = config?.minLabel ?? "Not at all likely";
      const neutralLabel = config?.neutralLabel ?? "Neutral";
      const maxLabel = config?.maxLabel ?? "Extremely likely";

      const cols = Array.from({ length: max - min + 1 }, (_, i) => i + min);
      const neutralIdx = Math.round((min + max) / 2);

      const isDetractor = (n) => n >= 0 && n <= 5;
      const isPassive = (n) => n >= 6 && n <= 8;
      const isPromoter = (n) => n >= 9 && n <= 10;

      const baseShade = (n) =>
        isDetractor(n)
          ? "bg-red-100 text-red-900 dark:bg-red-950/40 dark:text-red-200"
          : isPassive(n)
          ? "bg-yellow-100 text-yellow-900 dark:bg-yellow-950/40 dark:text-yellow-200"
          : "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200";

      const activeShade = (n) =>
        isDetractor(n)
          ? "bg-red-500 text-white"
          : isPassive(n)
          ? "bg-yellow-500 text-white"
          : "bg-emerald-500 text-white";

      const BTN = 44;
      const GAP = 8;
      const trackMinWidth = cols.length * BTN + (cols.length - 1) * GAP;

      return (
        <div className="text-center space-y-3">
          <div className="w-full overflow-x-auto scrollbar-hide">
            <div className="mx-auto sm:max-w-xl">
              <div
                role="radiogroup"
                aria-label="Net Promoter Score"
                className="grid"
                style={{
                  gridTemplateColumns: `repeat(${cols.length}, ${BTN}px)`,
                  columnGap: GAP,
                  minWidth: trackMinWidth,
                  justifyContent: "center",
                }}
              >
                {cols.map((score) => {
                  const selected = value === score;
                  return (
                    <button
                      key={score}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      aria-label={`Score ${score}`}
                      onClick={() => onChange(score)}
                      className={[
                        "rounded-full font-semibold transition-colors outline-none",
                        "focus:ring-2 focus:ring-offset-2",
                        selected ? activeShade(score) : baseShade(score),
                        "hover:brightness-105",
                      ].join(" ")}
                      style={{ width: BTN, height: BTN, fontSize: 12 }}
                    >
                      {score}
                    </button>
                  );
                })}
              </div>

              <div
                className="grid mt-2 text-[11px] sm:text-xs text-gray-600 dark:text-gray-300"
                style={{
                  gridTemplateColumns: `repeat(${cols.length}, ${BTN}px)`,
                  columnGap: GAP,
                  minWidth: trackMinWidth,
                  justifyContent: "center",
                }}
              >
                {cols.map((score) => {
                  let text = "";
                  if (score === min) text = minLabel;
                  else if (score === neutralIdx) text = neutralLabel;
                  else if (score === max) text = maxLabel;

                  return (
                    <div
                      key={`lbl-${score}`}
                      className="min-h-[1rem] flex justify-center"
                    >
                      {text && (
                        <span
                          className="whitespace-nowrap"
                          style={{ width: BTN }}
                        >
                          {text}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="text-xs text-gray-500 dark:text-gray-400 h-4">
            {value != null ? `Selected: ${value}` : "\u00A0"}
          </div>
        </div>
      );
    }

    case QUESTION_TYPES.MATRIX: {
      const columns = config.columns || config.cols || [];
      const rows = config.rows || [];
      const [matrixAnswers, setMatrixAnswers] = useState({});

      const handleMatrixChange = (rowLabel, colLabel, checked) => {
        setMatrixAnswers((prev) => ({
          ...prev,
          [rowLabel]:
            config.type === "checkbox"
              ? checked
                ? [...(prev[rowLabel] || []), colLabel]
                : (prev[rowLabel] || []).filter((c) => c !== colLabel)
              : colLabel,
        }));

        onChange({
          type: "matrix",
          value: {
            ...matrixAnswers,
            [rowLabel]:
              config.type === "checkbox"
                ? checked
                  ? [...(matrixAnswers[rowLabel] || []), colLabel]
                  : (matrixAnswers[rowLabel] || []).filter(
                      (c) => c !== colLabel
                    )
                : colLabel,
          },
        });
      };

      return (
        <div className="space-y-4">
          <div className="overflow-x-auto rounded-xl shadow-xl">
            <table className="min-w-full text-sm text-left ">
              <thead className="bg-[color:var(--bg-light)] rounded-xl dark:bg-[color:var(--bg-dark)]">
                <tr>
                  <th className="p-3 font-medium text-[color:var(--text-light)] dark:text-[color:var(--text-dark)]">
                    &nbsp;
                  </th>
                  {columns.map((col, idx) => (
                    <th
                      key={idx}
                      className="p-3 text-xs font-normal text-center text-nowrap text-[color:var(--text-light)] dark:text-[color:var(--text-dark)]"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, rowIndex) => (
                  <tr
                    key={rowIndex}
                    className="border-t border-[color:var(--secondary-light)] dark:border-[color:var(--secondary-dark)]"
                  >
                    <td className="p-3 text-xs text-nowrap text-[color:var(--text-light)] dark:text-[color:var(--text-dark)]">
                      {row}
                    </td>
                    {columns.map((col, colIndex) => {
                      const isChecked =
                        config.type === "checkbox"
                          ? matrixAnswers[row]?.includes(col)
                          : matrixAnswers[row] === col;

                      return (
                        <td key={colIndex} className="p-3 text-center">
                          <label className="inline-flex items-center justify-center cursor-pointer">
                            <input
                              type={
                                config.type === "checkbox"
                                  ? "checkbox"
                                  : "radio"
                              }
                              name={
                                config.type === "checkbox"
                                  ? `${rowIndex}-${colIndex}`
                                  : `${rowIndex}`
                              }
                              value={col}
                              checked={!!isChecked}
                              onChange={(e) =>
                                handleMatrixChange(row, col, e.target.checked)
                              }
                              className="hidden peer"
                            />
                            <div className="w-6 h-6 rounded border border-[color:var(--secondary-light)] bg-[color:var(--bg-light)] peer-checked:bg-[color:var(--primary-light)] flex items-center justify-center transition-colors duration-200">
                              <svg
                                className={`w-4 h-4 text-[color:var(--text-dark)] ${
                                  isChecked ? "block" : "hidden"
                                }`}
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="3"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M5 13l4 4L19 7"
                                />
                              </svg>
                            </div>
                          </label>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    case QUESTION_TYPES.WELCOME:
      return (
        <div className="text-center">
          <h2 className="text-3xl font-bold mb-2">{config.title}</h2>
          <p className="text-lg text-[color:var(--text-light)] dark:text-[color:var(--primary-light)] text-start justify-start">
            {config.description}
          </p>
        </div>
      );

case QUESTION_TYPES.SLIDER: {
  const min = config.min ?? 0;
  const max = config.max ?? 100;
  const step = config.step ?? 1;
  const prefix = config.prefix || "";
  const suffix = config.suffix || "";
  const anchors = Array.isArray(config.anchors) ? config.anchors : [];
  const showValue = config.showValue !== false;
  const showTicks = config.showTicks !== false;
  const snapToAnchors = !!config.snapToAnchors;

  const numericValue =
    typeof value === "number"
      ? value
      : config.startValue ?? Math.round((min + max) / 2);

  const snapIfNeeded = (val) => {
    if (!snapToAnchors || anchors.length === 0) return val;
    let closest = anchors[0].value;
    let bestDist = Math.abs(val - closest);
    for (const a of anchors) {
      const d = Math.abs(val - a.value);
      if (d < bestDist) {
        bestDist = d;
        closest = a.value;
      }
    }
    return closest;
  };

  const formatted = `${prefix}${numericValue}${suffix}`;
  const activeAnchor =
    anchors.find((a) => a.value === numericValue) || null;

  return (
    <div className="space-y-3 w-full">
      {/* labels above track */}
      <div className="flex justify-between text-[11px] text-[color:var(--text-light)] dark:text-[color:var(--text-dark)]">
        <span>{anchors[0]?.label || config.minLabel || min}</span>
        <span>
          {anchors[anchors.length - 1]?.label || config.maxLabel || max}
        </span>
      </div>

      {/* slider + numeric bubble */}
      <div className="flex items-center gap-3">
        <div className="flex-1 relative">
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={numericValue}
            onChange={(e) =>
              onChange(snapIfNeeded(Number(e.target.value)))
            }
            className="w-full accent-[color:var(--primary-light)]"
          />

          {/* ticks */}
          {showTicks && anchors.length > 0 && (
            <div className="mt-1 relative h-5">
              <div className="absolute inset-x-0 top-1 h-[2px] bg-gray-200 dark:bg-gray-700 rounded-full" />
              {anchors.map((a, idx) => {
                const pct =
                  ((a.value - min) / (max - min || 1)) * 100;

                const isActive = a.value === numericValue;
                return (
                  <div
                    key={`${a.value}-${idx}`}
                    className="absolute -translate-x-1/2"
                    style={{ left: `${pct}%` }}
                  >
                    <div
                      className={`w-[2px] h-3 mx-auto ${
                        isActive
                          ? "bg-[color:var(--primary-light)]"
                          : "bg-gray-400 dark:bg-gray-500"
                      }`}
                    />
                    <div className="mt-1 text-[10px] whitespace-nowrap text-center text-gray-500 dark:text-gray-300">
                      {a.label}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {showValue && (
          <div className="px-3 py-1.5 text-xs rounded-lg border bg-white/70 dark:bg-[#1A1A1E] dark:text-[#CBC9DE] shadow-sm min-w-[70px] text-center">
            {formatted}
          </div>
        )}
      </div>

      {activeAnchor && (
        <div className="text-xs text-gray-500 dark:text-gray-400">
          Selected band: <span className="font-medium">{activeAnchor.label}</span>
        </div>
      )}
    </div>
  );
}case QUESTION_TYPES.BAYES_ACQ: {
  const opts = config.items ?? [];
  const setSize = config.choiceSetSize ?? 3;
  const totalRounds = config.rounds ?? 5;

  const [round, setRound] = useState(1);
  const [selectedSet, setSelectedSet] = useState([]);

  // simple random selection for now (backend can later choose smarter sets)
  const getAdaptiveSet = () => {
    if (!opts.length) return [];
    const shuffled = [...opts].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, Math.min(setSize, shuffled.length));
  };

  useEffect(() => {
    setSelectedSet(getAdaptiveSet());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round, opts.length, setSize]);

  const handleSelect = (itemId) => {
    const prev = Array.isArray(value) ? value : [];
    const newValue = [...prev, { round, selected: itemId }];

    onChange(newValue);

    if (round < totalRounds) {
      setRound(round + 1);
    }
  };

  if (!opts.length) {
    return (
      <p className="text-xs text-gray-500 dark:text-gray-400">
        No features configured for this Bayesian choice question. Please add
        items in the survey designer.
      </p>
    );
  }

  const answeredCount = Array.isArray(value) ? value.length : 0;
  const progress = Math.min(
    100,
    Math.round((answeredCount / totalRounds) * 100)
  );

  return (
    <div className="space-y-4">
      {/* Progress bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>
            Round {Math.min(round, totalRounds)} of {totalRounds}
          </span>
          <span>{progress}% complete</span>
        </div>
        <div className="w-full h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
          <div
            className="h-full bg-[color:var(--primary-light)] dark:bg-[color:var(--primary-dark)] transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Option cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {selectedSet.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => handleSelect(item.id)}
            className="p-4 rounded-xl border border-[color:var(--secondary-light)] dark:border-[color:var(--secondary-dark)] bg-[color:var(--bg-light)] dark:bg-[color:var(--bg-dark)] text-left hover:shadow-md hover:bg-[color:var(--primary-light)]/10 dark:hover:bg-[color:var(--primary-dark)]/20 transition-all"
          >
            <div className="font-medium text-sm text-[color:var(--text-light)] dark:text-[color:var(--text-dark)]">
              {item.label}
            </div>
            {item.description && (
              <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {item.description}
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Debug / explanation for analysts (optional) */}
      {Array.isArray(value) && value.length > 0 && (
        <div className="mt-2 text-[10px] text-gray-400 dark:text-gray-500">
          Responses so far:{" "}
          {value.map((r) => `${r.round}:${r.selected}`).join(", ")}
        </div>
      )}
    </div>
  );
}

    case QUESTION_TYPES.TURF_PRO: {
      const opts = config.options ?? [];
      const scale = config.responseScale ?? {
        "1": { label: "Not Interested", reachValue: 0 },
        "2": { label: "Might Try", reachValue: 0.25 },
        "3": { label: "Likely", reachValue: 0.6 },
        "4": { label: "Definitely", reachValue: 1.0 },
      };

      const scaleKeys = Object.keys(scale).sort(
        (a, b) => Number(a) - Number(b)
      );

      // value looks like: { [optionId]: 1 | 2 | 3 | 4 }
      const answers = value || {};

      const handleClick = (optId, scaleKey) => {
        onChange({
          ...answers,
          [optId]: Number(scaleKey),
        });
      };

      if (!opts.length) {
        return (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            No options configured. Please add options in the designer.
          </p>
        );
      }

      return (
        <div className="space-y-4">
          <div className="overflow-x-auto rounded-xl shadow-sm border border-[color:var(--secondary-light)] dark:border-[color:var(--secondary-dark)]">
            <table className="min-w-full text-sm">
              <thead className="bg-[color:var(--bg-light)] dark:bg-[color:var(--bg-dark)]">
                <tr>
                  <th className="p-3 text-left text-xs font-medium text-[color:var(--text-light)] dark:text-[color:var(--text-dark)]">
                    Option
                  </th>
                  {scaleKeys.map((k) => (
                    <th
                      key={k}
                      className="p-3 text-center text-xs font-medium text-[color:var(--text-light)] dark:text-[color:var(--text-dark)]"
                    >
                      {scale[k]?.label ?? k}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {opts.map((opt) => (
                  <tr
                    key={opt.id}
                    className="border-t border-[color:var(--secondary-light)] dark:border-[color:var(--secondary-dark)]"
                  >
                    <td className="p-3 text-xs text-[color:var(--text-light)] dark:text-[color:var(--text-dark)]">
                      {opt.label}
                    </td>

                    {scaleKeys.map((k) => {
                      const selected =
                        Number(answers[opt.id]) === Number(k);

                      return (
                        <td
                          key={`${opt.id}-${k}`}
                          className="p-2 text-center"
                        >
                          <button
                            type="button"
                            onClick={() => handleClick(opt.id, k)}
                            className={`w-8 h-8 rounded-full text-xs font-medium transition-all focus:outline-none focus:ring-2 focus:ring-orange-400
                              ${
                                selected
                                  ? "bg-[color:var(--primary-light)] text-white shadow-md"
                                  : "bg-[color:var(--bg-light)] dark:bg-[color:var(--bg-dark)] text-[color:var(--text-light)] dark:text-[color:var(--text-dark)] hover:bg-[color:var(--primary-light)]/80"
                              }`}
                          >
                            {k}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-[11px] text-gray-500 dark:text-gray-400">
            Select one level of interest for each option. We&apos;ll use this
            to simulate portfolio reach & frequency in TURF analytics.
          </p>
        </div>
      );
    }

    case QUESTION_TYPES.REDIRECT:
      return (
        <div className="text-center">
          <p className="text-sm text-[color:var(--text-light)] dark:text-[color:var(--text-dark)] mb-2">
            After completing this step, you'll be redirected to:
          </p>
          <a
            href={config.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[color:var(--secondary-light)] dark:text-[color:var(--secondary-dark)] underline break-all"
          >
            {config.url || "No URL configured"}
          </a>
        </div>
      );
case QUESTION_TYPES.WEIGHTED_MULTI: {
  // Normalize options to object structure
  const rawOpts = config.options || [];
  const options = rawOpts.map((o, idx) =>
    typeof o === "string"
      ? {
          id: `opt_${idx + 1}`,
          label: o,
          description: "",
          min: config.minWeight ?? 0,
          max: config.maxWeight ?? config.maxWeight ?? 10,
          locked: false,
        }
      : {
          id: o.id || `opt_${idx + 1}`,
          label: o.label || `Option ${idx + 1}`,
          description: o.description || "",
          min:
            typeof o.min === "number"
              ? o.min
              : config.minWeight ?? 0,
          max:
            typeof o.max === "number"
              ? o.max
              : config.maxWeight ?? 10,
          locked: !!o.locked,
        }
  );

  const minGlobal = config.minWeight ?? 0;
  const maxGlobal = config.maxWeight ?? 10;
  const weightType = config.weightType || "slider";

  const totalLimitEnabled = !!config.totalLimitEnabled;
  const totalMax = config.totalMax ?? 100;

  const requireMinAssigned = config.requireMinAssigned ?? 1;
  const requireNonZeroTotal = !!config.requireNonZeroTotal;

  const answers = value || {}; // { [optionId]: number }
  const total = Object.entries(answers).reduce(
    (sum, [, v]) => sum + (Number.isFinite(v) ? v : 0),
    0
  );

  const nonZeroCount = Object.values(answers).filter(
    (v) => Number(v) > 0
  ).length;

  const remaining = totalLimitEnabled ? Math.max(totalMax - total, 0) : null;
  const overLimit = totalLimitEnabled && total > totalMax;

  const updateWeight = (opt, rawVal) => {
    if (rawVal === "" || rawVal === null || rawVal === undefined) {
      const next = { ...answers };
      delete next[opt.id];
      onChange(next);
      return;
    }

    let val = Number(rawVal);
    if (!Number.isFinite(val)) return;

    // Per-option min/max
    const localMin = typeof opt.min === "number" ? opt.min : minGlobal;
    const localMax = typeof opt.max === "number" ? opt.max : maxGlobal;

    if (val < localMin) val = localMin;
    if (val > localMax) val = localMax;

    // Total limit check
    if (totalLimitEnabled) {
      const oldVal = answers[opt.id] || 0;
      const newTotal = total - oldVal + val;
      if (newTotal > totalMax) {
        // hard block – or you can allow but show warning
        return;
      }
    }

    const next = { ...answers, [opt.id]: val };
    // Optional: auto-prune zeros
    if (!config.allowZero && val === 0) {
      delete next[opt.id];
    }
    onChange(next);
  };

  // Validation hint (visual only – actual blocking is handled by required logic elsewhere)
  const showMinAssignedWarning =
    requireMinAssigned > 0 && nonZeroCount < requireMinAssigned;
  const showNonZeroTotalWarning =
    requireNonZeroTotal && total === 0;

  const rowBg = (opt) =>
    opt.locked
      ? "bg-gray-100 dark:bg-[#1E1E22] opacity-70"
      : "bg-[color:var(--bg-light)] dark:bg-[color:var(--bg-dark)]";

  return (
    <div className="space-y-4">
      {totalLimitEnabled && (
        <div className="text-xs text-gray-500 dark:text-gray-400">
          You have{" "}
          <span className="font-semibold">
            {remaining} / {totalMax}
          </span>{" "}
          points remaining.
        </div>
      )}

      {options.map((opt) => {
        const val = answers[opt.id] ?? "";
        const localMin = typeof opt.min === "number" ? opt.min : minGlobal;
        const localMax = typeof opt.max === "number" ? opt.max : maxGlobal;
        const isLocked = opt.locked;

        return (
          <div
            key={opt.id}
            className={`p-3 rounded-xl border flex flex-col gap-2 ${
              rowBg(opt)
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1">
                <div className="font-medium text-sm">
                  {opt.label}
                  {isLocked && (
                    <span className="ml-2 text-[10px] uppercase tracking-wide text-orange-500">
                      LOCKED
                    </span>
                  )}
                </div>
                {opt.description && (
                  <div className="text-xs text-gray-500 mt-0.5">
                    {opt.description}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                {weightType === "slider" && (
                  <>
                    <input
                      type="range"
                      min={localMin}
                      max={localMax}
                      value={val === "" ? localMin : val}
                      disabled={isLocked}
                      onChange={(e) =>
                        updateWeight(opt, e.target.value)
                      }
                      className="w-32"
                    />
                    <div className="w-12 text-right text-xs">
                      {val === "" ? "—" : val}
                    </div>
                  </>
                )}

                {weightType === "textbox" && (
                  <input
                    type="number"
                    min={localMin}
                    max={localMax}
                    disabled={isLocked}
                    value={val}
                    onChange={(e) =>
                      updateWeight(opt, e.target.value)
                    }
                    className="w-16 px-2 py-1 rounded border text-xs dark:bg-[#111] dark:text-[#CBC9DE]"
                  />
                )}

                {weightType === "scale" && (
                  <select
                    disabled={isLocked}
                    value={val}
                    onChange={(e) =>
                      updateWeight(opt, e.target.value)
                    }
                    className="px-2 py-1 rounded border text-xs dark:bg-[#111] dark:text-[#CBC9DE]"
                  >
                    <option value="">-</option>
                    {Array.from(
                      { length: localMax - localMin + 1 },
                      (_, i) => localMin + i
                    ).map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between text-[10px] text-gray-500">
              <span>
                Allowed range: {localMin} – {localMax}
              </span>
              {totalLimitEnabled && (
                <span>Current total: {total}</span>
              )}
            </div>
          </div>
        );
      })}

      {config.showTotal && (
        <div className="mt-2 text-xs font-medium text-gray-700 dark:text-gray-300">
          Total assigned weight: {total}
          {totalLimitEnabled ? ` / ${totalMax}` : ""}
        </div>
      )}

      {config.showRemainingBar && totalLimitEnabled && (
        <div className="w-full h-2 rounded-full bg-gray-200 dark:bg-gray-800 overflow-hidden mt-1">
          <div
            className={`h-2 rounded-full ${
              overLimit
                ? "bg-red-500"
                : "bg-[color:var(--primary-light)] dark:bg-[color:var(--primary-dark)]"
            }`}
            style={{
              width: `${Math.min((total / totalMax) * 100, 100)}%`,
            }}
          />
        </div>
      )}

      {(showMinAssignedWarning || showNonZeroTotalWarning) && (
        <div className="mt-2 text-xs text-red-500 dark:text-red-400">
          {showMinAssignedWarning && (
            <div>
              Please assign weight &gt; 0 to at least{" "}
              {requireMinAssigned} option
              {requireMinAssigned > 1 ? "s" : ""}.
            </div>
          )}
          {showNonZeroTotalWarning && (
            <div>Total assigned weight must be greater than 0.</div>
          )}
        </div>
      )}
    </div>
  );
}

    case QUESTION_TYPES.END_SCREEN:
      return (
        <div className="text-center">
          <h2 className="text-3xl font-bold text-green-600 dark:text-green-400">
            {config.title}
          </h2>
          <p className="mt-2 text-lg text-[color:var(--text-light)] dark:text-[color:var(--primary-light)]">
            {config.description}
          </p>
        </div>
      );

    default:
      return (
        <p className="p-4 rounded-xl text-center text-[color:var(--text-light)] dark:text-[color:var(--primary-light)]">
          Unsupported question type: {questionType}
        </p>
      );
  }
}
