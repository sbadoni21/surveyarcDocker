"use client";
import React, { useEffect, useMemo, useState, useCallback } from "react";

import QUESTION_TYPES from "@/enums/questionTypes";
import { usePathname } from "next/navigation";

import QuestionsTab from "@/components/QuestionsTab";
import RulesTab from "@/components/RulesTab";
import SurveyDemoPage from "./SurveyDemoPage";
import TopTabsNavbar from "@/components/TopTabsNavbar";
import DistributionPage from "./DistributionPage";
import SurveyToolbar from "@/components/SurveyToolbar";
import Loading from "@/app/[locale]/loading";

import { useQuestion } from "@/providers/questionPProvider";
import { useSurvey } from "@/providers/surveyPProvider";
import QuestionModel from "@/models/questionModel";
import SurveyModel from "@/models/surveyModel";
import SurveyFlowView from "@/components/SurveyFlowView";
import CampaignPage from "./CampaignPage";
import SurveyResponsesPage from "@/components/SurveyResponsePopup";
import ThemeManager from "@/components/theme";
import { Button } from "@mui/material";
import DummyGeneratorPanel from "@/components/dummydata-generator/DummyGeneratorPanel";
import PanelManager from "./PanelManager";
import { createSurveyFromTemplate } from "@/utils/createSurveyFromTemplate";
import { TemplateSelectionPopup } from "@/components/surveys/TemplateSelectionPopup";
import { useUser } from "@/providers/postGresPorviders/UserProvider";
import QuotaTab from "@/components/QuotaTab";
import TranslationInitScreen from "./TranslationPage";
import { QuickActions } from "@/components/QuickActions";

