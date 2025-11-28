"use client";
import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  FiEdit2,
  FiCheck,
  FiX,
  FiTrash2,
  FiPlusSquare,
  FiInfo,
} from "react-icons/fi";

import { ICONS_MAP } from "@/utils/questionTypes";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  useDroppable,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { usePathname } from "next/navigation";
import { useSurvey } from "@/providers/surveyPProvider";
import { RiDeleteBin6Line } from "react-icons/ri";
import { useQuestion } from "@/providers/questionPProvider";

const ICON_BG_CLASSES = {
  CONTACT_EMAIL: "bg-[#FFEEDF] dark:bg-[#483A2D]",
  CONTACT_PHONE: "bg-[#FFEEDF] dark:bg-[#483A2D]",
  CONTACT_ADDRESS: "bg-[#FFEEDF] dark:bg-[#483A2D]",
  CONTACT_WEBSITE: "bg-[#FFEEDF] dark:bg-[#483A2D]",
  MULTIPLE_CHOICE: "bg-[#DFF5FF] dark:bg-[#374247]",
  DROPDOWN: "bg-[#DFF5FF] dark:bg-[#374247]",
  PICTURE_CHOICE: "bg-[#DFF5FF] dark:bg-[#374247]",
  YES_NO: "bg-[#DFF5FF] dark:bg-[#374247]",
  LEGAL: "bg-[#DFF5FF] dark:bg-[#374247]",
  CHECKBOX: "bg-[#DFF5FF] dark:bg-[#374247]",
  NPS: "bg-[#FFDFE0] dark:bg-[#473434]",
  OPINION_SCALE: "bg-[#FFDFE0] dark:bg-[#473434]",
  RATING: "bg-[#FFDFE0] dark:bg-[#473434]",
  RANKING: "bg-[#FFDFE0] dark:bg-[#473434]",
  MATRIX: "bg-[#FFDFE0] dark:bg-[#473434]",
  LONG_TEXT: "bg-[#DFFFEC] dark:bg-[#2B3B34]",
  SHORT_TEXT: "bg-[#DFFFEC] dark:bg-[#2B3B34]",
  VIDEO: "bg-[#DFFFEC] dark:bg-[#2B3B34]",
  NUMBER: "bg-[#F6FFDF] dark:bg-[#363A2C]",
  DATE: "bg-[#F6FFDF] dark:bg-[#363A2C]",
  FILE_UPLOAD: "bg-[#F6FFDF] dark:bg-[#363A2C]",
  GOOGLE_DRIVE: "bg-[#F6FFDF] dark:bg-[#363A2C]",
  CALENDLY: "bg-[#F6FFDF] dark:bg-[#363A2C]",
  WELCOME_SCREEN: "bg-[#E4DFFF] dark:bg-[#262337]",
  END_SCREEN: "bg-[#E4DFFF] dark:bg-[#262337]",
  REDIRECT_URL: "bg-[#E4DFFF] dark:bg-[#262337]",
};

const SortableItem = ({ q, index, onDelete, onSelect }) => {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: q.questionId });

  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={style}
      className="rounded-xl cursor-move"
    >
      <div className="w-full px-4 py-3 rounded-lg bg-white dark:bg-[#1A1A1E] border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden">
        <div className="flex items-center justify-between w-full gap-4">
          <button
            type="button"
            className="flex items-center gap-3 w-full text-left"
            onClick={onSelect}
          >
            {ICONS_MAP[q.type?.toUpperCase()] && (
              <div
                className={`min-w-[48px] h-8 flex items-center justify-center gap-1 px-2 rounded-md text-xs font-semibold text-white shrink-0 ${
                  ICON_BG_CLASSES[q.type?.toUpperCase()] || "bg-gray-400"
                }`}
              >
                <div>{ICONS_MAP[q.type.toUpperCase()]}</div>
                <div className="text-black dark:text-[#96949C]">
                  {index + 1}
                </div>
              </div>
            )}
            <p className="text-sm font-medium text-slate-800 dark:text-[#96949C] break-words max-w-full">
              {q.label}
              {/* {q.label?.split(" ").slice(0, 7).join(" ")}
              {q.label?.split(" ").length > 7 && " ..."} */}
            </p>
          </button>

          <button
            type="button"
            className="text-red-600 hover:text-red-700 transition-colors duration-200 shrink-0"
            onClick={onDelete}
            title="Delete"
          >
            <RiDeleteBin6Line className="text-lg" />
          </button>
        </div>
      </div>
    </div>
  );
};

