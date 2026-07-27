"use client";

import React, { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Code2, FileWarning, Layers3, ListTree, Loader2, Save } from "lucide-react";
import QuestionModel from "@/models/questionModel";
import SurveyModel from "@/models/surveyModel";

const SAMPLE_XML = `<survey name="Customer Satisfaction Survey">
  <block id="intro" name="Introduction">
    <question serial="Q1" type="welcome_screen">
      <label>Welcome</label>
      <description>Thanks for taking our survey</description>
      <config>
        <title>Customer Satisfaction Survey</title>
        <showStartButton>true</showStartButton>
      </config>
    </question>

    <question serial="Q2" type="multiple_choice" required="true">
      <label>How satisfied are you with our service?</label>
      <options>
        <option id="A1">Very satisfied</option>
        <option id="A2">Satisfied</option>
        <option id="A3">Neutral</option>
        <option id="A4">Dissatisfied</option>
      </options>
    </question>
  </block>
</survey>`;

const escapeXml = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const prettifyConfigValue = (value) => {
  if (typeof value === "boolean") return value ? "true" : "false";
  if (value == null) return "";
  return String(value);
};

const serializeSurveyToXml = (blocks = [], questions = []) => {
  if (!Array.isArray(blocks) || blocks.length === 0) {
    return SAMPLE_XML;
  }

  const questionMap = new Map((questions || []).map((q) => [q.questionId, q]));

  const blockXml = blocks
    .map((block, blockIndex) => {
      const blockId = block?.blockId || block?.id || `block_${blockIndex + 1}`;
      const blockName = block?.name || `Block ${blockIndex + 1}`;
      const questionOrder = Array.isArray(block?.questionOrder)
        ? block.questionOrder
        : Array.isArray(block?.question_order)
          ? block.question_order
          : [];

      const questionXml = questionOrder
        .filter((questionId) => typeof questionId === "string" && !questionId.startsWith("PB-"))
        .map((questionId, questionIndex) => {
          const question = questionMap.get(questionId);
          if (!question) return "";

          const configEntries = Object.entries(question.config || {});
          const options = question.config?.options || question.config?.items || [];

          return `    <question serial="${escapeXml(
            question.serial_label || `question_${questionIndex + 1}`
          )}" type="${escapeXml(
            question.type || "short_text"
          )}" required="${question.required === false ? "false" : "true"}">
      <label>${escapeXml(question.label || "")}</label>
${question.description ? `      <description>${escapeXml(question.description)}</description>\n` : ""}${
            configEntries.length > 0
              ? `      <config>\n${configEntries
                  .filter(([key]) => key !== "options" && key !== "items")
                  .map(
                    ([key, value]) =>
                      `        <${key}>${escapeXml(prettifyConfigValue(value))}</${key}>`
                  )
                  .join("\n")}\n      </config>\n`
              : ""
          }${
            Array.isArray(options) && options.length > 0
              ? `      <options>\n${options
                  .map((option, optionIndex) => {
                    const optionId =
                      option?.serial_label || option?.id || `A${optionIndex + 1}`;
                    const optionLabel =
                      option?.label || option?.value || `Option ${optionIndex + 1}`;
                    return `        <option id="${escapeXml(optionId)}">${escapeXml(
                      optionLabel
                    )}</option>`;
                  })
                  .join("\n")}\n      </options>\n`
              : ""
          }    </question>`;
        })
        .filter(Boolean)
        .join("\n\n");

      return `  <block id="${escapeXml(blockId)}" name="${escapeXml(blockName)}">
${questionXml}
  </block>`;
    })
    .join("\n\n");

  return `<survey name="Survey">
${blockXml}
</survey>`;
};

