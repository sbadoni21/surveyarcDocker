// components/survey/QuestionLogicEngine.js

function normalizeAnswer(answer) {
  if (answer == null) return null;

  if (Array.isArray(answer)) return answer;

  if (typeof answer === "object") {
    if (Array.isArray(answer.values)) return answer.values;
    if ("value" in answer) return answer.value;
    return null;
  }

  return answer;
}

function evaluateIf(ifCond, answers) {
  const { question_serial, operator, value } = ifCond;
  const ans = normalizeAnswer(answers?.[question_serial]);

  switch (operator) {
    case "equals":
      return Array.isArray(ans) ? ans.includes(value) : ans === value;

    case "not_equals":
      return Array.isArray(ans) ? !ans.includes(value) : ans !== value;

    case "answered":
      return Array.isArray(ans) ? ans.length > 0 : !!ans;

    default:
      return false;
  }
}

export function evaluateQuestionLogic({ questions = [], answers = {} }) {
  const hiddenOptionsMap = {};
  const pipedUpdates = [];

  questions.forEach((q) => {
    const rules = q?.config?.logic;
    if (!Array.isArray(rules)) return;

    rules.forEach((rule) => {
      if (!evaluateIf(rule.if, answers)) return;

      const then = rule.then;

      // 🔹 HIDE OPTIONS
      if (
        then.action === "hide_options" &&
        then.target_question &&
        Array.isArray(then.options)
      ) {
        hiddenOptionsMap[then.target_question] ??= new Set();
        then.options.forEach((o) =>
          hiddenOptionsMap[then.target_question].add(o)
        );
      }

      // 🔹 PIPE ANSWER
      if (
        then.action === "pipe_answer" &&
        then.target_question &&
        then.target_field
      ) {
        const source =
          normalizeAnswer(answers[rule.if.question_serial]) ?? "";

        pipedUpdates.push({
          targetSerial: then.target_question,
          field: then.target_field,
          value: Array.isArray(source) ? source.join(", ") : source,
        });
      }
    });
  });

  return { hiddenOptionsMap, pipedUpdates };
}
