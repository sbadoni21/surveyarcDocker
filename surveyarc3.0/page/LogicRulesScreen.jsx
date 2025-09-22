`use client`;

import React, { useState, useMemo } from "react";
import RuleLogicHeader from "@/components/RuleLogicHeader";
import ValidationErrors from "@/components/ValidationErrors";
import RuleAdminPanel from "@/components/RuleAdminPanel";

export default function AdvancedRuleLogicEditor({
  questions = [],
  blocks = [],
  rules,
}) {
  const processedQuestions = useMemo(() => {
    return Array.isArray(questions)
      ? questions.map((q) => ({
          id: typeof q === "string" ? q : q.questionId,
          title: typeof q === "object" ? q.label || q.questionId : q,
          type: typeof q === "object" ? q.type || "text" : "text",
          options: typeof q === "object" ? q.config.options || [] : [],
          required: typeof q === "object" ? q.required : false,
        }))
      : [];
  }, [questions]);
  const processedBlocks = useMemo(() => {
    return Array.isArray(blocks)
      ? blocks.map((b, idx) => ({
          id: typeof b === "string" ? b : b.id ?? b.blockId ?? `block_${idx}`,
          title:
            typeof b === "object"
              ? b.title || b.name || b.blockId || `Block ${idx + 1}`
              : b,
          order: typeof b === "object" ? b.order ?? b.index ?? idx : idx,
          questionIds: typeof b === "object" ? b.questionOrder ?? [] : [],
        }))
      : [];
  }, [blocks]);
  const [viewMode, setViewMode] = useState("visual");
  const [validationErrors, setValidationErrors] = useState([]);

  return (
    <div className="w-full ">
      <div className="bg-white rounded-xl shadow-xl border border-slate-200">
        <RuleLogicHeader validationErrors={validationErrors} />

        <div className="p-6">
          <RuleAdminPanel
            questionOptions={processedQuestions}
            blocks={processedBlocks}
          />
          <ValidationErrors validationErrors={validationErrors} />
        </div>
      </div>
    </div>
  );
}