export default function Dist() {
  const [selectedType, setSelectedType] = useState(null);
  const [newQuestionData, setNewQuestionData] = useState({
    label: "",
    description: "",
    config: {},
  });
  const [newQuestionSignal, setNewQuestionSignal] = useState(0);
  const [showTemplatePopup, setShowTemplatePopup] = useState(false);

  const [showTypePopup, setShowTypePopup] = useState(false);
  const [activeTab, setActiveTab] = useState("questions");
  const [rules, setRules] = useState("<Logic>\n</Logic>");
  const [survey, setSurvey] = useState(null);
  const [selectedBlock, setSelectedBlock] = useState(null);
  const [newBlockName, setNewBlockName] = useState("");
  const [loading, setLoading] = useState(true);
  const { uid } = useUser();
  const pathname = usePathname();
  const parts = (pathname || "").split("/");
  const orgId = parts[3];
  const projectId = parts[6];
  const surveyId = parts[7];

  const domain =
    process.env.NEXT_PUBLIC_DOMAIN || "https://surveyarc-docker.vercel.app";
  const publicSurveyUrl = `${domain}/en/form?org_id=${orgId}&projects=${projectId}&survey_id=${surveyId}`;

  const { getAllQuestions, saveQuestion } = useQuestion();
  const { updateSurvey, getSurvey, saveSurvey } = useSurvey();
  const [questions, setQuestions] = useState([]);

  const [addingQuestion, setAddingQuestion] = useState(false);
  const addingQuestionRef = React.useRef(false);

  const handleOpenNewQuestion = () => {
    setSelectedType(null);
    setNewQuestionData({ label: "", description: "", config: {} });
    setShowTypePopup(true);
    setNewQuestionSignal((n) => n + 1);
  };

  const openNewQuestionForBlock = (blockId) => {
    if (!blockId) {
      handleOpenNewQuestion();
      return;
    }
    setSelectedBlock(blockId);
    handleOpenNewQuestion();
  };

  const normalizeHashToTab = useCallback((hash) => {
    const k = String(hash || "")
      .replace(/^#/, "")
      .toLowerCase();
    if (["questions", "question", "questoins"].includes(k)) return "questions";
    if (["rules", "logicrules", "logic"].includes(k)) return "rules";
    if (["quota"].includes(k)) return "quota";
    if (["flow", "surveyflow"].includes(k)) return "flow";
    if (["demo", "preview"].includes(k)) return "demo";
    if (["distribution", "share"].includes(k)) return "distribution";
    if (["campaign"].includes(k)) return "campaign";
    if (["theme"].includes(k)) return "theme";
    if (["responses"].includes(k)) return "responses";
    if (["panel"].includes(k)) return "panel";
    if (["translation"].includes(k)) return "translation";
    return "questions";
  }, []);

  useEffect(() => {
    const apply = () => {
      const next = normalizeHashToTab(window.location.hash || "#questions");
      setActiveTab((prev) => (prev === next ? prev : next));
    };
    apply();
    window.addEventListener("hashchange", apply);
    return () => window.removeEventListener("hashchange", apply);
  }, [normalizeHashToTab]);

  const handleSetActiveTab = useCallback(
    (tab) => {
      const next = normalizeHashToTab(`#${tab}`);
      setActiveTab(next);
      if (typeof window !== "undefined") {
        history.replaceState(null, "", `#${next}`);
      }
    },
    [normalizeHashToTab]
  );

  const normalizeSurveyFromApi = (raw) => {
    const blocks = Array.isArray(raw?.blocks)
      ? raw.blocks.map((b) => ({
          blockId: b.blockId ?? b.block_id ?? b.id,
          name: b.name ?? "",
          questionOrder: Array.isArray(b.questionOrder)
            ? b.questionOrder
            : Array.isArray(b.question_order)
            ? b.question_order
            : [],
          randomization:
            b.randomization ??
            (b.randomizeQuestions
              ? { type: "full", subsetCount: null }
              : b.randomization ?? { type: "none", subsetCount: null }),
        }))
      : [];

    const blockOrder = Array.isArray(raw?.block_order)
      ? raw.block_order
      : Array.isArray(raw?.blockOrder)
      ? raw.blockOrder
      : [];

    const questionOrder = Array.isArray(raw?.question_order)
      ? raw.question_order
      : Array.isArray(raw?.questionOrder)
      ? raw.questionOrder
      : [];

    return { ...raw, blocks, blockOrder, questionOrder };
  };

  useEffect(() => {
    async function fetchData() {
      if (!orgId || !surveyId) return;
      setLoading(true);
      try {
        const qs = await getAllQuestions(orgId, surveyId);
        setQuestions(qs || []);

        const rawSurvey = await getSurvey(surveyId);
        const normalized = normalizeSurveyFromApi(rawSurvey);
        setSurvey(normalized);

        if (!selectedBlock) {
          const firstBlockId =
            normalized.blockOrder?.[0] ??
            (normalized.blocks?.[0]?.blockId || null);
          setSelectedBlock(firstBlockId);
        }
      } catch (error) {
        console.error("Failed to fetch data:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [orgId, surveyId]);

  const questionsById = useMemo(() => {
    const m = new Map();
    for (const q of questions) m.set(q.questionId, q);
    return m;
  }, [questions]);

  const questionsInSelectedBlock = useMemo(() => {
    const block = (survey?.blocks || []).find(
      (b) => b.blockId === selectedBlock
    );
    if (!block) return [];
    return (block.questionOrder || [])
      .map((id) => questionsById.get(id))
      .filter(Boolean);
  }, [survey?.blocks, selectedBlock, questionsById]);

  const handleAddQuestion = async () => {
    if (addingQuestionRef.current) return;

    if (!selectedBlock) return alert("Please select a block to add question");
    const isScreenType =
      selectedType === "welcome_screen" || selectedType === "end_screen";
    if (!selectedType) return alert("Please choose a type");
    if (!isScreenType && !newQuestionData.label?.trim())
      return alert("Please choose a type and enter a label");

    addingQuestionRef.current = true;
    setAddingQuestion(true);

    const questionId = `Q${Math.floor(100000 + Math.random() * 900000)}`;

    const defaultLabelForScreens =
      selectedType === "welcome_screen"
        ? "Welcome Screen"
        : selectedType === "end_screen"
        ? "End Screen"
        : "";

    const labelToSave =
      (newQuestionData.label && newQuestionData.label.trim()) ||
      (isScreenType ? defaultLabelForScreens : "");

    const optimisticQuestion = {
      questionId,
      type: selectedType,
      label: labelToSave,
      serial_label: newQuestionData.serial_label,
      description: newQuestionData.description || "",
      config: newQuestionData.config || {},
      required: true,
      logic: [],
      projectId,
    };
    try {
      setQuestions((prev) => [...prev, optimisticQuestion]);
      setSurvey((prev) => {
        if (!prev) return prev;
        const updatedBlocks = (prev.blocks || []).map((b) =>
          b.blockId === selectedBlock
            ? { ...b, questionOrder: [...(b.questionOrder || []), questionId] }
            : b
        );
        const updatedQuestionOrder = [
          ...(prev.questionOrder || []),
          questionId,
        ];
        return {
          ...prev,
          blocks: updatedBlocks,
          questionOrder: updatedQuestionOrder,
        };
      });

      await QuestionModel.create(orgId, surveyId, optimisticQuestion);

      const current = normalizeSurveyFromApi(await getSurvey(surveyId));
      const updatedBlocksServer = (current.blocks || []).map((b) =>
        b.blockId === selectedBlock
          ? { ...b, questionOrder: [...(b.questionOrder || []), questionId] }
          : b
      );
      const updatedQuestionOrderServer = [
        ...(current.questionOrder || []),
        questionId,
      ];

      await SurveyModel.update(surveyId, {
        blocks: updatedBlocksServer,
        block_order: current.blockOrder,
        question_order: updatedQuestionOrderServer,
      });

      const freshQs = await getAllQuestions(orgId, surveyId);
      setQuestions(freshQs || []);
      setSurvey({
        ...current,
        blocks: updatedBlocksServer,
        questionOrder: updatedQuestionOrderServer,
      });

      setSelectedType(null);
      setNewQuestionData({ label: "", description: "", config: {} });
      setShowTypePopup(false);
      return { ok: true, questionId };
    } catch (err) {
      console.error("Error adding question:", err);
      setQuestions((prev) => prev.filter((q) => q.questionId !== questionId));
      setSurvey((prev) => {
        if (!prev) return prev;
        const updatedBlocks = (prev.blocks || []).map((b) =>
          b.blockId === selectedBlock
            ? {
                ...b,
                questionOrder: (b.questionOrder || []).filter(
                  (id) => id !== questionId
                ),
              }
            : b
        );
        const updatedQuestionOrder = (prev.questionOrder || []).filter(
          (id) => id !== questionId
        );
        return {
          ...prev,
          blocks: updatedBlocks,
          questionOrder: updatedQuestionOrder,
        };
      });
      alert(err?.message || "Failed to add question");
      throw err;
    } finally {
      addingQuestionRef.current = false;
      setAddingQuestion(false);
    }
  };
  const handleSelectTemplate = async (template) => {
    if (!template) {
      // User chose "Start Blank"
      // Handle blank survey creation
      return;
    }

    try {
      const result = await createSurveyFromTemplate(
        template,
        orgId,
        projectId,
        uid, // <-- just pass uid
        { create: saveSurvey },
        { create: saveQuestion }
      );

      console.log("Survey created:", result);
      // Navigate to the new survey or show success message
    } catch (error) {
      console.error("Failed to create survey:", error);
    }
  };
  const handleUpdateQuestion = async (questionId, updatedQuestion) => {
    if (!questionId) throw new Error("questionId required");
    try {
      setQuestions((prev) =>
        (prev || []).map((q) =>
          q.questionId === questionId ? { ...q, ...updatedQuestion } : q
        )
      );

      if (typeof QuestionModel?.update === "function") {
        try {
          await QuestionModel.update(
            orgId,
            surveyId,
            questionId,
            updatedQuestion
          );
        } catch (err) {
          await QuestionModel.update(questionId, updatedQuestion);
        }
      } else if (typeof QuestionModel?.patch === "function") {
        await QuestionModel.patch(questionId, updatedQuestion);
      } else {
        throw new Error("QuestionModel.update not available");
      }

      const fresh = await getAllQuestions(orgId, surveyId);
      setQuestions(fresh || []);
      try {
        const rawSurvey = await getSurvey(surveyId);
        setSurvey(normalizeSurveyFromApi(rawSurvey));
      } catch (e) {
        console.warn("Failed to refresh survey after question update", e);
      }

      return true;
    } catch (err) {
      try {
        const fresh = await getAllQuestions(orgId, surveyId);
        setQuestions(fresh || []);
      } catch (e) {
        console.warn("Failed to rollback after update failure", e);
      }
      throw err;
    }
  };

  const selectedBlockOrderLen = useMemo(() => {
    const blk = (survey?.blocks || []).find((b) => b.blockId === selectedBlock);
    return blk?.questionOrder?.length || 0;
  }, [survey?.blocks, selectedBlock]);

  const handleAddBlock = async (name) => {
    const blockName = (name ?? newBlockName ?? "").trim();
    if (!blockName) return alert("Please enter block name");

    const blockId = `B${Math.floor(1000 + Math.random() * 9000)}`;
    const newBlock = {
      blockId,
      name: blockName,
      questionOrder: [],
      randomization: { type: "none", subsetCount: null },
    };

    try {
      const current = normalizeSurveyFromApi(await getSurvey(surveyId));

      const updatedBlocks = [...(current.blocks || []), newBlock];

      const currentOrder = Array.isArray(current.blockOrder)
        ? current.blockOrder
        : [];
      const updatedBlockOrder = [...currentOrder, blockId];

      await updateSurvey(orgId, surveyId, {
        blocks: updatedBlocks,
        block_order: updatedBlockOrder,
      });

      setSurvey({
        ...current,
        blocks: updatedBlocks,
        blockOrder: updatedBlockOrder,
      });
      setNewBlockName("");
      setSelectedBlock(blockId);
    } catch (e) {
      console.error("Failed to add block:", e);
      alert(e?.message || "Failed to add block");
    }
  };

  const updateConfig = (key, value) => {
    setNewQuestionData((prev) => ({
      ...prev,
      config: { ...prev.config, [key]: value },
    }));
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(publicSurveyUrl).then(() => {
      alert("Survey link copied to clipboard!");
    });
  };

  useEffect(() => {
    setShowTypePopup(false);
  }, []);
  const handleToggleStatus = async () => {
    try {
      const newStatus = survey.status === "test" ? "published" : "test";

      await updateSurvey(orgId, surveyId, { status: newStatus });

      // 🔥 After backend saves, fetch updated survey
      const refreshed = await getSurvey(surveyId);
      setSurvey(normalizeSurveyFromApi(refreshed));
    } catch (err) {
      console.error("Failed to update status", err);
    }
  };
console.log(questions)
  if (loading) return <Loading />;
  return (
<div className="flex flex-col h-screen overflow-hidden">
      <TopTabsNavbar activeTab={activeTab} setActiveTab={handleSetActiveTab}  />
     
      <>
    

        <TemplateSelectionPopup
          isOpen={showTemplatePopup}
          onClose={() => setShowTemplatePopup(false)}
          onSelectTemplate={handleSelectTemplate}
          orgId={orgId}
          projectId={projectId}
        />
      </>
<div className="flex justify-end items-end">     <QuickActions survey={survey} loading={loading} handleToggleStatus={handleToggleStatus}/>
</div>

      <div className="flex-1 overflow-auto bg-[#f5f5f5] dark:bg-[#121214] p-4">
        {activeTab === "questions" && (
          <>
            <SurveyToolbar
              blocks={survey?.blocks || []}
              selectedBlock={selectedBlock}
              onSelectBlock={setSelectedBlock}
              onSelectBlockRandomization={(blockId, updatedBlocks) => {
                setSelectedBlock(blockId);
                if (updatedBlocks) {
                  setSurvey((prev) =>
                    prev ? { ...prev, blocks: updatedBlocks } : prev
                  );

                  updateSurvey(orgId, surveyId, {
                    blocks: updatedBlocks,
                    block_order: survey?.blockOrder || [],
                  });
                }
              }}
              newBlockName={newBlockName}
              setNewBlockName={setNewBlockName}
              onAddBlock={handleAddBlock}
              onCopyLink={handleCopyLink}
              onNewQuestion={handleOpenNewQuestion}
              publicSurveyUrl={publicSurveyUrl}
              surveyTitle={survey?.title || survey?.name || "Survey"}
              showBlocks
              showCopy
              showQR
              showNewQuestion={false}
            />

            <QuestionsTab
              key={`${selectedBlock}-${selectedBlockOrderLen}-${questions.length}`}
              questions={questions}
              newQuestionSignal={newQuestionSignal}
              blocks={survey?.blocks || []}
              selectedBlockId={selectedBlock}
              publicSurveyUrl={publicSurveyUrl}
              showTypePopup={showTypePopup}
              fetchQuestions={getAllQuestions}
              setShowTypePopup={setShowTypePopup}
              setSelectedType={setSelectedType}
              selectedType={selectedType}
              QUESTION_TYPES={QUESTION_TYPES}
              newQuestionData={newQuestionData}
              setNewQuestionData={setNewQuestionData}
              updateConfig={updateConfig}
              handleCopyLink={handleCopyLink}
              handleAddQuestion={handleAddQuestion}
              handleUpdateQuestion={handleUpdateQuestion}
              addingQuestion={addingQuestion}
              surveyId={surveyId}
              orgId={orgId}
              onBlocksChange={(newBlocks) =>
                setSurvey((prev) =>
                  prev ? { ...prev, blocks: newBlocks } : prev
                )
              }
              onRequestNewQuestion={(blockId) =>
                openNewQuestionForBlock(blockId)
              }
            />
          </>
        )}

        {activeTab === "rules" && (
          <RulesTab
            questions={questions}
            blocks={survey?.blocks || []}
            rules={survey?.rules || []}
            setRules={setRules}
          />
        )}
        {activeTab === "quota" && (
          <QuotaTab
            surveyId={surveyId}
            orgId={orgId}
            questions={questions}
            onQuotaAssigned={(quota, questionId) => {
              // best-effort: call handleUpdateQuestion (if available) to attach quota to question config
              if (typeof handleUpdateQuestion === "function" && questionId) {
                // merge quota info into question config — adapt to your shape
                handleUpdateQuestion(questionId, {
                  quota: { id: quota.id, name: quota.name },
                });
              }
            }}
          />
        )}

        {activeTab === "flow" && (
          <SurveyFlowView
            questions={questions}
            surveyId={surveyId}
            blocks={survey?.blocks || []}
          />
        )}
        {activeTab === "demo" && <SurveyDemoPage />}
        {activeTab === "distribution" && <DistributionPage />}
        {activeTab === "campaign" && <CampaignPage />}
        {activeTab === "responses" && <SurveyResponsesPage survey={survey} />}
        {activeTab === "theme" && <ThemeManager />}
        {activeTab === "panel" && <PanelManager />}
        {activeTab === "translation" && <TranslationInitScreen />}
      </div>
    </div>
  );
}
