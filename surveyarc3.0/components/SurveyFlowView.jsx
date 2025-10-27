"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  MarkerType,
} from "reactflow";
import "reactflow/dist/style.css";
import { useParams } from "next/navigation";
import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  GitBranch,
  Play,
  Filter,
  X,
  Save,
  Sparkles,
} from "lucide-react";

import { useRule } from "@/providers/rulePProvider";
import { useTags } from "@/providers/postGresPorviders/TagProvider";
import { useUser } from "@/providers/postGresPorviders/UserProvider";
import RaiseTicketForm from "@/components/tickets/RaiseTicketForm";

/* =============================================
   LAYOUT CONSTANTS
============================================= */
const X_GAP = 320;
const Q_WIDTH = 240;
const BLOCK_HEADER_H = 20;
const BLOCK_PADDING = 16;
const BLOCK_BORDER_RADIUS = 14;
const BLOCK_LABEL_OFFSET = 12;
const RULE_Y_START = 250;
const PRIMARY_ROW_Y_GAP = 80;
const NODE_W = Q_WIDTH + 50;
const SIBLING_GAP = 24;
const MSG_W = 220;
const MSG_H = 56;
const MSG_X_OFFSET = 130;
const MSG_Y_STEP = 8;

/* =============================================
   RULE EDITOR HELPERS
============================================= */
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
  priority: "normal",
  groupId: "",
  tagsCsv: "",
  slaId: "",
  ticketData: [],
};

function makeEmptyRule(surveyId, blockId, primaryQuestionId) {
  return {
    name: "",
    surveyId,
    blockId,
    enabled: true,
    priority: 1,
    conditions: [{ ...emptyCondition, questionId: primaryQuestionId || "" }],
    actions: [{ ...emptyAction }],
  };
}

