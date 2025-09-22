'use client';

import answerModel from '@/models/answerModel';
import { getCookie } from 'cookies-next';
import React, { createContext, useContext, useState, useEffect } from 'react';

const AnswerContext = createContext();

export const AnswerProvider = ({ children }) => {
  const [answers, setAnswers] = useState({});

  // Helper to build composite key
  const _key = (orgId, surveyId, responseId, answerId) =>
    `${orgId}_${surveyId}_${responseId}_${answerId}`;

  // Fetch single answer (from cache or model)
  const getAnswer = async (surveyId, responseId, answerId) => {
    const orgId = getCookie('currentOrgId');
    const key = _key(orgId, surveyId, responseId, answerId);

    if (answers[key]) return answers[key];

    const doc = await answerModel.get(orgId, surveyId, responseId, answerId);
    if (doc?.exists) {
      const data = doc.data();
      setAnswers(prev => ({ ...prev, [key]: data }));
      return data;
    }

    return null;
  };

  const createAnswer = async (surveyId, responseId, answerData) => {
    const orgId = getCookie('currentOrgId');
    await answerModel.create(orgId, surveyId, responseId, answerData);
    const key = _key(orgId, surveyId, responseId, answerData.questionId);
    setAnswers(prev => ({ ...prev, [key]: answerData }));
  };

  const updateAnswer = async (surveyId, responseId, answerId, updateData) => {
    const orgId = getCookie('currentOrgId');
    await answerModel.update(orgId, surveyId, responseId, answerId, updateData);
    const key = _key(orgId, surveyId, responseId, answerId);
    const updatedDoc = await answerModel.get(orgId, surveyId, responseId, answerId);
    if (updatedDoc?.exists) {
      const updatedData = updatedDoc.data();
      setAnswers(prev => ({ ...prev, [key]: updatedData }));
    }
  };

  const deleteAnswer = async (surveyId, responseId, answerId) => {
    const orgId = getCookie('currentOrgId');
    await answerModel.delete(orgId, surveyId, responseId, answerId);
    const key = _key(orgId, surveyId, responseId, answerId);
    setAnswers(prev => {
      const newAnswers = { ...prev };
      delete newAnswers[key];
      return newAnswers;
    });
  };

  const invalidateResponseAnswers = (surveyId, responseId) => {
    const orgId = getCookie('currentOrgId');
    const prefix = `${orgId}_${surveyId}_${responseId}_`;
    setAnswers(prev => {
      const filtered = {};
      for (const key in prev) {
        if (!key.startsWith(prefix)) filtered[key] = prev[key];
      }
      return filtered;
    });
  };

  return (
    <AnswerContext.Provider
      value={{
        answers,
        getAnswer,
        createAnswer,
        updateAnswer,
        deleteAnswer,
        invalidateResponseAnswers
      }}
    >
      {children}
    </AnswerContext.Provider>
  );
};

export const useAnswer = () => useContext(AnswerContext);
