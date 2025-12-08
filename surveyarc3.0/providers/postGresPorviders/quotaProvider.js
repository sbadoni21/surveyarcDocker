import quotaModel from "@/models/postGresModels/quotaModel";
import React, { createContext, useContext, useState } from "react";

const QuotaContext = createContext(null);

export const QuotaProvider = ({ children }) => {
  const [quotas, setQuotas] = useState([]);

  // Load all quotas for a survey
  const loadQuotas = async (surveyId) => {
    const data = await quotaModel.listBySurvey(surveyId);
    setQuotas(data);
    return data;
  };

  // Evaluate a specific quota
  const evaluateQuota = async (quotaId, payload) => {
    return quotaModel.evaluate(quotaId, payload);
  };

  // Increment a specific quota
  const incrementQuota = async (quotaId, payload) => {
    return quotaModel.increment(quotaId, payload);
  };

  return (
    <QuotaContext.Provider
      value={{
        quotas,
        loadQuotas,
        evaluateQuota,
        incrementQuota,
      }}
    >
      {children}
    </QuotaContext.Provider>
  );
};

export const useQuotas = () => {
  const context = useContext(QuotaContext);
  if (!context) {
    throw new Error("useQuotas must be used inside QuotaProvider");
  }
  return context;
};
