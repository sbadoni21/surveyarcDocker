"use client";
import React, { useState } from "react";
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
  selectedBlockId
}) => {
  const [selectedQuestionId, setSelectedQuestionId] = useState(null);

  const selectedQuestion = questions.find(
    (q) => q.questionId === selectedQuestionId
  );

  return (
    <div className="flex dark:bg-[#121214] h-[calc(100vh-120px)] overflow-hidden min-h-0 bg-[#F5F5F5]">
      <aside className="w-[40%] relative z-10 shrink-0 h-full overflow-y-auto">
        {Array.isArray(questions) && questions.length >= 1 && (
          <DraggableQuestionsList
            questions={questions}
            blocks={blocks}
            selectedBlockId={selectedBlockId}
            setSelectedQuestionIndex={setSelectedQuestionId}
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
        selectedQuestion={selectedQuestion}
        selectedType={selectedType}
        setSelectedType={setSelectedType}
        setSelectedQuestionIndex={setSelectedQuestionId}
        newQuestionData={newQuestionData}
        setNewQuestionData={setNewQuestionData}
        updateConfig={updateConfig}
        handleAddQuestion={handleAddQuestion}
        handleUpdateQuestion={handleUpdateQuestion}
      />
    </div>
  );
};

export default QuestionsTab;
