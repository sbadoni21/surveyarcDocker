// components/contacts/ContactListCard.jsx
"use client";
import React from "react";
import {
  ChevronDown,
  ChevronRight,
  FolderOpen,
  UserPlus,
  Edit3,
  Trash,
  Users,
  Mail,
  Phone,
  Share2,
  Calendar,
  CheckCircle,
  XCircle,
  X,
} from "lucide-react";

/**
 * ContactListCard
 *
 * Props expected (parent passes these in):
 * - list
 * - lists
 * - contacts
 * - expanded (boolean)
 * - editingListId
 * - editingName
 * - paginationData { contacts: [], page, total, totalPages }
 * - selectedContacts (Set)
 * - toggleListExpansion(listId)
 * - handleRenameList(listId)
 * - setEditingName(str)
 * - openUploadForExistingList(list)
 * - handleToggleArchive(list)
 * - handleDuplicateList(list)
 * - exportListToCSV(list)
 * - shareListViaWhatsApp(list)
 * - shareListByEmail(list)
 * - handleAddExistingContact(list)
 * - startEditing(list)
 * - handleDeleteList(listId)
 * - setViewContact(contact)
 * - setViewOpen(bool)
 * - setEditingContact(contact)
 * - setContactEditOpen(bool)
 * - handleDeleteContact(contactId)
 * - handleRemoveContact(listId, contactId)
 * - handleAddTag(contact)
 * - handleMoveContact(currentListId, contactId)
 * - setListPage(listId, page)
 * - getListContacts(list) -> []
 * - getContactTypeBadge(type)
 * - getContactTypeIcon(type)
 * - setSelectedContacts(set)
 */

