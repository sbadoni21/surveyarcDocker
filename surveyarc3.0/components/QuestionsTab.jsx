"use client";
import React, { useState, useEffect, useRef, useMemo } from "react";
import DraggableQuestionsList from "./QuestionsList";
import QuestionTypeModal from "./QuestionTypeModal";
import QuestionEditorPanel from "./QuestionEditorPanel";

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
}) => {
  const [selectedQuestionId, setSelectedQuestionId] = useState(null);
  const [unsaved, setUnsaved] = useState(false);
  const [saveRequest, setSaveRequest] = useState(0);
  const [pendingAction, setPendingAction] = useState(null);

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
    <div className="flex gap-4 dark:bg-[#121214] h-[calc(100vh-120px)] overflow-hidden min-h-0 bg-[#F5F5F5]">
      <aside className="w-[25%] relative z-10 shrink-0 h-full overflow-y-auto">
        {Array.isArray(normalizedBlocks) && normalizedBlocks.length > 0 ? (
          <DraggableQuestionsList
            questions={questions}
            blocks={normalizedBlocks}
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
  );
};

export default QuestionsTab;
