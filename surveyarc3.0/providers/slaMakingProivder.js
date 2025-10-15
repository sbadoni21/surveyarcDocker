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

  // ---------- SLA list/load ----------
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

  const getSla = useCallback(async (slaId) => SlaMakingModel.get(slaId), []);

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
      const { [slaId]: _omit, ...rest } = m;
      return rest;
    });
    setCreditRulesBySla((m) => {
      const { [slaId]: _omit, ...rest } = m;
      return rest;
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

  const publishSla = useCallback(async (slaId, opts) => {
    const updated = await SlaMakingModel.publish(slaId, opts);
    setSlas((prev) => prev.map((s) => (s.sla_id === slaId ? updated : s)));
    return updated;
  }, []);

  const archiveSla = useCallback(async (slaId) => {
    const updated = await SlaMakingModel.archive(slaId);
    setSlas((prev) => prev.map((s) => (s.sla_id === slaId ? updated : s)));
    return updated;
  }, []);

  const validateSla = useCallback(async (slaId) => SlaMakingModel.validate(slaId), []);

  const duplicateSla = useCallback(async (slaId, overrides = {}) => {
    const clone = await SlaMakingModel.duplicate(slaId, overrides);
    setSlas((prev) => [clone, ...prev]);
    return clone;
  }, []);

  const createNewVersion = useCallback(async (slaId, changes = {}) => {
    const v = await SlaMakingModel.createNewVersion(slaId, changes);
    setSlas((prev) => [v, ...prev.filter((s) => s.slug !== v.slug || s.sla_id === v.sla_id)]);
    return v;
  }, []);

  const listVersions = useCallback(async (slaId) => SlaMakingModel.listVersions(slaId), []);

  const dependencies = useCallback(async (slaId, opts = {}) => SlaMakingModel.dependencies(slaId, opts), []);

  // ---------- Bulk ----------
  const bulkUpsert = useCallback(async (slasPayload, opts) => SlaMakingModel.bulkUpsert(slasPayload, opts), []);
  const bulkDelete = useCallback(async (ids, opts) => SlaMakingModel.bulkDelete(ids, opts), []);

  // ---------- Objectives ----------
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
    await SlaMakingModel.removeObjective(objectiveId);
    setObjectivesBySla((m) => {
      const out = {};
      for (const [sid, arr] of Object.entries(m)) out[sid] = (arr || []).filter((o) => o.objective_id !== objectiveId);
      return out;
    });
  }, []);

  // ---------- Credit Rules ----------
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
      for (const [sid, arr] of Object.entries(m)) out[sid] = (arr || []).filter((r) => r.rule_id !== ruleId);
      return out;
    });
  }, []);

  // ---------- Matching / Reporting / Import-Export / Cleanup ----------
  const match = useCallback(async (orgId, criteria) => SlaMakingModel.match(orgId, criteria), []);
  const simulate = useCallback(async (orgId, criteria) => SlaMakingModel.simulate(orgId, criteria), []);
  const effective = useCallback(async (orgId, opts) => SlaMakingModel.effective(orgId, opts), []);
  const stats = useCallback(async (orgId) => SlaMakingModel.stats(orgId), []);
  const compliance = useCallback(async (orgId, opts) => SlaMakingModel.compliance(orgId, opts), []);
  const exportSlas = useCallback(async (orgId, opts) => SlaMakingModel.export(orgId, opts), []);
  const importSlas = useCallback(async (orgId, file, opts) => SlaMakingModel.import(orgId, file, opts), []);
  const cleanup = useCallback(async (orgId, opts) => SlaMakingModel.cleanup(orgId, opts), []);

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
      publishSla,
      archiveSla,
      validateSla,
      duplicateSla,
      createNewVersion,
      listVersions,
      dependencies,

      // bulk
      bulkUpsert,
      bulkDelete,

      // objectives
      listObjectives,
      createObjective,
      updateObjective,
      removeObjective,

      // credit rules
      listCreditRules,
      createCreditRule,
      updateCreditRule,
      removeCreditRule,

      // matching / reports / import-export
      match,
      simulate,
      effective,
      stats,
      compliance,
      exportSlas,
      importSlas,
      cleanup,
    }),
    [
      slas,
      objectivesBySla,
      creditRulesBySla,
      loading,
      listSlas,
      getSla,
      createSla,
      updateSla,
      removeSla,
      activateSla,
      deactivateSla,
      publishSla,
      archiveSla,
      validateSla,
      duplicateSla,
      createNewVersion,
      listVersions,
      dependencies,
      bulkUpsert,
      bulkDelete,
      listObjectives,
      createObjective,
      updateObjective,
      removeObjective,
      listCreditRules,
      createCreditRule,
      updateCreditRule,
      removeCreditRule,
      match,
      simulate,
      effective,
      stats,
      compliance,
      exportSlas,
      importSlas,
      cleanup,
    ]
  );

  return <SLAMakingContext.Provider value={value}>{children}</SLAMakingContext.Provider>;
};

export const useMakingSLA = () => {
  const ctx = useContext(SLAMakingContext);
  if (!ctx) throw new Error("useMakingSLA must be used within SLAMakingProvider");
  return ctx;
};
