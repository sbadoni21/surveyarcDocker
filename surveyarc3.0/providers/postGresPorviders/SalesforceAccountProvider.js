"use client";
import { createContext, useContext, useState, useCallback } from "react";
import SalesforceAccountModel from "@/models/postGresModels/salesforceAccountModel";

const SalesforceAccountContext = createContext(null);

export const SalesforceAccountProvider = ({ children }) => {
  const [accounts, setAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [loading, setLoading] = useState(false);

  const list = useCallback(async (params = {}) => {
    setLoading(true);
    try {
      const { items } = await SalesforceAccountModel.list(params);
      setAccounts(items);
      return items;
    } finally {
      setLoading(false);
    }
  }, []);

  const get = useCallback(async (accountId) => {
    const data = await SalesforceAccountModel.get(accountId);
    setSelectedAccount(data);
    return data;
  }, []);

  const value = {
    accounts,
    selectedAccount,
    setSelectedAccount,
    loading,
    list,
    get,
  };

  return (
    <SalesforceAccountContext.Provider value={value}>
      {children}
    </SalesforceAccountContext.Provider>
  );
};

export const useSalesforceAccounts = () => {
  const ctx = useContext(SalesforceAccountContext);
  if (!ctx) throw new Error("useSalesforceAccounts must be used inside provider");
  return ctx;
};
