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
    const k = String(hash || "").replace(/^#/, "").toLowerCase();
    if (["questions", "question", "questoins"].includes(k)) return "questions";
    if (["rules", "logicrules", "logic"].includes(k)) return "rules";
    if (["demo", "preview"].includes(k)) return "demo";
    if (["distribution", "share"].includes(k)) return "distribution";
    if (["campaign", "share"].includes(k)) return "campaign";
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

  // --- helpers ---
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

  // initial fetch (decrypt already handled in your API route)
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

        // default to first block (by blockOrder if present, else first in blocks)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, surveyId]);

  // Map id -> question
  const questionsById = useMemo(() => {
    const m = new Map();
    for (const q of questions) m.set(q.questionId, q);
    return m;
  }, [questions]);

  // Questions for selected block
  const questionsInSelectedBlock = useMemo(() => {
    const block = (survey?.blocks || []).find(
      (b) => b.blockId === selectedBlock
    );
    if (!block) return [];
    return (block.questionOrder || [])
      .map((id) => questionsById.get(id))
      .filter(Boolean);
  }, [survey?.blocks, selectedBlock, questionsById]);

  // ===== Add Question =====
  const handleAddQuestion = async () => {
    if (!selectedBlock) {
      alert("Please select a block to add question");
      return;
    }
    if (!selectedType || !newQuestionData.label?.trim()) {
      alert("Please choose a type and enter a label");
      return;
    }

    const questionId = `Q${Math.floor(100000 + Math.random() * 900000)}`;

    const payload = {
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
      await QuestionModel.create(orgId, surveyId, payload);

      // latest survey from API (already decrypted by your route)
      const current = normalizeSurveyFromApi(await getSurvey(surveyId));

      const updatedBlocks = (current.blocks || []).map((b) =>
        b.blockId === selectedBlock
          ? {
              ...b,
              questionOrder: [...(b.questionOrder || []), questionId],
            }
          : b
      );

      const updatedQuestionOrder = [
        ...(current.questionOrder || []),
        questionId,
      ];

      // patch (snake_case for API model)
      await SurveyModel.update(surveyId, {
        blocks: updatedBlocks,
        block_order: current.blockOrder, // unchanged
        question_order: updatedQuestionOrder,
      });

      // refresh UI
      const freshQs = await getAllQuestions(orgId, surveyId);
      setQuestions(freshQs || []);
      setSurvey({
        ...current,
        blocks: updatedBlocks,
        questionOrder: updatedQuestionOrder,
      });

      // reset dialog
      setSelectedType(null);
      setNewQuestionData({ label: "", description: "", config: {} });
      setShowTypePopup(false);
    } catch (err) {
      console.error("Error adding question:", err);
      alert(err?.message || "Failed to add question");
    }
  };

  // ===== Add Block =====
  const handleAddBlock = async () => {
    if (!newBlockName.trim()) return alert("Please enter block name");

    const blockId = `B${Math.floor(1000 + Math.random() * 9000)}`;
    const newBlock = { blockId, name: newBlockName.trim(), questionOrder: [] };

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
              selectedBlock={selectedBlock}                 // value = blockId
              onSelectBlock={setSelectedBlock}             // setter expects blockId
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

            <QuestionsTab
              questions={questionsInSelectedBlock}
              blocks={survey?.blocks || []}
              selectedBlockId={selectedBlock}              // blockId
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
                setSurvey((prev) => (prev ? { ...prev, blocks: newBlocks } : prev))
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

        {activeTab === "demo" && <SurveyDemoPage />}
        {activeTab === "distribution" && <DistributionPage />}
        {activeTab === "campaign" && <CampaignPage />}
      </div>
    </div>
  );
}
