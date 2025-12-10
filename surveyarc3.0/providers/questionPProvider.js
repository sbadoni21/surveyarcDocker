"use client";
import React, { createContext, useContext, useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { getCookie } from "cookies-next";
import QuestionModel from "@/models/questionModel";

const QuestionContext = createContext(null);

export const QuestionProvider = ({ children }) => {
  const [questions, setQuestions] = useState([]);
  const [selectedQuestion, setSelectedQuestion] = useState(null);

  const [orgId, setOrgId] = useState(null);
  const [surveyId, setSurveyId] = useState(null);

  const pathname = usePathname();
  const searchParams = useSearchParams();

  // 1) Prefer survey_id from query (?survey_id=...)
  const surveyIdFromQuery = searchParams?.get("survey_id") || null;

  // 2) Fallback: derive from path
  // Example: /en/postgres-org/{orgId}/dashboard/projects/{projectId}/{surveyId}
  let surveyIdFromPath = null;
  if (pathname) {
    const parts = pathname.split("/").filter(Boolean); // remove empty

    // If you ever have /surveys/[surveyId]
    const surveysIdx = parts.indexOf("surveys");
    if (surveysIdx !== -1 && parts.length > surveysIdx + 1) {
      surveyIdFromPath = parts[surveysIdx + 1];
    } else {
      const last = parts[parts.length - 1];
      if (last && last !== "form") {
        surveyIdFromPath = last;
      }
    }
  }

  // 3) Final survey id
  const resolvedSurveyId = surveyIdFromQuery || surveyIdFromPath || null;

  useEffect(() => {
    const currentOrgId = getCookie("currentOrgId") || null;
    setOrgId(currentOrgId);
    setSurveyId(resolvedSurveyId);

    // Don’t auto-fetch on public /form — FormPage already fetches
    if (!currentOrgId || !resolvedSurveyId) return;
    if (pathname && pathname.startsWith("/form")) return;

    getAllQuestions(currentOrgId, resolvedSurveyId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams?.toString()]);

  const getAllQuestions = async (_orgId, _surveyId) => {
    if (!_orgId || !_surveyId) return [];
    const data = await QuestionModel.getAll(_orgId, _surveyId);
    setQuestions(data || []);
    return data;
  };

  const getQuestion = async (_orgId, _surveyId, questionId) => {
    const q = await QuestionModel.get(_orgId, _surveyId, questionId);
    setSelectedQuestion(q);
    return q;
  };

  const getBulkQuestions = async (questionIds) => {
    const q = await QuestionModel.getBulkQuestions(questionIds);
    return q;
  };

  const saveQuestion = async (_orgId, _surveyId, data) => {
    const created = await QuestionModel.create(_orgId, _surveyId, data);
    setQuestions((prev) => [...prev, created]);
    return created;
  };

  const updateQuestion = async (_orgId, _surveyId, questionId, updateData) => {
    const updated = await QuestionModel.update(
      _orgId,
      _surveyId,
      questionId,
      updateData
    );
    setQuestions((prev) =>
      prev.map((q) => (q.questionId === questionId ? updated : q))
    );
    return updated;
  };

  const deleteQuestion = async (_orgId, _surveyId, questionId) => {
    await QuestionModel.delete(_orgId, _surveyId, questionId);
    setQuestions((prev) => prev.filter((q) => q.questionId !== questionId));
  };

  return (
    <QuestionContext.Provider
      value={{
        questions,
        selectedQuestion,
        getAllQuestions,
        getQuestion,
        getBulkQuestions,
        saveQuestion,
        updateQuestion,
        deleteQuestion,
        setSelectedQuestion,
        orgId,
        surveyId,
      }}
    >
      {children}
    </QuestionContext.Provider>
  );
};

export const useQuestion = () => useContext(QuestionContext);
