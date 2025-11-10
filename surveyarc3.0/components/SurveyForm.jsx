"use client";
import { useState, useMemo, useEffect } from "react";
import defaultConfigMap from "@/enums/defaultConfigs";
import { FileText } from "lucide-react";
import RenderQuestion from "./AnswerUI";
import RuleEngine from "./RulesEngine";

export default function SurveyForm({
  questions = [],
  blocks = [],
  handleSubmit,
  rules,
}) {
  const [currentBlockIndex, setCurrentBlockIndex] = useState(0);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [pendingActions, setPendingActions] = useState([]);
  const [jumpToQuestion, setJumpToQuestion] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const ruleEngine = useMemo(() => new RuleEngine(rules), [rules]);

  const [blocksWithQuestions, setBlocksWithQuestions] = useState(() =>
    (blocks || [])
      .map((block) => ({
        ...block,
        questions: (block.questionOrder || [])
          .map((id) => questions.find((q) => q.questionId === id))
          .filter(Boolean),
      }))
      .filter(
        (block) =>
          block.questions.length > 0 && !block.blockId.startsWith("unassigned_")
      )
  );

  useEffect(() => {
    setBlocksWithQuestions(
      (blocks || [])
        .map((block) => ({
          ...block,
          questions: (block.questionOrder || [])
            .map((id) => questions.find((q) => q.questionId === id))
            .filter(Boolean),
        }))
        .filter(
          (block) =>
            block.questions.length > 0 &&
            !block.blockId.startsWith("unassigned_")
        )
    );
    setCurrentBlockIndex(0);
    setCurrentPageIndex(0);
    setJumpToQuestion(null);
  }, [blocks, questions]);

  const currentBlock = blocksWithQuestions[currentBlockIndex];

  const blockPages = useMemo(() => {
    if (!currentBlock) return [];
    const pages = [];
    let currentPage = [];

    const qOrder = Array.isArray(currentBlock.questionOrder)
      ? currentBlock.questionOrder
      : (currentBlock.questions || []).map((q) => q.questionId);

    qOrder.forEach((qid) => {
      if (String(qid).startsWith("PB-")) {
        if (currentPage.length > 0) {
          pages.push(currentPage);
          currentPage = [];
        }
      } else {
        const question = (currentBlock.questions || []).find(
          (q) => q.questionId === qid
        );
        if (question) currentPage.push(question);
      }
    });

    if (currentPage.length > 0) pages.push(currentPage);
    return pages;
  }, [currentBlock, questions, blocksWithQuestions]);

  useEffect(() => {
    if (!Object.keys(answers).length) {
      setPendingActions([]);
      return;
    }
    const actions = ruleEngine.evaluate(answers) || [];
    setPendingActions(actions);

    const skipQuestionIds = new Set();
    const skipBlockIds = new Set();

    actions.forEach((action) => {
      if (
        action?.type === "skip_questions" &&
        Array.isArray(action.questionIds)
      ) {
        action.questionIds.forEach((id) => skipQuestionIds.add(id));
      }
      if (action?.type === "skip_block" && Array.isArray(action.blockIds)) {
        action.blockIds.forEach((id) => skipBlockIds.add(id));
      }
    });

    if (skipQuestionIds.size === 0 && skipBlockIds.size === 0) {
      return;
    }

    setBlocksWithQuestions((prev) => {
      const filtered = prev.filter((b) => !skipBlockIds.has(b.blockId));
      const updated = filtered.map((b) => {
        const qOrder =
          Array.isArray(b.questionOrder) && b.questionOrder.length
            ? b.questionOrder
            : (b.questions || []).map((q) => q.questionId);

        const newQuestionOrder = qOrder.filter(
          (qid) => !skipQuestionIds.has(qid)
        );
        const newQuestions = (b.questions || []).filter(
          (q) => !skipQuestionIds.has(q.questionId)
        );

        return {
          ...b,
          questionOrder: newQuestionOrder,
          questions: newQuestions,
        };
      });

      return updated;
    });

    setCurrentBlockIndex((prev) =>
      Math.max(0, Math.min(prev, Math.max(0, blocksWithQuestions.length - 1)))
    );
  }, [answers, ruleEngine]);

  useEffect(() => {
    if (blockPages.length && currentPageIndex >= blockPages.length) {
      setCurrentPageIndex(Math.max(0, blockPages.length - 1));
    }
  }, [blockPages, currentPageIndex]);

  useEffect(() => {
    if (!currentBlock || !blockPages.length) return;
    const currentPageQuestions = blockPages[currentPageIndex] || [];
    if (currentPageQuestions.length === 0) {
      if (currentPageIndex < blockPages.length - 1) {
        setCurrentPageIndex((prev) => prev + 1);
      } else {
        if (currentBlockIndex < blocksWithQuestions.length - 1) {
          setCurrentBlockIndex((prev) => prev + 1);
          setCurrentPageIndex(0);
        }
      }
    }
  }, [blockPages, currentPageIndex, currentBlock, blocksWithQuestions]);

  const handleChange = (questionId, value) => {
    const questionType = questions.find(
      (q) => q.questionId === questionId
    )?.type;
    const finalValue = ["number", "rating", "opinion_scale", "nps"].includes(
      questionType
    )
      ? Number(value)
      : value;
    setAnswers((prev) => ({ ...prev, [questionId]: finalValue }));
  };

  const isLastBlock = currentBlockIndex === blocksWithQuestions.length - 1;

  const handleNextBlock = () => {
    const isLastPage = currentPageIndex === blockPages.length - 1;

    const actionsArray = Array.isArray(pendingActions)
      ? pendingActions
      : pendingActions
      ? [pendingActions]
      : [];

    const skipQuestionIds = new Set();
    const skipBlockIds = new Set();
    let gotoTargetBlock = null;
    let gotoTargetQuestion = null;
    let shouldEnd = false;
    let messageToShow = null;

    actionsArray.forEach((action) => {
      if (!action) return;
      switch (action.type) {
        case "skip_block":
          (Array.isArray(action.blockIds) ? action.blockIds : []).forEach(
            (id) => skipBlockIds.add(id)
          );
          break;
        case "skip_questions":
          (Array.isArray(action.questionIds) ? action.questionIds : []).forEach(
            (id) => skipQuestionIds.add(id)
          );
          break;
        case "goto_question":
          gotoTargetQuestion = action.questionId;
          break;
        case "goto_block":
          gotoTargetBlock = action.blockId;
          break;
        case "goto_block_question":
          gotoTargetBlock = action.targetBlockId;
          gotoTargetQuestion = action.targetQuestionId;
          break;
        case "end":
          shouldEnd = true;
          break;
        case "show_message":
          messageToShow = action.message;
          break;
        default:
      }
    });

    if (messageToShow) alert(messageToShow);
    if (shouldEnd) {
      (async () => {
        setSubmitting(true);
        try {
          await handleSubmit(answers);
        } catch (err) {
          console.error("Submit error:", err);
          setSubmitting(false); 
        }
      })();
      return;
    }

    const updatedBlocks = blocksWithQuestions
      .filter((b) => !skipBlockIds.has(b.blockId))
      .map((b) => {
        const qOrder =
          Array.isArray(b.questionOrder) && b.questionOrder.length
            ? b.questionOrder
            : (b.questions || []).map((q) => q.questionId);

        const newQOrder = qOrder.filter((qid) => !skipQuestionIds.has(qid));
        const newQuestions = (b.questions || []).filter(
          (q) => !skipQuestionIds.has(q.questionId)
        );

        return {
          ...b,
          questionOrder: newQOrder,
          questions: newQuestions,
        };
      });

    if (gotoTargetBlock || gotoTargetQuestion) {
      let targetBlockIndex = currentBlockIndex;
      if (gotoTargetBlock) {
        const idx = updatedBlocks.findIndex(
          (b) => b.blockId === gotoTargetBlock
        );
        if (idx !== -1) targetBlockIndex = idx;
      }

      if (gotoTargetQuestion) {
        const targetBlock = updatedBlocks[targetBlockIndex];
        if (targetBlock) {
          const qIdx = (targetBlock.questions || []).findIndex(
            (q) => q.questionId === gotoTargetQuestion
          );
          if (qIdx !== -1) {
            setJumpToQuestion({
              blockId: targetBlock.blockId,
              questionId: gotoTargetQuestion,
            });
          } else {
            setJumpToQuestion(null);
          }
        }
      } else {
        setJumpToQuestion(null);
      }

      setBlocksWithQuestions(updatedBlocks);
      setCurrentBlockIndex(
        Math.min(targetBlockIndex, Math.max(0, updatedBlocks.length - 1))
      );
      setCurrentPageIndex(0);
      setPendingActions([]);
      return;
    }

    setBlocksWithQuestions(updatedBlocks);

    if (!isLastPage) {
      setCurrentPageIndex((prev) => prev + 1);
      setJumpToQuestion(null);
      setPendingActions([]);
      return;
    }

    let nextBlockIndex = currentBlockIndex + 1;
    while (
      nextBlockIndex < updatedBlocks.length &&
      (!updatedBlocks[nextBlockIndex] ||
        (updatedBlocks[nextBlockIndex].questions || []).length === 0)
    ) {
      nextBlockIndex++;
    }

    if (nextBlockIndex < updatedBlocks.length) {
      setCurrentBlockIndex(nextBlockIndex);
      setCurrentPageIndex(0);
      setPendingActions([]);
      setJumpToQuestion(null);
    } else {
      (async () => {
        setSubmitting(true);
        try {
          await handleSubmit(answers);
        } catch (err) {
          console.error("Submit error:", err);
          setSubmitting(false); // allow retry
        }
      })();
    }
  };

  const getInputClasses = () => `
    w-full px-3 py-2 lg:px-4 lg:py-3 rounded-xl transition-all duration-200 
    outline-none border border-[#8C8A97] font-medium
    text-gray-800 dark:text-[#CBC9DE] dark:bg-[#1A1A1E] placeholder-gray-500 dark:placeholder-[#96949C]
  `;

  if (!blocksWithQuestions.length) {
    return (
      <div className="h-screen flex items-center justify-center bg-white dark:bg-[#121214]">
        <p className="text-lg font-semibold text-gray-600 dark:text-[#CBC9DE]">
          Loading survey...
        </p>
      </div>
    );
  }

  const rawPageQuestions = blockPages[currentPageIndex] || [];
  const pageQuestions = rawPageQuestions.filter((q) => {
    if (jumpToQuestion?.blockId === currentBlock.blockId) {
      const targetIndex = currentBlock.questions.findIndex(
        (qq) => qq.questionId === jumpToQuestion.questionId
      );
      const currentIndex = currentBlock.questions.findIndex(
        (qq) => qq.questionId === q.questionId
      );
      return currentIndex >= targetIndex;
    }
    return true;
  });

  const totalPagesInBlock = blockPages.length || 1;
  const pageProgress = `${currentPageIndex + 1}/${totalPagesInBlock}`;
  const blockProgress = `${currentBlockIndex + 1}/${
    blocksWithQuestions.length
  }`;


  return (
    <div className="min-h-fit max-h-screen dark:bg-[#121214] bg-white flex flex-col relative">
      {/* ---------- Overlay while submitting ---------- */}
      {submitting && (
        <div
          className="absolute inset-0 z-50 flex items-center justify-center"
          style={{
            background: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(2px)",
          }}
        >
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-t-transparent border-white mx-auto mb-4" />
            <div className="text-white font-semibold">Submitting…</div>
          </div>
        </div>
      )}

      {/* Sticky header */}
      <header className="sticky top-0 z-30 backdrop-blur bg-orange-500/95 dark:bg-[#111111]/95 border-b border-orange-400/30 dark:border-[#222]">
        <div className="lg:max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-md">
              <FileText className="text-white dark:text-[#CD7323]" size={22} />
            </div>
            <div>
              <p className="text-lg lg:text-2xl font-bold text-white leading-tight">
                Survey ARC
              </p>
            </div>
          </div>

          <div className="text-right">
            <p className="text-sm text-white/95">Progress</p>
            <div className="w-36 h-2 bg-white/20 rounded-full overflow-hidden mt-1">
              <div
                className="h-full bg-white rounded-full transition-all duration-300"
                style={{
                  width: `${Math.round(
                    ((currentBlockIndex * totalPagesInBlock +
                      currentPageIndex +
                      1) /
                      (blocksWithQuestions.length * totalPagesInBlock)) *
                      100
                  )}%`,
                }}
              />
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-auto">
        <div className="min-h-[calc(100vh-128px)] flex flex-col items-stretch justify-start px-4 py-8">
          <div className="w-full max-w-3xl mx-auto flex-1">
            {pageQuestions.length ? (
              pageQuestions.map((question, idx) => (
                <div key={question.questionId} className="mb-8">
                  {!["end_screen", "welcome_screen"].includes(
                    question.type
                  ) && (
                    <p className="text-lg lg:text-2xl font-semibold mb-4 text-gray-800 dark:text-[#CBC9DE]">
                      {idx + 1}. {question.label}
                    </p>
                  )}
                  {question.description && (
                    <i className="mb-4 text-sm text-gray-600 dark:text-[#A0A0B0]">{question.description}</i>
                  )}
                  <RenderQuestion
                    question={question}
                    value={answers[question.questionId] ?? ""}
                    onChange={(value) =>
                      handleChange(question.questionId, value)
                    }
                    config={
                      question.config || defaultConfigMap[question.type] || {}
                    }
                    inputClasses={getInputClasses()}
                    disabled={submitting} // if your RenderQuestion supports disabled prop
                  />
                </div>
              ))
            ) : (
              <div className="text-center py-12">
                <p className="text-xl text-gray-700 dark:text-[#CFCFE0]">
                  No question to show on this page.
                </p>
              </div>
            )}
          </div>
        </div>
      </main>

      <div className="sticky bottom-0 z-40 bg-white/95 dark:bg-[#0F0F10]/95 border-t border-gray-200 dark:border-[#222]">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="text-sm text-gray-600 dark:text-[#CFCFE0]"></div>

          <div className="flex justify-center items-center w-full gap-3">
            {isLastBlock ? (
              <button
                onClick={async () => {
                  if (
                    !window.confirm(
                      "Are you sure you want to submit your responses?"
                    )
                  )
                    return;
                  // set submitting flag BEFORE calling parent's handleSubmit
                  setSubmitting(true);
                  try {
                    await handleSubmit(answers);
                    // DO NOT setSubmitting(false) here on success — parent will redirect.
                  } catch (err) {
                    console.error("Submit failed:", err);
                    // allow retry
                    setSubmitting(false);
                    alert("Submission failed. Please try again.");
                  }
                }}
                disabled={submitting}
                className={`flex items-center text-sm lg:text-lg gap-2 px-6 py-3 rounded-md font-semibold transition-transform duration-150 ${
                  submitting
                    ? "opacity-70 cursor-not-allowed"
                    : "hover:scale-105"
                } bg-gradient-to-r from-green-500 to-green-600 text-white`}
              >
                {submitting ? "Submitting…" : "Submit"}
              </button>
            ) : (
              <button
                onClick={handleNextBlock}
                className="flex items-center text-sm lg:text-lg gap-2 px-6 py-3 rounded-md font-semibold transition-transform duration-150 hover:scale-105 bg-gradient-to-r from-orange-500 to-orange-600 text-white"
                disabled={submitting}
              >
                Next
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
