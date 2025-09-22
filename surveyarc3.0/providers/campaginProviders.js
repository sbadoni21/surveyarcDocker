// providers/CampaignProvider.jsx
"use client";
import React, { createContext, useContext, useMemo, useState } from "react";
import { getCookie } from "cookies-next";
import { getCampaignModel } from "@/models/campaginModel";

const CampaignContext = createContext(null);

export const CampaignProvider = ({ children }) => {
  const orgId = getCookie("currentOrgId");
  const model = useMemo(() => (orgId ? getCampaignModel(orgId) : null), [orgId]);

  const [campaigns, setCampaigns] = useState({}); // key => data

  const keyFor = (projectId, campaignId) => `${orgId}_${projectId}_${campaignId}`;

  const loadProjectCampaigns = async (projectId) => {
    if (!model) return [];
    const docs = await model.getByProject(projectId);
    console.log(docs.toString)
    setCampaigns((prev) => {
      const next = { ...prev };
      docs.forEach((d) => {
        const data = { id: d.id, ...d.data() };
        next[keyFor(data.projectId, d.id)] = data;
      });
      return next;
    });
    return docs.map((d) => ({ id: d.id, ...d.data() }));
  };

  const getCampaign = async (campaignId) => {
    if (!model) return null;
    const snap = await model.get(campaignId);
    if (!snap) return null;
    const data = { id: snap.id, ...snap.data() };
    setCampaigns((prev) => ({ ...prev, [keyFor(data.projectId, data.id)]: data }));
    return data;
  };

  const createCampaign = async (projectId, payload) => {
    if (!model) throw new Error("Missing orgId/model");
    const ref = await model.create(projectId, payload);
    const snap = await model.get(ref.id);
    const data = { id: ref.id, ...snap.data() };
    setCampaigns((prev) => ({ ...prev, [keyFor(projectId, ref.id)]: data }));
    return data;
  };

  const updateCampaign = async (projectId, campaignId, updateData) => {
    if (!model) throw new Error("Missing orgId/model");
    await model.update(campaignId, updateData);
    const snap = await model.get(campaignId);
    const data = { id: campaignId, ...snap.data() };
    setCampaigns((prev) => ({ ...prev, [keyFor(projectId, campaignId)]: data }));
  };

  const deleteCampaign = async (projectId, campaignId) => {
    if (!model) throw new Error("Missing orgId/model");
    await model.delete(campaignId);
    setCampaigns((prev) => {
      const next = { ...prev };
      delete next[keyFor(projectId, campaignId)];
      return next;
    });
  };

  const updateCampaignStatus = async (projectId, campaignId, status, totals = {}) => {
    if (!model) throw new Error("Missing orgId/model");
    const patch = {
      status,
      ...(Object.keys(totals).length ? { totals } : {}),
    };
    await model.update(campaignId, patch);
    setCampaigns((prev) => ({
      ...prev,
      [keyFor(projectId, campaignId)]: { ...(prev[keyFor(projectId, campaignId)] || {}), ...patch },
    }));
  };
const getAllCampaignsForProject = (projectId) => {
  const orgId = getCookie('currentOrgId');
  const byValue = Object.values(campaigns).filter(c => c?.projectId === projectId && (!c.orgId || c.orgId === orgId));
  if (byValue.length) return byValue;

  const prefix = `${orgId}_${projectId}_`;
  return Object.entries(campaigns)
    .filter(([k]) => k.startsWith(prefix))
    .map(([_, v]) => v);
};


  return (
    <CampaignContext.Provider
      value={{
        loadProjectCampaigns,
        getCampaign,
        createCampaign,
        updateCampaign,
        deleteCampaign,
        updateCampaignStatus,
        getAllCampaignsForProject,
      }}
    >
      {children}
    </CampaignContext.Provider>
  );
};

export const useCampaign = () => useContext(CampaignContext);
