// providers/postGresPorviders/SupportTeamProvider.jsx
"use client";
import React, { createContext, useContext, useMemo, useRef, useState, useCallback } from "react";
import SupportTeamModel from "@/models/postGresModels/supportTeamModel";

const TeamCtx = createContext(null);

export const SupportTeamProvider = ({ children }) => {
  const [teams, setTeams] = useState([]);        // last loaded set
  const [loading, setLoading] = useState(false);
  const cacheRef = useRef(new Map());            // key: groupId|orgId → array

  const listByGroup = useCallback(async (groupId) => {
    if (!groupId) return [];
    const key = `g:${groupId}`;
    if (cacheRef.current.has(key)) return cacheRef.current.get(key);
    setLoading(true);
    try {
      const arr = await SupportTeamModel.list({ groupId });
      cacheRef.current.set(key, arr);
      setTeams(arr);
      return arr;
    } finally {
      setLoading(false);
    }
  }, []);

  const listByOrg = useCallback(async (orgId) => {
    if (!orgId) return [];
    const key = `o:${orgId}`;
    if (cacheRef.current.has(key)) return cacheRef.current.get(key);
    setLoading(true);
    try {
      const arr = await SupportTeamModel.list({ orgId });
      cacheRef.current.set(key, arr);
      setTeams(arr);
      return arr;
    } finally {
      setLoading(false);
    }
  }, []);

  const value = useMemo(() => ({ teams, loading, listByGroup, listByOrg }), [teams, loading, listByGroup, listByOrg]);

  return <TeamCtx.Provider value={value}>{children}</TeamCtx.Provider>;
};

export const useSupportTeams = () => {
  const ctx = useContext(TeamCtx);
  if (!ctx) throw new Error("useSupportTeams must be used within SupportTeamProvider");
  return ctx;
};
