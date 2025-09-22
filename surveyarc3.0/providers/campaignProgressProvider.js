// ======================== providers/campaignProgressProvider.jsx ========================
import React, { createContext, useContext, useMemo, useState, useEffect, useCallback } from "react";
import { onSnapshot, doc, query, where, collection } from "firebase/firestore";
import { db } from "@/firebase/firebase";
import { getCookie } from "cookies-next";
import CampaignProgressModel, { campaignProgressModel as singletonModel } from "@/models/campaignProgressModel";

const CampaignProgressContext = createContext();

export const CampaignProgressProvider = ({ children }) => {
  const orgId = useMemo(() => getCookie("currentOrgId"), []);
  const [progressByCampaignId, setProgressByCampaignId] = useState({});
  const model = useMemo(() => {
    if (!orgId) return null;
    // hydrate singleton with orgId if needed
    singletonModel.orgId = orgId;
    return new CampaignProgressModel(orgId);
  }, [orgId]);

  const subscribeCampaignProgress = useCallback(
    (campaignId) => {
      if (!orgId || !campaignId) return () => {};
      const ref = doc(db, "organizations", orgId, "campaignProgress", campaignId);
      return onSnapshot(ref, (snap) => {
        if (!snap.exists()) return;
        const data = snap.data();
        setProgressByCampaignId((prev) => ({ ...prev, [campaignId]: { id: snap.id, ...data } }));
      });
    },
    [orgId]
  );

  const subscribeProjectProgress = useCallback(
    (projectId) => {
      if (!orgId || !projectId) return () => {};
      const q = query(
        collection(db, "organizations", orgId, "campaignProgress"),
        where("projectId", "==", projectId)
      );
      return onSnapshot(q, (snap) => {
        const next = {};
        snap.forEach((d) => (next[d.id] = { id: d.id, ...d.data() }));
        setProgressByCampaignId((prev) => ({ ...prev, ...next }));
      });
    },
    [orgId]
  );

  const value = {
    progressByCampaignId,
    subscribeCampaignProgress,
    subscribeProjectProgress,
    // passthrough model methods for convenience
    upsert: model?.upsert.bind(model),
    markStarted: model?.markStarted.bind(model),
    markCompleted: model?.markCompleted.bind(model),
    tick: model?.tick.bind(model),
    setPercentage: model?.setPercentage.bind(model),
  };

  return <CampaignProgressContext.Provider value={value}>{children}</CampaignProgressContext.Provider>;
};

export const useCampaignProgress = () => useContext(CampaignProgressContext);
