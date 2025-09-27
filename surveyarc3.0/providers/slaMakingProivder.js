// providers/postGresPorviders/SLAMakingProvider.jsx
"use client";
import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import SlaMakingModel from "@/models/postGresModels/slaMakingModel";

const SLAMakingContext = createContext(null);

export const SLAMakingProvider = ({ children }) => {
  const [slas, setSlas] = useState([]);
  const [objectivesBySla, setObjectivesBySla] = useState({});   // { [sla_id]: Objective[] }
  const [creditRulesBySla, setCreditRulesBySla] = useState({});  // { [sla_id]: CreditRule[] }
  const [loading, setLoading] = useState(false);

  // ---------- SLA ----------
  const listSlas = useCallback(async ({ orgId, active, scope, q, limit, offset } = {}) => {
    setLoading(true);
    try {
      const arr = await SlaMakingModel.list({ orgId, active, scope, q, limit, offset });
      setSlas(Array.isArray(arr) ? arr : []);
      return arr;
    } finally {
      setLoading(false);
    }
  }, []);

  const getSla = useCallback(async (slaId) => {
    return SlaMakingModel.get(slaId);
  }, []);

  const createSla = useCallback(async (payload) => {
    const created = await SlaMakingModel.create(payload);
    setSlas((prev) => [created, ...prev]);
    return created;
  }, []);

  const updateSla = useCallback(async (slaId, patch) => {
    const updated = await SlaMakingModel.update(slaId, patch);
    setSlas((prev) => prev.map((s) => (s.sla_id === slaId ? updated : s)));
    return updated;
  }, []);

  const removeSla = useCallback(async (slaId) => {
    await SlaMakingModel.remove(slaId);
    setSlas((prev) => prev.filter((s) => s.sla_id !== slaId));
    setObjectivesBySla((m) => {
      const { [slaId]: _, ...rest } = m; return rest;
    });
    setCreditRulesBySla((m) => {
      const { [slaId]: _, ...rest } = m; return rest;
    });
  }, []);

  const activateSla = useCallback(async (slaId) => {
    const updated = await SlaMakingModel.activate(slaId);
    setSlas((prev) => prev.map((s) => (s.sla_id === slaId ? updated : s)));
    return updated;
  }, []);

  const deactivateSla = useCallback(async (slaId) => {
    const updated = await SlaMakingModel.deactivate(slaId);
    setSlas((prev) => prev.map((s) => (s.sla_id === slaId ? updated : s)));
    return updated;
  }, []);

  const duplicateSla = useCallback(async (slaId, overrides = {}) => {
    const clone = await SlaMakingModel.duplicate(slaId, overrides);
    setSlas((prev) => [clone, ...prev]);
    return clone;
  }, []);

  // -------- Objectives --------
  const listObjectives = useCallback(async (slaId) => {
    const arr = await SlaMakingModel.listObjectives(slaId);
    setObjectivesBySla((m) => ({ ...m, [slaId]: Array.isArray(arr) ? arr : [] }));
    return arr;
  }, []);

  const createObjective = useCallback(async (slaId, payload) => {
    const created = await SlaMakingModel.createObjective(slaId, payload);
    setObjectivesBySla((m) => ({ ...m, [slaId]: [created, ...(m[slaId] || [])] }));
    return created;
  }, []);

  const updateObjective = useCallback(async (objectiveId, patch) => {
    const updated = await SlaMakingModel.updateObjective(objectiveId, patch);
    const slaId = updated.sla_id;
    setObjectivesBySla((m) => ({
      ...m,
      [slaId]: (m[slaId] || []).map((o) => (o.objective_id === updated.objective_id ? updated : o)),
    }));
    return updated;
  }, []);

  const removeObjective = useCallback(async (objectiveId) => {
    // We need to know its SLA bucket. Best effort: remove from all buckets.
    await SlaMakingModel.removeObjective(objectiveId);
    setObjectivesBySla((m) => {
      const out = {};
      for (const [sid, arr] of Object.entries(m)) {
        out[sid] = (arr || []).filter((o) => o.objective_id !== objectiveId);
      }
      return out;
    });
  }, []);

  // -------- Credit Rules --------
  const listCreditRules = useCallback(async (slaId) => {
    const arr = await SlaMakingModel.listCreditRules(slaId);
    setCreditRulesBySla((m) => ({ ...m, [slaId]: Array.isArray(arr) ? arr : [] }));
    return arr;
  }, []);

  const createCreditRule = useCallback(async (slaId, payload) => {
    const created = await SlaMakingModel.createCreditRule(slaId, payload);
    setCreditRulesBySla((m) => ({ ...m, [slaId]: [created, ...(m[slaId] || [])] }));
    return created;
  }, []);

  const updateCreditRule = useCallback(async (ruleId, patch) => {
    const updated = await SlaMakingModel.updateCreditRule(ruleId, patch);
    const slaId = updated.sla_id;
    setCreditRulesBySla((m) => ({
      ...m,
      [slaId]: (m[slaId] || []).map((r) => (r.rule_id === updated.rule_id ? updated : r)),
    }));
    return updated;
  }, []);

  const removeCreditRule = useCallback(async (ruleId) => {
    await SlaMakingModel.removeCreditRule(ruleId);
    setCreditRulesBySla((m) => {
      const out = {};
      for (const [sid, arr] of Object.entries(m)) {
        out[sid] = (arr || []).filter((r) => r.rule_id !== ruleId);
      }
      return out;
    });
  }, []);

  const value = useMemo(
    () => ({
      // state
      slas,
      objectivesBySla,
      creditRulesBySla,
      loading,
      // sla ops
      listSlas,
      getSla,
      createSla,
      updateSla,
      removeSla,
      activateSla,
      deactivateSla,
      duplicateSla,
      // objective ops
      listObjectives,
      createObjective,
      updateObjective,
      removeObjective,
      // credit rule ops
      listCreditRules,
      createCreditRule,
      updateCreditRule,
      removeCreditRule,
    }),
    [
      slas, objectivesBySla, creditRulesBySla, loading,
      listSlas, getSla, createSla, updateSla, removeSla, activateSla, deactivateSla, duplicateSla,
      listObjectives, createObjective, updateObjective, removeObjective,
      listCreditRules, createCreditRule, updateCreditRule, removeCreditRule,
    ]
  );

  return <SLAMakingContext.Provider value={value}>{children}</SLAMakingContext.Provider>;
};

export const useMakingSLA = () => {
  const ctx = useContext(SLAMakingContext);
  if (!ctx) throw new Error("useMakingSLA must be used within SLAMakingProvider");
  return ctx;
};
