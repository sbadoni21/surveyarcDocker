export function valuePreview(v) {
  if (v == null) return "null";
  if (Array.isArray(v)) return v.map(safeStr).join(" | ");
  return safeStr(v);
}
export function safeStr(v) {
  try {
    if (typeof v === "object") return JSON.stringify(v);
    return String(v);
  } catch {
    return String(v);
  }
}
export function conditionLabel(cond) {
  const op = cond?.operator || "";
  return `${op}: ${valuePreview(cond?.value)}`;
}
export function actionPreview(a) {
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
export function actionEdgeLabel(a, toId, blocks = [], meta = {}) {
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
export function resolveActionOrSkipTargetId({
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
export function messageNodeStyle() {
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
export function Legend() {
  return (
    <div className="hidden md:flex items-center gap-4 text-xs bg-gray-900 px-4 py-2.5 rounded-xl border border-gray-700">
      <span className="inline-flex items-center gap-2 text-gray-300">
        <i className="w-3 h-3 inline-block rounded-sm border-2 border-gray-500" />{" "}
        Block
      </span>
      {/* <span className="inline-flex items-center gap-2 text-gray-300">
        <i className="w-3 h-3 inline-block rounded-sm border-2 border-dashed border-red-500" />{" "}
        Unassigned (hidden in flow)
      </span> */}
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
      <span className="inline-flex items-center gap-2 text-gray-300">
        <i className="w-3 h-3 inline-block rounded-sm border-2 border-dashed border-yellow-400" />{" "}
        Page Break (visual)
      </span>
    </div>
  );
  /* Helper to get appropriate value options for a question type */
}
