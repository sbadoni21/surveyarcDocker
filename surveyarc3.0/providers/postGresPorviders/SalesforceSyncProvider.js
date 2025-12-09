"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
} from "react";

import SalesforceSyncModel from "@/models/postGresModels/salesforceSyncModel";
import { useContacts } from "@/providers/postGresPorviders/contactProvider";

const SalesforceSyncContext = createContext(null);

export const SalesforceSyncProvider = ({ children }) => {
  const [syncing, setSyncing] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const [lastError, setLastError] = useState(null);
  const [syncStatus, setSyncStatus] = useState(null);

  // so we can refresh lists/contacts after sync
  const { listLists, listContacts, invalidateCache } = useContacts?.() || {};

  const refreshContactsAndLists = useCallback(
    async (orgId) => {
      if (!orgId || !listLists || !listContacts) return;
      invalidateCache?.();
      await listLists(orgId);
      await listContacts(orgId);
    },
    [invalidateCache, listLists, listContacts]
  );

  /** Sync one Salesforce account as its own list (account name = list name) */
  const syncAccountAsNewList = useCallback(
    async (accountId, orgId) => {
      setSyncing(true);
      setLastError(null);
      try {
        const result = await SalesforceSyncModel.syncAccountAsList(accountId, orgId);
        setLastResult(result);

        if (orgId) {
          await refreshContactsAndLists(orgId);
        }

        return result;
      } catch (err) {
        console.error("[SalesforceSync] syncAccountAsNewList error:", err);
        setLastError(err);
        throw err;
      } finally {
        setSyncing(false);
      }
    },
    [refreshContactsAndLists]
  );

  /** Sync Salesforce contacts into an EXISTING list */
  const syncAccountIntoExistingList = useCallback(
    async ({ listId, accountId, orgId }) => {
      setSyncing(true);
      setLastError(null);
      try {
        const result = await SalesforceSyncModel.addToExistingList({
          listId,
          salesforceAccountId: accountId,
        });
        setLastResult(result);

        if (orgId) {
          await refreshContactsAndLists(orgId);
        }

        return result;
      } catch (err) {
        console.error("[SalesforceSync] syncAccountIntoExistingList error:", err);
        setLastError(err);
        throw err;
      } finally {
        setSyncing(false);
      }
    },
    [refreshContactsAndLists]
  );

  const loadSyncStatus = useCallback(async () => {
    try {
      const s = await SalesforceSyncModel.getSyncStatus();
      setSyncStatus(s);
      return s;
    } catch (err) {
      console.error("[SalesforceSync] loadSyncStatus error:", err);
      setLastError(err);
      throw err;
    }
  }, []);

  const value = useMemo(
    () => ({
      syncing,
      lastResult,
      lastError,
      syncStatus,
      syncAccountAsNewList,
      syncAccountIntoExistingList,
      loadSyncStatus,
    }),
    [
      syncing,
      lastResult,
      lastError,
      syncStatus,
      syncAccountAsNewList,
      syncAccountIntoExistingList,
      loadSyncStatus,
    ]
  );

  return (
    <SalesforceSyncContext.Provider value={value}>
      {children}
    </SalesforceSyncContext.Provider>
  );
};

export const useSalesforceSync = () => {
  const ctx = useContext(SalesforceSyncContext);
  if (!ctx)
    throw new Error(
      "useSalesforceSync must be used within SalesforceSyncProvider"
    );
  return ctx;
};
