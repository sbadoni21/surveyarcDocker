"use client";
import React, { useMemo } from "react";
import { v4 as uuidv4 } from "uuid";

/* -------------------------------------------------------
   Helpers
------------------------------------------------------- */

const OPTION_TYPES = ["multiple_choice", "checkbox", "dropdown", "ranking"];

function isOptionQuestion(q) {
  return OPTION_TYPES.includes(q.type);
}

function buildRegistry(questions = []) {
  const qMap = {};
  const optMap = {};

  questions.forEach((q) => {
    if (!q.serial_label) return;

    qMap[q.serial_label] = q;

    const options = q.config?.options || q.config?.items || [];
    if (Array.isArray(options)) {
      optMap[q.serial_label] = options
        .filter((o) => o?.serial_label)
        .map((o) => ({
          label: `${o.serial_label} – ${o.label}`,
          value: o.serial_label,
        }));
    }
  });

  return { qMap, optMap };
}
function generateRuleId() {
  // 6 digit alphanumeric (base36) – very low collision chance
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function createEmptyRule(currentQuestion) {
  return {
    id: generateRuleId(),
    if: {
      question_serial: currentQuestion.serial_label,
      operator: "equals",
      value: "",
    },
    then: {
      action: "hide_options",
      target_question: "",
      options: [],
      source_question: "",
      target_field: "label",
    },
  };
}

export default function LogicEditor({
  logic = [],
  updateLogic,
  questions = [],
  currentQuestion,
}) {
  const rules = Array.isArray(logic) ? logic : [];

  const { qMap, optMap } = useMemo(() => buildRegistry(questions), [questions]);

  const currentOptions = optMap[currentQuestion.serial_label] || [];

  const updateRule = (index, path, value) => {
    const copy = [...rules];
    const keys = path.split(".");
    let ref = copy[index];

    for (let i = 0; i < keys.length - 1; i++) {
      ref = ref[keys[i]];
    }

    ref[keys[keys.length - 1]] = value;
    updateLogic(copy);
  };

  const addRule = () => {
    updateLogic([...rules, createEmptyRule(currentQuestion)]);
  };

  const removeRule = (index) => {
    updateLogic(rules.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4 mt-6 border-t pt-4">
      <h3 className="font-semibold text-sm text-gray-700 dark:text-gray-300">
        Question Logic
      </h3>

      {rules.map((rule, index) => {
        const targetQuestion = qMap[rule.then.target_question];
        const canHideOptions =
          targetQuestion && isOptionQuestion(targetQuestion);

        return (
          <div
            key={rule.id}
            className="border rounded p-3 bg-gray-50 dark:bg-[#1A1A1E] space-y-2"
          >
            {/* IF */}
            <div className="flex items-center gap-2 text-xs">
              <strong>IF</strong>
              <span className="px-2 py-1 bg-gray-200 dark:bg-[#2a2a2a] rounded">
                {currentQuestion.serial_label}
              </span>

              <select
                value={rule.if.operator}
                onChange={(e) =>
                  updateRule(index, "if.operator", e.target.value)
                }
                className="border px-2 py-1 rounded"
              >
                <option value="equals">equals</option>
                <option value="not_equals">not equals</option>
                <option value="answered">is answered</option>
              </select>

              {rule.if.operator !== "answered" && (
                <select
                  value={typeof rule.if.value === "string" ? rule.if.value : ""}
                  onChange={(e) =>
                    updateRule(index, "if.value", e.target.value)
                  }
                  className="border px-2 py-1 rounded"
                >
                  <option value="">Select option</option>
                  {currentOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* THEN */}
            <div className="flex items-center gap-2 text-xs flex-wrap">
              <strong>THEN</strong>

              <select
                value={rule.then.action}
                onChange={(e) =>
                  updateRule(index, "then.action", e.target.value)
                }
                className="border px-2 py-1 rounded"
              >
                <option value="hide_options">Hide options</option>
                <option value="pipe_answer">Pipe answer</option>
              </select>

              <select
                value={rule.then.target_question}
                onChange={(e) =>
                  updateRule(index, "then.target_question", e.target.value)
                }
                className="border px-2 py-1 rounded"
              >
                <option value="">Target question</option>
                {questions
                  .filter(
                    (q) => q.serial_label !== currentQuestion.serial_label
                  )
                  .map((q) => (
                    <option key={q.serial_label} value={q.serial_label}>
                      {q.serial_label} – {q.label}
                    </option>
                  ))}
              </select>

              {/* HIDE OPTIONS */}
              {rule.then.action === "hide_options" && canHideOptions && (
                <select
                  multiple
                  value={rule.then.options || []}
                  onChange={(e) =>
                    updateRule(
                      index,
                      "then.options",
                      Array.from(e.target.selectedOptions).map((o) => o.value)
                    )
                  }
                  className="border px-2 py-1 rounded"
                >
                  {optMap[rule.then.target_question]?.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              )}

              {/* PIPE ANSWER */}
              {rule.then.action === "pipe_answer" && (
                <select
                  value={rule.then.target_field}
                  onChange={(e) =>
                    updateRule(index, "then.target_field", e.target.value)
                  }
                  className="border px-2 py-1 rounded"
                >
                  <option value="label">Label</option>
                  <option value="description">Description</option>
                  <option value="config.placeholder">Placeholder</option>
                </select>
              )}

              <button
                onClick={() => removeRule(index)}
                className="text-red-600 ml-auto"
              >
                Delete
              </button>
            </div>
          </div>
        );
      })}

      <button
        type="button"
        onClick={addRule}
        className="text-xs px-3 py-1 rounded bg-blue-600 text-white"
      >
        + Add Logic Rule
      </button>
    </div>
  );
}
