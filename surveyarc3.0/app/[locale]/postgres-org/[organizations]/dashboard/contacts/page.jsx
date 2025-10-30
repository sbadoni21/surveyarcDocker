"use client";

import { useState, useEffect } from "react";
import { 
  FolderOpen, 
  Plus, 
  Trash, 
  Edit3, 
  Users, 
  Mail, 
  Phone, 
  Share2,
  ChevronDown,
  ChevronRight,
  Search,
  Calendar,
  CheckCircle,
  XCircle,
  Upload,
  UserPlus,
  X
} from "lucide-react";
import { useContacts } from "@/providers/postGresPorviders/ContactProvider";
import { usePathname } from "next/navigation";
import { UploadModal } from "@/components/email-page-components/UploadContacts";
import ContactsList from "@/components/contacts/ContactsList";

export default function ListsPage() {
  const {
    lists,
    contacts,
    listLists,
    deleteContact,
    listContacts,
    createList,
    updateList,
    updateContact,
    deleteList,
    createContact,
    addContactsToList,
    removeContactsFromList,
    loading,
  } = useContacts();

  const path = usePathname();
  const orgId = path?.split("/")[3];

  // State management
  const [expandedLists, setExpandedLists] = useState(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [editingListId, setEditingListId] = useState(null);
  const [editingName, setEditingName] = useState("");
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [targetListId, setTargetListId] = useState(null);
  const [targetListName, setTargetListName] = useState("");
  const [editingContact, setEditingContact] = useState(null);
  const [contactEditOpen, setContactEditOpen] = useState(false);
  const [viewContact, setViewContact] = useState(null);
  const [viewOpen, setViewOpen] = useState(false);
  const [listPagination, setListPagination] = useState({});
  const [selectedContacts, setSelectedContacts] = useState(new Set());

const [sortBy, setSortBy] = useState("created_desc"); // created_desc, created_asc, name_asc, name_desc

  // Initialize data
  useEffect(() => {
    (async () => {
      if (!orgId) return;
      console.log("Fetching lists and contacts for orgId:", orgId);
      await listLists(orgId);
      await listContacts(orgId);
    })();
  }, [orgId, listLists, listContacts]);

  // Pagination helper for specific list
  const getPaginatedContacts = (listId, contactsList) => {
    const page = listPagination[listId] || 1;
    const pageSize = 10;
    const start = (page - 1) * pageSize;
    return {
      contacts: contactsList.slice(start, start + pageSize),
      page,
      total: contactsList.length,
      totalPages: Math.ceil(contactsList.length / pageSize)
    };
  };

  const setListPage = (listId, page) => {
    setListPagination(prev => ({ ...prev, [listId]: page }));
  };

  const refresh = async () => {
    if (!orgId) return;
    await listLists(orgId);
    await listContacts(orgId);
  };

  console.log("Lists:", lists);
  console.log("Contacts:", contacts);
  console.log("Current orgId:", orgId);

  // Archive/Unarchive handler
  const handleToggleArchive = async (list) => {
    try {
      const newStatus = list.status === "archived" ? "live" : "archived";
      await updateList(list.listId, { status: newStatus });
      await refresh();
    } catch (err) {
      console.error("Archive toggle failed", err);
      alert("Failed to update list status");
    }
  };

  // Duplicate list handler
  const handleDuplicateList = async (list) => {
    try {
      const newListId = crypto.randomUUID();
      const payload = {
        listId: newListId,
        orgId,
        listName: `${list.listName} (copy)`,
        status: "live",
        contactIds: (list.contacts || []).map(c => c.contactId),
      };
      await createList(payload);
      await refresh();
      alert("List duplicated successfully");
    } catch (err) {
      console.error("Duplicate failed", err);
      alert("Failed to duplicate list");
    }
  };

  // CSV export
  const exportListToCSV = (list) => {
    const rows = (list.contacts || []).map(c => {
      const emails = (c.emails || []).map(e => e.email).join("; ");
      const phones = (c.phones || []).map(p => `${p.country_code || ""}${p.phone_number}`).join("; ");
      const socials = (c.socials || []).map(s => `${s.platform}:${s.handle}`).join("; ");
      return {
        contactId: c.contactId,
        name: c.name,
        primaryIdentifier: c.primaryIdentifier,
        contactType: c.contactType,
        emails,
        phones,
        socials,
      };
    });

    const keys = ["contactId", "name", "primaryIdentifier", "contactType", "emails", "phones", "socials"];
    const csv = [
      keys.join(","),
      ...rows.map(r => keys.map(k => `"${String(r[k] ?? "").replace(/"/g, '""')}"`).join(","))
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${list.listName.replace(/\s+/g, "_") || "list"}_${new Date().toISOString()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // WhatsApp share
  const shareListViaWhatsApp = (list) => {
    const contactsText = (list.contacts || [])
      .map(c => `${c.name || ''} <${c.primaryIdentifier || ''}>`)
      .join("\n");
    const text = `Contacts from ${list.listName}:\n\n${contactsText}`;
    const encoded = encodeURIComponent(text);
    window.open(`https://wa.me/?text=${encoded}`, "_blank");
  };

  // Email share
  const shareListByEmail = (list) => {
    const contactsText = (list.contacts || [])
      .map(c => `${c.name || ''} <${c.primaryIdentifier || ''}>`)
      .join("\n");
    const subject = encodeURIComponent(`Contacts: ${list.listName}`);
    const body = encodeURIComponent(contactsText);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  // Upload modal handlers
  const openUploadForNewList = () => {
    setTargetListId(null);
    setTargetListName("");
    setUploadModalOpen(true);
  };

  const openUploadForExistingList = (list) => {
    setTargetListId(list.listId);
    setTargetListName(list.listName);
    setUploadModalOpen(true);
  };

  // Bulk upload handler
  const handleUpload = async ({
    listName,
    contacts,
    contactEmails,
    contactPhones,
    contactSocials,
  }) => {
    if (!orgId) {
      alert("Missing Org ID");
      return;
    }

    try {
      const contactsToCreate = contacts.map(c => {
        const emails = contactEmails.filter((e) => e.contactId === c.contactId);
        const phones = contactPhones.filter((p) => p.contactId === c.contactId);
        const socials = contactSocials.filter((s) => s.contactId === c.contactId);

        return {
          contactId: c.contactId,
          orgId,
          userId: null,
          name: c.name,
          primaryIdentifier: c.primaryIdentifier,
          contactType: c.contactType ?? "other",
          status: c.status ?? "active",
          meta: c.meta ?? {},
          emails: emails,
          phones: phones,
          socials: socials,
        };
      });

      for (const contactData of contactsToCreate) {
        await createContact(contactData);
      }

      const contactIds = contacts.map(c => c.contactId);

      await createList({
        listId: crypto.randomUUID(),
        orgId,
        listName,
        status: "live",
        contactIds: contactIds,
      });

      await refresh();
      setUploadModalOpen(false);
      alert(`✅ Uploaded ${contacts.length} contacts to list "${listName}"`);
    } catch (error) {
      console.error("UPLOAD ERROR →", error);
      alert(error.message || "Upload failed");
    }
  };

  // Remove contact from list
  const handleRemoveContact = async (listId, contactId) => {
    if (!confirm("Remove this contact from the list?")) return;
    
    try {
      await removeContactsFromList(listId, [contactId]);
      await refresh();
    } catch (error) {
      console.error("Failed to remove contact:", error);
      alert("Failed to remove contact");
    }
  };

  // List expansion toggle
  const toggleListExpansion = (listId) => {
    const newExpanded = new Set(expandedLists);
    if (newExpanded.has(listId)) {
      newExpanded.delete(listId);
    } else {
      newExpanded.add(listId);
    }
    setExpandedLists(newExpanded);
  };

  // Create list
  const handleCreateList = async () => {
    if (!newListName.trim() || !orgId) return;

    try {
      await createList({
        listId: crypto.randomUUID(),
        orgId,
        listName: newListName.trim(),
        status: "live",
      });

      await refresh();
      setNewListName("");
      setIsCreating(false);
    } catch (error) {
      console.error("Failed to create list:", error);
      alert("Failed to create list");
    }
  };

  // Delete list
  const handleDeleteList = async (listId) => {
    if (!confirm("Are you sure you want to delete this list?")) return;

    try {
      await deleteList(listId);
      await refresh();
    } catch (error) {
      console.error("Failed to delete list:", error);
      alert("Failed to delete list");
    }
  };

  // Rename list
  const handleRenameList = async (listId) => {
    if (!editingName.trim()) return;
    
    try {
      await updateList(listId, { listName: editingName.trim() });
      await refresh();
      setEditingListId(null);
      setEditingName("");
    } catch (error) {
      console.error("Failed to rename list:", error);
      alert("Failed to rename list");
    }
  };

  const startEditing = (list) => {
    setEditingListId(list.listId);
    setEditingName(list.listName);
  };

  // Get contacts for a list
  const getListContacts = (list) => {
    if (list.contacts && Array.isArray(list.contacts)) {
      return list.contacts;
    }
    return [];
  };

  // Add existing contact to list
  const handleAddExistingContact = async (listId) => {
    const sel = document.getElementById(`add-existing-${listId}`);
    const cid = sel?.value;
    if (!cid) return alert("Please select a contact");
    
    try {
      await addContactsToList(listId, [cid]);
      await refresh();
      sel.value = "";
    } catch (err) {
      console.error(err);
      alert("Failed to add contact");
    }
  };

  // Add tag to contact
  const handleAddTag = async (contact) => {
    const el = document.getElementById(`tag-${contact.contactId}`);
    const tag = el?.value?.trim();
    if (!tag) return;
    
    const tags = Array.from(new Set([...(contact.meta?.tags || []), tag]));
    try {
      await updateContact(contact.contactId, { 
        meta: { ...(contact.meta || {}), tags } 
      });
      await refresh();
      el.value = "";
    } catch (err) {
      console.error(err);
      alert("Failed to add tag");
    }
  };

  // Move contact to another list
  const handleMoveContact = async (currentListId, contactId) => {
    const sel = document.getElementById(`move-to-${contactId}`);
    const destListId = sel?.value;
    if (!destListId) return alert("Please choose a destination list");
    
    try {
      await addContactsToList(destListId, [contactId]);
      await removeContactsFromList(currentListId, [contactId]);
      await refresh();
      alert("Contact moved successfully");
    } catch (err) {
      console.error(err);
      alert("Failed to move contact");
    }
  };

  // Delete contact permanently
  const handleDeleteContact = async (contactId) => {
    if (!confirm("Delete this contact permanently? This cannot be undone.")) return;
    
    try {
      await deleteContact(contactId);
      await refresh();
    } catch (err) {
      console.error(err);
      alert("Failed to delete contact");
    }
  };

  // Filter & helpers
  const filteredLists = lists.filter(list =>
    list.listName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getContactTypeIcon = (type) => {
    switch (type) {
      case "email": return <Mail className="w-3.5 h-3.5" />;
      case "whatsapp":
      case "phone": return <Phone className="w-3.5 h-3.5" />;
      case "social": return <Share2 className="w-3.5 h-3.5" />;
      default: return <Users className="w-3.5 h-3.5" />;
    }
  };

  const getContactTypeBadge = (type) => {
    const colors = {
      email: "bg-blue-100 text-blue-700 border-blue-200",
      whatsapp: "bg-green-100 text-green-700 border-green-200",
      phone: "bg-purple-100 text-purple-700 border-purple-200",
      social: "bg-pink-100 text-pink-700 border-pink-200",
      other: "bg-gray-100 text-gray-700 border-gray-200"
    };
    return colors[type] || colors.other;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-6">
        {/* HEADER */}
        <div className="mb-8">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Contact Lists</h1>
              <p className="text-gray-500 mt-2">
                Organize your contacts into targeted lists
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={openUploadForNewList}
                className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all shadow-sm hover:shadow-md"
              >
                <Upload className="w-4 h-4" />
                Upload Contacts
              </button>
              <button
                onClick={() => setIsCreating(true)}
                className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all shadow-sm hover:shadow-md"
              >
                <Plus className="w-4 h-4" />
                Create Empty List
              </button>
            </div>
          </div>

          {/* STATS BAR */}
          <div className="grid grid-cols-3 gap-4 mt-6">
            <div className="bg-white rounded-lg p-4 border border-gray-200">
              <div className="text-2xl font-bold text-gray-900">{lists.length}</div>
              <div className="text-sm text-gray-500">Total Lists</div>
            </div>
            <div className="bg-white rounded-lg p-4 border border-gray-200">
              <div className="text-2xl font-bold text-blue-600">{contacts.length}</div>
              <div className="text-sm text-gray-500">Total Contacts</div>
            </div>
            <div className="bg-white rounded-lg p-4 border border-gray-200">
              <div className="text-2xl font-bold text-green-600">
                {lists.filter(l => l.status === 'live').length}
              </div>
              <div className="text-sm text-gray-500">Active Lists</div>
            </div>
          </div>
        </div>

        {/* SEARCH BAR */}
        <div className="bg-white rounded-lg p-4 mb-6 border border-gray-200">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search lists..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* CREATE NEW LIST FORM */}
        {isCreating && (
          <div className="bg-white rounded-lg border-2 border-blue-500 p-6 mb-6 shadow-lg">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Create Empty List</h3>
            <div className="flex gap-3">
              <input
                type="text"
                placeholder="Enter list name..."
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleCreateList()}
                autoFocus
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                onClick={handleCreateList}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                Create
              </button>
              <button
                onClick={() => {
                  setIsCreating(false);
                  setNewListName("");
                }}
                className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
<button onClick={async ()=>{
  if (!confirm("Remove selected contacts from the list?")) return;
  try {
    await removeContactsFromList(list.listId, Array.from(selectedContacts));
    setSelectedContacts(new Set());
    await refresh();
  } catch(err){ console.error(err); alert("Failed"); }
}} disabled={selectedContacts.size===0} className="px-3 py-1 bg-red-600 text-white rounded">
  Remove Selected ({selectedContacts.size})
</button>

        {/* LOADING STATE */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-500">Loading lists...</p>
            </div>
          </div>
        ) : filteredLists.length > 0 ? (
          <div className="space-y-4">
            {filteredLists.map((list) => {
              const listContacts = getListContacts(list);
              const paginationData = getPaginatedContacts(list.listId, listContacts);
              
              return (
                <div
                  key={list.listId}
                  className="bg-white rounded-lg border border-gray-200 hover:shadow-md transition-all overflow-hidden"
                >
                  {/* LIST HEADER */}
                  <div className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1">
                        <button
                          onClick={() => toggleListExpansion(list.listId)}
                          className="p-1 hover:bg-gray-100 rounded transition"
                        >
                          {expandedLists.has(list.listId) ? (
                            <ChevronDown className="w-5 h-5 text-gray-600" />
                          ) : (
                            <ChevronRight className="w-5 h-5 text-gray-600" />
                          )}
                        </button>

                        <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                          <FolderOpen className="w-5 h-5 text-blue-600" />
                        </div>

                        <div className="flex-1">
                          {editingListId === list.listId ? (
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                value={editingName}
                                onChange={(e) => setEditingName(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && handleRenameList(list.listId)}
                                onBlur={() => handleRenameList(list.listId)}
                                autoFocus
                                className="px-3 py-1 border border-blue-500 rounded focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                          ) : (
                            <div>
                              <h3 className="text-lg font-semibold text-gray-900">
                                {list.listName}
                              </h3>
                              <div className="flex items-center gap-3 mt-1">
                                <span className="flex items-center gap-1 text-sm text-gray-600">
                                  <Users className="w-4 h-4" />
                                  {listContacts.length} contacts
                                </span>
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                                  list.status === 'live' 
                                    ? 'bg-green-100 text-green-700 border border-green-200' 
                                    : 'bg-gray-100 text-gray-700 border border-gray-200'
                                }`}>
                                  {list.status === 'live' ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                                  {list.status}
                                </span>
                                {list.createdAt && (
                                  <span className="flex items-center gap-1 text-xs text-gray-500">
                                    <Calendar className="w-3 h-3" />
                                    {new Date(list.createdAt).toLocaleDateString('en-US', { 
                                      month: 'short', 
                                      day: 'numeric', 
                                      year: 'numeric' 
                                    })}
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          onClick={() => openUploadForExistingList(list)}
                          className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition"
                          title="Add contacts to list"
                        >
                          <UserPlus className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleToggleArchive(list)}
                          className="px-3 py-1 text-xs text-yellow-600 hover:bg-yellow-50 rounded-lg transition"
                          title={list.status === "archived" ? "Unarchive list" : "Archive list"}
                        >
                          {list.status === "archived" ? "Unarchive" : "Archive"}
                        </button>
                        <button
                          onClick={() => handleDuplicateList(list)}
                          className="px-3 py-1 text-xs text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                          title="Duplicate list"
                        >
                          Duplicate
                        </button>
                        <button 
                          onClick={() => exportListToCSV(list)} 
                          className="px-3 py-1 text-xs text-gray-700 hover:bg-gray-100 rounded-lg"
                        >
                          Export CSV
                        </button>
                        <button 
                          onClick={() => shareListViaWhatsApp(list)} 
                          className="p-2 text-green-600 hover:bg-green-50 rounded-lg"
                          title="Share via WhatsApp"
                        >
                          WA
                        </button>
                        <button 
                          onClick={() => shareListByEmail(list)} 
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                          title="Share via Email"
                        >
                          <Mail className="w-4 h-4" />
                        </button>
                        <select 
                          id={`add-existing-${list.listId}`} 
                          className="p-1 text-sm border rounded"
                        >
                          <option value="">Add existing...</option>
                          {contacts
                            .filter(c => !(list.contacts || []).some(x => x.contactId === c.contactId))
                            .map(c => (
                              <option key={c.contactId} value={c.contactId}>
                                {c.name || c.primaryIdentifier}
                              </option>
                            ))}
                        </select>
                        <button 
                          onClick={() => handleAddExistingContact(list.listId)} 
                          className="px-2 py-1 text-sm bg-green-600 text-white rounded"
                        >
                          Add
                        </button>
                        <button
                          onClick={() => startEditing(list)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                          title="Rename list"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteList(list.listId)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                          title="Delete list"
                        >
                          <Trash className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* CONTACTS IN LIST */}
                  {expandedLists.has(list.listId) && (
                    <div className="border-t border-gray-200 bg-gray-50">
                      {listContacts.length > 0 ? (
                        <>
                          {/* Pagination Controls - Top */}
                          {paginationData.totalPages > 1 && (
                            <div className="flex justify-between items-center px-6 py-3 bg-white border-b border-gray-200">
                              <div className="text-sm text-gray-600">
                                Showing {((paginationData.page - 1) * 10) + 1} - {Math.min(paginationData.page * 10, paginationData.total)} of {paginationData.total}
                              </div>
                              <div className="flex gap-2">
                                <button 
                                  disabled={paginationData.page === 1} 
                                  onClick={() => setListPage(list.listId, Math.max(1, paginationData.page - 1))} 
                                  className="px-3 py-1 text-sm border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                                >
                                  Prev
                                </button>
                                <span className="px-3 py-1 text-sm">
                                  Page {paginationData.page} of {paginationData.totalPages}
                                </span>
                                <button 
                                  disabled={paginationData.page >= paginationData.totalPages} 
                                  onClick={() => setListPage(list.listId, paginationData.page + 1)} 
                                  className="px-3 py-1 text-sm border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                                >
                                  Next
                                </button>
                              </div>
                            </div>
                          )}

                          <div className="p-6 space-y-3">
                            {paginationData.contacts.map((contact) => (
                              <div
                                key={contact.contactId}
                                className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-sm transition"
                              >
                                <div className="flex items-start justify-between">
                                  <div className="flex items-center gap-3 flex-1">
                                    <input type="checkbox" checked={selectedContacts.has(contact.contactId)} onChange={(e)=>{
  const s = new Set(selectedContacts);
  if (e.target.checked) s.add(contact.contactId); else s.delete(contact.contactId);
  setSelectedContacts(s);
}} />

                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${getContactTypeBadge(contact.contactType)}`}>
                                      <span className="text-sm font-semibold">
                                        {contact.name?.charAt(0)?.toUpperCase() || "?"}
                                      </span>
                                    </div>
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2">
                                        <h4 className="font-medium text-gray-900">
                                          {contact.name || "Unnamed Contact"}
                                        </h4>
                                        <button 
                                          onClick={() => { setViewContact(contact); setViewOpen(true); }}
                                          className="text-blue-600 hover:text-blue-800 text-sm"
                                          title="View details"
                                        >
                                          (i)
                                        </button>
                                        <button 
                                          onClick={() => { setEditingContact(contact); setContactEditOpen(true); }} 
                                          className="text-blue-600 hover:text-blue-800 text-sm"
                                          title="Edit contact"
                                        >
                                          Edit
                                        </button>
                                        <button
                                          onClick={() => handleDeleteContact(contact.contactId)}
                                          className="text-red-600 hover:text-red-800 text-sm"
                                          title="Delete permanently"
                                        >
                                          Delete
                                        </button>
                                      </div>
                                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border ${getContactTypeBadge(contact.contactType)}`}>
                                          {getContactTypeIcon(contact.contactType)}
                                          {contact.contactType}
                                        </span>
                                        <span className="text-xs text-gray-500">
                                          {contact.primaryIdentifier}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                  
                                  <button
                                    onClick={() => handleRemoveContact(list.listId, contact.contactId)}
                                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition ml-2 flex items-center gap-1"
                                    title="Remove from list"
                                  >
                                    <X className="w-4 h-4" />
                                    <span className="text-xs">Remove</span>
                                  </button>
                                </div>

                                {/* CONTACT DETAILS */}
                                <div className="mt-3 pt-3 border-t border-gray-100 grid md:grid-cols-3 gap-3 text-sm">
                                  <div>
                                    <span className="text-xs font-semibold text-gray-500 uppercase block mb-1">
                                      Emails
                                    </span>
                                    {contact.emails && contact.emails.length > 0 ? (
                                      contact.emails.map((email, i) => (
                                        <div key={i} className="text-gray-900 break-all">
                                          {email.email}
                                          {email.is_verified && (
                                            <CheckCircle className="inline w-3 h-3 text-green-600 ml-1" />
                                          )}
                                        </div>
                                      ))
                                    ) : (
                                      <span className="text-gray-400">None</span>
                                    )}
                                  </div>

                                  <div>
                                    <span className="text-xs font-semibold text-gray-500 uppercase block mb-1">
                                      Phones
                                    </span>
                                    {contact.phones && contact.phones.length > 0 ? (
                                      contact.phones.map((phone, i) => (
                                        <div key={i} className="text-gray-900">
                                          {phone.country_code} {phone.phone_number}
                                          {phone.is_whatsapp && (
                                            <span className="ml-1 text-xs text-green-600">(WA)</span>
                                          )}
                                        </div>
                                      ))
                                    ) : (
                                      <span className="text-gray-400">None</span>
                                    )}
                                  </div>

                                  <div>
                                    <span className="text-xs font-semibold text-gray-500 uppercase block mb-1">
                                      Socials
                                    </span>
                                    {contact.socials && contact.socials.length > 0 ? (
                                      contact.socials.map((social, i) => (
                                        <div key={i} className="text-gray-900">
                                          {social.platform}: {social.handle}
                                        </div>
                                      ))
                                    ) : (
                                      <span className="text-gray-400">None</span>
                                    )}
                                  </div>
                                </div>

                                {/* TAGS */}
                                <div className="mt-3 pt-3 border-t border-gray-100">
                                  <span className="text-xs font-semibold text-gray-500 uppercase block mb-2">
                                    Tags
                                  </span>
                                  <div className="flex gap-2 items-center flex-wrap">
                                    <div className="flex flex-wrap gap-2">
                                      {(contact.meta?.tags || []).map(t => (
                                        <span key={t} className="text-xs px-2 py-1 bg-gray-100 rounded">
                                          {t}
                                        </span>
                                      ))}
                                    </div>
                                    <input 
                                      placeholder="Add tag" 
                                      id={`tag-${contact.contactId}`} 
                                      className="p-1 text-sm border rounded w-32" 
                                    />
                                    <button 
                                      onClick={() => handleAddTag(contact)} 
                                      className="px-2 py-1 text-xs bg-blue-600 text-white rounded"
                                    >
                                      Add Tag
                                    </button>
                                  </div>
                                </div>

                                {/* MOVE CONTACT */}
                                <div className="mt-3 pt-3 border-t border-gray-100">
                                  <span className="text-xs font-semibold text-gray-500 uppercase block mb-2">
                                    Move Contact
                                  </span>
                                  <div className="flex gap-2 items-center">
                                    <select 
                                      id={`move-to-${contact.contactId}`} 
                                      className="p-1 text-sm border rounded flex-1"
                                    >
                                      <option value="">Select destination list...</option>
                                      {lists
                                        .filter(l => l.listId !== list.listId)
                                        .map(l => (
                                          <option key={l.listId} value={l.listId}>
                                            {l.listName}
                                          </option>
                                        ))}
                                    </select>
                                    <button 
                                      onClick={() => handleMoveContact(list.listId, contact.contactId)} 
                                      className="px-3 py-1 text-sm bg-gray-600 text-white rounded hover:bg-gray-700"
                                    >
                                      Move
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>

                          {/* Pagination Controls - Bottom */}
                          {paginationData.totalPages > 1 && (
                            <div className="flex justify-between items-center px-6 py-3 bg-white border-t border-gray-200">
                              <div className="text-sm text-gray-600">
                                Showing {((paginationData.page - 1) * 10) + 1} - {Math.min(paginationData.page * 10, paginationData.total)} of {paginationData.total}
                              </div>
                              <div className="flex gap-2">
                                <button 
                                  disabled={paginationData.page === 1} 
                                  onClick={() => setListPage(list.listId, Math.max(1, paginationData.page - 1))} 
                                  className="px-3 py-1 text-sm border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                                >
                                  Prev
                                </button>
                                <span className="px-3 py-1 text-sm">
                                  Page {paginationData.page} of {paginationData.totalPages}
                                </span>
                                <button 
                                  disabled={paginationData.page >= paginationData.totalPages} 
                                  onClick={() => setListPage(list.listId, paginationData.page + 1)} 
                                  className="px-3 py-1 text-sm border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                                >
                                  Next
                                </button>
                              </div>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="p-12 text-center">
                          <Users className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                          <p className="text-gray-500">No contacts in this list yet</p>
                          <button
                            onClick={() => openUploadForExistingList(list)}
                            className="mt-4 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition inline-flex items-center gap-2"
                          >
                            <UserPlus className="w-4 h-4" />
                            Add Contacts
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
            <FolderOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No lists found
            </h3>
            <p className="text-gray-500 mb-6">
              {searchTerm 
                ? `No lists match "${searchTerm}"` 
                : "Create your first list to organize contacts"}
            </p>
            {searchTerm ? (
              <button
                onClick={() => setSearchTerm("")}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
              >
                Clear Search
              </button>
            ) : (
              <div className="flex gap-3 justify-center">
                <button
                  onClick={openUploadForNewList}
                  className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition inline-flex items-center gap-2"
                >
                  <Upload className="w-4 h-4" />
                  Upload Contacts
                </button>
                <button
                  onClick={() => setIsCreating(true)}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  Create Empty List
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* MODALS */}
      <ContactEditModal 
        isOpen={contactEditOpen} 
        contact={editingContact} 
        onClose={() => setContactEditOpen(false)} 
        onSaved={refresh} 
      />
      
      <ContactProfileModal 
        contact={viewContact} 
        isOpen={viewOpen} 
        onClose={() => setViewOpen(false)} 
      />
          <ContactsList
      contacts={contacts}
      onDelete={deleteContact}
      onEdit={(c) => console.log("edit:", c)}
      pageSize={10}
    />
      <UploadModal
        isOpen={uploadModalOpen}
        onClose={() => {
          setUploadModalOpen(false);
          setTargetListId(null);
          setTargetListName("");
        }}
        onUpload={handleUpload}
        existingListName={targetListName}
        isAddingToList={!!targetListId}
      />
    </div>
  );
}

// Contact Edit Modal Component
const ContactEditModal = ({ contact, isOpen, onClose, onSaved }) => {
  const { updateContact } = useContacts();
  const [form, setForm] = useState(contact || {});

  useEffect(() => {
    setForm(contact || {});
  }, [contact]);

  if (!isOpen || !contact) return null;

  const save = async () => {
    try {
      await updateContact(contact.contactId, {
        name: form.name,
        status: form.status,
        meta: form.meta,
      });
      onSaved?.();
      onClose();
    } catch (err) {
      console.error(err);
      alert("Failed to save contact");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white p-6 rounded-lg w-full max-w-md shadow-xl">
        <h3 className="text-lg font-semibold mb-4">Edit Contact</h3>
        
        <label className="block mb-2 text-sm font-medium text-gray-700">Name</label>
        <input 
          value={form.name || ""} 
          onChange={(e) => setForm({ ...form, name: e.target.value })} 
          className="w-full mb-3 p-2 border rounded focus:ring-2 focus:ring-blue-500" 
        />

        <label className="block mb-2 text-sm font-medium text-gray-700">Status</label>
        <select 
          value={form.status || "active"} 
          onChange={(e) => setForm({ ...form, status: e.target.value })} 
          className="w-full mb-3 p-2 border rounded focus:ring-2 focus:ring-blue-500"
        >
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="bounced">Bounced</option>
          <option value="unsubscribed">Unsubscribed</option>
        </select>

        <div className="flex gap-2 justify-end mt-4">
          <button 
            onClick={onClose} 
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
          >
            Cancel
          </button>
          <button 
            onClick={save} 
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};

// Contact Profile Modal Component
function ContactProfileModal({ contact, isOpen, onClose }) {
  if (!isOpen || !contact) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white p-6 rounded-lg w-full max-w-2xl shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold">{contact.name || "Contact Details"}</h3>
          <button 
            onClick={onClose} 
            className="text-gray-600 hover:text-gray-800 px-3 py-1 rounded hover:bg-gray-100"
          >
            Close
          </button>
        </div>
        
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 p-3 rounded">
              <h4 className="font-semibold text-sm text-gray-700 mb-2">Contact ID</h4>
              <p className="text-sm text-gray-900 break-all">{contact.contactId}</p>
            </div>
            <div className="bg-gray-50 p-3 rounded">
              <h4 className="font-semibold text-sm text-gray-700 mb-2">Type</h4>
              <p className="text-sm text-gray-900">{contact.contactType}</p>
            </div>
          </div>

          <div className="bg-gray-50 p-3 rounded">
            <h4 className="font-semibold text-sm text-gray-700 mb-2">Primary Identifier</h4>
            <p className="text-sm text-gray-900">{contact.primaryIdentifier}</p>
          </div>

          <div className="bg-gray-50 p-3 rounded">
            <h4 className="font-semibold text-sm text-gray-700 mb-2">Emails</h4>
            {(contact.emails || []).length > 0 ? (
              <div className="space-y-1">
                {contact.emails.map((e, idx) => (
                  <div key={idx} className="text-sm text-gray-900 flex items-center gap-2">
                    {e.email} 
                    {e.is_verified && <CheckCircle className="w-4 h-4 text-green-600" />}
                    {e.is_primary && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">Primary</span>}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400">No emails</p>
            )}
          </div>

          <div className="bg-gray-50 p-3 rounded">
            <h4 className="font-semibold text-sm text-gray-700 mb-2">Phones</h4>
            {(contact.phones || []).length > 0 ? (
              <div className="space-y-1">
                {contact.phones.map((p, idx) => (
                  <div key={idx} className="text-sm text-gray-900 flex items-center gap-2">
                    {p.country_code} {p.phone_number}
                    {p.is_whatsapp && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">WhatsApp</span>}
                    {p.is_primary && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">Primary</span>}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400">No phones</p>
            )}
          </div>

          <div className="bg-gray-50 p-3 rounded">
            <h4 className="font-semibold text-sm text-gray-700 mb-2">Social Media</h4>
            {(contact.socials || []).length > 0 ? (
              <div className="space-y-1">
                {contact.socials.map((s, idx) => (
                  <div key={idx} className="text-sm text-gray-900">
                    <span className="font-medium">{s.platform}:</span> {s.handle}
                    {s.link && (
                      <a 
                        href={s.link} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="ml-2 text-blue-600 hover:underline"
                      >
                        Visit
                      </a>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400">No social media</p>
            )}
          </div>

          <div className="bg-gray-50 p-3 rounded">
            <h4 className="font-semibold text-sm text-gray-700 mb-2">Metadata</h4>
            <pre className="text-xs bg-white p-2 rounded border border-gray-200 overflow-x-auto">
              {JSON.stringify(contact.meta || {}, null, 2)}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}