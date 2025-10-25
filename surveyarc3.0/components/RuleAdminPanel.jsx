"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  GitBranch,
  Play,
  Filter,
} from "lucide-react";
import {
  evaluateRule,
  fetchRulesForSurvey, // keep using your ruleEngine helper; make it call the Postgres API under the hood
  getNextBlockFromRules,
  getNextTargetFromRules,
} from "@/utils/ruleEngine";
import { useParams } from "next/navigation";
import { useRule } from "@/providers/rulePProvider";
import TicketForm from "./tickets/TicketForm";
import { useTags } from "@/providers/postGresPorviders/TagProvider";
import { useTickets } from "@/providers/ticketsProvider";
import { useUser } from "@/providers/postGresPorviders/UserProvider";
import RaiseTicketForm from "./tickets/RaiseTicketForm";

const emptyCondition = {
  questionId: "",
  operator: "equals",
  value: "",
  conditionLogic: "AND",
};

const emptyAction = {
  type: "goto_block",
  blockId: "",
  targetBlockId: "",
  targetQuestionId: "",
  questionId: "",
  blockIds: [],
  questionIds: [],
  message: "",

  subjectTemplate: "",
  priority: "normal", // TicketForm defaults to normal
  groupId: "",
  tagsCsv: "",
};

function makeEmptyRule(surveyId, blockId) {
  return {
    name: "",
    surveyId,
    blockId, // scope rule to a block (Qualtrics-style)
    enabled: true,
    priority: 1,
    conditions: [{ ...emptyCondition }],
    actions: [{ ...emptyAction }],
  };
}

