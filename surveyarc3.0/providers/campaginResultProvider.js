// providers/CampaignResultProvider.jsx
"use client";
import React, { createContext, useContext, useMemo, useState } from "react";
import { getCookie } from "cookies-next";
import { getCampaignResultModel } from "@/models/campaginResults";

const CampaignResultContext = createContext(null);

export const CampaignResultProvider = ({ children }) => {
  const orgId = getCookie("currentOrgId");
  const model = useMemo(() => (orgId ? getCampaignResultModel(orgId) : null), [orgId]);

  const [cache, setCache] = useState({}); // `${orgId}_${campaignId}_results` => array

  const getCampaignResults = async (campaignId) => {
    if (!model) return [];
    const key = `${orgId}_${campaignId}_results`;
    const docs = await model.getByCampaign(campaignId);
    const rows = docs.map((d) => ({ id: d.id, ...d.data() }));
    setCache((p) => ({ ...p, [key]: rows }));
    return rows;
  };

  const createCampaignResult = async (campaignId, data) => {
    if (!model) throw new Error("Missing orgId/model");
    const ref = await model.create(campaignId, data);
    const key = `${orgId}_${campaignId}_results`;
    setCache((p) => ({ ...p, [key]: [...(p[key] || []), { id: ref.id, ...data }] }));
    return ref;
    };
  
  const updateCampaignResult = async (campaignId, resultId, updateData) => {
    if (!model) throw new Error("Missing orgId/model");
    await model.update(campaignId, resultId, updateData);
    const key = `${orgId}_${campaignId}_results`;
    setCache((p) => ({
      ...p,
      [key]: (p[key] || []).map((r) => (r.id === resultId ? { ...r, ...updateData } : r)),
    }));
  };

  return (
    <CampaignResultContext.Provider
      value={{ getCampaignResults, createCampaignResult, updateCampaignResult }}
    >
      {children}
    </CampaignResultContext.Provider>
  );
};

export const useCampaignResult = () => useContext(CampaignResultContext);
