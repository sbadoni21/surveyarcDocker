// providers/SalesforceContactProvider.jsx
"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
} from "react";
import SalesforceContactModel from "@/models/postGresModels/salesforceContactModel";

const SalesforceContactContext = createContext();

export const SalesforceContactProvider = ({ children }) => {
  const [contacts, setContacts] = useState([]);
  const [total, setTotal] = useState(0);
  const [selectedContact, setSelectedContact] = useState(null);
  const [loading, setLoading] = useState(false);

  const list = useCallback(async (params = {}) => {
    setLoading(true);
    try {
      const { items, total } = await SalesforceContactModel.list(params);
      setContacts(items);
      setTotal(total);
      return { items, total };
    } finally {
      setLoading(false);
    }
  }, []);

  const get = useCallback(async (contactId) => {
    const c = await SalesforceContactModel.get(contactId);
    setSelectedContact(c);
    return c;
  }, []);

  const update = useCallback(async (contactId, patch) => {
    const updated = await SalesforceContactModel.update(contactId, patch);

    setContacts((prev) =>
      prev.map((c) => (c.contactId === contactId ? updated : c))
    );

    setSelectedContact((prev) =>
      prev && prev.contactId === contactId ? updated : prev
    );

    return updated;
  }, []);
const listByAccount = useCallback(async (accountId) => {
  const items = await SalesforceContactModel.contactsByAccount(accountId);
  console.log(items)
  setContacts(items);
  setTotal(items.length);
  return items;
}, []);

  const remove = useCallback(async (contactId) => {
    await SalesforceContactModel.remove(contactId);

    setContacts((prev) => prev.filter((c) => c.contactId !== contactId));
    setSelectedContact((prev) =>
      prev && prev.contactId === contactId ? null : prev
    );

    return true;
  }, []);

  const value = {
    contacts,
    total,
    selectedContact,
    setSelectedContact,
    loading,
    list,
    get,
    listByAccount,
    update,
    remove,
  };

  return (
    <SalesforceContactContext.Provider value={value}>
      {children}
    </SalesforceContactContext.Provider>
  );
};

export const useSalesforceContacts = () => {
  const ctx = useContext(SalesforceContactContext);
  if (!ctx) {
    throw new Error(
      "useSalesforceContacts must be used within SalesforceContactProvider"
    );
  }
  return ctx;
};
