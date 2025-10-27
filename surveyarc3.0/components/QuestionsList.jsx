"use client";
import React, { useState, useEffect, useMemo, useRef } from "react";
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
import { FiEdit2, FiCheck, FiX, FiTrash2 } from "react-icons/fi";

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
              {q.label?.split(" ").slice(0, 7).join(" ")}
              {q.label?.split(" ").length > 7 && " ..."}
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
}) => {
  return (
    <div className="mb-6 border p-4 rounded bg-white dark:bg-gray-900">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {isEditing ? (
            <input
              autoFocus
              value={editValue}
              onChange={(e) => onEditChange?.(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onSaveEdit?.();
                if (e.key === "Escape") onCancelEdit?.();
              }}
              className="text-xl font-semibold capitalize bg-transparent border-b border-slate-300 dark:border-slate-600 outline-none px-1"
              placeholder="Block name"
            />
          ) : (
            <h3 className="text-xl font-semibold capitalize">
              {title} {randomizeQuestions == true ? "🔀" : ""}
            </h3>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isEditing ? (
            <>
              <button
                type="button"
                onClick={onSaveEdit}
                className="inline-flex items-center gap-1 rounded-md bg-green-600 hover:bg-green-700 text-white text-xs font-medium px-2 py-1"
                title="Save"
              >
                <FiCheck className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={onCancelEdit}
                className="inline-flex items-center gap-1 rounded-md bg-slate-200 dark:bg-slate-700 text-xs font-medium px-2 py-1"
                title="Cancel"
              >
                <FiX className="h-4 w-4" />
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={onStartEdit}
                className="inline-flex items-center gap-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1A1A1E] text-xs px-2 py-1 hover:bg-slate-50 dark:hover:bg-[#222]"
                title="Rename block"
              >
                <FiEdit2 className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={onDelete}
                className="inline-flex items-center gap-1 rounded-md border border-red-200 dark:border-red-700 bg-white dark:bg-[#1A1A1E] text-xs px-2 py-1 text-red-600 hover:bg-red-50 dark:hover:bg-[#300]"
                title="Delete block"
              >
                <FiTrash2 className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => moveBlock(blockId, "up")}
            disabled={blockIndex === 0}
            className="px-2 py-1 bg-slate-200 rounded"
            title="Move Up"
          >
            ↑
          </button>
          <button
            onClick={() => moveBlock(blockId, "down")}
            disabled={blockIndex === totalBlocks - 1}
            className="px-2 py-1 bg-slate-200 rounded"
            title="Move Down"
          >
            ↓
          </button>
        </div>
      </div>
      {children}
    </div>
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
}) => {
  return (
    <BlockContainer
      blockId={block.blockId}
      title={block.name}
      randomizeQuestions={block.randomization.type !== "none" ? true : false}
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
    >
      <Droppable id={block.blockId}>
        <SortableContext
          items={block.questionOrder || []}
          strategy={verticalListSortingStrategy}
        >
          {(block.questionOrder || []).map((qid, index) => {
            // if the ID is a page break, render special divider
            if (qid.startsWith("PB-")) {
              return (
                <div key={qid} className="my-3 text-center relative group">
                  <div className="border-t border-dashed border-gray-400 dark:border-gray-600 mb-2" />
                  <div className="text-xs text-gray-500 uppercase tracking-wider">
                    Page Break
                  </div>
                  <button
                    className="absolute top-1/2 right-2 -translate-y-1/2 text-red-500 text-xs opacity-0 group-hover:opacity-100 transition"
                    onClick={() => handleRemovePageBreak(block.blockId, qid)}
                  >
                    ✕
                  </button>
                </div>
              );
            }

            // normal question
            const q = questions.find((qq) => qq.questionId === qid);
            if (!q) return null;

            return (
              <React.Fragment key={q.questionId}>
                <SortableItem
                  q={q}
                  index={index}
                  onDelete={() => onDeleteQuestion(q.questionId)}
                  onSelect={() => onSelectQuestion(q.questionId)}
                  isDragging={activeId === q.questionId}
                />

                {/* --- Add Page Break button BELOW each question --- */}
                <div className="text-center mt-2 mb-4">
                  <button
                    onClick={() => handleAddPageBreak(block.blockId, index)}
                    className="text-xs text-blue-500 hover:underline"
                  >
                    + Add Page Break
                  </button>
                </div>
              </React.Fragment>
            );
          })}
        </SortableContext>
        {(!block.questionOrder || block.questionOrder.length === 0) && (
          <div className="text-xs text-slate-400 py-2 text-center">
            Drop questions here
          </div>
        )}
      </Droppable>
    </BlockContainer>
  );
};

// Add once near the top-level of this file
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
}) => {
  const pathname = usePathname();
  const pathParts = pathname.split("/");
  const orgId = pathParts[3];
  const surveyId = pathParts[7];
  const scrollRef = useRef(null);
  const { updateSurvey } = useSurvey();

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

  useEffect(() => {
    if (!renderBlocks.length && blocks?.length) {
      setRenderBlocks(blocks);
    }
  }, [blocks]);

  useEffect(() => {
    const next = {};
    (renderBlocks || []).forEach((b) => {
      let blockQuestions = (b.questionOrder || [])
        .map((qid) => qIndex.get(qid))
        .filter(Boolean);

      if (b.randomizationType === "randomizeQuestions") {
        blockQuestions = [...blockQuestions].sort(() => Math.random() - 0.5);
      }

      next[b.blockId] = blockQuestions;
    });
    setByBlock(next);
  }, [renderBlocks, qIndex]);



  const persistBlocks = async (newBlocks) => {
    try {
      const blockOrder = newBlocks.map((b) => b.blockId);
      await updateSurvey(orgId, surveyId, { blocks: newBlocks, blockOrder });
      onBlocksChange?.(newBlocks);
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

    const activeId = active.id;
    const overId = over.id;

    const fromBlockId = findContainerOfQuestion(activeId);
    if (!fromBlockId) return;

    const toBlockId = findContainerOfQuestion(overId) || overId;
    if (!toBlockId) return;

    if (fromBlockId === toBlockId) {
      const oldIndex = byBlock[fromBlockId].findIndex(
        (q) => q.questionId === activeId
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

    // Moving across blocks
    const fromArr = byBlock[fromBlockId];
    const toArr = byBlock[toBlockId] || [];
    const moving = fromArr.find((q) => q.questionId === activeId);
    if (!moving) return;

    const targetIndex = (() => {
      const overIdx = toArr.findIndex((q) => q.questionId === overId);
      return overIdx === -1 ? toArr.length : overIdx;
    })();

    const next = {
      ...byBlock,
      [fromBlockId]: fromArr.filter((q) => q.questionId !== activeId),
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

  const activeId = active.id; // question id
  const overId = over.id;     // could be question id or block id

  const fromBlockId = findContainerOfQuestion(activeId);
  const toBlockId = findContainerOfQuestion(overId) || overId; // if over a block container

  if (!fromBlockId || !toBlockId || fromBlockId === toBlockId) return;

  const fromArr = byBlock[fromBlockId] || [];
  const toArr = byBlock[toBlockId] || [];

  const moving = fromArr.find((q) => q.questionId === activeId);
  if (!moving) return;

  // where in target?
  const overIdx =
    toArr.findIndex((q) => q?.questionId === overId) // if over a question
  const targetIndex = overIdx === -1 ? toArr.length : overIdx;

  const next = {
    ...byBlock,
    [fromBlockId]: fromArr.filter((q) => q.questionId !== activeId),
    [toBlockId]: [
      ...toArr.slice(0, targetIndex),
      moving,
      ...toArr.slice(targetIndex),
    ],
  };

  setByBlock(next);

  // keep SortableContext `items` (questionOrder) in sync immediately
  const newBlocks = renderBlocks.map((b) => ({
    ...b,
    questionOrder: (next[b.blockId] || []).map((q) => q.questionId),
  }));
  setRenderBlocks(newBlocks);
};


  // --- Page Break Handlers ---
  const handleAddPageBreak = async (blockId, index) => {
    const newBlocks = renderBlocks.map((b) => {
      if (b.blockId !== blockId) return b;
      const newOrder = [...(b.questionOrder || [])];
      newOrder.splice(index + 1, 0, `PB-${Date.now()}`);
      return { ...b, questionOrder: newOrder };
    });

    setRenderBlocks(newBlocks);
    onBlocksChange?.(newBlocks);

    // ✅ persist to DB
    await persistBlocks(newBlocks);
  };

  const handleRemovePageBreak = async (blockId, breakId) => {
    const newBlocks = renderBlocks.map((b) =>
      b.blockId === blockId
        ? {
            ...b,
            questionOrder: (b.questionOrder || []).filter(
              (id) => id !== breakId
            ),
          }
        : b
    );

    setRenderBlocks(newBlocks);
    onBlocksChange?.(newBlocks);

    // ✅ persist to DB
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
      const blockOrder = newBlocks.map((b) => b.blockId);
      await updateSurvey(orgId, surveyId, {
        blocks: newBlocks,
        blockOrder,
        questionOrder: updatedQuestionOrder,
      });
      onBlocksChange?.(newBlocks);
    } catch (e) {
      console.error("Failed to delete question", e);
    }

    setSelectedQuestionIndex?.(null);
  };

  const handleDeleteBlock = async (blockId) => {
    const block = renderBlocks.find((b) => b.blockId === blockId);
    if (!block) return;

    const confirmDelete = window.confirm(
      `Delete block "${block.name}"? Questions inside will be moved to 'Unassigned'.`
    );
    if (!confirmDelete) return;

    const qIds = block.questionOrder || [];
    let newBlocks = renderBlocks.filter((b) => b.blockId !== blockId);

    if (qIds.length > 0) {
      let unassigned = newBlocks.find(
        (b) =>
          (b.name || "").toLowerCase() === "unassigned" ||
          b.blockId === "unassigned"
      );

      if (unassigned) {
        unassigned = {
          ...unassigned,
          questionOrder: [
            ...new Set([...(unassigned.questionOrder || []), ...qIds]),
          ],
        };
        newBlocks = newBlocks.map((b) =>
          b.blockId === unassigned.blockId ? unassigned : b
        );
      } else {
        const newUnassigned = {
          blockId: `unassigned_${Date.now()}`,
          name: "Unassigned",
          questionOrder: [...qIds],
        };
        newBlocks = [...newBlocks, newUnassigned];
      }
    }

    const newByBlock = {};
    newBlocks.forEach((b) => {
      newByBlock[b.blockId] = (b.questionOrder || [])
        .map((qid) => qIndex.get(qid))
        .filter(Boolean);
    });

    setRenderBlocks(newBlocks);
    setByBlock(newByBlock);
    await persistBlocks(newBlocks);
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
    <div ref={scrollRef} className="rounded-lg mt-8 dark:bg-[#1A1A1E] pb-0.5">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        // collisionDetection={rectIntersection}
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
                    {movingQ.label}
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
