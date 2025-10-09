"use client";
import ContactModel from "@/models/postGresModels/contactModel";
import React, { createContext, useContext, useState } from "react";

const ContactContext = createContext();

export const ContactProvider = ({ children }) => {
  const [contacts, setContacts] = useState([]);
  const [selectedContact, setSelectedContact] = useState(null);
  const [loading, setLoading] = useState(false);

  // 🔹 Fetch all contacts for an org
  const getAllContacts = async (orgId) => {
    setLoading(true);
    try {
      const list = await ContactModel.getAll(orgId);
      setContacts(list || []);
      return list;
    } finally {
      setLoading(false);
    }
  };

  // 🔹 Create new contact
  const createContact = async (orgId, contactData) => {
    const created = await ContactModel.create(orgId, contactData);
    setContacts((prev) => [created, ...prev]);
    return created;
  };

  // 🔹 Update existing contact
  const updateContact = async (contactId, updateData) => {
    const updated = await ContactModel.update(contactId, updateData);
    setContacts((prev) =>
      prev.map((c) => (c.contactId === contactId ? updated : c))
    );
    return updated;
  };

  // 🔹 Delete a contact
  const deleteContact = async (contactId) => {
    await ContactModel.delete(contactId);
    setContacts((prev) => prev.filter((c) => c.contactId !== contactId));
  };

  return (
    <ContactContext.Provider
      value={{
        contacts,
        selectedContact,
        loading,
        setSelectedContact,
        getAllContacts,
        createContact,
        updateContact,
        deleteContact,
      }}
    >
      {children}
    </ContactContext.Provider>
  );
};

export const useContact = () => useContext(ContactContext);
