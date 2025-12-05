'use client';
import SurveyModel from '@/models/surveyModel';
import React, { createContext, useContext, useState } from 'react';

const SurveyContext = createContext();

export const SurveyProvider = ({ children }) => {
  const [surveys, setSurveys] = useState([]);
  const [surveyLoading, setLoading] = useState(false);
  const [selectedSurvey, setSelectedSurvey] = useState(null);

  const getSurvey = async (surveyId) => {
    const data = await SurveyModel.get(surveyId);
    setSelectedSurvey(data);
    return data;
  };

  // 🔹 PROJECT-SCOPED: Load surveys for a specific project into state
  const getAllSurveys = async (_orgId, projectId) => {
    setLoading(true);
    try {
      const raw = await SurveyModel.getAllByProject(projectId);
      console.log('getAllSurveys raw response:', raw);

      // Handle both array and { items: [] } style responses
      const list = Array.isArray(raw)
        ? raw
        : Array.isArray(raw?.items)
        ? raw.items
        : [];

      setSurveys(list);
      return list;
    } catch (error) {
      console.error('Error in getAllSurveys:', error);
      return [];
    } finally {
      setLoading(false);
    }
  };

  // 🔹 PROJECT-SCOPED: Fetch surveys but don't touch global state
  const fetchSurveysByProject = async (projectId) => {
    try {
      const raw = await SurveyModel.getAllByProject(projectId);
      console.log(`Surveys for project ${projectId}:`, raw);

      const list = Array.isArray(raw)
        ? raw
        : Array.isArray(raw?.items)
        ? raw.items
        : [];

      return list;
    } catch (error) {
      console.error(`Error fetching surveys for project ${projectId}:`, error);
      return [];
    }
  };

  // 🔹 ORG-SCOPED: Load all surveys for an org into state
  const getAllOrgSurveys = async (orgId) => {
    setLoading(true);
    try {
      const raw = await SurveyModel.getAll(orgId);
      console.log('getAllOrgSurveys raw response:', raw);

      const list = Array.isArray(raw)
        ? raw
        : Array.isArray(raw?.items)
        ? raw.items
        : [];

      setSurveys(list);
      return list;
    } catch (error) {
      console.error('Error in getAllOrgSurveys:', error);
      return [];
    } finally {
      setLoading(false);
    }
  };

  // 🔹 ORG-SCOPED: Fetch all surveys for an org without touching state
  const fetchAllOrgSurveys = async (orgId) => {
    try {
      const raw = await SurveyModel.getAll(orgId);
      console.log('fetchAllOrgSurveys raw response:', raw);

      const list = Array.isArray(raw)
        ? raw
        : Array.isArray(raw?.items)
        ? raw.items
        : [];

      return list;
    } catch (error) {
      console.error('Error in fetchAllOrgSurveys:', error);
      return [];
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
    return SurveyModel.countResponses(surveyId);
  };

  return (
    <SurveyContext.Provider
      value={{
        surveys,
        selectedSurvey,
        surveyLoading,

        // single survey
        getSurvey,
        setSelectedSurvey,

        // project-scoped
        getAllSurveys,
        fetchSurveysByProject,

        // org-scoped
        getAllOrgSurveys,
        fetchAllOrgSurveys,

        // mutations
        saveSurvey,
        updateSurvey,
        deleteSurvey,

        // responses
        listResponses,
        countResponses,
      }}
    >
      {children}
    </SurveyContext.Provider>
  );
};

export const useSurvey = () => useContext(SurveyContext);
