// providers/postGresPorviders/SupportGroupProvider.jsx
"use client";
import React, { createContext, useContext, useMemo, useState, useCallback } from "react";
import SupportGroupModel from "@/models/postGresModels/supportGroupModel";

const Ctx = createContext(null);

export const SupportGroupProvider = ({ children }) => {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(false);

  const listByOrg = useCallback(async (orgId) => {
    setLoading(true);
    try {
      const arr = await SupportGroupModel.listByOrg(orgId);
      setGroups(arr);
      return arr;
    } finally {
      setLoading(false);
    }
  }, []);

  const create = useCallback(async (data) => {
    const g = await SupportGroupModel.create(data);
    setGroups((prev) => [g, ...prev]);
    return g;
  }, []);

  const update = useCallback(async (groupId, patch) => {
    const g = await SupportGroupModel.update(groupId, patch);
    setGroups((prev) => prev.map((x) => (x.groupId === groupId ? g : x)));
    return g;
  }, []);

  const remove = useCallback(async (groupId) => {
    await SupportGroupModel.remove(groupId);
    setGroups((prev) => prev.filter((x) => x.groupId !== groupId));
  }, []);

  const value = useMemo(() => ({ groups, loading, listByOrg, create, update, remove }), [groups, loading, listByOrg, create, update, remove]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

export const useSupportGroups = () => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSupportGroups must be used within SupportGroupProvider");
  return ctx;
};