const csvToArray = (s) =>
  (s || "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

// map tag names (from CSV) -> tagIds that TicketForm expects
const namesToTagIds = (names, availableTags) => {
  if (!Array.isArray(names) || !Array.isArray(availableTags)) return [];
  const byName = new Map(
    availableTags.map((t) => [
      (t.name ?? t.tag_name ?? t.label)?.toLowerCase(),
      t.tag_id ?? t.tagId ?? t.id,
    ])
  );
  return names.map((n) => byName.get(String(n).toLowerCase())).filter(Boolean);
};

export default function RuleAdminPanel({ questionOptions = [], blocks = [] }) {
  const params = useParams();
  const orgId = params.organizations;
  const surveyId = params.slug;
  const { list: listTags, getCachedTags } = useTags();
  const availableTags = getCachedTags(orgId);
  const { uid: currentUserId } = useUser() || {};
  const { rules, getAllRules, saveRule, updateRule, deleteRule } = useRule();

  const [editingRule, setEditingRule] = useState(null);
  const [loading, setLoading] = useState(false);

  const [expandedBlocks, setExpandedBlocks] = useState({});
  const [testAnswers, setTestAnswers] = useState({});
  const [currentBlockId, setCurrentBlockId] = useState("");
  const [currentQuestionId, setCurrentQuestionId] = useState("");

  // state
  const [ticketOpen, setTicketOpen] = useState(false);
  const [ticketInitial, setTicketInitial] = useState(null);
  const [ticketActIndex, setTicketActIndex] = useState(null);

  // ----- Derived structures -----
  const blockOrder = useMemo(() => {
    return (blocks || [])
      .slice()
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((b) => b.id);
  }, [blocks]);

  const blocksById = useMemo(() => {
    const m = {};
    (blocks || []).forEach((b) => (m[b.id] = b));
    return m;
  }, [blocks]);

  const questionsById = useMemo(() => {
    const m = {};
    (questionOptions || []).forEach((q) => {
      m[q.id] = q;
    });
    return m;
  }, [questionOptions]);

  const questionsByBlock = useMemo(() => {
    const m = {};
    (blocks || []).forEach((b) => {
      const list = Array.isArray(b.questionIds)
        ? b.questionIds.map((qid) => questionsById[qid]).filter(Boolean)
        : [];
      m[b.id] = list;
    });

    (questionOptions || []).forEach((q) => {
      const bid = q.blockId;
      if (!bid) return;
      if (!m[bid]) m[bid] = [];
      if (!m[bid].some((qq) => qq.id === q.id)) m[bid].push(q);
    });

    Object.keys(m).forEach((bid) => {
      m[bid].sort((a, b) => {
        const ao = a?.order ?? 0;
        const bo = b?.order ?? 0;
        if (ao !== bo) return ao - bo;
        return String(a?.title || a?.id).localeCompare(
          String(b?.title || b?.id)
        );
      });
    });

    return m;
  }, [blocks, questionsById, questionOptions]);

  useEffect(() => {
    if (orgId) {
      // Best-effort; ignore errors
      listTags({ orgId }).catch(() => {});
    }
  }, [orgId, listTags]);

  // ----- Load rules from Postgres via provider -----
  const loadRules = async () => {
    const data = await getAllRules(surveyId);
    // Provider sets state; if you need custom order in UI, we sort at render-time where needed
    return data;
  };

  // ----- Helpers -----
  const normalizeActions = (actions) =>
    (actions || []).map((act) => {
      const base = { type: act.type };
      if (act.type === "goto_block") base.blockId = act.blockId || "";
      if (act.type === "goto_block_question") {
        base.targetBlockId = act.targetBlockId || "";
        base.targetQuestionId = act.targetQuestionId || "";
      }
      if (act.type === "goto_question") base.questionId = act.questionId || "";
      if (act.type === "skip_block")
        base.blockIds = Array.isArray(act.blockIds) ? act.blockIds : [];
      if (act.type === "skip_questions")
        base.questionIds = Array.isArray(act.questionIds)
          ? act.questionIds
          : [];
      if (act.type === "show_message") base.message = act.message || "";
      if (act.type === "raise_ticket") {
        base.subjectTemplate = act.subjectTemplate || "";
        base.priority = act.priority || "normal";
        base.groupId = act.groupId || "";
        base.tagsCsv = act.tagsCsv || "";
        base.message = act.message || "";
        base.slaId = act.slaId || "";
        base.ticketData = Array.isArray(act.ticketData) ? act.ticketData : [];
      }
      return base;
    });

  const toggleBlockExpanded = (blockId) =>
    setExpandedBlocks((p) => ({ ...p, [blockId]: !p[blockId] }));

  const startCreateRuleForBlock = (blockId) => {
    setEditingRule(makeEmptyRule(surveyId, blockId));
    if (!expandedBlocks[blockId]) toggleBlockExpanded(blockId);
  };

  const updateTestAnswer = (qid, value) =>
    setTestAnswers((p) => ({ ...p, [qid]: value }));

  const simulateNextBlock = async () => {
    const allRules = await fetchRulesForSurvey(orgId, surveyId);
    const next = getNextBlockFromRules({
      rules: allRules,
      answers: testAnswers,
      currentBlockId: currentBlockId || blockOrder[0],
      blockOrder,
    });
    alert(`Next Block: ${next || "End Survey"}`);
  };

  const simulateNextTarget = async () => {
    const allRules = await fetchRulesForSurvey(orgId, surveyId);

    const target = getNextTargetFromRules({
      rules: allRules,
      answers: testAnswers,
      currentBlockId: currentBlockId || blockOrder[0],
      currentQuestionId:
        currentQuestionId ||
        ((questionsByBlock[currentBlockId] || [])[0]?.id ?? ""),
      blockOrder,
      questionsByBlock,
      evaluateRule,
    });

    const inBlock = allRules.filter(
      (r) =>
        r.enabled !== false && r.blockId === (currentBlockId || blockOrder[0])
    );
    console.group("Rule Inspector");
    inBlock.forEach((r) => {
      const passed = evaluateRule(r, testAnswers);
      console.log(
        `Rule: ${r.name || r.ruleId} (priority ${r.priority}) -> ${
          passed ? "MATCH" : "no match"
        }`
      );
      console.table(
        (r.conditions || []).map((c) => ({
          questionId: c.questionId,
          operator: c.operator,
          expected: c.value,
          actual: testAnswers?.[c.questionId],
        }))
      );
      console.log("actions:", r.actions);
    });
    console.log("Chosen target:", target);
    console.groupEnd();

    if (!target || target.type === "end") {
      alert("Next: End Survey");
      return;
    }
    if (target.type === "block") {
      alert(
        `Next: Block → ${blocksById[target.blockId]?.title || target.blockId}`
      );
      return;
    }
    if (target.type === "question") {
      const qList = questionsByBlock[target.blockId] || [];
      const qTitle =
        qList.find((q) => q.id === target.questionId)?.title ||
        target.questionId;
      const bTitle = blocksById[target.blockId]?.title || target.blockId;
      alert(`Next: ${bTitle} → ${qTitle}`);
    }
  };

  // ----- CRUD using provider -----
  const onSaveRule = async () => {
    if (!editingRule) return;
    if (!editingRule.blockId) {
      alert("Please select a Block for this branch.");
      return;
    }
    setLoading(true);
    try {
      const payload = {
        ...editingRule,
        surveyId,
        enabled: editingRule.enabled !== false,
        priority: Number(editingRule.priority || 1),
        actions: normalizeActions(editingRule.actions),
      };

      if (editingRule.ruleId) {
        await updateRule(surveyId, editingRule.ruleId, payload);
      } else {
        // Let backend create id OR provide your own
        payload.ruleId = `rule_${Math.random().toString(36).slice(2, 10)}`;
        await saveRule(orgId, surveyId, payload);
      }

      await loadRules();
      setEditingRule(null);
    } catch (err) {
      console.error("Save failed", err);
      alert("Save failed. Check console for details.");
    } finally {
      setLoading(false);
    }
  };

  const onDeleteRule = async (id) => {
    await deleteRule(surveyId, id);
    await loadRules();
  };

  // ----- Effects -----
  useEffect(() => {
    if (surveyId) loadRules();
  }, [surveyId]);

  useEffect(() => {
    if (!currentBlockId && blockOrder.length) setCurrentBlockId(blockOrder[0]);
  }, [blockOrder, currentBlockId]);

  useEffect(() => {
    const firstQ = (questionsByBlock[currentBlockId] || [])[0];
    setCurrentQuestionId(firstQ ? firstQ.id : "");
  }, [currentBlockId, questionsByBlock]);

  // ----- UI helpers -----
  // inside RuleAdminPanel
  const getOperatorsForType = (type) => {
    const base = [
      { label: "Equals", value: "equals" },
      { label: "Not Equals", value: "not_equals" },
    ];
    if (type === "number") {
      base.push(
        { label: "Greater Than", value: "greater_than" },
        { label: "Less Than", value: "less_than" }
      );
    }
    if (type === "nps") {
      return [
        { label: "Is Promoter (9–10)", value: "nps_is_promoter" },
        { label: "Is Passive (6–8)", value: "nps_is_passive" },
        { label: "Is Detractor (0–5)", value: "nps_is_detractor" },
        { label: "Equals", value: "equals" },
        { label: "Not Equals", value: "not_equals" },
        { label: "≥ (at least)", value: "nps_gte" },
        { label: "≤ (at most)", value: "nps_lte" },
        { label: "Between (inclusive)", value: "nps_between" }, // needs min/max
      ];
    }
    return base;
  };

  const summarizeRule = (rule) => {
    const conds = (rule.conditions || []).map((c, i) => {
      const qTitle =
        questionOptions.find((qq) => qq.id === c.questionId)?.title ||
        c.questionId ||
        "—";
      const chain = i > 0 ? ` ${c.conditionLogic || "AND"} ` : "";

      // NPS friendly text
      if (questionsById[c.questionId]?.type === "nps") {
        if (c.operator === "nps_is_promoter")
          return `${chain}[${qTitle}] is Promoter (9–10)`;
        if (c.operator === "nps_is_passive")
          return `${chain}[${qTitle}] is Passive (7–8)`;
        if (c.operator === "nps_is_detractor")
          return `${chain}[${qTitle}] is Detractor (0–6)`;
        if (c.operator === "nps_between")
          return `${chain}[${qTitle}] between ${c.min}–${c.max}`;
        if (c.operator === "nps_gte") return `${chain}[${qTitle}] ≥ ${c.value}`;
        if (c.operator === "nps_lte") return `${chain}[${qTitle}] ≤ ${c.value}`;
      }
      // default
      return `${chain}[${qTitle}] ${c.operator} "${c.value}"`;
    });

    const acts = (rule.actions || [])
      .map((a) => {
        if (a.type === "goto_block") {
          const bt = blocksById[a.blockId]?.title || a.blockId;
          return `→ Go to block: ${bt}`;
        }
        if (a.type === "goto_block_question") {
          const bt = blocksById[a.targetBlockId]?.title || a.targetBlockId;
          return `→ Go to ${bt} ▶︎ ${a.targetQuestionId || "(first)"}`;
        }
        if (a.type === "goto_question")
          return `→ Go to question: ${a.questionId}`;
        if (a.type === "skip_block") {
          const names = (a.blockIds || []).map(
            (id) => blocksById[id]?.title || id
          );
          return `⤼ Skip blocks: ${names.join(", ") || "—"}`;
        }
        if (a.type === "skip_questions") {
          return `⤼ Skip questions: ${(a.questionIds || []).join(", ") || "—"}`;
        }
        if (a.type === "show_message") return `💬 "${a.message}"`;
        if (a.type === "end") return "■ End survey";
        if (a.type === "raise_ticket") {
          const g = a.groupId ? `, group ${a.groupId}` : "";
          const t = a.tagsCsv ? `, tags [${a.tagsCsv}]` : "";
          return `🎫 Raise ticket (priority ${a.priority || "normal"}${g}${t})`;
        }
        return a.type;
      })
      .join("  •  ");
    return { cond: conds.join(""), act: acts };
  };

  const rulesByBlock = useMemo(() => {
    const m = {};
    blockOrder.forEach((id) => (m[id] = []));
    (rules || []).forEach((r) => {
      if (!m[r.blockId]) m[r.blockId] = [];
      m[r.blockId].push(r);
    });
    // Sort each block's rules by priority
    Object.keys(m).forEach((bid) => {
      m[bid].sort((a, b) => Number(a.priority ?? 1) - Number(b.priority ?? 1));
    });
    return m;
  }, [rules, blockOrder]);

  const orphanRules = useMemo(
    () => (rules || []).filter((r) => !blockOrder.includes(r.blockId)),
    [rules, blockOrder]
  );

  const ruleHasRaise = (r) =>
    Array.isArray(r?.actions) &&
    r.actions.some((a) => a.type === "raise_ticket");

  const openTicketFormFromRule = (rule) => {
    const rt =
      (rule.actions || []).find((a) => a.type === "raise_ticket") || {};

    const subject =
      (rt.subjectTemplate && rt.subjectTemplate.trim()) ||
      `[Survey ${surveyId}] ${
        rule.name || rule.ruleId || "New ticket"
      } — Block ${rule.blockId}`;

    // map CSV tag names -> tagIds that TicketForm expects
    const tagIds = namesToTagIds(csvToArray(rt.tagsCsv), availableTags);

    setTicketInitial({
      subject,
      description: rt.message || "",
      priority: rt.priority || "normal",
      groupId: rt.groupId || "",
      // anything else you want to prefill can be added here:
      // categoryId, productId, etc. if you derive them
      tags: tagIds, // TicketForm reads tagIds from initial.tags
    });
    setTicketOpen(true);
  };

  const openTicketFormForAction = (act, index) => {
    const tagIds = namesToTagIds(csvToArray(act.tagsCsv), availableTags);
    setTicketInitial({
      subject:
        (act.subjectTemplate || "").trim() ||
        `Ticket for rule ${editingRule?.name || editingRule?.ruleId || ""}`,
      description: act.message || "",
      priority: act.priority || "normal",
      groupId: act.groupId || "",
      // carry through anything you want prefilled
      tagIds: act.tagIds || tagIds,
      slaId: act.slaId || "",
      severity: act.severity || "sev4",
    });
    setTicketActIndex(index);
    setTicketOpen(true);
  };
  // ----- Render -----
  return (
    <div className="grid grid-cols-1 xl:grid-cols-[420px_1fr] gap-6">
      <div className="space-y-4">
        <div className="p-4 bg-white rounded-lg border shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-slate-800">Survey Flow</h3>
            <GitBranch className="h-4 w-4 text-slate-500" />
          </div>

          <div className="space-y-1 relative">
            {blockOrder.map((bid, i) => {
              const b = blocksById[bid];
              const expanded = !!expandedBlocks[bid];
              return (
                <div key={bid} className="relative">
                  {i < blockOrder.length - 1 && (
                    <div className="absolute left-4 top-8 bottom-[-8px] w-px bg-slate-200" />
                  )}

                  <div className="flex items-start gap-2">
                    <button
                      className="mt-1 p-1 rounded hover:bg-slate-100"
                      onClick={() => toggleBlockExpanded(bid)}
                      title={expanded ? "Collapse" : "Expand"}
                    >
                      {expanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </button>

                    <div className="flex-1">
                      <div className="flex items-center justify-between bg-orange-50 border border-orange-200 text-orange-900 rounded-md px-3 py-2">
                        <div className="font-medium">
                          {b?.title || bid}{" "}
                          <span className="text-xs text-orange-700 ml-2">
                            (order {b?.order ?? i})
                          </span>
                        </div>
                        <button
                          className="text-xs bg-orange-600 text-white px-2 py-1 rounded hover:bg-orange-700"
                          onClick={() => startCreateRuleForBlock(bid)}
                        >
                          <Plus className="inline h-3 w-3 mr-1" />
                          Add Branch
                        </button>
                      </div>

                      {expanded && (
                        <div className="mt-2 pl-2 space-y-2">
                          {(rulesByBlock[bid] || []).map((rule) => {
                            const sum = summarizeRule(rule);
                            return (
                              <div
                                key={rule.ruleId}
                                className="rounded border bg-white px-3 py-2"
                              >
                                <div className="flex items-center justify-between">
                                  <div>
                                    <div className="font-medium">
                                      {rule.name || "(untitled)"}
                                      {rule.enabled === false && (
                                        <span className="ml-2 text-xs text-red-500">
                                          • disabled
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-xs text-slate-500">
                                      Priority: {rule.priority}
                                    </div>
                                  </div>
                                  <div className="flex gap-2">
                                    {ruleHasRaise(rule) && (
                                      <button
                                        className="px-2 py-1 text-xs bg-emerald-600 text-white rounded"
                                        onClick={() =>
                                          openTicketFormFromRule(rule)
                                        }
                                        title="Raise ticket"
                                      >
                                        🎫 Raise Ticket
                                      </button>
                                    )}
                                    <button
                                      className="px-2 py-1 text-xs bg-blue-500 text-white rounded"
                                      onClick={() => setEditingRule(rule)}
                                    >
                                      Edit
                                    </button>
                                    <button
                                      className="px-2 py-1 text-xs bg-red-500 text-white rounded"
                                      onClick={() => onDeleteRule(rule.ruleId)}
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </button>
                                  </div>
                                </div>
                                <div className="mt-2">
                                  <div className="text-[12px]">
                                    <span className="font-semibold">If:</span>{" "}
                                    {sum.cond || "—"}
                                  </div>
                                  <div className="text-[12px] mt-1">
                                    <span className="font-semibold">Then:</span>{" "}
                                    {sum.act || "—"}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                          {(rulesByBlock[bid] || []).length === 0 && (
                            <div className="text-xs text-slate-500 pl-1">
                              No branches yet for this block.
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {orphanRules.length > 0 && (
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
              <div className="font-medium text-yellow-900 mb-2">
                Unassigned rules (block missing or not set)
              </div>
              <ul className="text-sm list-disc pl-5">
                {orphanRules.map((r) => (
                  <li key={r.ruleId}>
                    {r.name || r.ruleId} —{" "}
                    <button
                      className="underline"
                      onClick={() => setEditingRule(r)}
                    >
                      assign to a block
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="p-4 bg-white rounded-lg border shadow-sm w-full">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-slate-800">Test / Simulate</h3>
            <Play className="h-4 w-4 text-slate-500" />
          </div>

          <div className="mt-3 grid gap-3 w-fit">
            <div className="flex items-center gap-2">
              <div>
                <p className="text-sm text-slate-600">Current block</p>
                <select
                  className="border p-2 rounded text-sm"
                  value={currentBlockId}
                  onChange={(e) => setCurrentBlockId(e.target.value)}
                >
                  {blockOrder.map((bid) => (
                    <option key={bid} value={bid}>
                      {blocksById[bid]?.title || bid}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <p className="text-sm text-slate-600">Current question</p>
                <select
                  className="border p-2 rounded text-sm w-full"
                  value={currentQuestionId}
                  onChange={(e) => setCurrentQuestionId(e.target.value)}
                >
                  {(questionsByBlock[currentBlockId] || []).map((q) => (
                    <option key={q.id} value={q.id}>
                      {q.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <details className="rounded border p-3 text-sm w-full">
              <summary className="cursor-pointer flex items-center gap-2 text-slate-700">
                <Filter className="h-4 w-4" /> Test Answers{" "}
                <span className="text-xs text-slate-500">
                  (values used by conditions)
                </span>
              </summary>

              <div className="mt-3 grid sm:grid-cols-1 gap-3">
                {questionOptions.map((q) => (
                  <label key={q.id} className="flex flex-col text-xs">
                    <span className="text-slate-500 mb-1">
                      {q.title}
                      {q.blockId ? ` · ${blocksById[q.blockId]?.title}` : ""}
                    </span>
                    {q.options?.length ? (
                      <select
                        className="border rounded p-1"
                        value={testAnswers[q.id] || ""}
                        onChange={(e) => updateTestAnswer(q.id, e.target.value)}
                      >
                        <option value="">—</option>
                        {q.options.map((opt, i) => (
                          <option key={i} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type={q.type === "number" ? "number" : "text"}
                        className="border rounded p-1"
                        value={testAnswers[q.id] || ""}
                        onChange={(e) => updateTestAnswer(q.id, e.target.value)}
                      />
                    )}
                  </label>
                ))}
              </div>
            </details>

            <div className="flex gap-2">
              <button
                className="px-3 py-2 bg-indigo-600 text-white rounded text-sm"
                onClick={simulateNextBlock}
              >
                Simulate Next Block
              </button>
              <button
                className="px-3 py-2 bg-slate-700 text-white rounded text-sm"
                onClick={simulateNextTarget}
              >
                Simulate Next Target (Q/Block/End)
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Right pane: editor */}
      <div className="space-y-4">
        {!editingRule ? (
          <div className="p-6 bg-white rounded-lg border shadow-sm text-slate-600">
            <p className="text-sm">
              Select a block on the left and click <b>Add Branch</b> to create
              block logic. Click an existing branch to edit it here.
            </p>
          </div>
        ) : (
          <div className="p-6 bg-white rounded-lg border shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-800">
                {editingRule.ruleId ? "Edit Branch" : "Create Branch"}
              </h3>
              <button
                className="text-slate-500 hover:text-slate-800"
                onClick={() => setEditingRule(null)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="grid gap-3">
              <input
                className="w-full border p-2 rounded"
                placeholder="Branch Name"
                value={editingRule.name}
                onChange={(e) =>
                  setEditingRule({ ...editingRule, name: e.target.value })
                }
              />

              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-500">
                    Applies to Block
                  </label>
                  <select
                    className="w-full border p-2 rounded"
                    value={editingRule.blockId}
                    onChange={(e) => {
                      const newBlockId = e.target.value;
                      setEditingRule((prev) => ({
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
                        {blocksById[bid]?.title || bid}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-500">Priority</label>
                  <input
                    type="number"
                    className="w-full border p-2 rounded"
                    value={editingRule.priority}
                    onWheel={(e) => e.target.blur()}
                    onChange={(e) =>
                      setEditingRule({
                        ...editingRule,
                        priority: Number(e.target.value),
                      })
                    }
                  />
                </div>
              </div>

              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={editingRule.enabled !== false}
                  onChange={(e) =>
                    setEditingRule({
                      ...editingRule,
                      enabled: e.target.checked,
                    })
                  }
                />
                Enabled
              </label>

              {/* Conditions */}
              <div className="space-y-2">
                <h4 className="text-md font-medium">Conditions (If)</h4>
                {editingRule.conditions.map((cond, index) => {
                  const allQs = questionsByBlock[editingRule.blockId] || [];
                  const selectedQ =
                    allQs.find((q) => q.id === cond.questionId) || null;
                  if (selectedQ?.type === "nps") {
                    if (
                      cond.value !== "" &&
                      (cond.value < 0 || cond.value > 10)
                    ) {
                      // clamp
                      const copy = [...editingRule.conditions];
                      copy[index].value = Math.max(
                        0,
                        Math.min(10, Number(cond.value))
                      );
                      setEditingRule({ ...editingRule, conditions: copy });
                    }
                  }
                  return (
                    <div
                      key={index}
                      className="flex flex-wrap gap-2 items-center p-2 rounded border"
                    >
                      <select
                        className="border p-2 rounded"
                        value={cond.questionId}
                        onChange={(e) => {
                          const copy = [...editingRule.conditions];
                          copy[index].questionId = e.target.value;
                          copy[index].value = "";
                          setEditingRule({
                            ...editingRule,
                            conditions: copy,
                          });
                        }}
                      >
                        <option value="">Select Question</option>
                        {allQs.map((q) => (
                          <option key={q.id} value={q.id}>
                            {q.title}
                          </option>
                        ))}
                      </select>

                      {selectedQ && (
                        <>
                          <select
                            className="border p-2 rounded"
                            value={cond.operator}
                            onChange={(e) => {
                              const copy = [...editingRule.conditions];
                              copy[index].operator = e.target.value;
                              setEditingRule({
                                ...editingRule,
                                conditions: copy,
                              });
                            }}
                          >
                            {getOperatorsForType(selectedQ.type).map((op) => (
                              <option key={op.value} value={op.value}>
                                {op.label}
                              </option>
                            ))}
                          </select>

                          {/* NPS special inputs */}
                          {selectedQ?.type === "nps" ? (
                            <>
                              {[
                                "nps_is_promoter",
                                "nps_is_passive",
                                "nps_is_detractor",
                              ].includes(cond.operator) ? (
                                // no value needed
                                <span className="text-xs text-slate-500 px-2 py-1 rounded bg-slate-50 border">
                                  No value required
                                </span>
                              ) : cond.operator === "nps_between" ? (
                                <div className="flex items-center gap-2">
                                  <input
                                    type="number"
                                    min={0}
                                    max={10}
                                    className="border rounded p-1 w-20"
                                    placeholder="Min"
                                    value={cond.min ?? ""}
                                    onWheel={(e) => e.target.blur()}
                                    onChange={(e) => {
                                      const copy = [...editingRule.conditions];
                                      copy[index].min =
                                        e.target.value === ""
                                          ? ""
                                          : Number(e.target.value);
                                      setEditingRule({
                                        ...editingRule,
                                        conditions: copy,
                                      });
                                    }}
                                  />
                                  <span className="text-slate-500">to</span>
                                  <input
                                    type="number"
                                    min={0}
                                    max={10}
                                    className="border rounded p-1 w-20"
                                    placeholder="Max"
                                    value={cond.max ?? ""}
                                    onWheel={(e) => e.target.blur()}
                                    onChange={(e) => {
                                      const copy = [...editingRule.conditions];
                                      copy[index].max =
                                        e.target.value === ""
                                          ? ""
                                          : Number(e.target.value);
                                      setEditingRule({
                                        ...editingRule,
                                        conditions: copy,
                                      });
                                    }}
                                  />
                                </div>
                              ) : (
                                <input
                                  type="number"
                                  min={0}
                                  max={10}
                                  className="border rounded p-1 w-20"
                                  placeholder="0–10"
                                  value={cond.value}
                                  onWheel={(e) => e.target.blur()}
                                  onChange={(e) => {
                                    const val =
                                      e.target.value === ""
                                        ? ""
                                        : Number(e.target.value);
                                    const copy = [...editingRule.conditions];
                                    copy[index].value = val;
                                    setEditingRule({
                                      ...editingRule,
                                      conditions: copy,
                                    });
                                  }}
                                />
                              )}
                            </>
                          ) : selectedQ.options?.length ? (
                            // (keep your existing select for options questions)
                            <select
                              className="border p-2 rounded"
                              value={cond.value}
                              onChange={(e) => {
                                const copy = [...editingRule.conditions];
                                copy[index].value = e.target.value;
                                setEditingRule({
                                  ...editingRule,
                                  conditions: copy,
                                });
                              }}
                            >
                              <option value="">Select Answer</option>
                              {selectedQ.options.map((opt, i) => (
                                <option key={i} value={opt}>
                                  {opt}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input
                              type={
                                selectedQ.type === "number" ? "number" : "text"
                              }
                              className="border rounded p-1"
                              value={cond.value}
                              onChange={(e) => {
                                const copy = [...editingRule.conditions];
                                copy[index].value = e.target.value;
                                setEditingRule({
                                  ...editingRule,
                                  conditions: copy,
                                });
                              }}
                            />
                          )}
                        </>
                      )}

                      {index > 0 && (
                        <select
                          className="border p-2 rounded"
                          value={cond.conditionLogic || "AND"}
                          onChange={(e) => {
                            const copy = [...editingRule.conditions];
                            copy[index].conditionLogic = e.target.value;
                            setEditingRule({
                              ...editingRule,
                              conditions: copy,
                            });
                          }}
                        >
                          <option value="AND">AND</option>
                          <option value="OR">OR</option>
                        </select>
                      )}

                      <button
                        className="px-2 py-1 text-xs bg-blue-500 text-white rounded ml-2"
                        onClick={() =>
                          setEditingRule((r) => ({
                            ...r,
                            conditions: [
                              ...r.conditions,
                              { ...emptyCondition },
                            ],
                          }))
                        }
                      >
                        Add Condition
                      </button>

                      {editingRule.conditions.length > 1 && (
                        <button
                          className="px-2 py-1 text-xs bg-slate-200 rounded"
                          onClick={() =>
                            setEditingRule((r) => ({
                              ...r,
                              conditions: r.conditions.filter(
                                (_, i) => i !== index
                              ),
                            }))
                          }
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Actions */}
              <div className="space-y-2">
                <h4 className="text-md font-medium">Actions (Then)</h4>
                {editingRule.actions.map((act, index) => (
                  <div
                    key={index}
                    className="flex flex-wrap gap-2 items-center p-2 rounded border"
                  >
                    <select
                      className="border p-2 rounded"
                      value={act.type}
                      onChange={(e) => {
                        const copy = [...editingRule.actions];
                        copy[index] = { ...emptyAction, type: e.target.value };
                        setEditingRule({ ...editingRule, actions: copy });
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
                        className="border p-2 rounded"
                        value={act.blockId || ""}
                        onChange={(e) => {
                          const copy = [...editingRule.actions];
                          copy[index].blockId = e.target.value;
                          setEditingRule({ ...editingRule, actions: copy });
                        }}
                      >
                        <option value="">Select Block</option>
                        {blockOrder.map((bid) => (
                          <option key={bid} value={bid}>
                            {blocksById[bid]?.title || bid}
                          </option>
                        ))}
                      </select>
                    )}

                    {act.type === "goto_block_question" && (
                      <>
                        <select
                          className="border p-2 rounded"
                          value={act.targetBlockId || ""}
                          onChange={(e) => {
                            const copy = [...editingRule.actions];
                            copy[index].targetBlockId = e.target.value;
                            copy[index].targetQuestionId = "";
                            setEditingRule({ ...editingRule, actions: copy });
                          }}
                        >
                          <option value="">Select Block</option>
                          {blockOrder.map((bid) => (
                            <option key={bid} value={bid}>
                              {blocksById[bid]?.title || bid}
                            </option>
                          ))}
                        </select>

                        <select
                          className="border p-2 rounded"
                          value={act.targetQuestionId || ""}
                          onChange={(e) => {
                            const copy = [...editingRule.actions];
                            copy[index].targetQuestionId = e.target.value;
                            setEditingRule({ ...editingRule, actions: copy });
                          }}
                          disabled={!act.targetBlockId}
                        >
                          <option value="">Select Question</option>
                          {(questionsByBlock[act.targetBlockId] || []).map(
                            (q) => (
                              <option key={q.id} value={q.id}>
                                {q.title}
                              </option>
                            )
                          )}
                        </select>
                      </>
                    )}

                    {act.type === "goto_question" && (
                      <select
                        className="border p-2 rounded"
                        value={act.questionId || ""}
                        onChange={(e) => {
                          const copy = [...editingRule.actions];
                          copy[index].questionId = e.target.value;
                          setEditingRule({ ...editingRule, actions: copy });
                        }}
                      >
                        <option value="">Select Question</option>
                        {(questionsByBlock[editingRule.blockId] || []).map(
                          (q) => (
                            <option key={q.id} value={q.id}>
                              {q.title}
                            </option>
                          )
                        )}
                      </select>
                    )}

                    {act.type === "skip_block" && (
                      <select
                        multiple
                        className="border p-2 rounded"
                        value={Array.isArray(act.blockIds) ? act.blockIds : []}
                        onChange={(e) => {
                          const selected = Array.from(
                            e.target.selectedOptions
                          ).map((opt) => opt.value);
                          const copy = [...editingRule.actions];
                          copy[index].blockIds = selected;
                          setEditingRule({ ...editingRule, actions: copy });
                        }}
                      >
                        {blockOrder.map((bid) => (
                          <option key={bid} value={bid}>
                            {blocksById[bid]?.title || bid}
                          </option>
                        ))}
                      </select>
                    )}

                    {act.type === "skip_questions" && (
                      <select
                        multiple
                        className="border p-2 rounded"
                        value={
                          Array.isArray(act.questionIds) ? act.questionIds : []
                        }
                        onChange={(e) => {
                          const selected = Array.from(
                            e.target.selectedOptions
                          ).map((opt) => opt.value);
                          const copy = [...editingRule.actions];
                          copy[index].questionIds = selected;
                          setEditingRule({ ...editingRule, actions: copy });
                        }}
                      >
                        {(questionsByBlock[editingRule.blockId] || []).map(
                          (q) => (
                            <option key={q.id} value={q.id}>
                              {q.title}
                            </option>
                          )
                        )}
                      </select>
                    )}

                    {act.type === "show_message" && (
                      <input
                        className="border p-2 rounded"
                        placeholder="Message to display"
                        value={act.message || ""}
                        onChange={(e) => {
                          const copy = [...editingRule.actions];
                          copy[index].message = e.target.value;
                          setEditingRule({ ...editingRule, actions: copy });
                        }}
                      />
                    )}

                    {act.type === "raise_ticket" && (
                      <>
                        <button
                          type="button"
                          className="px-2 py-1 text-xs bg-emerald-600 text-white rounded"
                          onClick={() => openTicketFormForAction(act, index)}
                        >
                          Configure Ticket
                        </button>
                      </>
                    )}

                    <button
                      className="px-2 py-1 text-xs bg-slate-200 rounded"
                      onClick={() =>
                        setEditingRule((r) => ({
                          ...r,
                          actions: r.actions.filter((_, i) => i !== index),
                        }))
                      }
                    >
                      Remove
                    </button>
                  </div>
                ))}

                <button
                  className="px-3 py-1 bg-blue-500 text-white rounded"
                  onClick={() =>
                    setEditingRule((r) => ({
                      ...r,
                      actions: [...r.actions, { ...emptyAction }],
                    }))
                  }
                >
                  Add Action
                </button>
              </div>

              {/* single, global modal */}
              <RaiseTicketForm
                open={ticketOpen}
                onClose={() => setTicketOpen(false)}
                onSaveTemplate={(template) => {
                  if (ticketActIndex == null) return;

                  setEditingRule((prev) => {
                    if (!prev) return prev;
                    const actions = [...(prev.actions || [])];

                    // Ensure the action object exists and is of type raise_ticket
                    const current = {
                      ...(actions[ticketActIndex] || { type: "raise_ticket" }),
                    };

                    // Store template inside ticketData array (as you requested)
                    const ticketData = Array.isArray(current.ticketData)
                      ? [...current.ticketData]
                      : [];
                    ticketData[0] = template; // store a single template; or push if you want multiple
                    current.ticketData = ticketData;

                    // Also mirror a few top-level action fields for quick reads (optional)
                    current.subjectTemplate = template.subjectTemplate;
                    current.priority = template.priority;
                    current.groupId = template.groupId;
                    current.message = template.message;
                    current.slaId = template.slaId;

                    actions[ticketActIndex] = current;

                    return { ...prev, actions };
                  });

                  setTicketOpen(false);
                  setTicketActIndex(null);
                }}
                initial={ticketInitial || {}}
                title="New Ticket"
                orgId={orgId}
                requestorId={currentUserId}
                currentUserId={currentUserId}
              />

              <div className="flex gap-2 pt-2">
                <button
                  className="bg-green-600 text-white px-4 py-2 rounded"
                  onClick={onSaveRule}
                  disabled={loading}
                >
                  {editingRule.ruleId ? "Update Branch" : "Save Branch"}
                </button>
                <button
                  className="px-4 py-2 rounded border"
                  onClick={() => setEditingRule(null)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
