
// providers/CampaignResultProvider.js
"use client";
import React, { createContext, useContext, useState } from "react";
import CampaignResultModel from "@/models/postGresModels/campaginResults";

const CampaignResultContext = createContext();

export const CampaignResultProvider = ({ children }) => {
  const [campaignResults, setCampaignResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const getCampaignResults = async (campaignId) => {
    setLoading(true);
    try {
      const results = await CampaignResultModel.getAllByCampaign(campaignId);
      setCampaignResults(results || []);
      return results;
    } finally {
      setLoading(false);
    }
  };
  const getOrCreateCampaignResult = async (data) => {
    const result = await CampaignResultModel.getOrCreate(data);
    setCampaignResults((prev) => {
      const exists = prev.find((r) => r.resultId === result.resultId);
      if (exists) {
        return prev.map((r) => (r.resultId === result.resultId ? result : r));
      }
      return [result, ...prev];
    });
    return result;
  };
  const createCampaignResult = async (data) => {
    const created = await CampaignResultModel.create(data);
    setCampaignResults((prev) => [created, ...prev]);
    return created;
  };

  const updateCampaignResult = async (resultId, updateData) => {
    const updated = await CampaignResultModel.update(resultId, updateData);
    setCampaignResults((prev) => 
      prev.map((r) => (r.resultId === resultId ? updated : r))
    );
    return updated;
  };

  return (
    <CampaignResultContext.Provider
      value={{
        campaignResults,
        loading,
        getCampaignResults,
        createCampaignResult,
        updateCampaignResult,getOrCreateCampaignResult
      }}
    >
      {children}
    </CampaignResultContext.Provider>
  );
};

export const useCampaignResult = () => useContext(CampaignResultContext);