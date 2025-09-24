"use client";
import React, { createContext, useContext, useState } from "react";
import RuleModel from "@/models/postGresModels/ruleModel";

const RuleContext = createContext();

export const RuleProvider = ({ children }) => {
  const [rules, setRules] = useState([]);
  const [selectedRule, setSelectedRule] = useState(null);
  const [loading, setLoading] = useState(false);

  const getAllRules = async (surveyId) => {
    setLoading(true);
    try {
      const list = await RuleModel.getAll(surveyId);
      setRules(list || []);
      return list;
    } finally {
      setLoading(false);
    }
  };

  const getRule = async (surveyId, ruleId) => {
    const r = await RuleModel.get(surveyId, ruleId);
    setSelectedRule(r);
    return r;
  };

  const saveRule = async (orgId, surveyId, data) => {
    const created = await RuleModel.create(orgId, surveyId, data);
    setRules((prev) => [...prev, created]);
    return created;
  };

  const updateRule = async (surveyId, ruleId, updateData) => {
    const updated = await RuleModel.update(surveyId, ruleId, updateData);
    setRules((prev) => prev.map((r) => (r.ruleId === ruleId ? updated : r)));
    return updated;
  };

  const deleteRule = async (surveyId, ruleId) => {
    await RuleModel.delete(surveyId, ruleId);
    setRules((prev) => prev.filter((r) => r.ruleId !== ruleId));
  };

  return (
    <RuleContext.Provider
      value={{ rules, selectedRule, loading, getAllRules, getRule, saveRule, updateRule, deleteRule, setSelectedRule }}
    >
      {children}
    </RuleContext.Provider>
  );
};

export const useRule = () => useContext(RuleContext);
