import AdvancedRuleLogicEditor from "@/page/LogicRulesScreen";
import React from "react";

const RulesTab = ({ questions, rules, setRules, blocks }) => {
  return (
    <div className="p-8 h-full">
      <div className="max-w-6xl mx-auto h-full ">
        <AdvancedRuleLogicEditor
          blocks={blocks}
          questions={questions}
          rules={rules}
          onChange={setRules}
        />
      </div>
    </div>
  );
};

export default RulesTab;
