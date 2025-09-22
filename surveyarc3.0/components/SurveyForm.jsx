"use client";
import { useState, useMemo } from "react";
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
  const [answers, setAnswers] = useState({});
  const [pendingActions, setPendingActions] = useState([]);
  const [jumpToQuestion, setJumpToQuestion] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const ruleEngine = useMemo(() => new RuleEngine(rules), [rules]);

  const blocksWithQuestions = blocks
  .map((block) => ({
    ...block,
    questions: (block.questionOrder || [])
      .map((id) => questions.find((q) => q.questionId === id))
      .filter(Boolean),
  }))
  .filter(
    (block) => block.questions.length > 0 && !block.blockId.startsWith("unassigned_")
  );


  const currentBlock = blocksWithQuestions[currentBlockIndex];

  const handleChange = (questionId, value) => {
    const updatedAnswers = { ...answers, [questionId]: value };
    setAnswers(updatedAnswers);

    const actions = ruleEngine.evaluate(updatedAnswers);
    setPendingActions(actions || []);
  };

  const isLastBlock = currentBlockIndex === blocksWithQuestions.length - 1;

  const handleNextBlock = () => {
    let skipBlockIds = new Set();
    let gotoTargetBlock = null;
    let gotoTargetQuestion = null;
    let shouldEnd = false;
    let messageToShow = null;
    const variablesToSet = {};
    const calculations = {};

    const actionsArray = Array.isArray(pendingActions)
      ? pendingActions
      : pendingActions
      ? [pendingActions]
      : [];

    actionsArray.forEach((action) => {
      if (!action) return;

      switch (action.type) {
        case "skip_block":
          (Array.isArray(action.blockIds) ? action.blockIds : []).forEach(
            (id) => skipBlockIds.add(id)
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
          if (action.target && action.parameters?.value !== undefined) {
            variablesToSet[action.target] = action.parameters.value;
          }
          break;

        case "calculate":
          if (action.target) {
            calculations[action.target] = action.parameters?.value;
          }
          break;

        default:
          console.warn("Unknown action type:", action.type);
      }
    });

    if (messageToShow) alert(messageToShow);
    if (Object.keys(variablesToSet).length > 0)
      console.log("Variables set:", variablesToSet);
    if (Object.keys(calculations).length > 0)
      console.log("Calculated:", calculations);

    if (shouldEnd) {
      handleSubmit(answers);
      return;
    }

    if (gotoTargetBlock || gotoTargetQuestion) {
      let targetBlockIndex = currentBlockIndex;

      if (gotoTargetBlock) {
        const idx = blocksWithQuestions.findIndex(
          (b) => b.blockId === gotoTargetBlock
        );
        if (idx !== -1) targetBlockIndex = idx;
      }

      if (gotoTargetQuestion) {
        const targetBlock = blocksWithQuestions[targetBlockIndex];
        const questionIdx = targetBlock.questions.findIndex(
          (q) => q.questionId === gotoTargetQuestion
        );
        if (questionIdx !== -1) {
          setJumpToQuestion({
            blockId: targetBlock.blockId,
            questionId: gotoTargetQuestion,
          });
        }
      }

      setCurrentBlockIndex(targetBlockIndex);
      setPendingActions([]);
      return;
    }

    let nextBlockIndex = currentBlockIndex + 1;
    while (nextBlockIndex < blocksWithQuestions.length) {
      if (skipBlockIds.has(blocksWithQuestions[nextBlockIndex].blockId))
        nextBlockIndex++;
      else break;
    }

    if (nextBlockIndex < blocksWithQuestions.length) {
      setCurrentBlockIndex(nextBlockIndex);
      setPendingActions([]);
      setJumpToQuestion(null);
    } else {
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
          No blocks available
        </p>
      </div>
    );
  }

  const questionsToShow =
    jumpToQuestion && jumpToQuestion.blockId === currentBlock.blockId
      ? currentBlock.questions.filter((q) => {
          const targetIndex = currentBlock.questions.findIndex(
            (ques) => ques.questionId === jumpToQuestion.questionId
          );
          const currentIndex = currentBlock.questions.findIndex(
            (ques) => ques.questionId === q.questionId
          );
          return currentIndex >= targetIndex;
        })
      : currentBlock.questions;

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
                  {currentBlock.name}
                </p>
              </div>
              {/* <div className="mb-4">
                <div className="flex justify-between text-white/80 text-sm mb-2">
                  <span>
                    Block {currentBlockIndex + 1} of{" "}
                    {blocksWithQuestions.length}
                  </span>
                  <span>
                    {Math.round(
                      ((currentBlockIndex + 1) / blocksWithQuestions.length) *
                        100
                    )}
                    %
                  </span>
                </div>
                <div className="w-full bg-white/20 rounded-full h-2">
                  <div
                    className="bg-white dark:bg-[#CD7323] h-2 rounded-full transition-all duration-500"
                    style={{
                      width: `${
                        ((currentBlockIndex + 1) / blocksWithQuestions.length) *
                        100
                      }%`,
                    }}
                  />
                </div>
              </div> */}
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-8 lg:px-8 bg-white dark:bg-[#1A1A1E]">
              {questionsToShow.map((question, idx) => (
                <div key={question.questionId} className="mb-8">
                  <p className="text-sm lg:text-2xl font-semibold mb-6 text-gray-800 dark:text-[#CBC9DE]">
                    {idx + 1}. {question.label}
                  </p>
                  <RenderQuestion
                    question={question}
                    value={answers[question.questionId] || ""}
                    onChange={(value) =>
                      handleChange(question.questionId, value)
                    }
                    config={
                      question.config || defaultConfigMap[question.type] || {}
                    }
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
                <button
                  onClick={handleNextBlock}
                  className="flex items-center justify-end w-fit text-sm lg:text-lg gap-2 px-12 py-2 lg:px-8 lg:py-3 rounded-xl font-medium lg:font-semibold transition-all duration-200 transform hover:scale-105 shadow-lg bg-gradient-to-r from-orange-400 to-orange-500 dark:from-orange-500 dark:to-orange-600 text-white"
                >
                  Next
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
