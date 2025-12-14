"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  MarkerType,
  applyNodeChanges,
  applyEdgeChanges,
} from "reactflow";
import "reactflow/dist/style.css";
import { useParams } from "next/navigation";
import { GitBranch, Sparkles } from "lucide-react";
import { useRule } from "@/providers/rulePProvider";
import { useTags } from "@/providers/postGresPorviders/TagProvider";
import { useUser } from "@/providers/postGresPorviders/UserProvider";
import { RuleEditor } from "./SurveyFlowView/RuleEditor";
import {
  actionEdgeLabel,
  actionPreview,
  conditionLabel,
  Legend,
  messageNodeStyle,
  resolveActionOrSkipTargetId,
  valuePreview,
} from "@/utils/surveyFlowHelpers";
import RaiseTicketForm from "./tickets/RaiseTicketForm";

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

export default function SurveyFlowScreen({
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

  // ----- core derived data (unchanged logic) -----
  const questionsById = useMemo(() => {
    const map = new Map();
    (questions || []).forEach((q) => map.set(q.questionId, q));
    return map;
  }, [questions]);

  const blocksResolved = useMemo(() => {
    const list = [];
    const seen = new Set();
    for (const b of blocks || []) {
      const order = Array.isArray(b.questionOrder) ? b.questionOrder : [];
      const qs = order
        .map((id) => {
          if (typeof id === "string" && id.startsWith("PB-")) {
            return { questionId: id, __isPageBreak: true };
          }
          return questionsById.get(id) || null;
        })
        .filter(Boolean);
      qs.forEach((q) => {
        if (!q.__isPageBreak) seen.add(q.questionId);
      });
      list.push({ ...b, _questions: qs });
    }
    const stray = (questions || []).filter((q) => !seen.has(q.questionId));
    if (stray.length)
      list.push({
        blockId: "__unassigned__",
        name: "Unassigned",
        _questions: stray,
      });
    return list;
  }, [blocks, questionsById]);

  const blocksForFlow = useMemo(
    () => (blocksResolved || []).filter((b) => b.blockId !== "__unassigned__"),
    [blocksResolved]
  );

  const blockEntryMap = useMemo(() => {
    const m = new Map();
    for (const b of blocksResolved) {
      const first = (b._questions || []).find(
        (q) => !q.__isPageBreak
      )?.questionId;
      if (first) m.set(b.blockId, first);
    }
    return m;
  }, [blocksResolved]);

  const qToBlockId = useMemo(() => {
    const m = new Map();
    blocksResolved.forEach((b) =>
      b._questions.forEach((q) => {
        if (!q.__isPageBreak) m.set(q.questionId, b.blockId);
      })
    );
    return m;
  }, [blocksResolved]);

  const globalQ = useMemo(() => {
    const arr = [];
    blocksResolved.forEach((b) => b._questions.forEach((q) => arr.push(q)));
    return arr.filter(Boolean);
  }, [blocksResolved]);

  const qIndexMap = useMemo(() => {
    const m = {};
    globalQ.forEach((q, i) => (m[q.questionId] = i));
    return m;
  }, [globalQ]);

  // layout: keep your original layout approach
  const blockLayouts = useMemo(() => {
    let cursorX = 0;
    const out = [];
    for (const b of blocksForFlow) {
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
  }, [blocksForFlow]);

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
      (blockLayouts || []).map((l) => ({
        id: `block-${l.blockId}`,
        type: "group",
        position: { x: l.x, y: l.y },
        data: { label: l.name },
        style: {
          background: "transparent",
          border: "2px solid #3b3b45",
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
      (blockLayouts || []).map((l) => ({
        id: `block-label-${l.blockId}`,
        position: { x: 12, y: -BLOCK_LABEL_OFFSET - 18 },
        data: { label: l.name },
        parentNode: `block-${l.blockId}`,
        draggable: false,
        selectable: false,
        style: {
          width: "max-content",
          padding: "4px 12px",
          border: "1px solid #3b3b45",
          borderRadius: 999,
          background: "#000",
          color: "#E5E7EB",
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
    (blocksForFlow || []).forEach((b) => {
      const lay = layoutByBlock.get(b.blockId);
      if (!lay) return;
      b._questions.forEach((q, i) => {
        if (q.__isPageBreak) {
          nodes.push({
            id: q.questionId,
            data: { label: "— Page Break —" },
            parentNode: `block-${b.blockId}`,
            extent: "parent",
            position: {
              x: BLOCK_PADDING + i * X_GAP,
              y: BLOCK_PADDING + BLOCK_HEADER_H,
            },
            style: {
              borderRadius: 8,
              padding: 10,
              background: "linear-gradient(180deg,#0f1724,#0b1220)",
              color: "#FBBF24",
              border: "1px dashed #F59E0B",
              width: Q_WIDTH * 0.8,
              textAlign: "center",
              boxShadow: "0 6px 18px rgba(0,0,0,.35)",
              fontWeight: 700,
              fontSize: 13,
            },
          });
          return;
        }

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
            whiteSpace: "normal",
            wordBreak: "break-word",
          },
        });
      });
    });
    return nodes;
  }, [blocksForFlow, layoutByBlock]);

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
            wordBreak: "break-word",
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

        const explicitQuestionIds =
          Array.isArray(a.questionIds) && a.questionIds.length
            ? a.questionIds
            : null;
        const targetIds =
          explicitQuestionIds ?? (res?.targetId ? [res.targetId] : []);

        if (targetIds.length) {
          const isSkip = String(a.type || "").startsWith("skip");
          const isGoto = String(a.type || "").startsWith("goto");
          const stroke = isGoto ? "#10B981" : isSkip ? "#F59E0B" : "#EF4444";
          const dash = isSkip ? "6 3" : undefined;

          targetIds.forEach((targetId, tIdx) => {
            const resolvedTargetId = String(targetId);
            const targetIsPageBreak =
              typeof resolvedTargetId === "string" &&
              resolvedTargetId.startsWith("PB-");
            const targetIsInFlow = !!globalQ.find(
              (q) => q.questionId === resolvedTargetId
            );
            if (targetIsPageBreak || !targetIsInFlow) return;

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

        if (res?.targetId) {
          const isGoto = String(a.type || "").startsWith("goto");
          const isSkip = String(a.type || "").startsWith("skip");
          const stroke = isGoto ? "#10B981" : isSkip ? "#F59E0B" : "#EF4444";
          const resolvedTargetId = String(res.targetId);
          const targetIsPageBreak = resolvedTargetId.startsWith("PB-");
          const targetIsInFlow = !!globalQ.find(
            (q) => q.questionId === resolvedTargetId
          );
          if (!targetIsPageBreak && targetIsInFlow) {
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
        }
      });
    });

    return arr;
  }, [rules, blocksResolved, blockEntryMap, qToBlockId, globalQ]);

  const loops = useMemo(() => {
    const adj = new Map();
    const edgeToRules = new Map();

    (rules || []).forEach((rule) => {
      const primaryQ =
        (rule.conditions || []).find((c) => !!c.questionId)?.questionId || null;
      if (!primaryQ) return;

      (rule.actions || []).forEach((a) => {
        const res = resolveActionOrSkipTargetId({
          action: a,
          primaryQuestionId: primaryQ,
          blockEntryMap,
          qToBlockId,
          globalQ,
          blocks: blocksResolved,
        });

        const explicitQuestionIds =
          Array.isArray(a.questionIds) && a.questionIds.length
            ? a.questionIds
            : null;
        const targetIds =
          explicitQuestionIds ?? (res?.targetId ? [res.targetId] : []);

        if (targetIds && targetIds.length) {
          targetIds.forEach((t) => {
            if (!t) return;
            const tid = String(t);
            if (tid.startsWith("PB-")) return;
            const exists = globalQ.find((q) => q.questionId === tid);
            if (!exists) return;
            if (!adj.has(primaryQ)) adj.set(primaryQ, new Set());
            adj.get(primaryQ).add(tid);
            const key = `${primaryQ}-->${tid}`;
            if (!edgeToRules.has(key)) edgeToRules.set(key, []);
            edgeToRules.get(key).push(rule);
          });
        } else if (res?.targetId) {
          const tid = String(res.targetId);
          if (tid.startsWith("PB-")) return;
          const exists = globalQ.find((q) => q.questionId === tid);
          if (!exists) return;
          if (!adj.has(primaryQ)) adj.set(primaryQ, new Set());
          adj.get(primaryQ).add(tid);
          const key = `${primaryQ}-->${tid}`;
          if (!edgeToRules.has(key)) edgeToRules.set(key, []);
          edgeToRules.get(key).push(rule);
        }
      });
    });

    const visited = new Set();
    const stack = new Set();
    const cycles = [];
    const path = [];

    function dfs(u) {
      if (stack.has(u)) {
        const idx = path.indexOf(u);
        const cyclePath = path.slice(idx).concat(u);
        cycles.push(cyclePath);
        return;
      }
      if (visited.has(u)) return;
      visited.add(u);
      stack.add(u);
      path.push(u);

      const neighbors = adj.get(u);
      if (neighbors) {
        for (const v of neighbors) {
          dfs(v);
        }
      }

      stack.delete(u);
      path.pop();
    }

    for (const node of adj.keys()) {
      if (!visited.has(node)) dfs(node);
    }

    const readable = cycles.map((c) => {
      const edgesInCycle = [];
      for (let i = 0; i < c.length - 1; i++) {
        const a = c[i];
        const b = c[i + 1];
        const key = `${a}-->${b}`;
        const rulesList = edgeToRules.get(key) || [];
        edgesInCycle.push({ from: a, to: b, rules: rulesList });
      }
      const ruleInfos = [];
      const seenRuleIds = new Set();
      edgesInCycle.forEach((e) =>
        e.rules.forEach((r) => {
          if (!r || !r.ruleId) return;
          if (seenRuleIds.has(r.ruleId)) return;
          seenRuleIds.add(r.ruleId);
          ruleInfos.push({ ruleId: r.ruleId, name: r.name || "" });
        })
      );

      return {
        path: c,
        edges: edgesInCycle,
        rules: ruleInfos,
      };
    });

    return readable;
  }, [rules, blockEntryMap, qToBlockId, globalQ, blocksResolved]);

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
      setEditingRule(
        makeEmptyRule ? makeEmptyRule(surveyId, bId, q.questionId) : null
      );
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
    const tagIds = namesToTagIds
      ? namesToTagIds(csvToArray(act.tagsCsv), availableTags)
      : [];
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

  const PERSIST_KEY = `survey-flow-pos-${surveyId || "default"}`;

  const computedNodes = useMemo(
    () => [
      ...blockNodes,
      ...blockLabelNodes,
      ...questionNodes,
      ...logicNodes,
      ...messageNodes,
      endNode,
    ],
    [
      blockNodes,
      blockLabelNodes,
      questionNodes,
      logicNodes,
      messageNodes,
      endNode,
    ]
  );

  const computedEdges = edges;

  const [nodesState, setNodesState] = useState(() => {
    try {
      if (typeof window === "undefined") return computedNodes;
      const raw = localStorage.getItem(PERSIST_KEY);
      const stored = raw ? JSON.parse(raw) : null;
      if (Array.isArray(stored)) {
        const map = new Map(stored.map((s) => [s.id, s]));
        return computedNodes.map((cn) => {
          const s = map.get(cn.id);
          if (s && s.position) return { ...cn, position: s.position };
          return cn;
        });
      }
    } catch (e) {
      console.warn("Failed to parse stored positions", e);
    }
    return computedNodes;
  });

  const [edgesState, setEdgesState] = useState(computedEdges);

  useEffect(() => {
    setNodesState((prev) => {
      const prevMap = new Map((prev || []).map((n) => [n.id, n]));
      const merged = computedNodes.map((cn) => {
        const p = prevMap.get(cn.id);
        if (p && p.position) return { ...cn, position: p.position };
        return cn;
      });
      return merged;
    });

    setEdgesState(computedEdges);
  }, [computedNodes, computedEdges]);

  const onNodesChange = useCallback((changes) => {
    setNodesState((nds) => applyNodeChanges(changes, nds));
  }, []);

  const onEdgesChange = useCallback((changes) => {
    setEdgesState((eds) => applyEdgeChanges(changes, eds));
  }, []);

  const onNodeDragStop = useCallback(
    (evt, node) => {
      setNodesState((nds) => {
        const updated = nds.map((n) =>
          n.id === node.id ? { ...n, position: node.position } : n
        );
        try {
          localStorage.setItem(
            PERSIST_KEY,
            JSON.stringify(
              updated.map((n) => ({ id: n.id, position: n.position }))
            )
          );
        } catch (e) {
          console.warn("Failed to persist node positions", e);
        }
        return updated;
      });
    },
    [PERSIST_KEY]
  );

  const resetPositions = useCallback(() => {
    try {
      localStorage.removeItem(PERSIST_KEY);
    } catch (e) {}
    setNodesState(computedNodes);
  }, [computedNodes]);

  if (loadingRules)
    return (
      <div className="flex items-center justify-center h-[88vh] text-gray-400">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mx-auto mb-4"></div>
          <p className="text-sm">Loading flow...</p>
        </div>
      </div>
    );

  console.log(rules);
  return (
    <div className="grid grid-cols-1 2xl:grid-cols-[1fr_320px] gap-5 w-full h-[88vh]">
      <div className="w-full h-full dark:bg-[#0D0D0F] p-4 rounded-xl border-2 border-neutral-800 shadow-2xl overflow-hidden">
        <header className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-600 rounded-lg">
              <GitBranch className="w-4 h-4" />
            </div>
            <h2 className="text-lg font-bold">Survey Flow</h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={resetPositions}
              className="text-xs px-3 py-1 bg-gray-800 text-white rounded-md"
              title="Reset saved node positions"
            >
              Reset positions
            </button>
            <Legend />
          </div>
        </header>

        {loops && loops.length > 0 && (
          <div className="mb-4 p-3 rounded-lg bg-yellow-50 border border-amber-300 text-sm text-amber-800">
            <div className="font-semibold mb-1">Loop(s) detected in rules</div>
            {loops.map((lp, i) => (
              <div key={i} className="mb-2">
                <div className="text-xs text-amber-700 mb-1">
                  Path:{" "}
                  <span className="font-medium">{lp.path.join(" → ")}</span>
                </div>
                <div className="text-xs">
                  Rules involved:{" "}
                  {lp.rules.length
                    ? lp.rules.map((r) => `${r.name || r.ruleId}`).join(", ")
                    : "Unknown"}
                </div>
              </div>
            ))}
            <div className="text-xs text-amber-700 mt-2">
              Please review these rules — they create a cycle where a question
              can lead back to itself via one or more rules.
            </div>
          </div>
        )}

        <div style={{ width: "100%", height: "calc(88vh - 120px)" }}>
          <ReactFlow
            nodes={nodesState}
            edges={edgesState}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeDragStop={onNodeDragStop}
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
            emptyAction={emptyAction}
            emptyCondition={emptyCondition}
          />
        )}
      </div>

      <RaiseTicketForm
        open={ticketOpen}
        onClose={() => setTicketOpen(false)}
        onSaveTemplate={(template) => {
          if (ticketActIndex == null) return;
          setEditingRule((prev) => {
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
    </div>
  );
}
