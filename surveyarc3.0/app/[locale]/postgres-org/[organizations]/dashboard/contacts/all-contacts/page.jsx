"use client";

import { useEffect, useState } from "react";
import ContactsList from "@/components/contacts/ContactsList";
import { useContacts } from "@/providers/postGresPorviders/contactProvider";
import { usePathname } from "next/navigation";

export default function ContactsPage() {
  const {
    listContacts,
    listLists,
    contacts,
    lists,
    createContact,
    updateContact,
    deleteContact,
    addContactsToList,
    removeContactsFromList,
    loading,
  } = useContacts();

const path = usePathname();
const orgId = path.split("/")[3];
console.log(orgId)
  useEffect(() => {
    if (orgId) {
      listContacts(orgId);
      listLists(orgId);
    }
  }, []);

  const handleCreate = async (data) => {
    await createContact(data);
  };

  const handleUpdate = async (id, data) => {
    await updateContact(id, data);
  };

  const handleDelete = async (id) => {
    await deleteContact(id);
  };

  const handleAddToList = async (listId, contactIds) => {
    await addContactsToList(listId, contactIds);
  };

  const handleRemoveFromList = async (listId, contactIds) => {
    await removeContactsFromList(listId, contactIds);
  };
  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold mb-4">All Contacts</h1>

      <ContactsList
        contacts={contacts}
        lists={lists}
        loading={loading}
        onCreate={handleCreate}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
        onAddToList={handleAddToList}
        onRemoveFromList={handleRemoveFromList}
      />
    </div>
  );
}
