"use client";
import React, { createContext, useContext, useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { getCookie } from "cookies-next";
import QuestionModel from "@/models/questionModel";

const QuestionContext = createContext(null);

export const QuestionProvider = ({ children }) => {
  const [questions, setQuestions] = useState([]);
  const [selectedQuestion, setSelectedQuestion] = useState(null);
  const [currentLocale, setCurrentLocale] = useState("en");

  const [orgId, setOrgId] = useState(null);
  const [surveyId, setSurveyId] = useState(null);

  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Resolve survey_id from query or path
  const surveyIdFromQuery = searchParams?.get("survey_id") || null;
  
  let surveyIdFromPath = null;
  if (pathname) {
    const parts = pathname.split("/").filter(Boolean);
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

  const resolvedSurveyId = surveyIdFromQuery || surveyIdFromPath || null;

  useEffect(() => {
    const currentOrgId = getCookie("currentOrgId") || null;
    setOrgId(currentOrgId);
    setSurveyId(resolvedSurveyId);

    if (!currentOrgId || !resolvedSurveyId) return;
    if (pathname && pathname.startsWith("/form")) return;

    getAllQuestions(currentOrgId, resolvedSurveyId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams?.toString()]);

  // ============================================================
  // QUESTION CRUD
  // ============================================================

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
    return await QuestionModel.getBulkQuestions(questionIds);
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

  // ============================================================
  // SINGLE QUESTION TRANSLATION METHODS
  // ============================================================

  /**
   * Get all translations for a single question
   */
  const getQuestionTranslations = async (questionId) => {
    if (!surveyId) return null;
    return await QuestionModel.getQuestionTranslations(surveyId, questionId);
  };

  /**
   * Get translation for a specific locale
   */
  const getQuestionTranslation = async (questionId, locale) => {
    if (!surveyId) return null;
    return await QuestionModel.getQuestionTranslation(surveyId, questionId, locale);
  };

  /**
   * Get question with translation applied
   */
  const getQuestionWithTranslation = async (questionId, locale) => {
    if (!surveyId) return null;
    const translated = await QuestionModel.getQuestionWithTranslation(
      surveyId,
      questionId,
      locale
    );
    setSelectedQuestion(translated);
    return translated;
  };

  /**
   * Get blank translation structure for a question
   */
  const getBlankTranslationStructure = async (questionId, locale) => {
    if (!surveyId) return null;
    return await QuestionModel.getBlankTranslationStructure(
      surveyId,
      questionId,
      locale
    );
  };
const resyncTranslations = async (surveyId) => {
  if (!surveyId) return null;

  const result = await QuestionModel.resyncSurveyTranslations(surveyId);

  // refresh questions
  if (orgId && surveyId) {
    await getAllQuestions(orgId, surveyId);
  }

  return result;
};

 
  /**
   * Update translation for a specific locale
   */
  const updateQuestionTranslation = async (questionId, locale, translationData) => {
    if (!surveyId) return null;
    const updated = await QuestionModel.updateQuestionTranslation(
      surveyId,
      questionId,
      locale,
      translationData
    );
    setQuestions((prev) =>
      prev.map((q) => (q.questionId === questionId ? updated : q))
    );
    return updated;
  };

  /**
   * Delete translation for a specific locale
   */
  const deleteQuestionTranslation = async (questionId, locale) => {
    if (!surveyId) return null;
    const result = await QuestionModel.deleteQuestionTranslation(
      surveyId,
      questionId,
      locale
    );
    // Refresh questions
    if (orgId && surveyId) {
      await getAllQuestions(orgId, surveyId);
    }
    return result;
  };

  /**
   * Delete all translations for a question
   */
  const deleteAllQuestionTranslations = async (questionId) => {
    if (!surveyId) return null;
    const result = await QuestionModel.deleteAllQuestionTranslations(
      surveyId,
      questionId
    );
    // Refresh questions
    if (orgId && surveyId) {
      await getAllQuestions(orgId, surveyId);
    }
    return result;
  };

  // ============================================================
  // SURVEY-LEVEL TRANSLATION METHODS
  // ============================================================

  /**
   * Initialize blank translations for all questions in the survey
   */
  const initializeTranslations = async (surveyId,locale) => {
    console.log(surveyId, locale)
    if (!surveyId) return null;
    const result = await QuestionModel.initializeTranslations(surveyId, locale);
    // Refresh questions
    if (orgId && surveyId) {
      await getAllQuestions(orgId, surveyId);
    }
    return result;
  };

  /**
   * Get translation status for the survey
   */
  const getTranslationStatus = async () => {
    if (!surveyId) return null;
    return await QuestionModel.getTranslationStatus(surveyId);
  };

  /**
   * Get translations for all questions in the survey
   */
  const getSurveyTranslations = async (locale = null) => {
    if (!surveyId) return null;
    return await QuestionModel.getSurveyTranslations(surveyId, locale);
  };

  /**
   * Bulk update translations for multiple questions
   */
  const bulkUpdateTranslations = async (bulkData) => {
    if (!surveyId) return null;
    const result = await QuestionModel.bulkUpdateTranslations(surveyId, bulkData);
    // Refresh questions
    if (orgId && surveyId) {
      await getAllQuestions(orgId, surveyId);
    }
    return result;
  };

  /**
   * Delete all translations for a specific locale from the survey
   */
  const deleteTranslation = async (locale) => {
    if (!surveyId) return null;
    const result = await QuestionModel.deleteTranslation(surveyId, locale);
    // Refresh questions
    if (orgId && surveyId) {
      await getAllQuestions(orgId, surveyId);
    }
    return result;
  };

  /**
   * Get all questions with a specific locale applied
   */
  const getQuestionsWithLocale = async (locale) => {
    if (!orgId || !surveyId) return [];
    const data = await QuestionModel.getAllWithLocale(orgId, surveyId, locale);
    setQuestions(data || []);
    setCurrentLocale(locale);
    return data;
  };

  /**
   * Switch the current locale and refresh questions
   */
  const switchLocale = async (locale) => {
    setCurrentLocale(locale);
    if (locale === "en") {
      // For English, just get regular questions
      return await getAllQuestions(orgId, surveyId);
    } else {
      // For other locales, get translated questions
      return await getQuestionsWithLocale(locale);
    }
  };

  return (
    <QuestionContext.Provider
      value={{
        // State
        questions,
        selectedQuestion,
        orgId,
        surveyId,
        currentLocale,
        setCurrentLocale,
        setSelectedQuestion,

        // Question CRUD
        getAllQuestions,
        getQuestion,
        getBulkQuestions,
        saveQuestion,
        updateQuestion,
        deleteQuestion,

        // Single Question Translation
        getQuestionTranslations,
        getQuestionTranslation,
        getQuestionWithTranslation,
        getBlankTranslationStructure,
        updateQuestionTranslation,
        deleteQuestionTranslation,
        deleteAllQuestionTranslations,

        // Survey-Level Translation
        initializeTranslations,
        resyncTranslations,
        getTranslationStatus,
        getSurveyTranslations,
        bulkUpdateTranslations,
        deleteTranslation,

        // Convenience Methods
        getQuestionsWithLocale,
        switchLocale,
      }}
    >
      {children}
    </QuestionContext.Provider>
  );
};

export const useQuestion = () => useContext(QuestionContext);