const parseXmlSurvey = (xmlText) => {
  if (!xmlText.trim()) {
    return {
      surveyName: "",
      blocks: [],
      errors: ["XML is empty."],
    };
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, "application/xml");
  const parseErrors = Array.from(doc.getElementsByTagName("parsererror"));
  if (parseErrors.length > 0) {
    return {
      surveyName: "",
      blocks: [],
      errors: [parseErrors[0].textContent || "Invalid XML syntax."],
    };
  }

  const surveyNode = doc.getElementsByTagName("survey")[0];
  if (!surveyNode) {
    return {
      surveyName: "",
      blocks: [],
      errors: ["Missing root <survey> element."],
    };
  }

  const errors = [];
  const blocks = Array.from(surveyNode.getElementsByTagName("block")).map(
    (blockNode, blockIndex) => {
      const questions = Array.from(blockNode.getElementsByTagName("question")).map(
        (questionNode, questionIndex) => {
          const labelText =
            questionNode.getElementsByTagName("label")[0]?.textContent?.trim() ||
            questionNode.getAttribute("label") ||
            "";
          const descriptionText =
            questionNode.getElementsByTagName("description")[0]?.textContent?.trim() || "";
          const type = questionNode.getAttribute("type") || "short_text";
          const serial =
            questionNode.getAttribute("serial") ||
            questionNode.getAttribute("serial_label") ||
            questionNode.getAttribute("id") ||
            `Q${blockIndex + 1}_${questionIndex + 1}`;
          const requiredAttr = questionNode.getAttribute("required");
          const required = requiredAttr ? requiredAttr !== "false" : true;

          if (!labelText && !["welcome_screen", "end_screen", "redirect_url"].includes(type)) {
            errors.push(`Question ${serial} is missing a <label>.`);
          }

          const configNode = questionNode.getElementsByTagName("config")[0];
          const config = {};
          if (configNode) {
            Array.from(configNode.children).forEach((child) => {
              config[child.tagName] = child.textContent?.trim() || "";
            });
          }

          const optionsParent = questionNode.getElementsByTagName("options")[0];
          const options = optionsParent
            ? Array.from(optionsParent.getElementsByTagName("option")).map((optionNode, optionIndex) => ({
                id: optionNode.getAttribute("id") || `A${optionIndex + 1}`,
                label: optionNode.textContent?.trim() || `Option ${optionIndex + 1}`,
              }))
            : [];

          return {
            serial,
            type,
            required,
            label: labelText,
            description: descriptionText,
            config,
            options,
          };
        }
      );

      return {
        id: blockNode.getAttribute("id") || `block_${blockIndex + 1}`,
        name: blockNode.getAttribute("name") || `Block ${blockIndex + 1}`,
        questions,
      };
    }
  );

  return {
    surveyName: surveyNode.getAttribute("name") || "Survey",
    blocks,
    errors,
  };
};

const normalizeQuestionType = (type = "") => {
  const normalized = String(type || "").trim().toLowerCase();
  if (normalized === "redirect_screen") return "redirect_url";
  return normalized || "short_text";
};

const shouldUseOptions = (type) =>
  ["multiple_choice", "checkbox", "dropdown", "ranking"].includes(
    normalizeQuestionType(type)
  );

const buildCompiledSurvey = (parsed, projectId, existingBlocks = []) => {
  const questions = [];
  const blocks = parsed.blocks.map((block, blockIndex) => {
    const previousBlock = (existingBlocks || []).find((b) => b.blockId === block.id);
    const questionRefs = block.questions.map((question, questionIndex) => {
      const refId = question.serial || `Q${blockIndex + 1}_${questionIndex + 1}`;
      const normalizedType = normalizeQuestionType(question.type);
      const baseConfig = { ...(question.config || {}) };
      if (shouldUseOptions(normalizedType)) {
        baseConfig.options = (question.options || []).map((option, optionIndex) => ({
          serial_label: option.id || `A${optionIndex + 1}`,
          label: option.label || `Option ${optionIndex + 1}`,
        }));
      }

      questions.push({
        refId,
        projectId,
        type: normalizedType,
        label: question.label || "",
        serial_label: refId,
        required: question.required !== false,
        description: question.description || "",
        config: baseConfig,
        logic: [],
      });

      return refId;
    });

    return {
      blockId: block.id || `block_${blockIndex + 1}`,
      name: block.name || `Block ${blockIndex + 1}`,
      questionRefs,
      randomization: previousBlock?.randomization || { type: "none", subsetCount: "" },
    };
  });

  return {
    surveyName: parsed.surveyName || "Survey",
    questions,
    blocks,
  };
};

