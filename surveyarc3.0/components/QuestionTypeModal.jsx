import React, { useEffect } from "react";
import QuestionTypeSelector from "./QuestionSelectorType";

export default function QuestionTypeModal({
  show,
  setShow,
  selectedType,
  setSelectedType,
}) {
  useEffect(() => {
    if (show) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => (document.body.style.overflow = "");
  }, [show]);

  if (!show) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm"
        style={{ zIndex: 99998 }}
        onClick={() => setShow(false)}
      />

      <div
        className="fixed inset-0 flex items-center justify-center p-4"
        style={{ zIndex: 99999 }}
      >
        <div className="w-full max-w-5xl max-h-[80vh] overflow-y-auto bg-white dark:bg-[#1A1A1E] rounded-2xl shadow-2xl">
          <QuestionTypeSelector
            selectedType={selectedType}
            setSelectedType={setSelectedType}
            setShowTypePopup={setShow}
          />
        </div>
      </div>
    </>
  );
}
