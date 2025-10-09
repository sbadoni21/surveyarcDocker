"use client";
import React, { createContext, useContext, useState } from "react";
import ResponseModel from "@/models/postGresModels/responseModel";

const ResponseContext = createContext();

export const ResponseProvider = ({ children }) => {
  const [responses, setResponses] = useState([]);
  const [selectedResponse, setSelectedResponse] = useState(null);
  const [loading, setLoading] = useState(false);

  const getAllResponses = async (surveyId) => {
    setLoading(true);
    try {
      const list = await ResponseModel.getAllBySurvey(surveyId);
      setResponses(list || []);
      return list;
    } finally {
      setLoading(false);
    }
  };

  const getResponse = async (surveyId, responseId) => {
    const r = await ResponseModel.get(surveyId, responseId);
    setSelectedResponse(r);
    return r;
  };

  const saveResponse = async (orgId, surveyId, data) => {
    const created = await ResponseModel.create(orgId, surveyId, data);
    setResponses((prev) => [created, ...prev]);
    return created;
  };

  const updateResponse = async (surveyId, responseId, updateData) => {
    const updated = await ResponseModel.update(surveyId, responseId, updateData);
    setResponses((prev) => prev.map((r) => (r.responseId === responseId ? updated : r)));
    return updated;
  };

  const deleteResponse = async (surveyId, responseId) => {
    await ResponseModel.delete(surveyId, responseId);
    setResponses((prev) => prev.filter((r) => r.responseId !== responseId));
  };

  const countResponses = async (surveyId) => ResponseModel.count(surveyId);

  return (
    <ResponseContext.Provider
      value={{
        responses,
        selectedResponse,
        loading,
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

export const useResponse = () => useContext(ResponseContext);
