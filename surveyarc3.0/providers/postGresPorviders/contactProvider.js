"use client";

import React, {
  createContext, 
  useContext,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";

import ContactModel from "@/models/contactModel";
import ContactSocialsModel from "@/models/contactSocialsModel";
import ContactPhonesModel from "@/models/contactPhonesModel";
import ContactEmailsModel from "@/models/contactEmailsModel";
import ListModel from "@/models/listModel";

const ContactCtx = createContext(null);

export const ContactProvider = ({ children }) => {
  const [contacts, setContacts] = useState([]);
  const [contactSocials, setContactSocials] = useState([]);
  const [contactPhones, setContactPhones] = useState([]);
  const [contactEmails, setContactEmails] = useState([]);
  const [lists, setLists] = useState([]);

  const [loading, setLoading] = useState(false);
  const cacheRef = useRef(new Map());

  const invalidateCache = useCallback(() => {
    cacheRef.current.clear();
  }, []);

  /* ============================================================
      CONTACTS
  ============================================================*/
  const listContacts = useCallback(async (orgId) => {
    if (!orgId) return [];
    const key = `contacts:${orgId}`;
    if (cacheRef.current.has(key)) return cacheRef.current.get(key);

    setLoading(true);
    try {
      const arr = await ContactModel.getAll(orgId);
      cacheRef.current.set(key, arr);
      setContacts(arr);
      return arr;
    } finally {
      setLoading(false);
    }
  }, []);

  const getContact = useCallback(async (contactId) => {
    if (!contactId) return null;
    const key = `contact:${contactId}`;
    if (cacheRef.current.has(key)) return cacheRef.current.get(key);

    setLoading(true);
    try {
      const contact = await ContactModel.get(contactId);
      cacheRef.current.set(key, contact);
      return contact;
    } finally {
      setLoading(false);
    }
  }, []);

  const createContact = useCallback(async (data) => {
    setLoading(true);
    try {
      const created = await ContactModel.create(data);
      setContacts((p) => [...p, created]);
      invalidateCache();
      return created;
    } finally {
      setLoading(false);
    }
  }, [invalidateCache]);

  const updateContact = useCallback(async (contactId, data) => {
    setLoading(true);
    try {
      const updated = await ContactModel.update(contactId, data);
      setContacts((prev) =>
        prev.map((c) => (c.contactId === contactId ? updated : c))
      );
      invalidateCache();
      return updated;
    } finally {
      setLoading(false);
    }
  }, [invalidateCache]);

  const deleteContact = useCallback(async (contactId) => {
    setLoading(true);
    try {
      await ContactModel.delete(contactId);
      setContacts((prev) => prev.filter((c) => c.contactId !== contactId));
      invalidateCache();
      return true;
    } finally {
      setLoading(false);
    }
  }, [invalidateCache]);

  /* ============================================================
      SOCIALS
  ============================================================*/
  const addContactSocial = useCallback(async (data) => {
    setLoading(true);
    try {
      const created = await ContactSocialsModel.add(data);
      setContactSocials((prev) => [...prev, created]);
      invalidateCache();
      return created;
    } finally {
      setLoading(false);
    }
  }, [invalidateCache]);

  const deleteContactSocial = useCallback(async (id) => {
    setLoading(true);
    try {
      await ContactSocialsModel.delete(id);
      setContactSocials((prev) => prev.filter((i) => i.id !== id));
      invalidateCache();
      return true;
    } finally {
      setLoading(false);
    }
  }, [invalidateCache]);

  /* ============================================================
      PHONES
  ============================================================*/
  const addContactPhone = useCallback(async (data) => {
    setLoading(true);
    try {
      const created = await ContactPhonesModel.add(data);
      setContactPhones((prev) => [...prev, created]);
      invalidateCache();
      return created;
    } finally {
      setLoading(false);
    }
  }, [invalidateCache]);

  const deleteContactPhone = useCallback(async (id) => {
    setLoading(true);
    try {
      await ContactPhonesModel.delete(id);
      setContactPhones((prev) => prev.filter((i) => i.id !== id));
      invalidateCache();
      return true;
    } finally {
      setLoading(false);
    }
  }, [invalidateCache]);

  /* ============================================================
      EMAILS
  ============================================================*/
  const addContactEmail = useCallback(async (data) => {
    setLoading(true);
    try {
      const created = await ContactEmailsModel.add(data);
      setContactEmails((prev) => [...prev, created]);
      invalidateCache();
      return created;
    } finally {
      setLoading(false);
    }
  }, [invalidateCache]);

  const deleteContactEmail = useCallback(async (id) => {
    setLoading(true);
    try {
      await ContactEmailsModel.delete(id);
      setContactEmails((prev) => prev.filter((i) => i.id !== id));
      invalidateCache();
      return true;
    } finally {
      setLoading(false);
    }
  }, [invalidateCache]);

  /* ============================================================
      LISTS
  ============================================================*/
  const listLists = useCallback(async (orgId) => {
    if (!orgId) return [];

    const key = `lists:${orgId}`;
    if (cacheRef.current.has(key)) return cacheRef.current.get(key);

    setLoading(true);
    try {
      const arr = await ListModel.getAll(orgId);
      cacheRef.current.set(key, arr);
      setLists(arr);
      return arr;
    } finally {
      setLoading(false);
    }
  }, []);

  const createList = useCallback(async (data) => {
    setLoading(true);
    try {
      const created = await ListModel.create(data);
      setLists((p) => [...p, created]);
      invalidateCache();
      return created;
    } finally {
      setLoading(false);
    }
  }, [invalidateCache]);

  const updateList = useCallback(async (listId, data) => {
    setLoading(true);
    try {
      const updated = await ListModel.update(listId, data);
      setLists((prev) =>
        prev.map((l) => (l.listId === listId ? updated : l))
      );
      invalidateCache();
      return updated;
    } finally {
      setLoading(false);
    }
  }, [invalidateCache]);
const addContactsToList = useCallback(async (listId, contactIds) => {
  setLoading(true);
  try {
    const updated = await ListModel.addContacts(listId, contactIds);
    setLists((prev) =>
      prev.map((l) => (l.listId === listId ? updated : l))
    );
    invalidateCache();
    return updated;
  } finally {
    setLoading(false);
  }
}, [invalidateCache]);
// Add this to your contactProvider.js or wherever removeContactsFromList is defined

const removeContactsFromList = async (listId, contactIds) => {
  try {
    // ✅ Flatten if accidentally nested
    let idsArray = Array.isArray(contactIds) ? contactIds : [contactIds];
    
    // ✅ Check if first element is an array (double-wrapped)
    if (idsArray.length === 1 && Array.isArray(idsArray[0])) {
      console.warn("⚠️ contact_ids was double-wrapped, flattening...");
      idsArray = idsArray[0];
    }
    
    // ✅ Ensure all IDs are strings
    idsArray = idsArray.filter(id => typeof id === 'string' && id.trim() !== '');
    
    if (idsArray.length === 0) {
      throw new Error("No valid contact IDs provided");
    }

    console.log("🗑️ Removing contacts:", { listId, contactIds: idsArray });

    const response = await ListModel.removeContacts(listId, idsArray);
        return response;
  } catch (error) {
    console.error("❌ Error in removeContactsFromList:", error);
    throw error;
  }
};
const getAvailableContacts = useCallback(async (listId, orgId) => {
  setLoading(true);
  try {
    return await ListModel.getAvailableContacts(listId, orgId);
  } finally {
    setLoading(false);
  }
}, []);
  const deleteList = useCallback(async (listId) => {
    setLoading(true);
    try {
      await ListModel.delete(listId);
      setLists((prev) => prev.filter((l) => l.listId !== listId));
      invalidateCache();
      return true;
    } finally {
      setLoading(false);
    }
  }, [invalidateCache]);

  /* ============================================================
      PROVIDER VALUE
  ============================================================*/
  const value = useMemo(
    () => ({
      loading,

      // State
      contacts,
      contactSocials,
      contactPhones,
      contactEmails,
      lists,

      // Contacts
      listContacts,
      getContact,
      createContact,
      updateContact,
      deleteContact,

      // Socials
      addContactSocial,
      deleteContactSocial,

      // Phones
      addContactPhone,
      deleteContactPhone,

      // Emails
      addContactEmail,
      deleteContactEmail,
addContactsToList,
 removeContactsFromList,
 getAvailableContacts,
      // Lists
      listLists,
      createList,
      updateList,
      deleteList,

      // Cache
      invalidateCache,
    }),
    [
      loading,
      contacts,
      contactSocials,
      contactPhones,
      contactEmails,
      lists,
      addContactsToList,
      removeContactsFromList,
      getAvailableContacts,
      listContacts,
      getContact,
      createContact,
      updateContact,
      deleteContact,
      addContactSocial,
      deleteContactSocial,
      addContactPhone,
      deleteContactPhone,
      addContactEmail,
      deleteContactEmail,
      listLists,
      createList,
      updateList,
      deleteList,
      invalidateCache,
    ]
  );

  return <ContactCtx.Provider value={value}>{children}</ContactCtx.Provider>;
};

export const useContacts = () => {
  const ctx = useContext(ContactCtx);
  if (!ctx) throw new Error("useContacts must be used inside ContactProvider");
  return ctx;
};