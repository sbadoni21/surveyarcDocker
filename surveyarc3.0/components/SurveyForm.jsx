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

  // derive blocksWithQuestions from incoming props initially and when props change
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
    // reset navigation positions when blocks or questions change
    setCurrentBlockIndex(0);
    setCurrentPageIndex(0);
    setJumpToQuestion(null);
  }, [blocks, questions]);

  // Helper: compute pages for the currentBlock from its questionOrder
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

  // EFFECT: evaluate rules whenever answers change, compute pendingActions,
  // and synchronously prepare sets of skipped questions/blocks but DO NOT navigate here.
  useEffect(() => {
    if (!Object.keys(answers).length) {
      setPendingActions([]);
      return;
    }

    const actions = ruleEngine.evaluate(answers) || [];
    setPendingActions(actions);

    // Build skip sets to apply eagerly to blocksWithQuestions so UI hides skipped items immediately
    const skipQuestionIds = new Set();
    const skipBlockIds = new Set();

    actions.forEach((action) => {
      if (action?.type === "skip_questions" && Array.isArray(action.questionIds)) {
        action.questionIds.forEach((id) => skipQuestionIds.add(id));
      }
      if (action?.type === "skip_block" && Array.isArray(action.blockIds)) {
        action.blockIds.forEach((id) => skipBlockIds.add(id));
      }
    });

    if (skipQuestionIds.size === 0 && skipBlockIds.size === 0) {
      return;
    }

    // Apply skips synchronously using updater
    setBlocksWithQuestions((prev) => {
      // remove blocked blocks first
      const filtered = prev.filter((b) => !skipBlockIds.has(b.blockId));

      // remove skipped questions from each remaining block (both questionOrder and questions)
      const updated = filtered.map((b) => {
        const qOrder =
          Array.isArray(b.questionOrder) && b.questionOrder.length
            ? b.questionOrder
            : (b.questions || []).map((q) => q.questionId);

        const newQuestionOrder = qOrder.filter((qid) => !skipQuestionIds.has(qid));
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

    // If current block was removed, clamp the index (updater form)
    setCurrentBlockIndex((prev) => Math.max(0, Math.min(prev, Math.max(0, blocksWithQuestions.length - 1))));
    // keep page index in-bounds: an effect below will clamp if needed
  }, [answers, ruleEngine]);

  // Ensure currentPageIndex is in bounds when pages change
  useEffect(() => {
    if (blockPages.length && currentPageIndex >= blockPages.length) {
      setCurrentPageIndex(Math.max(0, blockPages.length - 1));
    }
  }, [blockPages, currentPageIndex]);

  // When the current page has zero questions, auto-advance (this handles empty pages after skips)
  useEffect(() => {
    if (!currentBlock || !blockPages.length) return;

    const currentPageQuestions = blockPages[currentPageIndex] || [];
    if (currentPageQuestions.length === 0) {
      if (currentPageIndex < blockPages.length - 1) {
        setCurrentPageIndex((prev) => prev + 1);
      } else {
        // page empty and last page in this block, try moving to next block
        if (currentBlockIndex < blocksWithQuestions.length - 1) {
          setCurrentBlockIndex((prev) => prev + 1);
          setCurrentPageIndex(0);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blockPages, currentPageIndex, currentBlock, blocksWithQuestions]);

  const handleChange = (questionId, value) => {
    const questionType = questions.find((q) => q.questionId === questionId)?.type;

    const finalValue = ["number", "rating", "opinion_scale", "nps"].includes(
      questionType
    )
      ? Number(value)
      : value;

    setAnswers((prev) => {
      return { ...prev, [questionId]: finalValue };
    });
  };

  const isLastBlock = currentBlockIndex === blocksWithQuestions.length - 1;

  // Improved handleNextBlock: build updatedBlocks locally and decide navigation based on that
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
          (Array.isArray(action.blockIds) ? action.blockIds : []).forEach((id) =>
            skipBlockIds.add(id)
          );
          break;
        case "skip_questions":
          (Array.isArray(action.questionIds) ? action.questionIds : []).forEach((id) =>
            skipQuestionIds.add(id)
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
        case "set_variable":
        case "calculate":
          // preserve original behavior if you plan to implement variables/calculations
          break;
        default:
          console.warn("Unknown action type:", action.type);
      }
    });

    if (messageToShow) alert(messageToShow);
    if (shouldEnd) {
      handleSubmit(answers);
      return;
    }

    // Build updated blocks synchronously (local) so decisions are made from the new structure
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

    // If goto is requested, resolve indices and set jump
    if (gotoTargetBlock || gotoTargetQuestion) {
      let targetBlockIndex = currentBlockIndex;
      if (gotoTargetBlock) {
        const idx = updatedBlocks.findIndex((b) => b.blockId === gotoTargetBlock);
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

      // Commit updates and move
      setBlocksWithQuestions(updatedBlocks);
      setCurrentBlockIndex(Math.min(targetBlockIndex, Math.max(0, updatedBlocks.length - 1)));
      setCurrentPageIndex(0);
      setPendingActions([]);
      return;
    }

    // If no goto, commit updatedBlocks and proceed
    setBlocksWithQuestions(updatedBlocks);

    if (!isLastPage) {
      setCurrentPageIndex((prev) => prev + 1);
      setJumpToQuestion(null);
      setPendingActions([]);
      return;
    }

    // find next non-empty block after the currentBlockIndex
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
      // nothing left — submit
      handleSubmit(answers);
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

  const questionsToShow = (blockPages[currentPageIndex] || []).filter((q) => {
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

  return (
    <div className="h-screen dark:bg-[#121214] lg:bg-white transition-colors lg:flex lg:items-center lg:justify-center duration-300">
      <div className="w-full lg:container lg:mx-auto px-4 py-8">
        <div className="lg:max-w-2xl lg:mx-auto max-h-screen lg:h-full">
          <div className="lg:bg-white lg:rounded-3xl lg:shadow-2xl overflow-hidden lg:border-2 border-yellow-400 dark:border-0 shadow-orange-200/50 dark:shadow-orange-900/20 flex flex-col max-h-[90vh]">
            <div className="lg:p-8 bg-orange-500 p-4 dark:bg-[#1A1A1E] dark:border-b dark:border-[#96949C]">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 lg:p-3 bg-white/20 rounded-xl">
                  <FileText
                    className="text-white dark:text-[#CD7323]"
                    size={24}
                  />
                </div>
                <p className="text-xl lg:text-3xl font-bold text-white">
                  Survey ARC
                </p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-8 lg:px-8 bg-white dark:bg-[#1A1A1E]">
              {questionsToShow.map((question, idx) => (
                <div key={question.questionId} className="mb-8">
                  {!["end_screen", "welcome_screen"].includes(question.type) && (
                    <p className="text-sm lg:text-2xl font-semibold mb-6 text-gray-800 dark:text-[#CBC9DE]">
                      {idx + 1}. {question.label}
                    </p>
                  )}
                  <RenderQuestion
                    question={question}
                    value={answers[question.questionId] ?? ""}
                    onChange={(value) => handleChange(question.questionId, value)}
                    config={question.config || defaultConfigMap[question.type] || {}}
                    inputClasses={getInputClasses()}
                  />
                </div>
              ))}
            </div>

            <div className="px-4 py-4 lg:px-8 flex justify-end bg-white dark:bg-[#1A1A1E]">
              {isLastBlock ? (
                <button
                  onClick={async () => {
                    if (
                      window.confirm(
                        "Are you sure you want to submit your responses?"
                      )
                    ) {
                      try {
                        setSubmitting(true);
                        await handleSubmit(answers);
                      } finally {
                        setSubmitting(false);
                      }
                    }
                  }}
                  disabled={submitting}
                  className={`flex items-center  text-sm lg:text-lg gap-2 px-12 py-2 lg:px-8 lg:py-3 rounded-xl font-medium lg:font-semibold transition-all duration-200 transform ${
                    submitting
                      ? "opacity-70 cursor-not-allowed"
                      : "hover:scale-105"
                  } shadow-lg bg-gradient-to-r from-green-400 to-green-500 dark:from-green-500 dark:to-green-600 text-white`}
                >
                  {submitting ? (
                    <>
                      <svg
                        className="animate-spin h-5 w-5 text-white"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                        ></path>
                      </svg>
                      Submitting…
                    </>
                  ) : (
                    "Submit"
                  )}
                </button>
              ) : (
                <>
                  <button
                    onClick={handleNextBlock}
                    className="flex items-center justify-end w-fit text-sm lg:text-lg gap-2 px-12 py-2 lg:px-8 lg:py-3 rounded-xl font-medium lg:font-semibold transition-all duration-200 transform hover:scale-105 shadow-lg bg-gradient-to-r from-orange-400 to-orange-500 dark:from-orange-500 dark:to-orange-600 text-white"
                  >
                    Next
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
