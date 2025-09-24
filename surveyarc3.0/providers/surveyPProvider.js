// providers/surveyPProvider.js
'use client';
import SurveyModel from '@/models/surveyModel';
import React, { createContext, useContext, useState } from 'react';

const SurveyContext = createContext();

export const SurveyProvider = ({ children }) => {
  const [surveys, setSurveys] = useState([]);
  const [surveyLoading, setLoading] = useState(false);
  const [selectedSurvey, setSelectedSurvey] = useState(null);

  const getSurvey = async (surveyId) => {
    console.log("gcfhvjikol")
    const data = await SurveyModel.get(surveyId);
    console.log(data)
    setSelectedSurvey(data);
    return data;
  };

  const getAllSurveys = async (_orgId, projectId) => {
    setLoading(true);

    try {

      const list = await SurveyModel.getAllByProject(projectId);
      setSurveys(list || []);
      return list;
    } finally {
      setLoading(false);
    }
  };

  const saveSurvey = async (data) => {
    const created = await SurveyModel.create(data.orgId, data);
    setSurveys((prev) => [...prev, created]);
    return created;
  };

  const updateSurvey = async (_orgId, surveyId, updateData) => {
    const updated = await SurveyModel.update(surveyId, updateData);
    setSurveys((prev) =>
      prev.map((s) => (s.survey_id === surveyId ? { ...s, ...updated } : s))
    );
    return updated;
  };

  const deleteSurvey = async (_orgId, surveyId) => {
    await SurveyModel.delete(surveyId);
    setSurveys((prev) => prev.filter((s) => s.survey_id !== surveyId));
  };

  const listResponses = async (surveyId) => {
    return SurveyModel.listResponses(surveyId);
  };

  const countResponses = async (surveyId) => {
    return SurveyModel.countResponses(surveyId); // { count }
  };

  return (
    <SurveyContext.Provider
      value={{
        surveys,
        selectedSurvey,
        getSurvey,
        getAllSurveys,
        saveSurvey,
        updateSurvey,
        deleteSurvey,
        setSelectedSurvey,
        surveyLoading,
        listResponses,
        countResponses,
      }}
    >
      {children}
    </SurveyContext.Provider>
  );
};

export const useSurvey = () => useContext(SurveyContext);
