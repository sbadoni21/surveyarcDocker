'use client';
import React, { createContext, useContext, useState } from 'react';
import SurveyModel from '@/models/surveyModel';

const SurveyContext = createContext();

export const SurveyProvider = ({ children }) => {
  const [surveys, setSurveys] = useState([]);
  const [surveyLoading, setLoading] = useState(false);
  const [selectedSurvey, setSelectedSurvey] = useState(null);

  const getSurvey = async (orgId, surveyId) => {
    const data = await SurveyModel.get(orgId, surveyId);
    setSelectedSurvey(data);
    return data;
  };

  const getAllSurveys = async (orgId, projectId) => {
    setLoading(true);
    const data = await SurveyModel.getAllSurveys(orgId, projectId);
    setSurveys(data);
    setLoading(false);
    return data;
  };

  const getSurveysByIds = async (orgId, surveyIds) => {
    setLoading(true);
    const results = await Promise.all(
      surveyIds.map((id) => SurveyModel.get(orgId, id))
    );
    setSurveys(results);
    setLoading(false);
    return results;
  };

  const saveSurvey = async (data) => {
    await SurveyModel.create(data.orgId, data);
    setSurveys((prev) => [...prev, data]);
  };

  const updateSurvey = async (orgId, surveyId, updateData) => {
    await SurveyModel.update(orgId, surveyId, updateData);
    setSurveys((prev) =>
      prev.map((s) => (s.surveyId === surveyId ? { ...s, ...updateData } : s))
    );
  };

  const deleteSurvey = async (orgId, surveyId) => {
    await SurveyModel.delete(orgId, surveyId);
    setSurveys((prev) => prev.filter((s) => s.surveyId !== surveyId));
  };

  return (
    <SurveyContext.Provider
      value={{
        surveys,
        selectedSurvey,
        getSurvey,
        getAllSurveys,
        getSurveysByIds,
        saveSurvey,
        updateSurvey,
        deleteSurvey,
        setSelectedSurvey,
        surveyLoading,
      }}
    >
      {children}
    </SurveyContext.Provider>
  );
};

export const useSurvey = () => useContext(SurveyContext);
