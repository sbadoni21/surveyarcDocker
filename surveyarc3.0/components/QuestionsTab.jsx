"use client";
import React, { useState, useEffect, useRef, useMemo } from "react";
import { Code2 } from "lucide-react";
import DraggableQuestionsList from "./QuestionsList";
import QuestionTypeModal from "./QuestionTypeModal";
import QuestionEditorPanel from "./QuestionEditorPanel";
import SurveyXmlModePanel from "./SurveyXmlModePanel";

const QuestionsTab = ({
  questions = [],
  blocks = [],
  showTypePopup,
  setShowTypePopup,
  setSelectedType,
  selectedType,
  newQuestionData,
  setNewQuestionData,
  updateConfig,
  handleAddQuestion,
  handleUpdateQuestion,
  onBlocksChange,
  addingQuestion,
  selectedBlockId,
  newQuestionSignal,
  onRequestNewQuestion,
  surveyId,
  orgId,
  projectId,
  surveyName,
  onXmlSaved,
}) => {
  const [selectedQuestionId, setSelectedQuestionId] = useState(null);
  const [unsaved, setUnsaved] = useState(false);
  const [saveRequest, setSaveRequest] = useState(0);
  const [pendingAction, setPendingAction] = useState(null);
  const [xmlMode, setXmlMode] = useState(false);

  const normalizedBlocks = useMemo(() => {
    return (blocks || []).map((b) => ({
      ...b,
      blockId: b.blockId ?? b.id ?? b.block_id ?? null,
      questionOrder:
        Array.isArray(b.questionOrder) && b.questionOrder.length >= 0
          ? b.questionOrder
          : Array.isArray(b.question_order)
          ? b.question_order
          : [],
    }));
  }, [blocks]);

  useEffect(() => {
    if (
      (selectedBlockId === null ||
        selectedBlockId === undefined ||
        selectedBlockId === "") &&
      normalizedBlocks.length > 0
    ) {
      const first = normalizedBlocks.find((b) => b?.blockId);
      if (first) {
      }
    }
  }, [normalizedBlocks, selectedBlockId]);

  const questionsInSelectedBlock = useMemo(() => {
    if (!selectedBlockId) return [];
    const selectedBlock = normalizedBlocks.find(
      (b) => b.blockId === selectedBlockId
    );
    const order = selectedBlock?.questionOrder ?? [];
    const qById = new Map((questions || []).map((q) => [q.questionId, q]));
    return order.map((id) => qById.get(id)).filter(Boolean);
  }, [questions, normalizedBlocks, selectedBlockId]);

  const selectedQuestion = useMemo(() => {
    return (
      (questions || []).find((q) => q.questionId === selectedQuestionId) || null
    );
  }, [questions, selectedQuestionId]);

  const onChildSaved = async (result) => {
    setUnsaved(false);

    if (!pendingAction) return;
    const action = pendingAction;
    setPendingAction(null);

    if (action.type === "select") {
      setSelectedQuestionId(action.payload);
    } else if (action.type === "new") {
      setSelectedQuestionId(null);
    }
  };

  const onDirtyChange = (isDirty) => {
    setUnsaved(Boolean(isDirty));
  };

  const attemptSelectQuestion = (id) => {
    if (!unsaved) {
      setSelectedQuestionId(id);
      return;
    }

    const save = window.confirm(
      "You have unsaved changes. Click OK to save changes before switching, or Cancel to discard changes."
    );
    if (save) {
      setPendingAction({ type: "select", payload: id });
      setSaveRequest((n) => n + 1);
    } else {
      setUnsaved(false);
      setSelectedQuestionId(id);
    }
  };

  const isFirstNewSignal = useRef(true);

  useEffect(() => {
    if (typeof newQuestionSignal === "undefined") return;

    if (isFirstNewSignal.current) {
      isFirstNewSignal.current = false;
      return;
    }

    if (!unsaved) {
      setSelectedQuestionId(null);
      return;
    }

    const save = window.confirm(
      "You have unsaved changes. Click OK to save changes before creating a new question, or Cancel to discard changes."
    );
    if (save) {
      setPendingAction({ type: "new", payload: null });
      setSaveRequest((n) => n + 1);
    } else {
      setUnsaved(false);
      setSelectedQuestionId(null);
    }
  }, [newQuestionSignal]);

  return (
    <div className="dark:bg-[#121214] h-[calc(100vh-120px)] overflow-hidden min-h-0 bg-[#F5F5F5]">
      <div className="mb-4 flex items-center justify-end">
        <button
          type="button"
          onClick={() => setXmlMode((prev) => !prev)}
          className={`inline-flex items-center gap-3 rounded-full border px-4 py-2 text-sm font-medium transition-all ${
            xmlMode
              ? "border-orange-300 bg-orange-50 text-orange-700 shadow-sm dark:border-orange-700 dark:bg-orange-950/30 dark:text-orange-200"
              : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-[#1A1A1E] dark:text-[#96949C] dark:hover:bg-[#232328]"
          }`}
          aria-pressed={xmlMode}
        >
          <Code2 className="h-4 w-4" />
          XML Mode
          <span
            className={`relative h-6 w-11 rounded-full transition-colors ${
              xmlMode ? "bg-orange-500" : "bg-slate-300 dark:bg-slate-700"
            }`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                xmlMode ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </span>
        </button>
      </div>

      {xmlMode ? (
        <SurveyXmlModePanel
          blocks={normalizedBlocks}
          questions={questions}
          orgId={orgId}
          surveyId={surveyId}
          projectId={projectId}
          surveyName={surveyName}
          onPersisted={onXmlSaved}
        />
      ) : (
        <div className="flex gap-4 h-[calc(100%-56px)] overflow-hidden min-h-0">
          <aside className="w-[25%] relative z-10 shrink-0 h-full overflow-y-auto">
            {Array.isArray(normalizedBlocks) && normalizedBlocks.length > 0 ? (
              <DraggableQuestionsList
                questions={questions}
                blocks={normalizedBlocks}
                orgId={orgId}
                surveyId={surveyId}
                selectedBlockId={selectedBlockId}
                setSelectedQuestionIndex={attemptSelectQuestion}
                onBlocksChange={onBlocksChange}
                onRequestNewQuestion={onRequestNewQuestion}
              />
            ) : (
              <div className="p-6 text-sm text-slate-500">
                No blocks yet. Use "Add Block" to create the first one.
              </div>
            )}

            <QuestionTypeModal
              selectedType={selectedType}
              show={showTypePopup}
              setShow={setShowTypePopup}
              setSelectedType={setSelectedType}
            />
          </aside>

          <QuestionEditorPanel
            key={selectedQuestionId ?? "new-editor"}
            selectedQuestion={selectedQuestion}
            selectedType={selectedType}
            setSelectedType={setSelectedType}
            setSelectedQuestionIndex={setSelectedQuestionId}
            newQuestionData={newQuestionData}
            setNewQuestionData={setNewQuestionData}
            updateConfig={updateConfig}
            handleAddQuestion={handleAddQuestion}
            handleUpdateQuestion={handleUpdateQuestion}
            addingQuestion={addingQuestion}
            onDirtyChange={onDirtyChange}
            saveRequestCounter={saveRequest}
            onSaved={onChildSaved}
            surveyId={surveyId}
            orgId={orgId}
            questions={questions}
          />
        </div>
      )}
    </div>
  );
};

export default QuestionsTab;
