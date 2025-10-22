// ============================================
// PROVIDER - providers/postGresProviders/TicketTaxonomyProvider.jsx
// ============================================

"use client";
import React, { createContext, useContext, useMemo, useRef, useState, useCallback } from "react";
import TaxonomyModel from "@/models/postGresModels/ticketTaxonomyModel";

const TaxonomyCtx = createContext(null);

export const TicketTaxonomyProvider = ({ children }) => {
  const [features, setFeatures] = useState([]);
  const [impacts, setImpacts] = useState([]);
  const [rootCauses, setRootCauses] = useState([]);
  const [loading, setLoading] = useState(false);
  const cacheRef = useRef(new Map());

  const listFeatures = useCallback(async (orgId, { productId } = {}) => {
    if (!orgId) return [];
    const key = `feat:${orgId}:${productId || "all"}`;
    if (cacheRef.current.has(key)) return cacheRef.current.get(key);

    setLoading(true);
    try {
      const arr = await TaxonomyModel.listFeatures(orgId, { productId });
      cacheRef.current.set(key, arr);
      setFeatures(arr);
      return arr;
    } finally {
      setLoading(false);
    }
  }, []);

  const listImpacts = useCallback(async (orgId) => {
    if (!orgId) return [];
    const key = `impact:${orgId}`;
    if (cacheRef.current.has(key)) return cacheRef.current.get(key);

    setLoading(true);
    try {
      const arr = await TaxonomyModel.listImpacts(orgId);
      cacheRef.current.set(key, arr);
      setImpacts(arr);
      return arr;
    } finally {
      setLoading(false);
    }
  }, []);

  const listRootCauses = useCallback(async (orgId) => {
    if (!orgId) return [];
    const key = `rca:${orgId}`;
    if (cacheRef.current.has(key)) return cacheRef.current.get(key);

    setLoading(true);
    try {
      const arr = await TaxonomyModel.listRootCauses(orgId);
      cacheRef.current.set(key, arr);
      setRootCauses(arr);
      return arr;
    } finally {
      setLoading(false);
    }
  }, []);

  const invalidateCache = useCallback(() => cacheRef.current.clear(), []);

  const value = useMemo(
    () => ({
      features,
      impacts,
      rootCauses,
      loading,
      listFeatures,
      listImpacts,
      listRootCauses,
      invalidateCache,
    }),
    [features, impacts, rootCauses, loading, listFeatures, listImpacts, listRootCauses, invalidateCache]
  );

  return <TaxonomyCtx.Provider value={value}>{children}</TaxonomyCtx.Provider>;
};

export const useTicketTaxonomies = () => {
  const ctx = useContext(TaxonomyCtx);
  if (!ctx) throw new Error("useTicketTaxonomies must be used within TicketTaxonomyProvider");
  return ctx;
};
