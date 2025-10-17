import { db } from "@/firebase/firebase";
import { getDocs, collection } from "firebase/firestore";

const evaluateCondition = (condition, answers) => {
  const userAnswer = answers?.[condition.questionId];
  const val = condition.dataType === "number" ? parseFloat(condition.value) : condition.value;

  switch (condition.operator) {
    case "eq": return userAnswer === val;
    case "neq": return userAnswer !== val;
    case "gt": return parseFloat(userAnswer) > val;
    case "lt": return parseFloat(userAnswer) < val;
    case "gte": return parseFloat(userAnswer) >= val;
    case "lte": return parseFloat(userAnswer) <= val;
    case "contains": return Array.isArray(userAnswer) && userAnswer.includes(val);
    case "not_contains": return Array.isArray(userAnswer) && !userAnswer.includes(val);
    default: return false;
  }
};

export const evaluateRuleConditions = (conditions, logicType, answers) => {
  if (!Array.isArray(conditions)) return false;
  if (logicType === "AND") return conditions.every((c) => evaluateCondition(c, answers));
  if (logicType === "OR") return conditions.some((c) => evaluateCondition(c, answers));
  return false;
};

export function evaluateRule(rule, answers) {
  if (!rule || !Array.isArray(rule.conditions)) return false;

  const norm = (v) => {
    if (v == null) return "";
    if (typeof v === "string") return v.trim().toLowerCase();
    return String(v).trim().toLowerCase();
  };

  const toNum = (v) => {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : null;
  };

  const isNpsPromoter = (s) => s >= 9 && s <= 10;
  const isNpsPassive = (s) => s >= 7 && s <= 8;
  const isNpsDetractor = (s) => s >= 0 && s <= 6;

  const evalOne = (cond) => {
    const lhs = answers?.[cond.questionId];
    const op = (cond.operator || "equals").toLowerCase();

    // NPS operators
    if (op.startsWith("nps_")) {
      const score = toNum(lhs);
      if (score == null) return false;

      switch (op) {
        case "nps_is_promoter":
          return isNpsPromoter(score);
        case "nps_is_passive":
          return isNpsPassive(score);
        case "nps_is_detractor":
          return isNpsDetractor(score);
        case "nps_gte": {
          const v = toNum(cond.value);
          return v != null && score >= v;
        }
        case "nps_lte": {
          const v = toNum(cond.value);
          return v != null && score <= v;
        }
        case "nps_between": {
          let min = toNum(cond.min);
          let max = toNum(cond.max);
          if (min == null || max == null) return false;
          if (min > max) [min, max] = [max, min];
          return score >= min && score <= max;
        }
        default:
          return false;
      }
    }

    // String comparisons
    if (op === "equals") return norm(lhs) === norm(cond.value);
    if (op === "not_equals") return norm(lhs) !== norm(cond.value);

    // Numeric comparisons
    const a = toNum(lhs);
    const b = toNum(cond.value);
    if (a == null || b == null) return false;
    if (op === "greater_than") return a > b;
    if (op === "less_than") return a < b;

    return false;
  };

  let acc = null;
  for (let i = 0; i < rule.conditions.length; i++) {
    const c = rule.conditions[i];
    const pass = evalOne(c);
    if (i === 0) {
      acc = pass;
    } else {
      const logic = (c.conditionLogic || "AND").toUpperCase();
      acc = logic === "OR" ? acc || pass : acc && pass;
    }
  }
  return !!acc;
}


