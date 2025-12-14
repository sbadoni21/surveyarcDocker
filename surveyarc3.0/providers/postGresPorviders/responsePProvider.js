"use client";
import React, { createContext, useContext, useEffect, useState, useRef } from "react";
import ResponseModel from "@/models/postGresModels/responseModel";
import { usePathname, useSearchParams } from "next/navigation";

const ResponseContext = createContext();

export const ResponseProvider = ({ children }) => {
  const [responses, setResponses] = useState([]);
  const [selectedResponse, setSelectedResponse] = useState(null);
  const [loading, setLoading] = useState(false);
  const lastFetchedSurveyId = useRef(null);

  const pathname = usePathname();
  const searchParams = useSearchParams();

  // 1) Try from query: ?survey_id=...
  const surveyIdFromQuery = searchParams?.get("survey_id") || null;
  
  // 2) Try to extract from pathname: /dashboard/projects/proj_xxx/survey_xxx
  const surveyIdFromPath = pathname?.match(/survey_[a-zA-Z0-9]+/)?.[0] || null;

  // 3) Final resolved surveyId (prefer query, fallback to path)
  const resolvedSurveyId = surveyIdFromQuery || surveyIdFromPath;

  useEffect(() => {
    // 🔹 Don't auto-fetch on the public /form page at all
    if (pathname?.startsWith("/form")) {
      return;
    }

    // 🔹 Prevent duplicate fetches for the same survey
    if (resolvedSurveyId && resolvedSurveyId !== lastFetchedSurveyId.current) {
      lastFetchedSurveyId.current = resolvedSurveyId;
      getAllResponses(resolvedSurveyId);
    } else if (!resolvedSurveyId) {
      // Reset when no survey is selected
      lastFetchedSurveyId.current = null;
      setResponses([]);
    } else {
      console.log("[ResponseProvider] ⏸️ Skipping fetch - already loaded:", resolvedSurveyId);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedSurveyId]);

  const getAllResponses = async (surveyId) => {
    if (!surveyId) {
      console.warn("[ResponseProvider] ⚠️ getAllResponses called without surveyId");
      return [];
    }
    
    setLoading(true);
    
    try {
      const list = await ResponseModel.getAllBySurvey(surveyId);
  
      setResponses(list || []);
      return list;
    } catch (error) {
      setResponses([]);
      return [];
    } finally {
      setLoading(false);
    }
  };

  const getResponse = async (surveyId, responseId) => {
    try {
      const r = await ResponseModel.get(surveyId, responseId);
      setSelectedResponse(r);
      return r;
    } catch (error) {
      throw error;
    }
  };

  const saveResponse = async (orgId, surveyId, data) => {
    try {
      const created = await ResponseModel.create(orgId, surveyId, data);
      
      // Only update the list if we're viewing this survey
      if (surveyId === resolvedSurveyId) {
        setResponses((prev) => {
          const updated = [created, ...prev];
          return updated;
        });
      } else {
        console.log("[ResponseProvider] ⏭️ Not adding to list (different survey)");
      }
      
      return created;
    } catch (error) {
      console.error("[ResponseProvider] Error saving response:", error);
      throw error;
    }
  };

  const updateResponse = async (surveyId, responseId, updateData) => {
    try {
      const updated = await ResponseModel.update(surveyId, responseId, updateData);
      setResponses((prev) =>
        prev.map((r) => (r.response_id === responseId ? updated : r))
      );
      if (selectedResponse?.response_id === responseId) {
        setSelectedResponse(updated);
      }
      return updated;
    } catch (error) {
      console.error("[ResponseProvider] Error updating response:", error);
      throw error;
    }
  };

  const deleteResponse = async (surveyId, responseId) => {
    try {
      await ResponseModel.delete(surveyId, responseId);
      setResponses((prev) => {
        const filtered = prev.filter((r) => r.response_id !== responseId);
        return filtered;
      });
      if (selectedResponse?.response_id === responseId) {
        setSelectedResponse(null);
      }
    } catch (error) {
      console.error("[ResponseProvider] Error deleting response:", error);
      throw error;
    }
  };

  const countResponses = async (surveyId) => {
    try {
      return await ResponseModel.count(surveyId);
    } catch (error) {
      console.error("[ResponseProvider] Error counting responses:", error);
      throw error;
    }
  };

  return (
    <ResponseContext.Provider
      value={{
        responses,
        selectedResponse,
        loading,
        surveyId: resolvedSurveyId,
        getAllResponses,
        getResponse,
        saveResponse,
        updateResponse,
        deleteResponse,
        countResponses,
        setSelectedResponse,
      }}
    >
      {children}
    </ResponseContext.Provider>
  );
};

export const useResponse = () => {
  const context = useContext(ResponseContext);
  if (!context) {
    throw new Error("useResponse must be used within ResponseProvider");
  }
  return context;
};