const csvToArray = (s) =>
  (s || "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

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

/* =============================================
   MERGED SCREEN
============================================= */
export default function SurveyFlowView({
  surveyId: surveyIdProp,
  blocks = [],
  questions = [],
}) {
  const params = useParams();
  const surveyId = surveyIdProp || params?.slug;

  const { rules, getAllRules, saveRule, updateRule, deleteRule } = useRule();
  const { list: listTags, getCachedTags } = useTags();
  const { uid: currentUserId } = useUser() || {};

  const [editingRule, setEditingRule] = useState(null);
  const [loadingRules, setLoadingRules] = useState(true);
  const [saving, setSaving] = useState(false);

  const orgId = params?.organizations;
  const availableTags = getCachedTags(orgId);

  const [ticketOpen, setTicketOpen] = useState(false);
  const [ticketInitial, setTicketInitial] = useState(null);
  const [ticketActIndex, setTicketActIndex] = useState(null);

  const [testAnswers, setTestAnswers] = useState({});

  const fetchedSurveys = useRef(new Set());
  const fetchInFlight = useRef(false);

  useEffect(() => {
    if (orgId) listTags({ orgId }).catch(() => {});
  }, [orgId, listTags]);

  useEffect(() => {
    let active = true;
    async function run() {
      try {
        const shouldFetch =
          !fetchedSurveys.current.has(surveyId) && !fetchInFlight.current;
        if (shouldFetch && surveyId) {
          fetchInFlight.current = true;
          await getAllRules(surveyId);
          fetchedSurveys.current.add(surveyId);
        }
      } finally {
        if (active) setLoadingRules(false);
        fetchInFlight.current = false;
      }
    }
    if (surveyId) run();
    else setLoadingRules(false);
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [surveyId]);

  const questionsById = useMemo(() => {
    const map = new Map();
    questions.forEach((q) => map.set(q.questionId, q));
    return map;
  }, [questions]);

  const blocksResolved = useMemo(() => {
    const list = [];
    const seen = new Set();
    for (const b of blocks || []) {
      const order = Array.isArray(b.questionOrder) ? b.questionOrder : [];
      const qs = order.map((id) => questionsById.get(id)).filter(Boolean);
      qs.forEach((q) => seen.add(q.questionId));
      list.push({ ...b, _questions: qs });
    }
    const stray = questions.filter((q) => !seen.has(q.questionId));
    if (stray.length)
      list.push({
        blockId: "__unassigned__",
        name: "Unassigned",
        _questions: stray,
      });
    return list;
  }, [blocks, questions, questionsById]);

  const blockEntryMap = useMemo(() => {
    const m = new Map();
    for (const b of blocksResolved) {
      const first = b._questions?.[0]?.questionId;
      if (first) m.set(b.blockId, first);
    }
    return m;
  }, [blocksResolved]);

  const qToBlockId = useMemo(() => {
    const m = new Map();
    blocksResolved.forEach((b) =>
      b._questions.forEach((q) => m.set(q.questionId, b.blockId))
    );
    return m;
  }, [blocksResolved]);

  const globalQ = useMemo(() => {
    const arr = [];
    blocksResolved.forEach((b) => b._questions.forEach((q) => arr.push(q)));
    return arr;
  }, [blocksResolved]);

  const qIndexMap = useMemo(() => {
    const m = {};
    globalQ.forEach((q, i) => (m[q.questionId] = i));
    return m;
  }, [globalQ]);

  const blockLayouts = useMemo(() => {
    let cursorX = 0;
    const out = [];
    for (const b of blocksResolved) {
      const count = b._questions.length || 1;
      const width =
        Math.max(1, count) * X_GAP - (X_GAP - Q_WIDTH) + BLOCK_PADDING * 2;
      const height = BLOCK_HEADER_H + 80 + BLOCK_PADDING * 2;
      out.push({
        blockId: b.blockId,
        name: b.name || "Block",
        x: cursorX,
        y: 0,
        width,
        height,
      });
      cursorX += width + 40;
    }
    return out;
  }, [blocksResolved]);

  const layoutByBlock = useMemo(() => {
    const m = new Map();
    blockLayouts.forEach((l) => m.set(l.blockId, l));
    return m;
  }, [blockLayouts]);

  const canvasRightX = useMemo(() => {
    let right = 0;
    for (const l of blockLayouts) right = Math.max(right, l.x + l.width);
    return right;
  }, [blockLayouts]);

  const blockNodes = useMemo(
    () =>
      blockLayouts.map((l) => ({
        id: `block-${l.blockId}`,
        type: "group",
        position: { x: l.x, y: l.y },
        data: { label: l.name },
        style: {
          background: "transparent",
          border:
            l.blockId === "__unassigned__"
              ? "2px dashed #EF4444"
              : "2px solid #3b3b45",
          borderRadius: BLOCK_BORDER_RADIUS,
          width: l.width,
          height: l.height,
          overflow: "visible",
        },
      })),
    [blockLayouts]
  );

  const blockLabelNodes = useMemo(
    () =>
      blockLayouts.map((l) => ({
        id: `block-label-${l.blockId}`,
        position: { x: 12, y: -BLOCK_LABEL_OFFSET - 18 },
        data: { label: l.name },
        parentNode: `block-${l.blockId}`,
        draggable: false,
        selectable: false,
        style: {
          width: "max-content",
          padding: "4px 12px",
          border:
            l.blockId === "__unassigned__"
              ? "1px dashed #EF4444"
              : "1px solid #3b3b45",
          borderRadius: 999,
          background: "#000",
          color: l.blockId === "__unassigned__" ? "#FCA5A5" : "#E5E7EB",
          fontSize: 12,
          fontWeight: 600,
          lineHeight: 1.2,
          pointerEvents: "none",
          boxShadow: "0 2px 4px rgba(0,0,0,.6)",
        },
      })),
    [blockLayouts]
  );

  const questionNodes = useMemo(() => {
    const nodes = [];
    blocksResolved.forEach((b) => {
      const lay = layoutByBlock.get(b.blockId);
      if (!lay) return;
      b._questions.forEach((q, i) => {
        nodes.push({
          id: q.questionId,
          data: { label: `[Q.Id - ${q.questionId}] : ${q.label}` },
          parentNode: `block-${b.blockId}`,
          extent: "parent",
          position: {
            x: BLOCK_PADDING + i * X_GAP,
            y: BLOCK_PADDING + BLOCK_HEADER_H,
          },
          style: {
            borderRadius: 12,
            padding: 14,
            background: "linear-gradient(180deg,#1a1a1f,#131316)",
            color: "#E6E6F0",
            border: "1px solid #3b3b45",
            width: Q_WIDTH,
            textAlign: "center",
            boxShadow: "0 8px 20px rgba(0,0,0,.3)",
            transition: "all 0.2s ease",
          },
        });
      });
    });
    return nodes;
  }, [blocksResolved, layoutByBlock]);

  const ruleGroups = useMemo(() => {
    const g = {};
    (rules || []).forEach((r) => {
      const primary =
        (r.conditions || []).find((c) => !!c.questionId)?.questionId ||
        "__ungrouped__";
      if (!g[primary]) g[primary] = [];
      g[primary].push(r);
    });
    return g;
  }, [rules]);

  const { logicNodes, messageNodes } = useMemo(() => {
    const logic = [];
    const msgs = [];

    const orderPrimaries = [
      ...globalQ.map((q) => q.questionId).filter((qid) => ruleGroups[qid]),
      ...Object.keys(ruleGroups).filter(
        (k) => k !== "__ungrouped__" && !globalQ.some((q) => q.questionId === k)
      ),
      ...("__ungrouped__" in ruleGroups ? ["__ungrouped__"] : []),
    ];
    const rowMap = new Map(orderPrimaries.map((id, row) => [id, row]));

    Object.entries(ruleGroups).forEach(([primaryQ, list]) => {
      const colIdx = qIndexMap[primaryQ] != null ? qIndexMap[primaryQ] : 0;
      const baseCenterX = colIdx * X_GAP + Q_WIDTH / 2 - NODE_W / 2;
      const row = rowMap.get(primaryQ) ?? 0;
      const baseY = RULE_Y_START + row * PRIMARY_ROW_Y_GAP;

      const totalWidth = list.length * NODE_W + (list.length - 1) * SIBLING_GAP;
      const startX = baseCenterX - (totalWidth - NODE_W) / 2;

      list.forEach((rule, i) => {
        const x = startX + i * (NODE_W + SIBLING_GAP);
        const y = baseY;
        const condText = (rule.conditions || [])
          .map(
            (c) =>
              `${c.questionId || "?"} ${c.operator || "?"} ${valuePreview(
                c.value
              )}`
          )
          .join("\nAND ");
        const actText = (rule.actions || [])
          .map((a) => actionPreview(a))
          .join("\n");

        const logicId = `logic-${rule.ruleId}`;
        logic.push({
          id: logicId,
          data: {
            label: `${rule.name || "Rule"}\nIF ${condText}\nTHEN ${actText}`,
          },
          position: { x, y },
          style: {
            width: NODE_W,
            borderRadius: 12,
            padding: 10,
            background: "linear-gradient(135deg, #374151 0%, #2d3748 100%)",
            color: "#F9FAFB",
            border: "1px solid #4B5563",
            whiteSpace: "pre-line",
            fontSize: 11,
            lineHeight: 1.3,
            textAlign: "center",
            boxShadow: "0 6px 16px rgba(0,0,0,.3)",
            transition: "all 0.2s ease",
          },
        });

        let msgCount = 0;
        (rule.actions || []).forEach((a, ai) => {
          if (a?.type === "show_message") {
            const isRightHalf = i >= Math.floor(list.length / 2);
            const msgX = isRightHalf
              ? x + NODE_W + MSG_X_OFFSET
              : x - (MSG_X_OFFSET + MSG_W + 20);
            const msgY = y + msgCount * (MSG_H + MSG_Y_STEP);
            msgs.push({
              id: `msg-${rule.ruleId}-${ai}`,
              data: { label: `🛈 ${a.message || "(message)"}` },
              position: { x: msgX, y: msgY },
              style: messageNodeStyle(),
            });
            msgCount += 1;
          }
        });
      });
    });

    return { logicNodes: logic, messageNodes: msgs };
  }, [ruleGroups, qIndexMap, globalQ]);

  const endNode = useMemo(
    () => ({
      id: "end-node",
      data: { label: "END" },
      position: { x: canvasRightX + 120, y: RULE_Y_START - 80 },
      style: {
        padding: 10,
        border: "2px solid #EF4444",
        color: "#EF4444",
        background: "rgba(239, 68, 68, 0.1)",
        borderRadius: 999,
        width: 80,
        textAlign: "center",
        fontWeight: 700,
        fontSize: 13,
      },
    }),
    [canvasRightX]
  );

  const edges = useMemo(() => {
    const arr = [];

    (rules || []).forEach((rule) => {
      const logicId = `logic-${rule.ruleId}`;
      (rule.conditions || []).forEach((c, idx) => {
        if (!c.questionId) return;
        arr.push({
          id: `cond-${c.questionId}-${logicId}-${idx}`,
          source: c.questionId,
          target: logicId,
          type: "smoothstep",
          animated: true,
          style: { stroke: "#4F46E5", strokeWidth: 2.5 },
          markerEnd: { type: MarkerType.ArrowClosed, color: "#4F46E5" },
          label: conditionLabel(c),
          labelStyle: { fontSize: 11, fill: "#E5E7EB", fontWeight: 500 },
          labelBgPadding: [6, 4],
          labelBgBorderRadius: 8,
          labelBgStyle: { fill: "rgba(31,41,55,.95)", stroke: "#4F46E5" },
        });
      });

      (rule.actions || []).forEach((a, idx) => {
        // show_message -> message node (existing behavior)
        if (a?.type === "show_message") {
          const msgId = `msg-${rule.ruleId}-${idx}`;
          arr.push({
            id: `act-${logicId}-${msgId}-${idx}`,
            source: logicId,
            target: msgId,
            type: "smoothstep",
            animated: true,
            style: { stroke: "#22c55e", strokeWidth: 2.5 },
            markerEnd: { type: MarkerType.ArrowClosed, color: "#22c55e" },
            label: "Show Message",
            labelStyle: { fontSize: 11, fill: "#E5E7EB", fontWeight: 500 },
            labelBgPadding: [6, 4],
            labelBgBorderRadius: 8,
            labelBgStyle: { fill: "rgba(6,78,59,.95)", stroke: "#22c55e" },
          });
          return;
        }

        // explicit end / skip_end handling (existing behavior)
        if (a?.type === "end" || a?.type === "skip_end") {
          arr.push({
            id: `act-${logicId}-end-node-${idx}`,
            source: logicId,
            target: "end-node",
            type: "smoothstep",
            animated: true,
            style: { stroke: "#10B981", strokeWidth: 3 },
            markerEnd: { type: MarkerType.ArrowClosed, color: "#10B981" },
            label: "End Survey",
            labelStyle: { fontSize: 11, fill: "#E5E7EB", fontWeight: 500 },
            labelBgPadding: [6, 4],
            labelBgBorderRadius: 8,
            labelBgStyle: { fill: "rgba(6,78,59,.95)", stroke: "#10B981" },
          });
          return;
        }

        // resolve primary and resolution helper (same usage as before)
        const primaryQ =
          (rule.conditions || []).find((c) => !!c.questionId)?.questionId ||
          null;
        const res = resolveActionOrSkipTargetId({
          action: a,
          primaryQuestionId: primaryQ,
          blockEntryMap,
          qToBlockId,
          globalQ,
          blocks: blocksResolved,
        });

        // If action explicitly contains multiple questionIds (skip_questions), use them
        const explicitQuestionIds =
          Array.isArray(a.questionIds) && a.questionIds.length
            ? a.questionIds
            : null;

        // Build a list of target ids to create edges for.
        // Preference: explicit questionIds -> res.targetId (single) -> nothing
        const targetIds =
          explicitQuestionIds ?? (res?.targetId ? [res.targetId] : []);

        if (targetIds.length) {
          const isSkip = String(a.type || "").startsWith("skip");
          const isGoto = String(a.type || "").startsWith("goto");
          const stroke = isGoto ? "#10B981" : isSkip ? "#F59E0B" : "#EF4444";
          const dash = isSkip ? "6 3" : undefined;

          targetIds.forEach((targetId, tIdx) => {
            // ensure id is string and matches node ids (questions use questionId)
            const resolvedTargetId = String(targetId);

            arr.push({
              id: `act-${logicId}-${resolvedTargetId}-${idx}-${tIdx}`,
              source: logicId,
              target: resolvedTargetId,
              type: "smoothstep",
              animated: true,
              style: {
                stroke,
                strokeWidth: isSkip ? 3 : 3,
                strokeDasharray: dash,
              },
              markerEnd: { type: MarkerType.ArrowClosed, color: stroke },
              label: isSkip
                ? "Skip Question"
                : isGoto
                ? a.type === "goto_question"
                  ? "Go to Question"
                  : "Go"
                : actionEdgeLabel(
                    a,
                    resolvedTargetId,
                    blocksResolved,
                    res?.meta
                  ),
              labelStyle: { fontSize: 11, fill: "#E5E7EB", fontWeight: 500 },
              labelBgPadding: [6, 4],
              labelBgBorderRadius: 8,
              labelBgStyle: {
                fill: isGoto
                  ? "rgba(6,78,59,.95)"
                  : isSkip
                  ? "rgba(120,53,15,.95)"
                  : "rgba(127,29,29,.95)",
                stroke,
              },
            });
          });

          return;
        }

        // fallback single-target handling (keeps your original behavior with res.targetId)
        if (res?.targetId) {
          const isGoto = String(a.type || "").startsWith("goto");
          const isSkip = String(a.type || "").startsWith("skip");
          const stroke = isGoto ? "#10B981" : isSkip ? "#F59E0B" : "#EF4444";
          arr.push({
            id: `act-${logicId}-${res.targetId}-${idx}`,
            source: logicId,
            target: res.targetId,
            type: "smoothstep",
            animated: true,
            style: {
              stroke,
              strokeWidth: isSkip ? 3 : 3,
              strokeDasharray: isSkip ? "6 3" : undefined,
            },
            markerEnd: { type: MarkerType.ArrowClosed, color: stroke },
            label: actionEdgeLabel(a, res.targetId, blocksResolved, res.meta),
            labelStyle: { fontSize: 11, fill: "#E5E7EB", fontWeight: 500 },
            labelBgPadding: [6, 4],
            labelBgBorderRadius: 8,
            labelBgStyle: {
              fill: isGoto
                ? "rgba(6,78,59,.95)"
                : isSkip
                ? "rgba(120,53,15,.95)"
                : "rgba(127,29,29,.95)",
              stroke,
            },
          });
        }
      });
    });

    return arr;
  }, [rules, blocksResolved, blockEntryMap, qToBlockId, globalQ]);

  const onNodeClick = (_, node) => {
    if (!node?.id) return;

    if (node.id.startsWith("logic-")) {
      const ruleId = node.id.replace("logic-", "");
      const r = (rules || []).find((rr) => rr.ruleId === ruleId);
      if (r) setEditingRule(structuredClone(r));
      return;
    }

    const q = questionsById.get(node.id);
    if (q) {
      const bId = qToBlockId.get(q.questionId);
      setEditingRule(makeEmptyRule(surveyId, bId, q.questionId));
    }
  };

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

  async function saveEditingRule() {
    if (!editingRule) return;
    if (!editingRule.blockId) {
      alert("Please select a Block for this branch.");
      return;
    }
    setSaving(true);
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
        payload.ruleId = `rule_${Math.random().toString(36).slice(2, 10)}`;
        await saveRule(orgId, surveyId, payload);
      }
      await getAllRules(surveyId);
      setEditingRule(null);
    } catch (e) {
      console.error(e);
      alert("Save failed. Check console.");
    } finally {
      setSaving(false);
    }
  }

  async function onDeleteRule(ruleId) {
    await deleteRule(surveyId, ruleId);
    await getAllRules(surveyId);
    setEditingRule(null);
  }

  function openTicketFormForAction(act, index) {
    const tagIds = namesToTagIds(csvToArray(act.tagsCsv), availableTags);
    setTicketInitial({
      subject:
        (act.subjectTemplate || "").trim() ||
        `Ticket for rule ${editingRule?.name || editingRule?.ruleId || ""}`,
      description: act.message || "",
      priority: act.priority || "normal",
      groupId: act.groupId || "",
      tagIds: act.tagIds || tagIds,
      slaId: act.slaId || "",
      severity: act.severity || "sev4",
    });
    setTicketActIndex(index);
    setTicketOpen(true);
  }

  if (loadingRules)
    return (
      <div className="flex items-center justify-center h-[88vh] text-gray-400">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mx-auto mb-4"></div>
          <p className="text-sm">Loading flow...</p>
        </div>
      </div>
    );

  return (
    <div className="grid grid-cols-1 2xl:grid-cols-[1fr_320px] gap-5 w-full h-[88vh]">
      <div className="w-full h-full dark:bg-[#0D0D0F] p-4 rounded-xl border-2 border-neutral-800 shadow-2xl overflow-hidden">
        <header className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold flex items-center gap-2.5">
            <div className="p-2 bg-indigo-600 rounded-lg">
              <GitBranch className="w-4 h-4" />
            </div>
            Survey Flow
          </h2>
          <Legend />
        </header>

        <ReactFlow
          nodes={[
            ...blockNodes,
            ...blockLabelNodes,
            ...questionNodes,
            ...logicNodes,
            ...messageNodes,
            endNode,
          ]}
          edges={edges}
          fitView
          fitViewOptions={{ padding: 0.2, minZoom: 1, maxZoom: 1.75 }}
          panOnScroll
          zoomOnScroll
          nodesDraggable
          nodesConnectable={false}
          onNodeClick={onNodeClick}
          attributionPosition="bottom-left"
        >
          <MiniMap
            nodeColor={(n) =>
              n.id === "end-node"
                ? "#991B1B"
                : n.id.startsWith("msg-")
                ? "#0f766e"
                : n.id.startsWith("block-__unassigned__")
                ? "#7F1D1D"
                : n.id.startsWith("block-")
                ? "#1f2937"
                : n.id.startsWith("logic-")
                ? "#374151"
                : "#6366F1"
            }
            maskColor="rgba(17,24,39,0.7)"
            style={{ bottom: "20px" }}
          />
          <Controls showInteractive={false} style={{ bottom: "40px" }} />
          <Background color="#2B2B31" gap={16} />
        </ReactFlow>
      </div>

      <div className="p-6 bg-white rounded-xl border-2 border-gray-200 shadow-lg space-y-5 overflow-y-auto">
        {!editingRule ? (
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-4 bg-indigo-50 border border-indigo-200 rounded-xl">
              <Sparkles className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-indigo-900">
                <p className="font-medium mb-1">Quick Start Guide</p>
                <p className="text-indigo-700">
                  Click a <span className="font-semibold">question node</span>{" "}
                  to create a new branch. Click a{" "}
                  <span className="font-semibold">logic node</span> to edit
                  existing rules.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <RuleEditor
            rule={editingRule}
            setRule={setEditingRule}
            onSave={saveEditingRule}
            onDelete={() => onDeleteRule(editingRule.ruleId)}
            saving={saving}
            blocksResolved={blocksResolved}
            questionsById={questionsById}
            availableTags={availableTags}
            openTicketFormForAction={openTicketFormForAction}
            ticketOpen={ticketOpen}
            setTicketOpen={setTicketOpen}
            ticketInitial={ticketInitial}
            setTicketInitial={setTicketInitial}
            ticketActIndex={ticketActIndex}
            setTicketActIndex={setTicketActIndex}
            orgId={orgId}
            currentUserId={currentUserId}
          />
        )}
      </div>
    </div>
  );
}