export default function SurveyXmlModePanel({
  blocks = [],
  questions = [],
  orgId,
  surveyId,
  projectId,
  surveyName,
  onPersisted,
}) {
  const [xmlText, setXmlText] = useState("");
  const [hasBootstrapped, setHasBootstrapped] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

  useEffect(() => {
    if (hasBootstrapped) return;
    setXmlText(serializeSurveyToXml(blocks, questions));
    setHasBootstrapped(true);
  }, [blocks, hasBootstrapped, questions]);

  const compiled = useMemo(() => parseXmlSurvey(xmlText), [xmlText]);
  const totalQuestions = compiled.blocks.reduce(
    (sum, block) => sum + block.questions.length,
    0
  );

  const handleSaveSurvey = async () => {
    if (compiled.errors.length > 0) {
      setSaveMessage("Fix XML errors before saving.");
      return;
    }

    if (!orgId || !surveyId) {
      setSaveMessage("Survey context is missing.");
      return;
    }

    setSaving(true);
    setSaveMessage("");

    try {
      const compiledSurvey = buildCompiledSurvey(compiled, projectId, blocks);
      const existingByRef = new Map(
        (questions || [])
          .filter((question) => question?.serial_label)
          .map((question) => [question.serial_label, question])
      );
      const nextQuestions = [];
      const seenRefs = new Set();

      for (const question of compiledSurvey.questions) {
        const existing = existingByRef.get(question.refId);
        seenRefs.add(question.refId);

        if (existing?.questionId) {
          const updated = await QuestionModel.update(orgId, surveyId, existing.questionId, {
            type: question.type,
            label: question.label,
            serial_label: question.serial_label,
            required: question.required,
            description: question.description,
            config: question.config,
            logic: existing.logic || [],
          });
          nextQuestions.push(updated);
        } else {
          const created = await QuestionModel.create(orgId, surveyId, question);
          nextQuestions.push(created);
        }
      }

      const staleQuestions = (questions || []).filter(
        (question) =>
          question?.serial_label &&
          !seenRefs.has(question.serial_label)
      );

      for (const staleQuestion of staleQuestions) {
        if (staleQuestion?.questionId) {
          await QuestionModel.delete(orgId, surveyId, staleQuestion.questionId);
        }
      }

      const questionIdByRef = new Map(
        nextQuestions.map((question) => [question.serial_label, question.questionId])
      );

      const persistedBlocks = compiledSurvey.blocks.map((block) => ({
        blockId: block.blockId,
        name: block.name,
        questionOrder: block.questionRefs
          .map((refId) => questionIdByRef.get(refId))
          .filter(Boolean),
        randomization: block.randomization,
      }));

      const persistedQuestionOrder = persistedBlocks.flatMap(
        (block) => block.questionOrder || []
      );

      const updatedSurvey = await SurveyModel.update(surveyId, {
        name: compiledSurvey.surveyName || surveyName || "Survey",
        blocks: persistedBlocks,
        block_order: persistedBlocks.map((block) => block.blockId),
        question_order: persistedQuestionOrder,
      });

      if (typeof onPersisted === "function") {
        await onPersisted(updatedSurvey);
      }

      setSaveMessage("Survey saved from XML.");
    } catch (error) {
      console.error("Failed to save XML survey:", error);
      setSaveMessage(error?.message || "Failed to save survey.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex-1 min-h-0 rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-[#1A1A1E]">
      <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-[#CBC9DE]">
            XML Survey Programming
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-[#96949C]">
            Write survey XML and preview the questions compiled from it.
          </p>
        </div>

        <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-[#96949C]">
          {saveMessage ? (
            <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 dark:bg-[#232328]">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {saveMessage}
            </div>
          ) : null}
          <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 dark:bg-[#232328]">
            <Layers3 className="h-3.5 w-3.5" />
            {compiled.blocks.length} block{compiled.blocks.length === 1 ? "" : "s"}
          </div>
          <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 dark:bg-[#232328]">
            <ListTree className="h-3.5 w-3.5" />
            {totalQuestions} question{totalQuestions === 1 ? "" : "s"}
          </div>
        </div>
      </div>

      <div className="grid h-[calc(100%-81px)] min-h-0 gap-0 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="min-h-0 border-b border-slate-200 dark:border-slate-800 xl:border-b-0 xl:border-r">
          <div className="flex items-center justify-between px-6 py-3">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-800 dark:text-[#CBC9DE]">
              <Code2 className="h-4 w-4" />
              XML Editor
            </div>
            <button
              type="button"
              onClick={() => setXmlText(serializeSurveyToXml(blocks, questions))}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-[#96949C] dark:hover:bg-[#232328]"
            >
              Reset From Survey
            </button>
            <button
              type="button"
              onClick={handleSaveSurvey}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-3.5 w-3.5" />
                  Save Survey
                </>
              )}
            </button>
          </div>
          <div className="h-[calc(100%-53px)] px-6 pb-6">
            <textarea
              value={xmlText}
              onChange={(e) => setXmlText(e.target.value)}
              className="h-full min-h-[420px] w-full resize-none rounded-2xl border border-slate-200 bg-slate-950 p-5 font-mono text-sm leading-6 text-slate-100 outline-none ring-0 placeholder:text-slate-500 dark:border-slate-700"
              spellCheck={false}
            />
          </div>
        </section>

        <section className="min-h-0 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-3">
            <div>
              <h3 className="text-sm font-medium text-slate-800 dark:text-[#CBC9DE]">
                Compiled Preview
              </h3>
              <p className="text-xs text-slate-500 dark:text-[#96949C]">
                {compiled.surveyName || "Untitled Survey"}
              </p>
            </div>
          </div>

          <div className="h-[calc(100%-53px)] overflow-y-auto px-6 pb-6">
            {compiled.errors.length > 0 && (
              <div className="mb-4 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-200">
                <div className="mb-2 flex items-center gap-2 font-medium">
                  <FileWarning className="h-4 w-4" />
                  XML issues
                </div>
                <ul className="space-y-1">
                  {compiled.errors.map((error, index) => (
                    <li key={`${error}-${index}`}>{error}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="space-y-4">
              {compiled.blocks.map((block) => (
                <div
                  key={block.id}
                  className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-[#18181b]"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold text-slate-900 dark:text-[#CBC9DE]">
                        {block.name}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-[#96949C]">
                        {block.id}
                      </div>
                    </div>
                    <div className="text-xs text-slate-500 dark:text-[#96949C]">
                      {block.questions.length} question{block.questions.length === 1 ? "" : "s"}
                    </div>
                  </div>

                  <div className="space-y-3">
                    {block.questions.map((question) => (
                      <div
                        key={question.serial}
                        className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-[#1F1F23]"
                      >
                        <div className="mb-2 flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-medium text-slate-900 dark:text-[#CBC9DE]">
                              {question.label || "Untitled question"}
                            </div>
                            {question.description ? (
                            <div className="mt-1 text-xs text-slate-500 dark:text-[#96949C]">
                              {question.description}
                            </div>
                          ) : null}
                        </div>
                        <div className="text-right text-xs text-slate-500 dark:text-[#96949C]">
                            <div>{question.serial}</div>
                            <div className="capitalize">{question.type.replaceAll("_", " ")}</div>
                          </div>
                        </div>

                        {question.options.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {question.options.map((option) => (
                              <span
                                key={option.id}
                                className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700 dark:bg-[#2A2A30] dark:text-[#CBC9DE]"
                              >
                                {option.id}: {option.label}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {compiled.blocks.length === 0 && compiled.errors.length === 0 && (
                <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-[#96949C]">
                  Start typing XML to generate question preview.
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
