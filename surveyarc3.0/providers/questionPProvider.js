"use client";
import React, { createContext, useContext, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { getCookie } from "cookies-next";
import QuestionModel from "@/models/questionModel";

const QuestionContext = createContext();

export const QuestionProvider = ({ children }) => {
  const [questions, setQuestions] = useState([]);
  const [selectedQuestion, setSelectedQuestion] = useState(null);

  const [orgId, setOrgId] = useState(null);
  const [surveyId, setSurveyId] = useState(null);

  const path = usePathname();
  const parts = (path || "").split("/"); // e.g. /en/postgres-org/{orgId}/dashboard/projects/{projectId}/{surveyId}
  // Adjust index per your routing: you used 7 earlier; confirm with your actual path.
  const inferredSurveyId = parts[7] || parts[parts.length - 1];

  useEffect(() => {
    const o = getCookie("currentOrgId") || null;
    setOrgId(o);
    setSurveyId(inferredSurveyId);

    if (o && inferredSurveyId) {
      getAllQuestions(o, inferredSurveyId);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  const getAllQuestions = async (_orgId, _surveyId) => {
    const data = await QuestionModel.getAll(_orgId, _surveyId);
    setQuestions(data || []);
    return data;
  };

  const getQuestion = async (_orgId, _surveyId, questionId) => {
    const q = await QuestionModel.get(_orgId, _surveyId, questionId);
    setSelectedQuestion(q);
    return q;
  };
const getBulkQuestions = async ( questionIds) => {
  const q = await QuestionModel.getBulkQuestions( questionIds);
  return q;
};

  const saveQuestion = async (_orgId, _surveyId, data) => {
    const created = await QuestionModel.create(_orgId, _surveyId, data);
    setQuestions((prev) => [...prev, created]);
    return created;
  };

  const updateQuestion = async (_orgId, _surveyId, questionId, updateData) => {
    const updated = await QuestionModel.update(_orgId, _surveyId, questionId, updateData);
    setQuestions((prev) => prev.map((q) => (q.questionId === questionId ? updated : q)));
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
        saveQuestion,
        getBulkQuestions,
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
