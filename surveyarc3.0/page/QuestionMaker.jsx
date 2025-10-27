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
import CampaignPage from "./CampaignPage";
import Loading from "@/app/[locale]/loading";

import { useQuestion } from "@/providers/questionPProvider";
import { useSurvey } from "@/providers/surveyPProvider";
import QuestionModel from "@/models/questionModel";
import SurveyModel from "@/models/surveyModel";
import SurveyFlowView from "@/components/SurveyFlowView";

export default function Dist() {
  // UI state
  const [selectedType, setSelectedType] = useState(null);
  const [newQuestionData, setNewQuestionData] = useState({
    label: "",
    description: "",
    config: {},
  });
  const [showTypePopup, setShowTypePopup] = useState(false);
  const [activeTab, setActiveTab] = useState("questions");
  const [rules, setRules] = useState("<Logic>\n</Logic>");
  const [survey, setSurvey] = useState(null);
  const [selectedBlock, setSelectedBlock] = useState(null); // must be a blockId
  const [newBlockName, setNewBlockName] = useState("");
  const [loading, setLoading] = useState(true);

  // route params
  const pathname = usePathname();
  const parts = (pathname || "").split("/");
  const orgId = parts[3];
  const projectId = parts[6];
  const surveyId = parts[7];

  // URLs
  const domain =
    process.env.NEXT_PUBLIC_DOMAIN || "https://surveyarc2-0.vercel.app";
  const publicSurveyUrl = `${domain}/en/form?orgId=${orgId}&projects=${projectId}&survey=${surveyId}`;

  // providers
  const { getAllQuestions } = useQuestion();
  const { updateSurvey, getSurvey } = useSurvey();
  const [questions, setQuestions] = useState([]);

  // tab handling
  const normalizeHashToTab = useCallback((hash) => {
    const k = String(hash || "")
      .replace(/^#/, "")
      .toLowerCase();

    if (["questions", "question", "questoins"].includes(k)) return "questions";
    if (["rules", "logicrules", "logic"].includes(k)) return "rules";
    if (["flow", "surveyflow"].includes(k)) return "flow"; // ✅ Add this
    if (["demo", "preview"].includes(k)) return "demo";
    if (["distribution", "share"].includes(k)) return "distribution";
    if (["campaign"].includes(k)) return "campaign";
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
          // normalize the randomization object consistently
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
    if (!selectedBlock) return alert("Please select a block to add question");
    if (!selectedType || !newQuestionData.label?.trim())
      return alert("Please choose a type and enter a label");

    const questionId = `Q${Math.floor(100000 + Math.random() * 900000)}`;
    const optimisticQuestion = {
      questionId,
      type: selectedType,
      label: newQuestionData.label,
      description: newQuestionData.description || "",
      config: newQuestionData.config || {},
      required: true,
      logic: [],
      projectId,
    };

    try {
      // 1) OPTIMISTIC: update UI immediately
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

      // 2) Server create
      await QuestionModel.create(orgId, surveyId, optimisticQuestion);

      // 3) Persist survey order server-side
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

      // 4) Reconcile with fresh data (if needed)
      const freshQs = await getAllQuestions(orgId, surveyId);
      setQuestions(freshQs || []);
      setSurvey({
        ...current,
        blocks: updatedBlocksServer,
        questionOrder: updatedQuestionOrderServer,
      });

      // reset dialog
      setSelectedType(null);
      setNewQuestionData({ label: "", description: "", config: {} });
      setShowTypePopup(false);
    } catch (err) {
      console.error("Error adding question:", err);
      // rollback optimistic change
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
    }
  };

  // Add in Dist component (next to handleAddQuestion)
  const handleUpdateQuestion = async (questionId, updatedQuestion) => {
    if (!questionId) throw new Error("questionId required");
    try {
      // 1) Optimistic update locally so user sees change immediately
      setQuestions((prev) =>
        (prev || []).map((q) =>
          q.questionId === questionId ? { ...q, ...updatedQuestion } : q
        )
      );

      // 2) Call backend model (adjust signature if your model expects different args)
      // I assume QuestionModel.update(orgId, surveyId, questionId, payload) OR QuestionModel.update(questionId, payload)
      // Try the most likely first, otherwise fall back.
      if (typeof QuestionModel?.update === "function") {
        // prefer org+survey signature if available
        try {
          // some implementations: QuestionModel.update(orgId, surveyId, id, payload)
          await QuestionModel.update(
            orgId,
            surveyId,
            questionId,
            updatedQuestion
          );
        } catch (err) {
          // fallback: QuestionModel.update(id, payload)
          await QuestionModel.update(questionId, updatedQuestion);
        }
      } else if (typeof QuestionModel?.patch === "function") {
        await QuestionModel.patch(questionId, updatedQuestion);
      } else {
        throw new Error("QuestionModel.update not available");
      }

      // 3) Reconcile with server copy (recommended)
      const fresh = await getAllQuestions(orgId, surveyId);
      setQuestions(fresh || []);
      // Optionally refresh survey structure if update touches order/blocks:
      try {
        const rawSurvey = await getSurvey(surveyId);
        setSurvey(normalizeSurveyFromApi(rawSurvey));
      } catch (e) {
        // non-fatal
        console.warn("Failed to refresh survey after question update", e);
      }

      return true;
    } catch (err) {
      // rollback local optimistic change by refetching
      try {
        const fresh = await getAllQuestions(orgId, surveyId);
        setQuestions(fresh || []);
      } catch (e) {
        console.warn("Failed to rollback after update failure", e);
      }
      // bubble error for UI
      throw err;
    }
  };

  const selectedBlockOrderLen = useMemo(() => {
    const blk = (survey?.blocks || []).find((b) => b.blockId === selectedBlock);
    return blk?.questionOrder?.length || 0;
  }, [survey?.blocks, selectedBlock]);

  // ===== Add Block =====
  const handleAddBlock = async () => {
    if (!newBlockName.trim()) return alert("Please enter block name");

    const blockId = `B${Math.floor(1000 + Math.random() * 9000)}`;
    const newBlock = {
      blockId,
      name: newBlockName.trim(),
      questionOrder: [],
      // default randomization object
      randomization: { type: "none", subsetCount: null },
    };

    try {
      const current = normalizeSurveyFromApi(await getSurvey(surveyId));

      const updatedBlocks = [...(current.blocks || []), newBlock];

      // derive blockOrder: prefer existing order, append new id
      const currentOrder = Array.isArray(current.blockOrder)
        ? current.blockOrder
        : [];
      const updatedBlockOrder = [...currentOrder, blockId];

      await updateSurvey(orgId, surveyId, {
        blocks: updatedBlocks,
        block_order: updatedBlockOrder, // snake_case for API
      });

      setSurvey({
        ...current,
        blocks: updatedBlocks,
        blockOrder: updatedBlockOrder,
      });
      setNewBlockName("");
      setSelectedBlock(blockId); // IMPORTANT: keep selected as blockId
    } catch (e) {
      console.error("Failed to add block:", e);
      alert(e?.message || "Failed to add block");
    }
  };

  // config helper
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

  if (loading) return <Loading />;

  return (
    <div className="flex flex-col min-h-screen">
      <TopTabsNavbar activeTab={activeTab} setActiveTab={handleSetActiveTab} />

      <div className="flex-1 overflow-auto bg-[#f5f5f5] dark:bg-[#121214] p-4">
        {activeTab === "questions" && (
          <>
            <SurveyToolbar
              blocks={survey?.blocks || []}
              selectedBlock={selectedBlock} // value = blockId
              onSelectBlock={setSelectedBlock}
              onSelectBlockRandomization={(blockId, updatedBlocks) => {
                setSelectedBlock(blockId);
                if (updatedBlocks) {
                  // update local UI
                  setSurvey((prev) =>
                    prev ? { ...prev, blocks: updatedBlocks } : prev
                  );

                  // persist the updated blocks (which include the randomization object)
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
              onNewQuestion={() => setShowTypePopup(true)}
              publicSurveyUrl={publicSurveyUrl}
              surveyTitle={survey?.title || survey?.name || "Survey"}
              showBlocks
              showCopy
              showQR
              showNewQuestion
            />

            {/* <QuestionsTab
              questions={questions}
              blocks={survey?.blocks || []}
              selectedBlockId={selectedBlock} // blockId
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
              onBlocksChange={(newBlocks) =>
                setSurvey((prev) =>
                  prev ? { ...prev, blocks: newBlocks } : prev
                )
              }
            /> */}
            <QuestionsTab
              key={`${selectedBlock}-${selectedBlockOrderLen}-${questions.length}`}
              questions={questions}
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
              onBlocksChange={(newBlocks) =>
                setSurvey((prev) =>
                  prev ? { ...prev, blocks: newBlocks } : prev
                )
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
      </div>
    </div>
  );
}
