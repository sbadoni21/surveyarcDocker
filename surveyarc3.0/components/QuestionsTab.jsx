"use client";
import React, { useState, useEffect, useRef } from "react";
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
}) => {
  const [selectedQuestionId, setSelectedQuestionId] = useState(null);
  const [unsaved, setUnsaved] = useState(false);
  const [saveRequest, setSaveRequest] = useState(0);
  const [pendingAction, setPendingAction] = useState(null);

  const selectedQuestion = questions.find(
    (q) => q.questionId === selectedQuestionId
  );

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
    <div className="flex dark:bg-[#121214] h-[calc(100vh-120px)] overflow-hidden min-h-0 bg-[#F5F5F5]">
      <aside className="w-[40%] relative z-10 shrink-0 h-full overflow-y-auto">
        {Array.isArray(questions) && questions.length >= 1 && (
          <DraggableQuestionsList
            questions={questions}
            blocks={blocks}
            selectedBlockId={selectedBlockId}
            setSelectedQuestionIndex={attemptSelectQuestion}
            onBlocksChange={onBlocksChange}
          />
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
      />
    </div>
  );
};

export default QuestionsTab;
