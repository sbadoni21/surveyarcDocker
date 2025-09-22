import QuestionFlowTab from "@/page/WorkFlowPage";
import React from "react";

const FlowTab = ({ questions, rules}) => {
  return (
    <div className="p-8 bg-white">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-2xl font-bold mb-6" style={{ color: 'var(--text-primary)' }}>
          Logic Flow Overview
        </h2>
        <QuestionFlowTab questions={questions} rules={rules}  />
      </div>
    </div>
  );
};

export default FlowTab;
