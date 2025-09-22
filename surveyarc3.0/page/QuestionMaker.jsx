"use client";
import React, { useEffect, useMemo, useState, useCallback } from "react";

import QUESTION_TYPES from "@/enums/questionTypes";
import { usePathname } from "next/navigation";
import QuestionsTab from "@/components/QuestionsTab";
import RulesTab from "@/components/RulesTab";
import { useQuestion } from "@/providers/questionPProvider";
import { useSurvey } from "@/providers/surveyPProvider";
import { db } from "@/firebase/firebase";
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import Loading from "@/app/[locale]/loading";
import SurveyDemoPage from "./SurveyDemoPage";
import TopTabsNavbar from "@/components/TopTabsNavbar";
import DistributionPage from "./DistributionPage";
import SurveyToolbar from "@/components/SurveyToolbar";
import CampaignPage from "./CampaignPage";

export default function dist() {
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
  const [selectedBlock, setSelectedBlock] = useState(null);
  const [newBlockName, setNewBlockName] = useState("");
  const [loading, setLoading] = useState(true);

  const pathname = usePathname();
  const pathParts = pathname.split("/");
  const orgId = pathParts[3];
  const projectId = pathParts[6];
  const surveyId = pathParts[7];

  const domain =
    process.env.NEXT_PUBLIC_DOMAIN || "https://surveyarc2-0.vercel.app";
  const publicSurveyUrl = `${domain}/en/form?orgId=${orgId}&projects=${projectId}&survey=${surveyId}`;

  const { getAllQuestions } = useQuestion();
  const { updateSurvey, getSurvey } = useSurvey();
  const [questions, setQuestions] = useState([]);
  const normalizeHashToTab = useCallback((hash) => {
    const k = String(hash || "")
      .replace(/^#/, "")
      .toLowerCase();

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

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const questionsData = await getAllQuestions(orgId, surveyId);
        setQuestions(questionsData);
        const surveyData = await getSurvey(orgId, surveyId);
        setSurvey(surveyData);

        if (surveyData?.blocks?.length > 0 && !selectedBlock) {
          setSelectedBlock(surveyData.blocks[0].blockId);
        }
      } catch (error) {
        console.error("Failed to fetch data:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [orgId, surveyId]);

  const handleAddQuestion = async () => {
    if (!selectedBlock) {
      alert("Please select a block to add question");
      return;
    }

    const questionId = `Q${Math.floor(100000 + Math.random() * 900000)}`;
    const newQuestion = {
      questionId,
      type: selectedType,
      label: newQuestionData.label,
      description: newQuestionData.description,
      config: newQuestionData.config,
    };

    try {
      const docId = `${surveyId}`;
      const docRef = doc(db, "organizations", orgId, "questions", docId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        await updateDoc(docRef, {
          questions: [...(docSnap.data().questions || []), newQuestion],
        });
      } else {
        await setDoc(docRef, {
          orgId,
          surveyId,
          projectId,
          uid: docId,
          createdAt: serverTimestamp(),
          questions: [newQuestion],
        });
      }

      const currentSurvey = await getSurvey(orgId, surveyId);
      const updatedBlocks = (currentSurvey.blocks || []).map((block) => {
        if (block.blockId === selectedBlock) {
          return {
            ...block,
            questionOrder: [...(block.questionOrder || []), questionId],
          };
        }
        return block;
      });

      await updateSurvey(orgId, surveyId, {
        blocks: updatedBlocks,
        questionOrder: [...(currentSurvey.questionOrder || []), questionId],
      });

      const questionsData = await getAllQuestions(orgId, surveyId);
      setQuestions(questionsData);
      setSurvey({
        ...currentSurvey,
        blocks: updatedBlocks,
        questionOrder: [...(currentSurvey.questionOrder || []), questionId],
      });

      setSelectedType(null);
      setNewQuestionData({ label: "", description: "", config: {} });
      setShowTypePopup(false);
    } catch (err) {
      console.error("Error adding question:", err);
    }
  };

  const handleUpdateQuestion = async (questionId, updatedQuestion) => {
    try {
      await fetch("/api/questions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId,
          surveyId,
          questionId,
          updatedQuestion,
        }),
      });

      setQuestions((prev) =>
        prev.map((q) => (q.questionId === questionId ? updatedQuestion : q))
      );
    } catch (error) {
      console.error("Failed to update question", error);
    }
  };

  const updateConfig = (key, value) => {
    setNewQuestionData((prev) => ({
      ...prev,
      config: {
        ...prev.config,
        [key]: value,
      },
    }));
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(publicSurveyUrl).then(() => {
      alert("Survey link copied to clipboard!");
    });
  };

  const handleAddBlock = async () => {
    if (!newBlockName.trim()) return alert("Please enter block name");
    const blockId = `B${Math.floor(1000 + Math.random() * 9000)}`;
    const newBlock = { blockId, name: newBlockName.trim(), questionOrder: [] };
    const currentSurvey = await getSurvey(orgId, surveyId);
    const updatedBlocks = [...(currentSurvey.blocks || []), newBlock];
    const updatedBlockOrder = [...(currentSurvey.blockOrder || []), blockId];

    await updateSurvey(orgId, surveyId, {
      blocks: updatedBlocks,
      blockOrder: updatedBlockOrder,
    });
    setSurvey({
      ...currentSurvey,
      blocks: updatedBlocks,
      blockOrder: updatedBlockOrder,
    });
    setNewBlockName("");
    setSelectedBlock(blockId);
  };

  if (loading) {
    return <Loading />;
  }

  return (
    <div className="flex flex-col min-h-screen">
      <TopTabsNavbar activeTab={activeTab} setActiveTab={handleSetActiveTab} />

      <div className="flex-1 overflow-auto bg-[#f5f5f5] dark:bg-[#121214] p-4">
        {activeTab === "questions" && (
          <>
            <SurveyToolbar
              blocks={survey?.blocks || []}
              selectedBlock={selectedBlock}
              onSelectBlock={setSelectedBlock}
              newBlockName={newBlockName}
              setNewBlockName={setNewBlockName}
              onAddBlock={handleAddBlock}
              onCopyLink={handleCopyLink}
              onNewQuestion={() => setShowTypePopup(true)}
              publicSurveyUrl={publicSurveyUrl}
              surveyTitle={survey?.title || "Survey"}
              showBlocks={true}
              showCopy={true}
              showQR={true}
              showNewQuestion={true}
            />

            <QuestionsTab
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

        {activeTab === "demo" && <SurveyDemoPage />}
        {activeTab === "distribution" && <DistributionPage />}
        {activeTab === "campaign" && <CampaignPage />}
      </div>
    </div>
  );
}