const BlockContainer = ({
  blockId,
  title,
  randomization,
  randomizeQuestions,
  isEditing = false,
  editValue = "",
  onEditChange,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onDelete,
  moveBlock,
  blockIndex,
  totalBlocks,
  children,
  onRequestNewQuestion,
}) => {
  const r =
    randomization ??
    (randomizeQuestions
      ? { type: "full", subsetCount: null }
      : { type: "none", subsetCount: null });

  const hasRand = r && r.type && r.type !== "none";

  const randLabel = (() => {
    if (!hasRand) return "";
    if (r.type === "full") return "All";
    if (r.type === "subset")
      return r.subsetCount ? `Subset (${r.subsetCount})` : "Subset";
    return "Randomized";
  })();

  const toneClass =
    r.type === "subset"
      ? "bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200 border-amber-200 dark:border-amber-700"
      : "bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-700";

  const [infoOpen, setInfoOpen] = useState(false);

  const showInfo = infoOpen;

  return (
    <section className="mb-6 border p-4 rounded bg-white dark:bg-gray-900">
      <div
        className="relative group"
        onMouseLeave={() => {
          if (!infoOpen) return;
        }}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3 min-w-0">
            {isEditing ? (
              <input
                autoFocus
                value={editValue}
                onChange={(e) => onEditChange?.(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") onSaveEdit?.();
                  if (e.key === "Escape") onCancelEdit?.();
                }}
                className="text-lg font-semibold truncate bg-transparent border-b border-slate-300 dark:border-slate-600 outline-none px-1"
                placeholder="Block name"
                aria-label="Edit block name"
              />
            ) : (
              <>
                <div className="flex items-center gap-2 min-w-0">
                  <h3 className="text-lg font-semibold truncate" title={title}>
                    {title}
                  </h3>

                  <button
                    type="button"
                    onMouseEnter={() => setInfoOpen(true)}
                    onMouseLeave={() => setInfoOpen(false)}
                    className="inline-flex items-center justify-center h-6 w-6 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"
                  >
                    <FiInfo className="h-4 w-4" />
                  </button>

                  {hasRand && (
                    <div
                      className={`ml-2 inline-flex items-center gap-2 text-xs font-medium px-2 py-0.5 rounded-full border ${toneClass}`}
                      aria-hidden
                      title={randLabel}
                    >
                      <svg
                        className="w-3 h-3"
                        viewBox="0 0 20 20"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        aria-hidden
                      >
                        <path
                          d="M4 7h4l3 6h3"
                          stroke="currentColor"
                          strokeWidth="1.4"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          opacity="0.9"
                        />
                        <path
                          d="M16 7v6"
                          stroke="currentColor"
                          strokeWidth="1.4"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          opacity="0.9"
                        />
                      </svg>
                      <span className="whitespace-nowrap">
                        {r.type === "full"
                          ? "All"
                          : r.type === "subset"
                          ? r.subsetCount
                            ? `Subset (${r.subsetCount})`
                            : "Subset"
                          : "Random"}
                      </span>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            {isEditing ? (
              <>
                <button
                  type="button"
                  onClick={onSaveEdit}
                  className="inline-flex items-center justify-center h-8 w-8 rounded-md bg-green-600 hover:bg-green-700 text-white text-sm"
                  title="Save"
                  aria-label="Save block name"
                >
                  <FiCheck className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={onCancelEdit}
                  className="inline-flex items-center justify-center h-8 w-8 rounded-md bg-slate-200 dark:bg-slate-700 text-sm"
                  title="Cancel"
                  aria-label="Cancel rename"
                >
                  <FiX className="h-4 w-4" />
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => onRequestNewQuestion?.(blockId)}
                  className="inline-flex items-center justify-center h-8 w-8 rounded-md border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-[#222] text-sm"
                  title="Add new question to this block"
                  aria-label="Add question"
                >
                  <FiPlusSquare className="h-4 w-4" />
                </button>

                <button
                  type="button"
                  onClick={onStartEdit}
                  className="inline-flex items-center justify-center h-8 w-8 rounded-md border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-[#222] text-sm"
                  title="Rename block"
                  aria-label="Rename block"
                >
                  <FiEdit2 className="h-4 w-4" />
                </button>

                <button
                  type="button"
                  onClick={onDelete}
                  className="inline-flex items-center justify-center h-8 w-8 rounded-md border border-red-200 dark:border-red-700 hover:bg-red-50 dark:hover:bg-[#300] text-red-600"
                  title="Delete block"
                  aria-label="Delete block"
                >
                  <FiTrash2 className="h-4 w-4" />
                </button>
              </>
            )}

            <div className="flex flex-col ml-2">
              <button
                onClick={() => moveBlock(blockId, "up")}
                disabled={blockIndex === 0}
                className="px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-xs disabled:opacity-40"
                title="Move Up"
                aria-label="Move block up"
              >
                ↑
              </button>
              <button
                onClick={() => moveBlock(blockId, "down")}
                disabled={blockIndex === totalBlocks - 1}
                className="px-2 py-1 mt-1 rounded-md bg-slate-100 dark:bg-slate-800 text-xs disabled:opacity-40"
                title="Move Down"
                aria-label="Move block down"
              >
                ↓
              </button>
            </div>
          </div>
        </div>

        <div
          className={`absolute left-4 right-4 -bottom-0 translate-y-full transition-opacity duration-150 z-10 ${
            showInfo ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          }`}
          style={{ pointerEvents: showInfo ? "auto" : "none" }}
        >
          <div className="mx-auto w-fit bg-white dark:bg-[#0b0b0d] border border-slate-200 dark:border-slate-700 rounded-md shadow-md p-3 text-xs text-slate-600 dark:text-slate-300">
            <div className="flex items-start gap-2">
              <FiInfo className="mt-0.5 h-4 w-4 text-slate-400 dark:text-slate-400" />
              <div className="max-w-xs">
                <div className="font-medium text-sm text-slate-800 dark:text-slate-100">
                  {title}
                </div>

                {hasRand ? (
                  <div className="mt-1 text-xs">
                    <span className="font-medium">Randomization:</span>{" "}
                    <span>{randLabel}</span>
                  </div>
                ) : (
                  <div className="mt-1 text-xs text-slate-500">
                    No randomization configured
                  </div>
                )}

                <div className="mt-2 text-xs text-slate-500">
                  Tip: Use the <strong>New</strong> icon to add a question
                  directly to this block.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-2">{children}</div>
    </section>
  );
};

const SortableBlock = ({
  block,
  questions,
  onDeleteQuestion,
  onDeleteBlock,
  onSelectQuestion,
  isEditing,
  editValue,
  onEditChange,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  moveBlock,
  blockIndex,
  totalBlocks,
  activeId,
  handleAddPageBreak,
  handleRemovePageBreak,
  onRequestNewQuestion, // forwarded
}) => {
  return (
    <BlockContainer
      blockId={block.blockId}
      title={block.name}
      randomization={block.randomization}
      randomizeQuestions={block.randomization?.type !== "none" ? true : false}
      isEditing={isEditing}
      editValue={editValue}
      onEditChange={onEditChange}
      onStartEdit={() => onStartEdit(block)}
      onSaveEdit={() => onSaveEdit(block.blockId)}
      onCancelEdit={onCancelEdit}
      onDelete={() => onDeleteBlock(block.blockId)}
      moveBlock={moveBlock}
      blockIndex={blockIndex}
      totalBlocks={totalBlocks}
      onRequestNewQuestion={onRequestNewQuestion}
    >
      <Droppable id={block.blockId}>
        <SortableContext
          items={block.questionOrder || []}
          strategy={verticalListSortingStrategy}
        >
          {(() => {
            let visibleQIndex = 0;
            return (questions || []).map((item, idx) => {
              if (item && item.__isPageBreak) {
                return (
                  <div
                    key={item.questionId}
                    className="my-3 text-center relative group"
                  >
                    <div className="border-t border-dashed border-gray-400 dark:border-gray-600 mb-2" />
                    <div className="text-xs text-gray-500 uppercase tracking-wider">
                      Page Break
                    </div>
                    <button
                      className="absolute top-1/2 right-2 -translate-y-1/2 text-red-500 text-xs opacity-0 group-hover:opacity-100 transition"
                      onClick={() =>
                        handleRemovePageBreak(block.blockId, item.questionId)
                      }
                    >
                      ✕
                    </button>
                  </div>
                );
              }

              if (!item) return null;

              const displayIndex = visibleQIndex;
              visibleQIndex += 1;

              return (
                <React.Fragment key={item.questionId}>
                  <SortableItem
                    q={item}
                    index={displayIndex}
                    onDelete={() => onDeleteQuestion(item.questionId)}
                    onSelect={() => onSelectQuestion(item.questionId)}
                    isDragging={activeId === item.questionId}
                  />

                  <div className="text-center mt-2 mb-4">
                    <button
                      onClick={() =>
                        handleAddPageBreak(block.blockId, displayIndex)
                      }
                      className="text-xs text-blue-500 hover:underline"
                    >
                      + Add Page Break
                    </button>
                  </div>
                </React.Fragment>
              );
            });
          })()}

          {(!questions || questions.length === 0) && (
            <div className="text-xs text-slate-400 py-2 text-center">
              Drop questions here
            </div>
          )}
        </SortableContext>
      </Droppable>
    </BlockContainer>
  );
};

const Droppable = ({ id, children }) => {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={isOver ? "ring-2 ring-blue-400 rounded-md" : ""}
      style={{ minHeight: 12 }}
    >
      {children}
    </div>
  );
};

const DraggableQuestionsList = ({
  questions,
  blocks,
  setSelectedQuestionIndex,
  onBlocksChange,
  selectedBlockId,
  onRequestNewQuestion, // NEW prop from QuestionsTab/Dist
}) => {
  const pathname = usePathname();
  const pathParts = pathname.split("/");
  const orgId = pathParts[3];
  const surveyId = pathParts[7];
  const scrollRef = useRef(null);
  const { updateSurvey } = useSurvey();
  const { deleteQuestion } = useQuestion();
  const [renderBlocks, setRenderBlocks] = useState(blocks || []);
  const [byBlock, setByBlock] = useState({});
  const [activeId, setActiveId] = useState(null);

  const [renamingBlockId, setRenamingBlockId] = useState(null);
  const [renameValue, setRenameValue] = useState("");

  const qIndex = useMemo(() => {
    const idx = new Map();
    (questions || []).forEach((q) => idx.set(q.questionId, q));
    return idx;
  }, [questions]);

  const isPB = (id) => typeof id === "string" && id.startsWith("PB-");

  const normalizeOrder = (order = []) => {
    const out = [];
    let prevWasPB = false;
    const seenPB = new Set();

    for (const id of order) {
      if (!id) continue;
      const pb = isPB(id);
      if (pb) {
        if (prevWasPB) continue;
        if (seenPB.has(id)) continue;
        out.push(id);
        prevWasPB = true;
        seenPB.add(id);
      } else {
        out.push(id);
        prevWasPB = false;
      }
    }

    while (out.length && isPB(out[0])) out.shift();
    while (out.length && isPB(out[out.length - 1])) out.pop();

    return out;
  };

  const insertionIndexFromDisplayIndex = (questionOrder = [], displayIndex) => {
    if (displayIndex == null) return questionOrder.length;
    let visibleCount = -1;
    for (let i = 0; i < questionOrder.length; i++) {
      const id = questionOrder[i];
      if (!isPB(id)) {
        visibleCount += 1;
        if (visibleCount === displayIndex) {
          return i + 1;
        }
      }
    }
    return questionOrder.length;
  };

  const makePB = () => `PB-${Date.now()}-${Math.floor(Math.random() * 9999)}`;

  useEffect(() => {
    const next = Array.isArray(blocks) ? blocks : [];
    if (next === renderBlocks) return;
    setRenderBlocks(next);
  }, [blocks]);

  useEffect(() => {
    const next = {};
    (renderBlocks || []).forEach((b) => {
      const normalizedOrder = normalizeOrder(b.questionOrder || []);
      const blockQuestions = normalizedOrder
        .map((qid) => {
          if (isPB(qid)) return { questionId: qid, __isPageBreak: true };
          return qIndex.get(qid) || null;
        })
        .filter(Boolean);
      next[b.blockId] = blockQuestions;
    });
    setByBlock(next);
  }, [renderBlocks, qIndex]);

  const persistBlocks = async (newBlocks) => {
    try {
      const cleanedBlocks = (newBlocks || []).map((b) => ({
        ...b,
        questionOrder: normalizeOrder(b.questionOrder || []),
      }));

      const blockOrder = cleanedBlocks.map((b) => b.blockId);
      await updateSurvey(orgId, surveyId, {
        blocks: cleanedBlocks,
        blockOrder,
      });
      onBlocksChange?.(cleanedBlocks);
    } catch (e) {
      console.error("Failed to update blocks", e);
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 1 } })
  );

  const findContainerOfQuestion = (questionId) => {
    for (const [bid, arr] of Object.entries(byBlock)) {
      if (arr.some((q) => q.questionId === questionId)) return bid;
    }
    return null;
  };

  const handleDragStart = (evt) => setActiveId(evt.active.id);

  const handleDragEnd = async (evt) => {
    const { active, over } = evt;
    setActiveId(null);
    if (!over) return;
    const activeIdLocal = active.id;
    const overId = over.id;
    const fromBlockId = findContainerOfQuestion(activeIdLocal);
    if (!fromBlockId) return;
    const toBlockId = findContainerOfQuestion(overId) || overId;
    if (!toBlockId) return;

    if (fromBlockId === toBlockId) {
      const oldIndex = byBlock[fromBlockId].findIndex(
        (q) => q.questionId === activeIdLocal
      );
      const newIndex = byBlock[toBlockId].findIndex(
        (q) => q.questionId === overId
      );
      if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;

      const reordered = arrayMove(byBlock[fromBlockId], oldIndex, newIndex);
      const next = { ...byBlock, [fromBlockId]: reordered };
      setByBlock(next);

      const newBlocks = renderBlocks.map((b) => ({
        ...b,
        questionOrder: (next[b.blockId] || []).map((q) => q.questionId),
      }));
      setRenderBlocks(newBlocks);
      await persistBlocks(newBlocks);
      return;
    }

    const fromArr = byBlock[fromBlockId];
    const toArr = byBlock[toBlockId] || [];
    const moving = fromArr.find((q) => q.questionId === activeIdLocal);
    if (!moving) return;

    const targetIndex = (() => {
      const overIdx = toArr.findIndex((q) => q.questionId === overId);
      return overIdx === -1 ? toArr.length : overIdx;
    })();

    const next = {
      ...byBlock,
      [fromBlockId]: fromArr.filter((q) => q.questionId !== activeIdLocal),
      [toBlockId]: [
        ...toArr.slice(0, targetIndex),
        moving,
        ...toArr.slice(targetIndex),
      ],
    };

    setByBlock(next);

    const newBlocks = renderBlocks.map((b) => ({
      ...b,
      questionOrder: (next[b.blockId] || []).map((q) => q.questionId),
    }));

    await persistBlocks(newBlocks);
  };

  const handleDragOver = (evt) => {
    const { active, over } = evt;
    if (!over) return;

    const activeIdLocal = active.id;
    const overId = over.id;

    const fromBlockId = findContainerOfQuestion(activeIdLocal);
    const toBlockId = findContainerOfQuestion(overId) || overId;

    if (!fromBlockId || !toBlockId || fromBlockId === toBlockId) return;

    const fromArr = byBlock[fromBlockId] || [];
    const toArr = byBlock[toBlockId] || [];

    const moving = fromArr.find((q) => q.questionId === activeIdLocal);
    if (!moving) return;

    const overIdx = toArr.findIndex((q) => q?.questionId === overId);
    const targetIndex = overIdx === -1 ? toArr.length : overIdx;

    const next = {
      ...byBlock,
      [fromBlockId]: fromArr.filter((q) => q.questionId !== activeIdLocal),
      [toBlockId]: [
        ...toArr.slice(0, targetIndex),
        moving,
        ...toArr.slice(targetIndex),
      ],
    };

    setByBlock(next);

    const newBlocks = renderBlocks.map((b) => ({
      ...b,
      questionOrder: (next[b.blockId] || []).map((q) => q.questionId),
    }));
    setRenderBlocks(newBlocks);
  };

  const handleAddPageBreak = async (blockId, displayIndex) => {
    const newBlocks = renderBlocks.map((b) => {
      if (b.blockId !== blockId) return b;

      const currentOrder = Array.isArray(b.questionOrder)
        ? [...b.questionOrder]
        : [];
      const insertAt = insertionIndexFromDisplayIndex(
        currentOrder,
        displayIndex
      );
      const pbId = makePB();

      currentOrder.splice(insertAt, 0, pbId);

      const normalized = normalizeOrder(currentOrder);
      return { ...b, questionOrder: normalized };
    });

    setRenderBlocks(newBlocks);
    onBlocksChange?.(newBlocks);

    await persistBlocks(newBlocks);
  };

  const handleRemovePageBreak = async (blockId, breakId) => {
    const newBlocks = renderBlocks.map((b) =>
      b.blockId === blockId
        ? {
            ...b,
            questionOrder: normalizeOrder(
              (b.questionOrder || []).filter((id) => id !== breakId)
            ),
          }
        : b
    );

    setRenderBlocks(newBlocks);
    onBlocksChange?.(newBlocks);

    await persistBlocks(newBlocks);
  };

  const handleDeleteQuestion = async (questionId) => {
    const confirmDelete = window.confirm("Delete this question?");
    if (!confirmDelete) return;

    const srcBlock = findContainerOfQuestion(questionId);
    if (!srcBlock) return;

    const updatedByBlock = {
      ...byBlock,
      [srcBlock]: byBlock[srcBlock].filter((q) => q.questionId !== questionId),
    };
    setByBlock(updatedByBlock);

    const newBlocks = renderBlocks.map((b) => ({
      ...b,
      questionOrder: (updatedByBlock[b.blockId] || []).map((q) => q.questionId),
    }));

    const updatedQuestionOrder = (questions || [])
      .filter((q) => q.questionId !== questionId)
      .map((q) => q.questionId);

    try {
      await deleteQuestion(orgId, surveyId, questionId);

      const blockOrder = newBlocks.map((b) => b.blockId);
      await updateSurvey(orgId, surveyId, {
        blocks: newBlocks,
        blockOrder,
        questionOrder: updatedQuestionOrder,
      });

      onBlocksChange?.(newBlocks);
      setSelectedQuestionIndex?.(null);
    } catch (e) {
      console.error("Failed to delete question", e);
      alert("Error deleting question. Please try again.");
    }
  };

  const handleDeleteBlock = async (blockId) => {
    if (!Array.isArray(renderBlocks)) return;

    const block = renderBlocks.find((b) => b.blockId === blockId);
    if (!block) return;

    const confirmDelete = window.confirm(
      `Delete block "${block.name}" and all questions inside it?`
    );
    if (!confirmDelete) return;

    const newBlocks = renderBlocks.filter((b) => b.blockId !== blockId);

    const blockQuestionIds = (block.questionOrder || []).filter(Boolean);
    const updatedQuestions = (questions || []).filter(
      (q) => !blockQuestionIds.includes(q.questionId)
    );

    const newByBlock = {};
    newBlocks.forEach((b) => {
      const arr = (b.questionOrder || [])
        .map((qid) => {
          if (typeof qid === "string" && qid.startsWith("PB-")) {
            return { questionId: qid, __isPageBreak: true };
          }
          return updatedQuestions.find((qq) => qq.questionId === qid);
        })
        .filter(Boolean);
      newByBlock[b.blockId] = arr;
    });

    setRenderBlocks(newBlocks);
    setByBlock(newByBlock);

    try {
      const blockOrder = newBlocks.map((b) => b.blockId);
      const questionOrder = updatedQuestions.map((q) => q.questionId);

      await updateSurvey(orgId, surveyId, {
        blocks: newBlocks,
        blockOrder,
        questionOrder,
      });

      onBlocksChange?.(newBlocks);
    } catch (err) {
      console.error("Failed to delete block and its questions", err);
    }
  };

  const moveBlock = async (blockId, direction) => {
    const index = renderBlocks.findIndex((b) => b.blockId === blockId);
    if (index === -1) return;

    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= renderBlocks.length) return;

    const newBlocks = [...renderBlocks];
    [newBlocks[index], newBlocks[newIndex]] = [
      newBlocks[newIndex],
      newBlocks[index],
    ];

    setRenderBlocks(newBlocks);

    try {
      const blockOrder = newBlocks.map((b) => b.blockId);
      await updateSurvey(orgId, surveyId, { blocks: newBlocks, blockOrder });
    } catch (e) {
      console.error("Failed to persist block order", e);
    }

    onBlocksChange?.(newBlocks);
  };

  const startRename = (block) => {
    setRenamingBlockId(block.blockId);
    setRenameValue(block.name || "");
  };
  const cancelRename = () => {
    setRenamingBlockId(null);
    setRenameValue("");
  };
  const saveRename = async (blockId) => {
    const trimmed = (renameValue || "").trim();
    if (!trimmed) return cancelRename();

    const newBlocks = renderBlocks.map((b) =>
      b.blockId === blockId ? { ...b, name: trimmed } : b
    );
    setRenderBlocks(newBlocks);
    await persistBlocks(newBlocks);
    cancelRename();
  };

  return (
    <div ref={scrollRef} className="rounded-lg dark:bg-[#1A1A1E]  p-0.5">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        {renderBlocks.map((block) => (
          <SortableBlock
            key={block.blockId}
            block={block}
            questions={byBlock[block.blockId] || []}
            onDeleteQuestion={handleDeleteQuestion}
            onDeleteBlock={handleDeleteBlock}
            onSelectQuestion={setSelectedQuestionIndex}
            isEditing={renamingBlockId === block.blockId}
            editValue={renameValue}
            onEditChange={setRenameValue}
            onStartEdit={startRename}
            onSaveEdit={saveRename}
            onCancelEdit={cancelRename}
            moveBlock={moveBlock}
            blockIndex={renderBlocks.findIndex(
              (b) => b.blockId === block.blockId
            )}
            totalBlocks={renderBlocks.length}
            activeId={activeId}
            handleAddPageBreak={handleAddPageBreak}
            handleRemovePageBreak={handleRemovePageBreak}
            onRequestNewQuestion={onRequestNewQuestion}
          />
        ))}

        <DragOverlay>
          {activeId
            ? (() => {
                const movingQ = Object.values(byBlock)
                  .flat()
                  .find((q) => q.questionId === activeId);
                return movingQ ? (
                  <div className="w-full px-4 py-3 rounded-lg bg-blue-100 dark:bg-blue-900 shadow-lg">
                    {movingQ.__isPageBreak ? "Page Break" : movingQ.label}
                  </div>
                ) : null;
              })()
            : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
};

export default DraggableQuestionsList;