export const fetchRulesForSurvey = async (orgId, surveyId) => {
  const ref = collection(db, `organizations/${orgId}/surveys/${surveyId}/rules`);
  const snap = await getDocs(ref);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

export const getNextQuestionFromRules = (rules, answers) => {
  for (const rule of (rules || []).sort((a, b) => a.priority - b.priority)) {
    const next = evaluateRule(rule, answers);
    if (next) return next;
  }
  return null;
};

export function getNextBlockFromRules({
  rules,
  answers,
  currentBlockId,
  blockOrder = [],
}) {
  if (!Array.isArray(rules)) return null;

  const active = rules
    .filter((r) => r.enabled !== false)
    .sort((a, b) => Number(a.priority ?? 1) - Number(b.priority ?? 1));

  for (const rule of active) {
    if (rule.blockId && rule.blockId !== currentBlockId) continue;

    try {
      if (typeof evaluateRule === "function" && evaluateRule(rule, answers)) {
        for (const act of rule.actions || []) {
          if (act.type === "show_message") continue;
          if (act.type === "end") return null;

          if (act.type === "goto_block" && act.blockId) {
            return act.blockId;
          }

          if (act.type === "skip_block" && Array.isArray(act.blockIds)) {
            const skipSet = new Set(act.blockIds);
            const idx = blockOrder.indexOf(currentBlockId);
            for (let i = idx + 1; i < blockOrder.length; i++) {
              if (!skipSet.has(blockOrder[i])) return blockOrder[i];
            }
            return null;
          }

          if (act.type === "goto_block_question" && act.targetBlockId) {
            return act.targetBlockId;
          }

          if (act.type === "goto_question") {
            return currentBlockId;
          }

          if (act.type === "skip_questions") {
            const idx = blockOrder.indexOf(currentBlockId);
            if (idx >= 0 && idx + 1 < blockOrder.length) return blockOrder[idx + 1];
            return null;
          }
        }
      }
    } catch (e) {
      console.warn("Rule eval failed", e);
    }
  }

  const idx = blockOrder.indexOf(currentBlockId);
  if (idx >= 0 && idx + 1 < blockOrder.length) return blockOrder[idx + 1];
  return null;
}

export function getNextTargetFromRules({
  rules,
  answers,
  currentBlockId,
  currentQuestionId,
  blockOrder = [],
  questionsByBlock = {},
  evaluateRule,
}) {
  const active = (rules || [])
    .filter((r) => r.enabled !== false)
    .sort((a, b) => Number(a.priority ?? 1) - Number(b.priority ?? 1));

  for (const rule of active) {
    if (rule.blockId && rule.blockId !== currentBlockId) continue;
    if (!evaluateRule || !evaluateRule(rule, answers)) continue;

    for (const act of (rule.actions || [])) {
      if (act.type === "show_message") continue;
      if (act.type === "end") return { type: "end" };

      if (act.type === "skip_block") {
        const skipSet = new Set(act.blockIds || []);
        const idx = blockOrder.indexOf(currentBlockId);
        for (let i = idx + 1; i < blockOrder.length; i++) {
          if (!skipSet.has(blockOrder[i])) {
            return { type: "block", blockId: blockOrder[i] };
          }
        }
        return { type: "end" };
      }

      if (act.type === "goto_block") {
        if (act.blockId) return { type: "block", blockId: act.blockId };
      }

      if (act.type === "skip_questions") {
        const order = questionsByBlock[currentBlockId] || [];
        const ids = order.map((q) => q.id);
        const skipSet = new Set(act.questionIds || []);
        const startIdx = Math.max(0, ids.indexOf(currentQuestionId));
        for (let i = startIdx + 1; i < ids.length; i++) {
          if (!skipSet.has(ids[i])) {
            return { type: "question", blockId: currentBlockId, questionId: ids[i] };
          }
        }
        const bIdx = blockOrder.indexOf(currentBlockId);
        if (bIdx >= 0 && bIdx + 1 < blockOrder.length) {
          return { type: "block", blockId: blockOrder[bIdx + 1] };
        }
        return { type: "end" };
      }

      if (act.type === "goto_question") {
        if (act.questionId) {
          return { type: "question", blockId: currentBlockId, questionId: act.questionId };
        }
      }

      if (act.type === "goto_block_question") {
        if (act.targetBlockId && act.targetQuestionId) {
          return { type: "question", blockId: act.targetBlockId, questionId: act.targetQuestionId };
        }
        if (act.targetBlockId) {
          const firstQ = (questionsByBlock[act.targetBlockId] || [])[0];
          if (firstQ) {
            return { type: "question", blockId: act.targetBlockId, questionId: firstQ.id };
          }
          return { type: "block", blockId: act.targetBlockId };
        }
      }
    }
  }

  const order = questionsByBlock[currentBlockId] || [];
  const ids = order.map((q) => q.id);
  const idxQ = ids.indexOf(currentQuestionId);
  if (idxQ >= 0 && idxQ + 1 < ids.length) {
    return { type: "question", blockId: currentBlockId, questionId: ids[idxQ + 1] };
  }
  const bIdx = blockOrder.indexOf(currentBlockId);
  if (bIdx >= 0 && bIdx + 1 < blockOrder.length) {
    return { type: "block", blockId: blockOrder[bIdx + 1] };
  }
  return { type: "end" };
}