/* =============================================
   RULE EDITOR (right pane)
============================================= */
function RuleEditor({
  rule,
  setRule,
  onSave,
  onDelete,
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

  const getOperatorsForType = (type) => {
    const base = [
      { label: "Equals", value: "equals" },
      { label: "Not Equals", value: "not_equals" },
    ];
    if (type === "number")
      base.push(
        { label: "Greater Than", value: "greater_than" },
        { label: "Less Than", value: "less_than" }
      );
    if (type === "nps") {
      return [
        { label: "Is Promoter (9–10)", value: "nps_is_promoter" },
        { label: "Is Passive (6–8)", value: "nps_is_passive" },
        { label: "Is Detractor (0–5)", value: "nps_is_detractor" },
        { label: "Equals", value: "equals" },
        { label: "Not Equals", value: "not_equals" },
        { label: "≥ (at least)", value: "nps_gte" },
        { label: "≤ (at most)", value: "nps_lte" },
        { label: "Between (inclusive)", value: "nps_between" },
      ];
    }
    return base;
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

        {/* Conditions */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <h4 className="text-base font-bold text-slate-900">Conditions</h4>
            <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded-full font-medium">
              IF
            </span>
          </div>

          {rule.conditions.map((cond, index) => {
            const allQs = questionsByBlock[rule.blockId] || [];
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

                      {/* derive options robustly from multiple possible fields */}
                      {(() => {
                        // possible places where options might live
                        const rawOpts =
                          selectedQ.options ??
                          selectedQ.config?.options ??
                          selectedQ.choices ??
                          selectedQ.answers ??
                          [];

                        const opts = Array.isArray(rawOpts) ? rawOpts : [];

                        // helper to normalize option into { value, label }
                        const normalize = (opt) => {
                          if (opt == null) return { value: "", label: "" };
                          if (
                            typeof opt === "string" ||
                            typeof opt === "number"
                          ) {
                            return { value: String(opt), label: String(opt) };
                          }
                          // object case
                          return {
                            value: String(
                              opt.value ?? opt.id ?? opt.key ?? opt.option ?? ""
                            ),
                            label: String(
                              opt.label ??
                                opt.text ??
                                opt.name ??
                                opt.value ??
                                ""
                            ),
                          };
                        };

                        // NPS special numeric input
                        if (selectedQ?.type === "nps") {
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

                        // if opts exist, render select
                        if (opts.length > 0) {
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
                              {opts.map((o, i) => {
                                const { value, label } = normalize(o);
                                return (
                                  <option key={i} value={value}>
                                    {label}
                                  </option>
                                );
                              })}
                            </select>
                          );
                        }

                        // fallback to a free-text / number input
                        return (
                          <input
                            type={
                              selectedQ?.type === "number" ? "number" : "text"
                            }
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
                    ).map((q) => (
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
                  ).map((q) => (
                    <option key={q.questionId} value={q.questionId}>
                      {q.label}
                    </option>
                  ))}
                </select>
              )}

              {act.type === "skip_block" && (
                <select
                  multiple
                  className="w-full border-2 border-gray-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 p-2.5 rounded-lg text-sm transition-all outline-none bg-white min-h-[100px]"
                  value={Array.isArray(act.blockIds) ? act.blockIds : []}
                  onChange={(e) => {
                    const selected = Array.from(e.target.selectedOptions).map(
                      (o) => o.value
                    );
                    const copy = [...rule.actions];
                    copy[index].blockIds = selected;
                    setRule({ ...rule, actions: copy });
                  }}
                >
                  {blocksResolved.map((b) => (
                    <option key={b.blockId} value={b.blockId}>
                      {b.name}
                    </option>
                  ))}
                </select>
              )}

              {act.type === "skip_questions" && (
                <select
                  multiple
                  className="w-full border-2 border-gray-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 p-2.5 rounded-lg text-sm transition-all outline-none bg-white min-h-[100px]"
                  value={Array.isArray(act.questionIds) ? act.questionIds : []}
                  onChange={(e) => {
                    const selected = Array.from(e.target.selectedOptions).map(
                      (o) => o.value
                    );
                    const copy = [...rule.actions];
                    copy[index].questionIds = selected;
                    setRule({ ...rule, actions: copy });
                  }}
                >
                  {(
                    blocksResolved.find((b) => b.blockId === rule.blockId)
                      ?._questions || []
                  ).map((q) => (
                    <option key={q.questionId} value={q.questionId}>
                      {q.label}
                    </option>
                  ))}
                </select>
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

        <RaiseTicketForm
          open={ticketOpen}
          onClose={() => setTicketOpen(false)}
          onSaveTemplate={(template) => {
            if (ticketActIndex == null) return;
            setRule((prev) => {
              if (!prev) return prev;
              const actions = [...(prev.actions || [])];
              const current = {
                ...(actions[ticketActIndex] || { type: "raise_ticket" }),
              };
              const ticketData = Array.isArray(current.ticketData)
                ? [...current.ticketData]
                : [];
              ticketData[0] = template;
              current.ticketData = ticketData;
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

/* =============================================
   HELPERS
============================================= */
function valuePreview(v) {
  if (v == null) return "null";
  if (Array.isArray(v)) return v.map(safeStr).join(" | ");
  return safeStr(v);
}
function safeStr(v) {
  try {
    if (typeof v === "object") return JSON.stringify(v);
    return String(v);
  } catch {
    return String(v);
  }
}
function conditionLabel(cond) {
  const op = cond?.operator || "";
  return `${op}: ${valuePreview(cond?.value)}`;
}
function actionPreview(a) {
  switch (a?.type) {
    case "goto_question":
      return `goto question ${a.questionId}`;
    case "goto_block":
      return `goto block ${a.blockId}`;
    case "goto_block_question":
      return `goto ${a.targetQuestionId}`;
    case "skip_question":
      return `skip question`;
    case "skip_block":
      return `skip block`;
    case "end":
    case "skip_end":
      return `end survey`;
    case "show_message":
      return `show message`;
    case "raise_ticket":
      return `raise ticket`;
    default:
      return `action: ${a ? a.type : "unknown"}`;
  }
}
function actionEdgeLabel(a, toId, blocks = [], meta = {}) {
  if (!a) return "→ action";
  switch (a.type) {
    case "goto_question":
      return `→ Q: ${toId}`;
    case "goto_block": {
      const blk =
        blocks.find((b) => b._questions?.[0]?.questionId === toId) || null;
      const nm = blk?.name || a.blockId;
      return `→ Block: ${nm}`;
    }
    case "goto_block_question":
      return `→ Q: ${toId}`;
    case "skip_question":
      return "⤼ Skip question";
    case "skip_block": {
      const nextName = meta?.nextBlockName ? ` (${meta.nextBlockName})` : "";
      return `⤼ Skip block${nextName}`;
    }
    case "end":
    case "skip_end":
      return "End Survey";
    case "show_message":
      return "Show Message";
    default:
      return "→ action";
  }
}
function resolveActionOrSkipTargetId({
  action,
  primaryQuestionId,
  blockEntryMap,
  qToBlockId,
  globalQ,
  blocks,
}) {
  if (!action) return null;
  const getNextQuestionGlobal = (qid) => {
    const idx = globalQ.findIndex((q) => q.questionId === qid);
    return (idx >= 0 ? globalQ[idx + 1] : null)?.questionId || null;
  };
  const getNextQuestionInSameBlock = (qid) => {
    const blockId = qToBlockId.get(qid);
    if (!blockId) return null;
    const same = globalQ.filter(
      (q) => qToBlockId.get(q.questionId) === blockId
    );
    const i = same.findIndex((q) => q.questionId === qid);
    return (i >= 0 ? same[i + 1] : null)?.questionId || null;
  };
  const getNextBlockEntry = (qid) => {
    const blockId = qToBlockId.get(qid);
    if (!blockId) return null;
    const seq = [];
    const seen = new Set();
    globalQ.forEach((q) => {
      const b = qToBlockId.get(q.questionId);
      if (b && !seen.has(b)) {
        seen.add(b);
        seq.push(b);
      }
    });
    const idx = seq.indexOf(blockId);
    const nextBlockId = idx >= 0 ? seq[idx + 1] : null;
    if (!nextBlockId) return null;
    const entry = blockEntryMap.get(nextBlockId) || null;
    const nextBlockName =
      blocks.find((b) => b.blockId === nextBlockId)?.name ||
      nextBlockId ||
      null;
    return { entry, nextBlockName };
  };

  switch (action.type) {
    case "goto_block":
      return {
        targetId: action.blockId
          ? blockEntryMap.get(action.blockId) || null
          : null,
      };
    case "goto_question":
      return { targetId: action.questionId || null };
    case "goto_block_question":
      return { targetId: action.targetQuestionId || null };
    case "skip_question": {
      const nextInBlock = primaryQuestionId
        ? getNextQuestionInSameBlock(primaryQuestionId)
        : null;
      const next =
        nextInBlock ||
        (primaryQuestionId ? getNextQuestionGlobal(primaryQuestionId) : null);
      return { targetId: next || null };
    }
    case "skip_block": {
      const res = primaryQuestionId
        ? getNextBlockEntry(primaryQuestionId)
        : null;
      if (!res) return null;
      return {
        targetId: res.entry || null,
        meta: { nextBlockName: res.nextBlockName },
      };
    }
    default:
      return null;
  }
}
function messageNodeStyle() {
  return {
    width: MSG_W,
    height: MSG_H - 10,
    borderRadius: 12,
    padding: 10,
    background:
      "linear-gradient(135deg, rgba(15,118,110,.25) 0%, rgba(15,118,110,.15) 100%)",
    color: "#000",
    border: "2px solid #0f766e",
    fontSize: 12,
    fontWeight: 500,
    whiteSpace: "pre-wrap",
    boxShadow: "0 6px 16px rgba(0,0,0,.25)",
  };
}
function Legend() {
  return (
    <div className="hidden md:flex items-center gap-4 text-xs bg-gray-900 px-4 py-2.5 rounded-xl border border-gray-700">
      <span className="inline-flex items-center gap-2 text-gray-300">
        <i className="w-3 h-3 inline-block rounded-sm border-2 border-gray-500" />{" "}
        Block
      </span>
      <span className="inline-flex items-center gap-2 text-gray-300">
        <i className="w-3 h-3 inline-block rounded-sm border-2 border-dashed border-red-500" />{" "}
        Unassigned
      </span>
      <span className="inline-flex items-center gap-2 text-gray-300">
        <i className="w-3 h-3 inline-block rounded-sm bg-indigo-600" />{" "}
        Condition
      </span>
      <span className="inline-flex items-center gap-2 text-gray-300">
        <i className="w-3 h-3 inline-block rounded-sm bg-emerald-600" /> Goto /
        End
      </span>
      <span className="inline-flex items-center gap-2 text-gray-300">
        <i className="w-3 h-3 inline-block rounded-sm bg-amber-500" /> Skip
      </span>
      <span className="inline-flex items-center gap-2 text-gray-300">
        <i className="w-3 h-3 inline-block rounded-sm bg-teal-600" /> Message
      </span>
    </div>
  );
}