export default function ContactListCard(props) {
  const {
    list,
    lists = [],
    contacts = [],
    expanded = false,
    editingListId,
    setTargetListId,
    editingName,
    paginationData = { contacts: [], page: 1, total: 0, totalPages: 1 },
    selectedContacts = new Set(),
    toggleListExpansion = () => {},
    handleRenameList = () => {},
    setEditingName = () => {},
    openUploadForExistingList = () => {},
    handleToggleArchive = () => {},
    handleDuplicateList = () => {},
    exportListToCSV = () => {},
    shareListViaWhatsApp = () => {},
    shareListByEmail = () => {},
    handleAddExistingContact = () => {},
    startEditing = () => {},
    handleDeleteList = () => {},
    setViewContact = () => {},
    setViewOpen = () => {},
    setEditingContact = () => {},
    setContactEditOpen = () => {},
    handleDeleteContact = () => {},
    handleRemoveContact = () => {},
    handleAddTag = () => {},
    handleMoveContact = () => {},
    setListPage = () => {},
    getListContacts = (l) => l.contacts || [],
    getContactTypeBadge = () => "bg-gray-100 text-gray-700 border-gray-200",
    getContactTypeIcon = () => <Users className="w-3.5 h-3.5" />,
    setSelectedContacts = () => {},
        setManualContactOpen = () => {},
    setManualContactListId = () => {},
  } = props;

  const listContacts = getListContacts(list) || [];
  const page = paginationData.page || 1;
  const total = paginationData.total || listContacts.length;
  const totalPages = paginationData.totalPages || Math.max(1, Math.ceil(total / 10));
  const pageContacts = paginationData.contacts ?? listContacts.slice((page - 1) * 10, page * 10);

  const handleToggleSelect = (contactId, checked) => {
    const copy = new Set(selectedContacts);
    if (checked) copy.add(contactId);
    else copy.delete(contactId);
    setSelectedContacts(copy);
  };

  const handleSelectAllOnPage = (checked) => {
    const copy = new Set(selectedContacts);
    pageContacts.forEach((c) => {
      if (checked) copy.add(c.contactId);
      else copy.delete(c.contactId);
    });
    setSelectedContacts(copy);
  };

  const handleAddExisting = (e) => {
    const val = e.target.value;
    if (!val) return;
    handleAddExistingContact(list.listId, val); // parent expects just (listId) earlier; we keep call consistent below
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 hover:shadow-md transition-all overflow-hidden">
      {/* LIST HEADER */}
      <div className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1">
            <button
              onClick={() => toggleListExpansion(list.listId)}
              className="p-1 hover:bg-gray-100 rounded transition"
              aria-label={expanded ? "Collapse list" : "Expand list"}
            >
              {expanded ? (
                <ChevronDown className="w-5 h-5 text-gray-600" />
              ) : (
                <ChevronRight className="w-5 h-5 text-gray-600" />
              )}
            </button>
<button
  onClick={() => {
    setManualContactListId(list.listId);
    setManualContactOpen(true);
  }}
  className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition"
  title="Add contact manually"
>
  <UserPlus className="w-4 h-4" />
  <span className="text-xs ml-1">Manual</span>
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
                    onKeyDown={(e) => e.key === "Enter" && handleRenameList(list.listId)}
                    onBlur={() => handleRenameList(list.listId)}
                    autoFocus
                    className="px-3 py-1 border border-blue-500 rounded focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              ) : (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{list.listName}</h3>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="flex items-center gap-1 text-sm text-gray-600">
                      <Users className="w-4 h-4" />
                      {listContacts.length} contacts
                    </span>

                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                        list.status === "live"
                          ? "bg-green-100 text-green-700 border border-green-200"
                          : "bg-gray-100 text-gray-700 border border-gray-200"
                      }`}
                    >
                      {list.status === "live" ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                      {list.status}
                    </span>

                    {list.createdAt && (
                      <span className="flex items-center gap-1 text-xs text-gray-500">
                        <Calendar className="w-3 h-3" />
                        {new Date(list.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
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
 onClick={() => {
    console.log("Setting target list id to:", list.listId);
    setTargetListId(list.listId);
    openUploadForExistingList(list);
  }}              className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition"
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

            <button onClick={() => exportListToCSV(list)} className="px-3 py-1 text-xs text-gray-700 hover:bg-gray-100 rounded-lg">
              Export CSV
            </button>

            <button onClick={() => shareListViaWhatsApp(list)} className="p-2 text-green-600 hover:bg-green-50 rounded-lg" title="Share via WhatsApp">
              WA
            </button>

            <button onClick={() => shareListByEmail(list)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg" title="Share via Email">
              <Mail className="w-4 h-4" />
            </button>

            <select id={`add-existing-${list.listId}`} className="p-1 text-sm border rounded">
              <option value="">Add existing...</option>
              {contacts
                .filter((c) => !(list.contacts || []).some((x) => x.contactId === c.contactId))
                .map((c) => (
                  <option key={c.contactId} value={c.contactId}>
                    {c.name || c.primaryIdentifier}
                  </option>
                ))}
            </select>


            <button
              onClick={() => startEditing(list)}
              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
              title="Rename list"
            >
              <Edit3 className="w-4 h-4" />
            </button>

            <button onClick={() => handleDeleteList(list.listId)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition" title="Delete list">
              <Trash className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* CONTACTS (expanded) */}
      {expanded && (
        <div className="border-t border-gray-200 bg-gray-50">
          {listContacts.length > 0 ? (
            <>
              {/* Pagination controls top */}
              {totalPages > 1 && (
                <div className="flex justify-between items-center px-6 py-3 bg-white border-b border-gray-200">
                  <div className="text-sm text-gray-600">
                    Showing {Math.min((page - 1) * 10 + 1, total)} - {Math.min(page * 10, total)} of {total}
                  </div>

                  <div className="flex gap-2 items-center">
                    <button
                      disabled={page === 1}
                      onClick={() => setListPage(list.listId, Math.max(1, page - 1))}
                      className="px-3 py-1 text-sm border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                    >
                      Prev
                    </button>
                    <span className="px-3 py-1 text-sm">Page {page} of {totalPages}</span>
                    <button
                      disabled={page >= totalPages}
                      onClick={() => setListPage(list.listId, page + 1)}
                      className="px-3 py-1 text-sm border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}

              {/* Select all checkbox and actions */}
              <div className="px-6 py-3 flex items-center justify-between bg-white border-b border-gray-200">
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      onChange={(e) => handleSelectAllOnPage(e.target.checked)}
                      checked={pageContacts.every((c) => selectedContacts.has(c.contactId)) && pageContacts.length > 0}
                    />
                    <span> Select page</span>
                  </label>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      // Remove selected from this list: parent expects (listId, [contactIds])
                      if (selectedContacts.size === 0) return alert("No selected contacts");
                      if (!confirm("Remove selected contacts from this list?")) return;
                      if (typeof props.handleRemoveContact === "function") {
                        // call parent removeMany if available; parent originally had removeContactsFromList(listId, [ids])
                        props.handleRemoveContact(list.listId, Array.from(selectedContacts));
                      } else {
                        alert("Remove handler not provided");
                      }
                    }}
                    className="px-3 py-1 bg-red-600 text-white rounded disabled:opacity-50"
                    disabled={selectedContacts.size === 0}
                  >
                    Remove Selected ({selectedContacts.size})
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-3">
                {pageContacts.map((contact) => (
                  <div key={contact.contactId} className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-sm transition">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3 flex-1">
                        <input
                          type="checkbox"
                          checked={selectedContacts.has(contact.contactId)}
                          onChange={(e) => handleToggleSelect(contact.contactId, e.target.checked)}
                        />

                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${getContactTypeBadge(contact.contactType)}`}>
                          <span className="text-sm font-semibold">{contact.name?.charAt(0)?.toUpperCase() || "?"}</span>
                        </div>

                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium text-gray-900">{contact.name || "Unnamed Contact"}</h4>

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
                              {contact.contactType || "other"}
                            </span>
                            <span className="text-xs text-gray-500">{contact.primaryIdentifier}</span>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          if (!confirm("Remove this contact from the list?")) return;
                          handleRemoveContact(list.listId, contact.contactId);
                        }}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition ml-2 flex items-center gap-1"
                        title="Remove from list"
                      >
                        <X className="w-4 h-4" />
                        <span className="text-xs">Remove</span>
                      </button>
                    </div>

                    {/* CONTACT DETAILS */}
                    <div className="mt-3 pt-3 border-t border-gray-100 grid md:grid-cols-3 gap-3 text-sm">
                      {/* Emails */}
                      <div>
                        <span className="text-xs font-semibold text-gray-500 uppercase block mb-1">Emails</span>
                        {contact.emails && contact.emails.length > 0 ? (
                          contact.emails.map((email, i) => (
                            <div key={i} className="text-gray-900 break-all">
                              {email.email}
                              {email.is_verified && <CheckCircle className="inline w-3 h-3 text-green-600 ml-1" />}
                            </div>
                          ))
                        ) : (
                          <span className="text-gray-400">None</span>
                        )}
                      </div>

                      {/* Phones */}
                      <div>
                        <span className="text-xs font-semibold text-gray-500 uppercase block mb-1">Phones</span>
                        {contact.phones && contact.phones.length > 0 ? (
                          contact.phones.map((phone, i) => (
                            <div key={i} className="text-gray-900">
                              {phone.country_code || phone.countryCode || ""} {phone.phone_number || phone.phoneNumber}
                              {phone.is_whatsapp && <span className="ml-1 text-xs text-green-600">(WA)</span>}
                            </div>
                          ))
                        ) : (
                          <span className="text-gray-400">None</span>
                        )}
                      </div>

                      {/* Socials */}
                      <div>
                        <span className="text-xs font-semibold text-gray-500 uppercase block mb-1">Socials</span>
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

                    {/* Tags / Move */}
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <span className="text-xs font-semibold text-gray-500 uppercase block mb-2">Tags</span>
                      <div className="flex gap-2 items-center flex-wrap">
                        <div className="flex flex-wrap gap-2">
                          {(contact.meta?.tags || []).map((t) => (
                            <span key={t} className="text-xs px-2 py-1 bg-gray-100 rounded">
                              {t}
                            </span>
                          ))}
                        </div>

                        <input placeholder="Add tag" id={`tag-${contact.contactId}`} className="p-1 text-sm border rounded w-32" />
                        <button
                          onClick={() => handleAddTag(contact)}
                          className="px-2 py-1 text-xs bg-blue-600 text-white rounded"
                        >
                          Add Tag
                        </button>
                      </div>

                      <div className="mt-3">
                        <span className="text-xs font-semibold text-gray-500 uppercase block mb-2">Move Contact</span>
                        <div className="flex gap-2 items-center">
                          <select id={`move-to-${contact.contactId}`} className="p-1 text-sm border rounded flex-1">
                            <option value="">Select destination list...</option>
                            {lists
                              .filter((l) => l.listId !== list.listId)
                              .map((l) => (
                                <option key={l.listId} value={l.listId}>
                                  {l.listName}
                                </option>
                              ))}
                          </select>
                          <button
                            onClick={() => {
                              const sel = document.getElementById(`move-to-${contact.contactId}`);
                              const dest = sel?.value;
                              if (!dest) return alert("Select destination");
                              handleMoveContact(list.listId, contact.contactId);
                            }}
                            className="px-3 py-1 text-sm bg-gray-600 text-white rounded hover:bg-gray-700"
                          >
                            Move
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination bottom */}
              {totalPages > 1 && (
                <div className="flex justify-between items-center px-6 py-3 bg-white border-t border-gray-200">
                  <div className="text-sm text-gray-600">
                    Showing {Math.min((page - 1) * 10 + 1, total)} - {Math.min(page * 10, total)} of {total}
                  </div>

                  <div className="flex gap-2">
                    <button
                      disabled={page === 1}
                      onClick={() => setListPage(list.listId, Math.max(1, page - 1))}
                      className="px-3 py-1 text-sm border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                    >
                      Prev
                    </button>
                    <span className="px-3 py-1 text-sm">Page {page} of {totalPages}</span>
                    <button
                      disabled={page >= totalPages}
                      onClick={() => setListPage(list.listId, page + 1)}
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
}
