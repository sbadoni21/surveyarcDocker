// providers/postGresPorviders/participantSourcePProvider.jsx
"use client";

import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import ParticipantSourceModel from "@/models/postGresModels/participantSourceModel";

const ParticipantSourceContext = createContext(null);

export const ParticipantSourceProvider = ({ children }) => {
  const [sources, setSources] = useState([]);          // panels for current survey
  const [selectedSource, setSelectedSource] = useState(null);
  const [loading, setLoading] = useState(false);
  const lastFetchedSurveyId = useRef(null);

  const pathname = usePathname();
  const searchParams = useSearchParams();

  const surveyIdFromQuery = searchParams?.get("survey_id") || null;
  const surveyIdFromPath =
    pathname?.match(/survey_[a-zA-Z0-9]+/)?.[0] || null;

  const resolvedSurveyId = surveyIdFromQuery || surveyIdFromPath;


  useEffect(() => {
    if (!resolvedSurveyId) {
      lastFetchedSurveyId.current = null;
      setSources([]);
      return;
    }

    if (resolvedSurveyId !== lastFetchedSurveyId.current) {
      lastFetchedSurveyId.current = resolvedSurveyId;
      fetchSources({ survey_id: resolvedSurveyId });
    } else {
      console.log("[ParticipantSourceProvider] ⏸️ Skipping fetch; already loaded for:", resolvedSurveyId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedSurveyId]);

  const fetchSources = async (filters) => {
    setLoading(true);
    try {
      const res = await ParticipantSourceModel.list(filters);
      // API returns { items, total }
      setSources(res?.items || []);
      return res;
    } catch (err) {
      console.error("[ParticipantSourceProvider] Error loading participant sources:", err);
      setSources([]);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const getSource = async (sourceId) => {
    try {
      const s = await ParticipantSourceModel.get(sourceId);
      setSelectedSource(s);
      return s;
    } catch (err) {
      console.error("[ParticipantSourceProvider] Error getting source:", err);
      throw err;
    }
  };

  const createSource = async (payload) => {
    // payload must include org_id & survey_id
    try {
      const created = await ParticipantSourceModel.create(payload);
      // if it belongs to the current survey, add to list
      if (created.survey_id === resolvedSurveyId) {
        setSources((prev) => [created, ...prev]);
      }
      return created;
    } catch (err) {
      console.error("[ParticipantSourceProvider] Error creating source:", err);
      throw err;
    }
  };

  const updateSource = async (sourceId, updateData) => {
    try {
      const updated = await ParticipantSourceModel.update(sourceId, updateData);
      setSources((prev) =>
        prev.map((s) => (s.id === sourceId ? updated : s))
      );
      if (selectedSource?.id === sourceId) setSelectedSource(updated);
      return updated;
    } catch (err) {
      console.error("[ParticipantSourceProvider] Error updating source:", err);
      throw err;
    }
  };

  const deleteSource = async (sourceId) => {
    try {
      await ParticipantSourceModel.remove(sourceId);
      setSources((prev) => prev.filter((s) => s.id !== sourceId));
      if (selectedSource?.id === sourceId) setSelectedSource(null);
    } catch (err) {
      console.error("[ParticipantSourceProvider] Error deleting source:", err);
      throw err;
    }
  };

  const getStats = async (sourceId) => {
    try {
      return await ParticipantSourceModel.stats(sourceId);
    } catch (err) {
      console.error("[ParticipantSourceProvider] Error fetching stats:", err);
      throw err;
    }
  };

  const generateUrl = async (sourceId, baseUrl) => {
    try {
      return await ParticipantSourceModel.generateUrl(sourceId, baseUrl);
    } catch (err) {
      console.error("[ParticipantSourceProvider] Error generating URL:", err);
      throw err;
    }
  };

  return (
    <ParticipantSourceContext.Provider
      value={{
        loading,
        sources,
        selectedSource,
        surveyId: resolvedSurveyId,
        fetchSources,
        getSource,
        createSource,
        updateSource,
        deleteSource,
        getStats,
        generateUrl,
        setSelectedSource,
      }}
    >
      {children}
    </ParticipantSourceContext.Provider>
  );
};

export const useParticipantSources = () => {
  const ctx = useContext(ParticipantSourceContext);
  if (!ctx) {
    throw new Error("useParticipantSources must be used within ParticipantSourceProvider");
  }
  return ctx;
};
