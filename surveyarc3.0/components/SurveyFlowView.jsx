'use client';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import ReactFlow, { Background, Controls, MiniMap, MarkerType } from 'reactflow';
import 'reactflow/dist/style.css';
import { useRule } from '@/providers/rulePProvider';

// ---- Layout constants ----
const X_GAP = 320;           // horizontal distance between question columns (global)
const Q_WIDTH = 240;         // question card width

// Block container metrics
const BLOCK_HEADER_H = 20;   // internal spacing to place questions below label region
const BLOCK_PADDING = 16;
const BLOCK_BORDER_RADIUS = 14;
const BLOCK_LABEL_OFFSET = 12; // how far above the block border the label chip sits

// Logic row metrics
const RULE_Y_START = 200;    // logic nodes start below the block row
const RULE_Y_STEP = 120;

// Message pill metrics (to avoid overlaps with logic nodes)
const MSG_W = 220;
const MSG_H = 56;
const MSG_X_OFFSET = 130;      // gap to the right of rule card
const MSG_Y_STEP = 8;         // small vertical staggering for multiple messages on same rule

const fetchedSurveys = new Set();

export default function SurveyFlowView({ questions = [], surveyId, blocks = [] }) {

  const { rules, getAllRules } = useRule();
  const [loading, setLoading] = useState(true);
  const fetchInFlight = useRef(false);

  // -------- Fetch rules once per surveyId ----------
  useEffect(() => {
    let isActive = true;
    if (!surveyId) {
      setLoading(false);
      return;
    }
    const shouldFetch =
      !fetchedSurveys.has(surveyId) &&
      !fetchInFlight.current &&
      (!rules || rules.length === 0);

    async function run() {
      try {
        if (shouldFetch) {
          fetchInFlight.current = true;
          await getAllRules(surveyId);
          fetchedSurveys.add(surveyId);
        }
      } catch (e) {
        console.error(e);
      } finally {
        if (isActive) {
          fetchInFlight.current = false;
          setLoading(false);
        }
      }
    }

    if (!shouldFetch) {
      setLoading(false);
      return;
    }

    run();
    return () => { isActive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [surveyId]);

  // -------- Quick lookups ----------
  const questionsById = useMemo(() => {
    const map = new Map();
    for (const q of questions) map.set(q.questionId, q);
    return map;
  }, [questions]);

  // Blocks with resolved question objects in declared order
  const blocksWithResolvedQs = useMemo(() => {
    const list = [];
    const seen = new Set();

    for (const b of blocks || []) {
      const qIds = (Array.isArray(b.questionOrder) ? b.questionOrder : []).filter(Boolean);
      const resolved = qIds.map(qid => questionsById.get(qid)).filter(Boolean);
      resolved.forEach(q => seen.add(q.questionId));
      list.push({ ...b, _questions: resolved, _qIds: qIds });
    }

    const stray = questions.filter(q => !seen.has(q.questionId));
    if (stray.length) {
      list.push({
        blockId: '__unassigned__',
        name: 'Unassigned',
        _questions: stray,
        _qIds: stray.map(q => q.questionId),
      });
    }
    return list;
  }, [blocks, questionsById, questions]);

  // Map: blockId -> firstQuestionId (entry)
  const blockEntryMap = useMemo(() => {
    const m = new Map();
    for (const b of blocksWithResolvedQs) {
      const first = b._questions?.[0]?.questionId;
      if (first) m.set(b.blockId, first);
    }
    return m;
  }, [blocksWithResolvedQs]);

  // Global flattened question order for column indexing + skip resolution
  const globalQOrder = useMemo(() => {
    const arr = [];
    for (const b of blocksWithResolvedQs) {
      for (const q of b._questions) arr.push(q);
    }
    return arr;
  }, [blocksWithResolvedQs]);

  const qIndexMap = useMemo(() => {
    const map = {};
    globalQOrder.forEach((q, idx) => { map[q.questionId] = idx; });
    return map;
  }, [globalQOrder]);

  // Map: questionId -> blockId (for skip logic)
  const qToBlockId = useMemo(() => {
    const m = new Map();
    blocksWithResolvedQs.forEach(b => {
      b._questions.forEach(q => m.set(q.questionId, b.blockId));
    });
    return m;
  }, [blocksWithResolvedQs]);

  // -------- Block layout: compute container sizes & absolute X offsets ----------
  const blockLayouts = useMemo(() => {
    let cursorX = 0;
    const layouts = [];
    for (const b of blocksWithResolvedQs) {
      const count = b._questions.length || 1;
      const width = Math.max(1, count) * X_GAP - (X_GAP - Q_WIDTH) + BLOCK_PADDING * 2;
      const height = BLOCK_HEADER_H + 80 + BLOCK_PADDING * 2; // label band + question row + padding
      layouts.push({
        blockId: b.blockId,
        name: b.name || 'Block',
        x: cursorX,
        y: 0,
        width,
        height,
        qCount: count,
      });
      cursorX += width + 40; // gap between blocks
    }
    return layouts;
  }, [blocksWithResolvedQs]);

  const blockLayoutById = useMemo(() => {
    const m = new Map();
    for (const lay of blockLayouts) m.set(lay.blockId, lay);
    return m;
  }, [blockLayouts]);

  // For placing END terminator node to the far right
  const canvasRightX = useMemo(() => {
    let right = 0;
    for (const lay of blockLayouts) right = Math.max(right, lay.x + lay.width);
    return right;
  }, [blockLayouts]);

  // -------- Question Nodes (children of their block group) ----------
  const questionNodes = useMemo(() => {
    const nodes = [];

    blocksWithResolvedQs.forEach((b) => {
      const lay = blockLayoutById.get(b.blockId);
      if (!lay) return;
      b._questions.forEach((q, idx) => {
        const innerX = BLOCK_PADDING + idx * X_GAP;
        const innerY = BLOCK_PADDING + BLOCK_HEADER_H; // below label region

        nodes.push({
          id: q.questionId,
          data: { label:`[Q.Id - ${q.questionId} ] : ${ q.label}` },
          position: { x: innerX, y: innerY },
          parentNode: `block-${b.blockId}`,
          extent: 'parent',
          style: {
            borderRadius: 12,
            padding: 12,
            background: 'linear-gradient(180deg,#151518,#0f0f12)',
            color: '#E6E6F0',
            border: '1px solid #2e2e35',
            width: Q_WIDTH,
            textAlign: 'center',
            boxShadow: '0 6px 18px rgba(0,0,0,.25)',
          },
        });
      });
    });

    return nodes;
  }, [blocksWithResolvedQs, blockLayoutById]);

  // -------- Block Group Nodes (border only; unassigned highlighted) ----------
  const blockNodes = useMemo(() => {
    return blockLayouts.map((lay) => {
      const isUnassigned = lay.blockId === '__unassigned__';
      return {
        id: `block-${lay.blockId}`,
        type: 'group',
        data: { label: lay.name },
        position: { x: lay.x, y: lay.y },
        style: {
          background: 'transparent',
          border: isUnassigned ? '1px dashed #EF4444' : '1px solid #3b3b45',
          borderRadius: BLOCK_BORDER_RADIUS,
          width: lay.width,
          height: lay.height,
          boxShadow: 'none',
          overflow: 'visible', // allow label chip to hang above
        },
        draggable: true,
        selectable: true,
      };
    });
  }, [blockLayouts]);

  // -------- Block Label Nodes (chips just above border) ----------
  const blockLabelNodes = useMemo(() => {
    return blockLayouts.map((lay) => {
      const isUnassigned = lay.blockId === '__unassigned__';
      return {
        id: `block-label-${lay.blockId}`,
        data: { label: blocksWithResolvedQs.find(b => b.blockId === lay.blockId)?.name || 'Block' },
        position: { x: 12, y: -BLOCK_LABEL_OFFSET - 18 }, // ~18px chip height
        parentNode: `block-${lay.blockId}`,
        draggable: false,
        selectable: false,
        style: {
          padding: '2px 8px',
          border: isUnassigned ? '1px dashed #EF4444' : '1px solid #3b3b45',
          borderRadius: 999,
          background: '#000',
          color: isUnassigned ? '#FCA5A5' : '#E5E7EB',
          fontSize: 11,
          fontWeight: 700,
          lineHeight: 1.2,
          pointerEvents: 'none',
          zIndex: 5,
          width: 'auto',
          textAlign: 'left',
          display: 'inline-block',
          boxShadow: '0 1px 2px rgba(0,0,0,.6)',
        },
      };
    });
  }, [blockLayouts, blocksWithResolvedQs]);

  // -------- Rule Groups ----------
  const ruleGroups = useMemo(() => {
    const g = {};
    (rules || []).forEach((r) => {
      const primaryCond = (r && r.conditions || []).find(c => !!c.questionId);
      const primary = primaryCond ? primaryCond.questionId : '__ungrouped__';
      if (!g[primary]) g[primary] = [];
      g[primary].push(r);
    });
    return g;
  }, [rules]);

  // -------- Logic & Message Nodes ----------
  const { logicNodes, messageNodes } = useMemo(() => {
    const logic = [];
    const msgs = [];
    const entries = Object.entries(ruleGroups);

    for (const [primaryQ, list] of entries) {
      list.forEach((rule, i) => {
        const colIdx = qIndexMap[primaryQ] != null ? qIndexMap[primaryQ] : 0;
        const x = colIdx * X_GAP + (Q_WIDTH / 2) - ((Q_WIDTH + 40) / 2);
        const y = RULE_Y_START + (i * RULE_Y_STEP);

        const condText = (rule.conditions || [])
          .map(c => `${c.questionId || '?'} ${c.operator || '?'} ${valuePreview(c.value)}`)
          .join('\nAND ');

        const actText = (rule.actions || [])
          .map(a => actionPreview(a))
          .join('\n');

        const logicId = `logic-${rule.ruleId}`;

        logic.push({
          id: logicId,
          data: { label: `${rule.name || 'Rule'}\n\nIF\n${condText}\n\nTHEN\n${actText}` },
          position: { x, y },
          style: {
            borderRadius: 12,
            padding: 12,
            background: '#374151',
            color: '#F9FAFB',
            border: '1px solid #6B7280',
            width: Q_WIDTH + 40,
            whiteSpace: 'pre-line',
            fontSize: 12,
            textAlign: 'center',
            boxShadow: '0 6px 18px rgba(0,0,0,.25)',
          },
        });

        // Create message nodes (to the right of the rule) without overlapping the rule
        let msgIndex = 0;
        (rule.actions || []).forEach((a, ai) => {
          if (a?.type === 'show_message') {
            const msgId = `msg-${rule.ruleId}-${ai}`;
            const msgX = x + (Q_WIDTH + 40) + MSG_X_OFFSET;
            const msgY = y + msgIndex * (MSG_H + MSG_Y_STEP);
            msgs.push({
              id: msgId,
              data: { label: `🛈 ${a.message || '(message)'}` },
              position: { x: msgX, y: msgY },
              style: messageNodeStyle(),
            });
            msgIndex += 1;
          }
        });
      });
    }
    return { logicNodes: logic, messageNodes: msgs };
  }, [ruleGroups, qIndexMap]);

  // -------- END terminator node ----------
  const endNode = useMemo(() => {
    return {
      id: 'end-node',
      data: { label: 'END' },
      position: { x: canvasRightX + 120, y: RULE_Y_START - 80 },
      style: {
        padding: 8,
        border: '1px solid #EF4444',
        color: '#EF4444',
        background: 'transparent',
        borderRadius: 999,
        width: 72,
        textAlign: 'center',
        fontWeight: 700,
      },
    };
  }, [canvasRightX]);

  // -------- Edges (conditions, actions, skip, messages, end) ----------
  const edges = useMemo(() => {
    const edgesArr = [];

    (rules || []).forEach(rule => {
      const logicId = `logic-${rule.ruleId}`;

      const primaryCond = (rule.conditions || []).find(c => !!c.questionId);
      const primaryQ = primaryCond?.questionId || null;

      // Conditions
      (rule.conditions || []).forEach((cond, idx) => {
        if (cond.questionId) {
          edgesArr.push({
            id: `cond-${cond.questionId}-${logicId}-${idx}`,
            source: cond.questionId,
            target: logicId,
            type: 'smoothstep',
            animated: true,
            style: { stroke: '#4F46E5', strokeWidth: 2 },
            markerEnd: { type: MarkerType.ArrowClosed, color: '#4F46E5' },
            label: conditionLabel(cond),
            labelStyle: { fontSize: 11, fill: '#E5E7EB' },
            labelBgPadding: [6, 3],
            labelBgBorderRadius: 8,
            labelBgStyle: { fill: 'rgba(31,41,55,.9)', stroke: '#4F46E5' },
          });
        }
      });

      // Actions
      (rule.actions || []).forEach((a, idx) => {
        // Show message → edge to msg node
        if (a?.type === 'show_message') {
          const msgId = `msg-${rule.ruleId}-${idx}`;
          edgesArr.push({
            id: `act-${logicId}-${msgId}-${idx}`,
            source: logicId,
            target: msgId,
            type: 'smoothstep',
            animated: true,
            style: { stroke: '#22c55e', strokeWidth: 2.4 },
            markerEnd: { type: MarkerType.ArrowClosed, color: '#22c55e' },
            label: 'Show Message',
            labelStyle: { fontSize: 11, fill: '#E5E7EB' },
            labelBgPadding: [6, 3],
            labelBgBorderRadius: 8,
            labelBgStyle: { fill: 'rgba(6,78,59,.9)', stroke: '#22c55e' },
          });
          return; // continue next action
        }

        // End survey actions → connect to END node
        if (a?.type === 'end' || a?.type === 'skip_end') {
          edgesArr.push({
            id: `act-${logicId}-end-node-${idx}`,
            source: logicId,
            target: 'end-node',
            type: 'smoothstep',
            animated: true,
            style: { stroke: '#10B981', strokeWidth: 2.8 },
            markerEnd: { type: MarkerType.ArrowClosed, color: '#10B981' },
            label: 'End Survey',
            labelStyle: { fontSize: 11, fill: '#E5E7EB' },
            labelBgPadding: [6, 3],
            labelBgBorderRadius: 8,
            labelBgStyle: { fill: 'rgba(6,78,59,.9)', stroke: '#10B981' },
          });
          return;
        }

        // Other actions (goto*, skip_question, skip_block)
        const res = resolveActionOrSkipTargetId({
          action: a,
          primaryQuestionId: primaryQ,
          blockEntryMap,
          qToBlockId,
          globalQOrder,
          blocks: blocksWithResolvedQs,
        });

        if (res?.targetId) {
          const isGoto = String(a.type || '').startsWith('goto');
          const isSkip = String(a.type || '').startsWith('skip');
          const stroke = isGoto ? '#10B981' : (isSkip ? '#F59E0B' : '#EF4444');

          edgesArr.push({
            id: `act-${logicId}-${res.targetId}-${idx}`,
            source: logicId,
            target: res.targetId,
            type: 'smoothstep',
            animated: true,
            style: {
              stroke,
              strokeWidth: isSkip ? 3 : 2.8,
              strokeDasharray: isSkip ? '6 3' : undefined,
            },
            markerEnd: { type: MarkerType.ArrowClosed, color: stroke },
            label: actionEdgeLabel(a, res.targetId, blocksWithResolvedQs, res.meta),
            labelStyle: { fontSize: 11, fill: '#E5E7EB' },
            labelBgPadding: [6, 3],
            labelBgBorderRadius: 8,
            labelBgStyle: {
              fill: isGoto ? 'rgba(6,78,59,.9)' : (isSkip ? 'rgba(120,53,15,.9)' : 'rgba(127,29,29,.9)'),
              stroke,
            },
          });
        }
      });
    });

    return edgesArr;
  }, [rules, blockEntryMap, qToBlockId, globalQOrder, blocksWithResolvedQs]);

  const existingNodeIds = useMemo(() => {
    const ids = new Set();
    blockNodes.forEach(n => ids.add(n.id));
    blockLabelNodes.forEach(n => ids.add(n.id));
    questionNodes.forEach(n => ids.add(n.id));
    logicNodes.forEach(n => ids.add(n.id));
    messageNodes.forEach(n => ids.add(n.id));
    ids.add('end-node');
    return ids;
  }, [blockNodes, blockLabelNodes, questionNodes, logicNodes, messageNodes]);

  const placeholderNodes = useMemo(() => {
    const nodes = [];
    const actionTargets = collectActionTargetsForBlocks(rules, blocksWithResolvedQs, globalQOrder);

    let col = globalQOrder.length;
    actionTargets.forEach((target) => {
      if (target.type === 'question' && !existingNodeIds.has(target.id)) {
        nodes.push({
          id: target.id,
          data: { label: `Q: ${target.id} (placeholder)` },
          position: { x: col * X_GAP, y: BLOCK_HEADER_H + BLOCK_PADDING + 8 },
          style: {
            borderRadius: 12,
            padding: 12,
            background: 'linear-gradient(180deg,#131317,#0b0b0e)',
            color: '#E6E6F0',
            border: '1px dashed #6b7280',
            width: Q_WIDTH,
            textAlign: 'center',
            boxShadow: '0 6px 18px rgba(0,0,0,.25)',
            opacity: 0.9,
          },
        });
        col += 1;
      }
    });
    return nodes;
  }, [rules, blocksWithResolvedQs, existingNodeIds, globalQOrder.length, globalQOrder]);

  const hasLoop = useMemo(() => detectLoop(edges), [edges]);

  if (loading) return <div className="text-gray-400 p-4">Loading survey flow...</div>;

  return (
    <div className="w-full h-[80vh] dark:bg-[#0D0D0F] p-4 relative">
      <header className="mb-3 flex items-center justify-between">
        <h2 className="text-xl font-semibold text-black">Survey Flow Diagram</h2>
        <Legend />
      </header>

      {hasLoop && (
        <div className="bg-red-500/10 border border-red-500 text-red-300 text-sm p-2 mb-3 rounded">
          ⚠️ Loop detected in survey logic! Please review.
        </div>
      )}

      <ReactFlow
        nodes={[
          ...blockNodes,
          ...blockLabelNodes,
          ...questionNodes,
          endNode,
          ...placeholderNodes,
          ...logicNodes,
          ...messageNodes,
        ]}
        
        edges={edges}
        fitView
        fitViewOptions={{ padding: 0.2, minZoom: 0.8, maxZoom: 1.25 }}
        panOnScroll
        zoomOnScroll
        nodesDraggable
        nodesConnectable={false}
        attributionPosition="bottom-left"
      >
        <MiniMap
          nodeColor={(n) =>
            n.id === 'end-node' ? '#991B1B' :
            (n.id.startsWith('msg-') ? '#0f766e' :
            (n.id.startsWith('block-__unassigned__') ? '#7F1D1D' :
              (n.id.startsWith('block-') ? '#1f2937' :
               (n.id.startsWith('logic-') ? '#374151' : '#6366F1'))))
          }
          maskColor="rgba(17,24,39,0.7)"
        />
        <Controls showInteractive={false} />
        <Background color="#2B2B31" gap={24} />
      </ReactFlow>
    </div>
  );
}

/* ---------- helpers ---------- */
function valuePreview(v) {
  if (v == null) return 'null';
  if (Array.isArray(v)) return v.map(safeStr).join(' | ');
  return safeStr(v);
}
function safeStr(v) {
  try {
    if (typeof v === 'object') return JSON.stringify(v);
    return String(v);
  } catch {
    return String(v);
  }
}
function conditionLabel(cond) {
  const op = cond && cond.operator ? cond.operator : '';
  return `${op}: ${valuePreview(cond && cond.value)}`;
}
function actionPreview(a) {
  switch (a && a.type) {
    case 'goto_question': return `goto question ${a.questionId}`;
    case 'goto_block': return `goto block ${a.blockId}`;
    case 'goto_block_question': return `goto ${a.targetQuestionId}`;
    case 'skip_question': return `skip question`;
    case 'skip_block': return `skip block`;
    case 'end':
    case 'skip_end': return `end survey`;
    case 'show_message': return `show message`;
    default: return `action: ${a ? a.type : 'unknown'}`;
  }
}
function actionEdgeLabel(a, toId, blocks = [], meta = {}) {
  if (!a) return '→ action';
  switch (a.type) {
    case 'goto_question': return `→ Q: ${toId}`;
    case 'goto_block': {
      const blk = blocks.find(b => b._questions?.[0]?.questionId === toId) || null;
      const nm = blk?.name || a.blockId;
      return `→ Block: ${nm}`;
    }
    case 'goto_block_question': return `→ Q: ${toId}`;
    case 'skip_question': return '⤼ Skip question';
    case 'skip_block': {
      const nextName = meta?.nextBlockName ? ` (${meta.nextBlockName})` : '';
      return `⤼ Skip block${nextName}`;
    }
    case 'end':
    case 'skip_end': return 'End Survey';
    case 'show_message': return 'Show Message';
    default: return '→ action';
  }
}

/**
 * Resolve action/skip target IDs:
 * - goto_block          -> FIRST QUESTION in that block
 * - goto_question       -> questionId
 * - goto_block_question -> targetQuestionId
 * - skip_question       -> next question after primaryQuestionId (prefer same block, else global)
 * - skip_block          -> first question of the next block
 * - end / skip_end      -> handled separately (END node)
 */
function resolveActionOrSkipTargetId({
  action,
  primaryQuestionId,
  blockEntryMap,
  qToBlockId,
  globalQOrder,
  blocks,
}) {
  if (!action) return null;

  const getNextQuestionGlobal = (qid) => {
    const idx = globalQOrder.findIndex(q => q.questionId === qid);
    const next = idx >= 0 ? globalQOrder[idx + 1] : null;
    return next?.questionId || null;
  };

  const getNextQuestionInSameBlock = (qid) => {
    const blockId = qToBlockId.get(qid);
    if (!blockId) return null;
    const sameBlockQs = globalQOrder.filter(q => qToBlockId.get(q.questionId) === blockId);
    const localIdx = sameBlockQs.findIndex(q => q.questionId === qid);
    const nextLocal = localIdx >= 0 ? sameBlockQs[localIdx + 1] : null;
    return nextLocal?.questionId || null;
  };

  const getNextBlockEntry = (qid) => {
    const blockId = qToBlockId.get(qid);
    if (!blockId) return null;
    // Build a sequential list of blockIds based on globalQOrder encounter order
    const seq = [];
    const seen = new Set();
    globalQOrder.forEach(q => {
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

    // For label enrichment
    const nextBlockName = blocks.find(b => b.blockId === nextBlockId)?.name || nextBlockId || null;
    return { entry, nextBlockName };
  };

  switch (action.type) {
    case 'goto_block':
      return { targetId: action.blockId ? (blockEntryMap.get(action.blockId) || null) : null };

    case 'goto_question':
      return { targetId: action.questionId || null };

    case 'goto_block_question':
      return { targetId: action.targetQuestionId || null };

    case 'skip_question': {
      const nextInBlock = primaryQuestionId ? getNextQuestionInSameBlock(primaryQuestionId) : null;
      const next = nextInBlock || (primaryQuestionId ? getNextQuestionGlobal(primaryQuestionId) : null);
      return { targetId: next || null };
    }

    case 'skip_block': {
      const res = primaryQuestionId ? getNextBlockEntry(primaryQuestionId) : null;
      if (!res) return null;
      return { targetId: res.entry || null, meta: { nextBlockName: res.nextBlockName } };
    }

    default:
      return null; // end/skip_end handled in edges builder; show_message handled separately
  }
}

/**
 * Collect potential question targets so we can create placeholders
 * for missing nodes. Includes goto_* and skip_* that resolve to a question.
 */
function collectActionTargetsForBlocks(rules = [], blocksWithResolvedQs = [], globalQOrder = []) {
  const targets = new Set();

  const addQuestion = (id) => {
    if (id) targets.add(JSON.stringify({ type: 'question', id }));
  };

  const qToBlockId = new Map();
  const blockEntryMap = new Map();

  blocksWithResolvedQs.forEach(b => {
    const qIds = b._questions.map(q => q.questionId);
    if (qIds.length) blockEntryMap.set(b.blockId, qIds[0]);
    qIds.forEach(qid => qToBlockId.set(qid, b.blockId));
  });

  globalQOrder.forEach((q) => {
    if (!qToBlockId.has(q.questionId) && q.blockId) qToBlockId.set(q.questionId, q.blockId);
    if (q.blockId && !blockEntryMap.has(q.blockId)) blockEntryMap.set(q.blockId, q.questionId);
  });

  const getNextQuestionGlobal = (qid) => {
    const idx = globalQOrder.findIndex(q => q.questionId === qid);
    const next = idx >= 0 ? globalQOrder[idx + 1] : null;
    return next?.questionId || null;
  };
  const getNextQuestionInSameBlock = (qid) => {
    const blockId = qToBlockId.get(qid);
    if (!blockId) return null;
    const sameBlockQs = globalQOrder.filter(q => qToBlockId.get(q.questionId) === blockId);
    const localIdx = sameBlockQs.findIndex(q => q.questionId === qid);
    const nextLocal = localIdx >= 0 ? sameBlockQs[localIdx + 1] : null;
    return nextLocal?.questionId || null;
  };
  const getNextBlockEntry = (qid) => {
    const blockId = qToBlockId.get(qid);
    if (!blockId) return null;
    const seq = [];
    const seen = new Set();
    globalQOrder.forEach(q => {
      const b = qToBlockId.get(q.questionId);
      if (b && !seen.has(b)) {
        seen.add(b);
        seq.push(b);
      }
    });
    const idx = seq.indexOf(blockId);
    const nextBlockId = idx >= 0 ? seq[idx + 1] : null;
    if (!nextBlockId) return null;
    return blockEntryMap.get(nextBlockId) || null;
  };

  for (const r of rules || []) {
    const primary = (r.conditions || []).find(c => !!c.questionId)?.questionId || null;

    for (const a of (r.actions || [])) {
      if (a.type === 'goto_question') addQuestion(a.questionId);
      if (a.type === 'goto_block_question') addQuestion(a.targetQuestionId);
      if (a.type === 'goto_block' && a.blockId) addQuestion(blockEntryMap.get(a.blockId));

      if (a.type === 'skip_question' && primary) {
        addQuestion(getNextQuestionInSameBlock(primary) || getNextQuestionGlobal(primary));
      }
      if (a.type === 'skip_block' && primary) {
        addQuestion(getNextBlockEntry(primary));
      }
      // end/skip_end -> END node (no placeholder)
    }
  }

  return Array.from(targets).map(s => JSON.parse(s));
}

function detectLoop(edges) {
  const graph = {};
  edges.forEach(e => {
    if (!graph[e.source]) graph[e.source] = [];
    graph[e.source].push(e.target);
  });

  const visited = new Set();
  const stack = new Set();

  function dfs(node) {
    if (!graph[node]) return false;
    visited.add(node);
    stack.add(node);

    for (const neighbor of graph[node]) {
      if (!visited.has(neighbor) && dfs(neighbor)) return true;
      else if (stack.has(neighbor)) return true;
    }
    stack.delete(node);
    return false;
  }

  return Object.keys(graph).some(node => dfs(node));
}

/* ---------- styles ---------- */
function messageNodeStyle() {
  return {
    width: MSG_W,
    height: MSG_H,
    borderRadius: 10,
    padding: 10,
    background: 'rgba(15,118,110,.2)',
    color: '#000',
    border: '1px solid #0f766e',
    fontSize: 12,
    whiteSpace: 'pre-wrap',
    boxShadow: '0 4px 12px rgba(0,0,0,.2)',
  };
}

function Legend() {
  return (
    <div className="hidden md:flex items-center gap-3 text-xs text-black-300">
      <span className="inline-flex items-center gap-1">
        <i className="w-3 h-3 inline-block rounded-sm" style={{ border: '1px solid #3b3b45' }} /> Block (border-only)
      </span>
      <span className="inline-flex items-center gap-1">
        <i className="w-3 h-3 inline-block rounded-sm" style={{ border: '1px dashed #EF4444' }} /> Unassigned Block
      </span>
      <span className="inline-flex items-center gap-1">
        <i className="w-3 h-3 inline-block rounded-sm" style={{ background: '#000' }} /> Block Label
      </span>
      <span className="inline-flex items-center gap-1">
        <i className="w-3 h-3 inline-block rounded-sm" style={{ background: '#4F46E5' }} /> Condition Edge
      </span>
      <span className="inline-flex items-center gap-1">
        <i className="w-3 h-3 inline-block rounded-sm" style={{ background: '#10B981' }} /> Action (Goto/End)
      </span>
      <span className="inline-flex items-center gap-1">
        <i className="w-3 h-3 inline-block rounded-sm" style={{ background: '#F59E0B' }} /> Skip (dashed)
      </span>
      <span className="inline-flex items-center gap-1">
        <i className="w-3 h-3 inline-block rounded-sm" style={{ background: '#0f766e' }} /> Message
      </span>
    </div>
  );
}
