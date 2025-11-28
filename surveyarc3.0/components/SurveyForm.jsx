"use client";
import { useState, useMemo, useEffect } from "react";
import defaultConfigMap from "@/enums/defaultConfigs";
import { FileText } from "lucide-react";
import RenderQuestion from "./AnswerUI";
import RuleEngine from "./RulesEngine";
import TicketModel from "@/models/ticketModel";
import SLAModel from "@/models/slaModel";

export default function SurveyForm({
  questions = [],
  blocks = [],
  handleSubmit,
  rules,
  theme,
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

  // -------------------------
  // Helpers for options & answers
  // -------------------------

  // normalize options to objects: { id, label, isOther?, isNone? }
  const normalizeOptions = (opts = []) =>
    (opts || []).map((o, idx) =>
      typeof o === "string"
        ? { id: `opt_${idx}`, label: o }
        : { id: o.id ?? `opt_${idx}`, label: o.label ?? "", isOther: !!o.isOther, isNone: !!o.isNone }
    );

  // check if a question is answered (respecting Other text requirement)
  const isAnswered = (question, answer) => {
    const qType = question?.type;
    const config = question?.config || {};
    const required = Boolean(config.required);

    if (!required) return true; // not required -> always okay

    // treat empty as not answered
    if (answer === undefined || answer === null) return false;

    const opts = normalizeOptions(config.options || []);

    switch (qType) {
      case "checkbox": {
        // answer could be array or { values: [...], otherText }
        const vals = Array.isArray(answer)
          ? answer
          : answer?.values || [];
        if (!vals || vals.length === 0) return false;
        // if values contains an 'other' option, ensure otherText present if value is exactly other id
        const otherOpt = opts.find((o) => o.isOther);
        if (otherOpt) {
          if (vals.includes(otherOpt.id)) {
            // if stored as object with otherText
            if (typeof answer === "object") {
              return Boolean(answer.otherText && String(answer.otherText).trim());
            }
            // otherwise assume not answered
            return false;
          }
        }
        return true;
      }

      case "multiple_choice":
      case "dropdown":
      case "picture_choice":
      case "yes_no": {
        // answer might be string or { value, otherText }
        if (typeof answer === "string") {
          return answer !== "";
        }
        if (typeof answer === "object") {
          const val = answer.value;
          if (!val) return false;
          const otherOpt = opts.find((o) => o.isOther);
          if (otherOpt && val === otherOpt.id) {
            return Boolean(answer.otherText && String(answer.otherText).trim());
          }
          return true;
        }
        return false;
      }

      case "short_text":
      case "long_text":
      case "video":
      case "file_upload":
      case "google_drive":
      case "calendly":
      case "number":
      case "date": {
        if (typeof answer === "string") return String(answer).trim() !== "";
        if (typeof answer === "number") return true;
        // object wrappers or arrays are considered answered only if not empty
        if (Array.isArray(answer)) return answer.length > 0;
        if (typeof answer === "object") {
          // try to find a value property
          return Boolean(answer.value ?? answer.text ?? false);
        }
        return false;
      }

      default:
        // fallback: truthy check
        if (Array.isArray(answer)) return answer.length > 0;
        if (typeof answer === "object") {
          // check value or values presence
          if (Array.isArray(answer.values)) return answer.values.length > 0;
          return Boolean(answer.value ?? answer.otherText ?? false);
        }
        return Boolean(answer);
    }
  };

  // central answer setter that also enforces "none exclusive" and normalizes "other"
  const handleAnswerChange = (question, rawValue) => {
    const qid = question.questionId;
    const config = question.config || {};
    const opts = normalizeOptions(config.options || []);
    const noneOpt = opts.find((o) => o.isNone);
    const otherOpt = opts.find((o) => o.isOther);

    // helper to set answer safely
    const setAnswer = (value) =>
      setAnswers((prev) => {
        return { ...prev, [qid]: value };
      });

    // CASE: checkbox (multi-select) - accept array or toggle id
    if (question.type === "checkbox") {
      // rawValue might be:
      // - an array of ids
      // - a string id to toggle
      // - an object { values: [...], otherText }
      let values = [];
      let otherText;

      if (Array.isArray(rawValue)) {
        values = rawValue.slice();
      } else if (typeof rawValue === "string") {
        // toggle behavior: check previous value
        const prev = answers[qid];
        const prevVals = Array.isArray(prev) ? prev.slice() : prev?.values?.slice() || [];
        if (prevVals.includes(rawValue)) {
          values = prevVals.filter((v) => v !== rawValue);
        } else {
          values = [...prevVals, rawValue];
        }
      } else if (rawValue && typeof rawValue === "object") {
        values = Array.isArray(rawValue.values) ? rawValue.values.slice() : [];
        otherText = rawValue.otherText;
      }

      // enforce none exclusivity
      if (noneOpt) {
        if (values.includes(noneOpt.id)) {
          values = [noneOpt.id]; // choose only none
          otherText = undefined;
        } else {
          // remove none if present
          values = values.filter((v) => v !== noneOpt.id);
        }
      }

      // if other chosen, carry otherText in object form
      if (otherOpt && values.includes(otherOpt.id)) {
        setAnswer({ values, otherText: otherText ?? (answers[qid]?.otherText ?? "") });
      } else {
        setAnswer(values);
      }

      return;
    }

    // CASE: single-select (radio/dropdown/yes_no/picture_choice)
    if (
      ["multiple_choice", "dropdown", "picture_choice", "yes_no"].includes(
        question.type
      )
    ) {
      // rawValue might be:
      // - a string id
      // - an object { value, otherText }
      if (rawValue && typeof rawValue === "object" && "value" in rawValue) {
        const val = rawValue.value;
        if (noneOpt && val === noneOpt.id) {
          setAnswer(val);
          return;
        }
        if (otherOpt && val === otherOpt.id) {
          // need otherText to be present in the object
          setAnswer({ value: val, otherText: rawValue.otherText ?? "" });
          return;
        }
        // normal option
        setAnswer(val);
        return;
      }

      // if rawValue is string id
      if (typeof rawValue === "string") {
        const val = rawValue;
        if (noneOpt && val === noneOpt.id) {
          setAnswer(val);
          return;
        }
        if (otherOpt && val === otherOpt.id) {
          // set as object with empty otherText (UI should later update otherText)
          setAnswer({ value: val, otherText: "" });
          return;
        }
        setAnswer(val);
        return;
      }

      // otherwise store as-is
      setAnswer(rawValue);
      return;
    }

    // Default: pass through (text, number etc.)
    setAnswers((prev) => ({ ...prev, [qid]: rawValue }));
  };

  // used by Next/Submit: validate all required questions on current page
  const validateCurrentPageRequired = () => {
    const currentPageQuestions = blockPages[currentPageIndex] || [];
    const pageQuestionsFiltered = currentPageQuestions.filter((q) => {
      if (jumpToQuestion?.blockId === currentBlock?.blockId) {
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

    for (let q of pageQuestionsFiltered) {
      const cfg = q.config || defaultConfigMap[q.type] || {};
      if (cfg.required) {
        const ans = answers[q.questionId];
        if (!isAnswered(q, ans)) {
          // Focus behavior could be improved; for now show alert and return false
          window.alert("Please answer the required question: " + (q.label || "This question"));
          return false;
        }
      }
    }
    return true;
  };

  const isLastBlock = currentBlockIndex === blocksWithQuestions.length - 1;

  const handleNextBlock = () => {
    // validate required first — prevents navigation if any required unanswered
    if (!validateCurrentPageRequired()) return;

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

    const addMinutesToNow = (minutes) => {
      return new Date(Date.now() + minutes * 60 * 1000).toISOString();
    };

    const raiseTicket = async (ticketData) => {
      try {
        const data = await TicketModel.create(ticketData);
        console.log("Ticket raised successfully:", data);
      } catch (err) {
        console.error(" Failed to raise ticket:", err);
      }
    };

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
        case "raise_ticket":
          try {
            if (action?.ticketData?.[0]) {
              const ticket = action.ticketData[0];

              const slaRes = SLAModel.get(ticket.slaId, ticket.orgId);

              if (!slaRes || slaRes.error) {
                throw new Error("Failed to fetch SLA data");
              }

              const slaData = slaRes.data || slaRes;

              const priorityMinutes =
                slaData?.priority_map?.[ticket.priority] ?? 7200;
              const severityMinutes =
                slaData?.severity_map?.[ticket.severity] ?? 7200;

              const firstResponseDueAt = addMinutesToNow(severityMinutes);
              const resolutionDueAt = addMinutesToNow(priorityMinutes);

              const updatedTicketData = {
                ...ticket,
                dueAt: resolutionDueAt,
                sla_processing: {
                  ...ticket.sla_processing,
                  first_response_due_at: firstResponseDueAt,
                  resolution_due_at: resolutionDueAt,
                },
                firstResponseDueAt,
                resolutionDueAt,
                meta: {
                  ...(ticket.meta || {}),
                  title: "Survey Ticket",
                  message: "A ticket was raised by the survey.",
                  submittedAnswers: answers,
                  timestamp: new Date().toISOString(),
                },
              };
              raiseTicket(updatedTicketData);
            } else {
              console.warn("No ticketData found in action");
            }
          } catch (err) {
            console.error("Error processing raise_ticket action:", err);
          }
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
          setSubmitting(false);
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
          setSubmitting(false);
        } catch (err) {
          console.error("Submit error:", err);
          setSubmitting(false); // allow retry
        }
      })();
    }
  };

  const getInputClasses = () => `
    w-full px-3 py-2 lg:px-4 lg:py-3 rounded-xl transition-all duration-200 
    outline-none border border-[color:var(--secondary-light)] dark:border-[color:var(--secondary-dark)] font-medium
    text-[color:var(--text-light)] dark:text-[color:var(--text-dark)] bg-[color:var(--bg-light)] dark:bg-[color:var(--bg-dark)] placeholder-gray-500 dark:placeholder-[#96949C]
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
    <div
      className="min-h-fit max-h-screen flex flex-col relative 
             bg-[color:var(--bg-light)] dark:bg-[color:var(--bg-dark)]"
      style={
        theme?.isActive
          ? {
              "--bg-light": theme.lightBackgroundColor,
              "--bg-dark": theme.darkBackgroundColor,
              "--primary-light": theme.lightPrimaryColor,
              "--primary-dark": theme.darkPrimaryColor,
              "--secondary-light": theme.lightSecondaryColor,
              "--secondary-dark": theme.darkSecondaryColor,
              "--text-light": theme.lightTextColor,
              "--text-dark": theme.darkTextColor,
            }
          : {
              "--bg-light": "#ffffff",
              "--bg-dark": "#121214",
              "--primary-light": "#f1882a",
              "--primary-dark": "#cd7323",
              "--secondary-light": "#fbbe24",
              "--secondary-dark": "#9a6d1b",
              "--text-light": "#000000",
              "--text-dark": "#ffffff",
            }
      }
    >
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
      <header className="sticky top-0 z-30 backdrop-blur bg-[color:var(--primary-light)] dark:bg-[color:var(--primary-dark)] border-b border-orange-400/30 dark:border-[#222]">
        <div className="lg:max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {theme?.logoUrl ? (
              <img
                src={theme.logoUrl}
                alt={theme.brandName || "Logo"}
                className="h-10 w-10 object-contain rounded-md"
              />
            ) : (
              <div className="p-2 bg-white/20 rounded-md flex items-center justify-center">
                <FileText
                  className="text-white dark:text-[#CD7323]"
                  size={22}
                />
              </div>
            )}

            <div>
              <p className="text-lg lg:text-2xl font-bold text-white leading-tight">
                {theme?.name || "Survey ARC"}
              </p>
            </div>
          </div>

          <div className="text-right">
            <p className="text-sm text-[color:var(--bg-light)] ">Progress</p>
            <div className="w-36 h-2 bg-[color:var(--bg-light)] rounded-full overflow-hidden mt-1">
              <div
                className="h-full bg-[color:var(--secondary-light)]  rounded-full transition-all duration-300"
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
                    <p className="text-lg lg:text-2xl font-semibold mb-4 text-[color:var(--text-light)] dark:text-[color:var(--text-dark)]">
                      {idx + 1}. {question.label}
                    </p>
                  )}
                  {question.description && (
                    <i className="mb-4 text-sm text-[color:var(--text-light)] dark:text-[color:var(--text-dark)]">
                      {question.description}
                    </i>
                  )}
                  <RenderQuestion
                    question={question}
                    value={answers[question.questionId] ?? ""}
                    onChange={(value) => handleAnswerChange(question, value)}
                    config={
                      question.config || defaultConfigMap[question.type] || {}
                    }
                    inputClasses={getInputClasses()}
                    disabled={submitting}
                  />
                </div>
              ))
            ) : (
              <div className="text-center py-12">
                <p className="text-xl text-[color:var(--text-light)] dark:text-[color:var(--text-dark)]">
                  No question to show on this page.
                </p>
              </div>
            )}
          </div>
        </div>
      </main>

      <div className="sticky bottom-0 z-40 bg-[color:var(--bg-light)] dark:bg-[color:var(--bg-dark)] border-t border-[color:var(--secondary-light)] dark:border-[color:var(--secondary-dark)]">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="text-sm text-[color:var(--text-light)] dark:text-[color:var(--text-dark)]"></div>

          <div className="flex justify-center items-center w-full gap-3">
            {isLastBlock ? (
              <button
                onClick={async () => {
                  // validate required before final submit
                  if (!validateCurrentPageRequired()) return;

                  if (
                    !window.confirm(
                      "Are you sure you want to submit your responses?"
                    )
                  )
                    return;
                  setSubmitting(true);
                  try {
                    await handleSubmit(answers);
                    setSubmitting(false);
                  } catch (err) {
                    console.error("Submit failed:", err);
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
                className="flex items-center text-sm lg:text-lg gap-2 px-6 py-3 rounded-md font-semibold transition-transform duration-150 hover:scale-105 bg-[color:var(--primary-light)] dark:bg-[color:var(--primary-dark)] text-[color:var(--text-light)] dark:text-[color:var(--text-dark)]"
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
