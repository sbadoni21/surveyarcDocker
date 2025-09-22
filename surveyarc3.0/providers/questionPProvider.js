"use client";
import React, { createContext, useContext, useState, useEffect } from "react";
import QuestionModel from "@/models/questionModel";
import { usePathname } from "next/navigation";
import { getCookie } from "cookies-next";

const QuestionContext = createContext();

export const QuestionProvider = ({ children }) => {
  const [questions, setQuestions] = useState([]);
  const [selectedQuestion, setSelectedQuestion] = useState(null);

  const [orgId, setOrgId] = useState(null);
  const [surveyId, setSurveyId] = useState(null);
  const path = usePathname();
  const pathParts = path.split("/");
  
  useEffect(() => {
    const storedOrgId = getCookie("currentOrgId") || null;
    const storedSurveyId = pathParts[7];

    setOrgId(storedOrgId);
    setSurveyId(storedSurveyId);

    getAllQuestions(storedOrgId, storedSurveyId);
  }, []);

  const getQuestion = async (orgId, surveyId, questionId) => {
    const data = await QuestionModel.get(orgId, surveyId, questionId);
    setSelectedQuestion(data);
    return data;
  };

  const getAllQuestions = async (orgId, surveyId) => {
    const data = await QuestionModel.getAll(orgId, surveyId);
    setQuestions(data || []);
    return data;
  };

  const saveQuestion = async (orgId, surveyId, data) => {
    await QuestionModel.create(orgId, surveyId, data);
    setQuestions((prev) => [...prev, data]);
  };

  const updateQuestion = async (orgId, surveyId, questionId, updateData) => {
    await QuestionModel.update(orgId, surveyId, questionId, updateData);
    setQuestions((prev) =>
      prev.map((q) =>
        q.questionId === questionId ? { ...q, ...updateData } : q
      )
    );
  };

  const deleteQuestion = async (orgId, surveyId, questionId) => {
    await QuestionModel.delete(orgId, surveyId, questionId);
    setQuestions((prev) => prev.filter((q) => q.questionId !== questionId));
  };

  return (
    <QuestionContext.Provider
      value={{
        questions,
        selectedQuestion,
        getQuestion,
        getAllQuestions,
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
