"use client";

import { useState, useMemo } from "react";
import React from "react";
import { Pencil, Trash, User, Mail, Phone, X, Plus, Trash2 } from "lucide-react";

// Edit Contact Modal Component
function EditContactModal({ contact, onSave, onClose }) {
  const [formData, setFormData] = useState({
    name: contact?.name || "",
    primary_identifier: contact?.primary_identifier || "",
    contactType: contact?.contactType || "other",
    status: contact?.status || "active",
    emails: contact?.emails || [],
    phones: contact?.phones || [],
    socials: contact?.socials || [],
    meta: contact?.meta || {}
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(contact.contactId, formData);
    onClose();
  };

  // Email handlers
  const addEmail = () => {
    setFormData(prev => ({
      ...prev,
      emails: [...prev.emails, { email: "", is_primary: false, is_verified: false, status: "active" }]
    }));
  };

  const updateEmail = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      emails: prev.emails.map((email, i) => 
        i === index ? { ...email, [field]: value } : email
      )
    }));
  };

  const removeEmail = (index) => {
    setFormData(prev => ({
      ...prev,
      emails: prev.emails.filter((_, i) => i !== index)
    }));
  };

  // Phone handlers
  const addPhone = () => {
    setFormData(prev => ({
      ...prev,
      phones: [...prev.phones, { country_code: "", phone_number: "", is_primary: false, is_whatsapp: false, is_verified: false }]
    }));
  };

  const updatePhone = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      phones: prev.phones.map((phone, i) => 
        i === index ? { ...phone, [field]: value } : phone
      )
    }));
  };

  const removePhone = (index) => {
    setFormData(prev => ({
      ...prev,
      phones: prev.phones.filter((_, i) => i !== index)
    }));
  };

  // Social handlers
  const addSocial = () => {
    setFormData(prev => ({
      ...prev,
      socials: [...prev.socials, { platform: "", handle: "", link: "" }]
    }));
  };

  const updateSocial = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      socials: prev.socials.map((social, i) => 
        i === index ? { ...social, [field]: value } : social
      )
    }));
  };

  const removeSocial = (index) => {
    setFormData(prev => ({
      ...prev,
      socials: prev.socials.filter((_, i) => i !== index)
    }));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-semibold">Edit Contact</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Basic Info */}
          <div className="space-y-4">
            <h3 className="font-medium text-lg">Basic Information</h3>
            
            <div>
              <label className="block text-sm font-medium mb-1">Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Primary Identifier</label>
              <input
                type="text"
                value={formData.primary_identifier}
                onChange={(e) => setFormData(prev => ({ ...prev, primary_identifier: e.target.value }))}
                className="w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Contact Type</label>
                <select
                  value={formData.contactType}
                  onChange={(e) => setFormData(prev => ({ ...prev, contactType: e.target.value }))}
                  className="w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="email">Email</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="phone">Phone</option>
                  <option value="social">Social</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
                  className="w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="active">Active</option>
                  <option value="bounced">Bounced</option>
                  <option value="unsubscribed">Unsubscribed</option>
                  <option value="inactive">Inactive</option>
                  <option value="blocked">Blocked</option>
                </select>
              </div>
            </div>
          </div>

          {/* Emails */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="font-medium text-lg">Emails</h3>
              <button
                type="button"
                onClick={addEmail}
                className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
              >
                <Plus size={16} /> Add Email
              </button>
            </div>

            {formData.emails.length === 0 && (
              <div className="text-sm text-gray-500 italic p-3 border border-dashed rounded-md">
                No emails added yet. Click "Add Email" to add one.
              </div>
            )}

            {formData.emails.map((email, index) => (
              <div key={index} className="flex gap-2 items-start p-3 border rounded-md bg-gray-50">
                <div className="flex-1 space-y-2">
                  <input
                    type="email"
                    placeholder="Email address"
                    value={email.email}
                    onChange={(e) => updateEmail(index, "email", e.target.value)}
                    className="w-full border rounded px-2 py-1 text-sm"
                  />
                  <div className="flex gap-4 text-sm">
                    <label className="flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={email.is_primary}
                        onChange={(e) => updateEmail(index, "is_primary", e.target.checked)}
                      />
                      Primary
                    </label>
                    <label className="flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={email.is_verified}
                        onChange={(e) => updateEmail(index, "is_verified", e.target.checked)}
                      />
                      Verified
                    </label>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removeEmail(index)}
                  className="p-1 text-red-600 hover:bg-red-50 rounded"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>

          {/* Phones */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="font-medium text-lg">Phones</h3>
              <button
                type="button"
                onClick={addPhone}
                className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
              >
                <Plus size={16} /> Add Phone
              </button>
            </div>

            {formData.phones.length === 0 && (
              <div className="text-sm text-gray-500 italic p-3 border border-dashed rounded-md">
                No phones added yet. Click "Add Phone" to add one.
              </div>
            )}

            {formData.phones.map((phone, index) => (
              <div key={index} className="flex gap-2 items-start p-3 border rounded-md bg-gray-50">
                <div className="flex-1 space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Code"
                      value={phone.country_code}
                      onChange={(e) => updatePhone(index, "country_code", e.target.value)}
                      className="w-20 border rounded px-2 py-1 text-sm"
                    />
                    <input
                      type="text"
                      placeholder="Phone number"
                      value={phone.phone_number}
                      onChange={(e) => updatePhone(index, "phone_number", e.target.value)}
                      className="flex-1 border rounded px-2 py-1 text-sm"
                    />
                  </div>
                  <div className="flex gap-4 text-sm">
                    <label className="flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={phone.is_primary}
                        onChange={(e) => updatePhone(index, "is_primary", e.target.checked)}
                      />
                      Primary
                    </label>
                    <label className="flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={phone.is_whatsapp}
                        onChange={(e) => updatePhone(index, "is_whatsapp", e.target.checked)}
                      />
                      WhatsApp
                    </label>
                    <label className="flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={phone.is_verified}
                        onChange={(e) => updatePhone(index, "is_verified", e.target.checked)}
                      />
                      Verified
                    </label>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removePhone(index)}
                  className="p-1 text-red-600 hover:bg-red-50 rounded"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>

          {/* Socials */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="font-medium text-lg">Social Media</h3>
              <button
                type="button"
                onClick={addSocial}
                className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
              >
                <Plus size={16} /> Add Social
              </button>
            </div>

            {formData.socials.length === 0 && (
              <div className="text-sm text-gray-500 italic p-3 border border-dashed rounded-md">
                No social media accounts added yet. Click "Add Social" to add one.
              </div>
            )}

            {formData.socials.map((social, index) => (
              <div key={index} className="flex gap-2 items-start p-3 border rounded-md bg-gray-50">
                <div className="flex-1 space-y-2">
                  <input
                    type="text"
                    placeholder="Platform (e.g., Instagram, LinkedIn)"
                    value={social.platform}
                    onChange={(e) => updateSocial(index, "platform", e.target.value)}
                    className="w-full border rounded px-2 py-1 text-sm"
                  />
                  <input
                    type="text"
                    placeholder="Handle/Username"
                    value={social.handle}
                    onChange={(e) => updateSocial(index, "handle", e.target.value)}
                    className="w-full border rounded px-2 py-1 text-sm"
                  />
                  <input
                    type="url"
                    placeholder="Profile URL"
                    value={social.link}
                    onChange={(e) => updateSocial(index, "link", e.target.value)}
                    className="w-full border rounded px-2 py-1 text-sm"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeSocial(index)}
                  className="p-1 text-red-600 hover:bg-red-50 rounded"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Main ContactsList Component
export default function ContactsList({
  contacts = [],
  lists = [],
  loading,
  onCreate,
  onUpdate,
  onDelete,
  onAddToList,
  onRemoveFromList,
}) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState("name");
  const [sortOrder, setSortOrder] = useState("asc");
  const [page, setPage] = useState(1);
  const [editingContact, setEditingContact] = useState(null);
  const pageSize = 15;

  const filtered = useMemo(() => {
    return contacts.filter((c) => {
      const matchString =
        `${c.name} ${(c.emails ?? []).map((e) => e.email).join(" ")}`.toLowerCase();
      return matchString.includes(search.toLowerCase());
    });
  }, [search, contacts]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let A = a[sortKey] ?? "";
      let B = b[sortKey] ?? "";

      if (sortKey === "createdAt") {
        A = new Date(A);
        B = new Date(B);
      } else {
        A = A.toString().toLowerCase();
        B = B.toString().toLowerCase();
      }

      if (A < B) return sortOrder === "asc" ? -1 : 1;
      if (A > B) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });
  }, [filtered, sortKey, sortOrder]);

  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sorted.slice(start, start + pageSize);
  }, [page, sorted]);

  const totalPages = Math.ceil(sorted.length / pageSize);

  const toggleSort = (key) => {
    if (sortKey === key) {
      setSortOrder((s) => (s === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortOrder("asc");
    }
  };

  const handleEdit = (contactId, contact) => {
    setEditingContact(contact);
  };

  const handleSaveEdit = async (contactId, formData) => {
    await onUpdate(contactId, formData);
    setEditingContact(null);
  };

  return (
    <div className="w-full p-4">

      
      {/* Edit Modal */}
      {editingContact && (
        <EditContactModal
          contact={editingContact}
          onSave={handleSaveEdit}
          onClose={() => setEditingContact(null)}
        />
      )}

      {/* SEARCH BAR */}
      <div className="flex justify-between mb-4">
        <input
          placeholder="Search contacts"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border rounded-md px-3 py-2 w-full max-w-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="overflow-x-auto border rounded-xl shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 border-b">
            <tr>
              <th 
                onClick={() => toggleSort("name")} 
                className="py-3 px-4 cursor-pointer text-left font-semibold hover:bg-gray-200"
              >
                Name {sortKey === "name" && (sortOrder === "asc" ? "↑" : "↓")}
              </th>
              <th className="py-3 px-4 text-left font-semibold">Email</th>
              <th className="py-3 px-4 text-left font-semibold">Phone</th>
              <th className="py-3 px-4 text-left font-semibold">Lists</th>
              <th 
                onClick={() => toggleSort("createdAt")} 
                className="py-3 px-4 cursor-pointer text-left font-semibold hover:bg-gray-200"
              >
                Created {sortKey === "createdAt" && (sortOrder === "asc" ? "↑" : "↓")}
              </th>
              <th className="py-3 px-4 text-left font-semibold">Actions</th>
            </tr>
          </thead>

          <tbody>
            {paginated.length > 0 && paginated.map((c) => {
              const contactLists = Array.isArray(c.lists) ? c.lists : [];
              const availableLists = lists.filter(
                (l) => !contactLists.some((x) => x.list_id === l.list_id)
              );

              return (
                <React.Fragment key={c.contactId}>
                <tr className="border-b hover:bg-gray-50 transition-colors">
                  <td className="py-3 px-4">
                    <div className="flex gap-2 items-center">
                      <User size={16} className="text-gray-500 flex-shrink-0" />
                      <span className="font-medium">{c.name}</span>
                    </div>
                  </td>

                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1 text-gray-700">
                      <Mail size={14} className="text-gray-400 flex-shrink-0" />
                      <span className="text-sm truncate">{c.emails?.[0]?.email ?? "-"}</span>
                    </div>
                  </td>

                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1 text-gray-700">
                      <Phone size={14} className="text-gray-400 flex-shrink-0" />
                      <span className="text-sm">{c.phones?.[0]?.phone_number ?? "-"}</span>
                    </div>
                  </td>

                  <td className="py-3 px-4">
                    <div className="flex gap-2 flex-wrap items-center min-w-[200px]">
                      {contactLists.length > 0 ? (
                        <>
                          {contactLists.map((l) => (
                            <span
                              key={l.list_id}
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-blue-50 text-blue-700 border border-blue-200"
                            >
                              <span className="font-medium">{l.list_name}</span>
                              <button
                                className="text-blue-500 hover:text-red-600 transition-colors ml-1"
                                onClick={() => onRemoveFromList(l.list_id, [c.contactId])}
                                title="Remove from list"
                              >
                                <X size={12} />
                              </button>
                            </span>
                          ))}
                        </>
                      ) : (
                        <span className="text-gray-400 text-xs italic">Not in any list</span>
                      )}

                      {availableLists.length > 0 && (
                        <select
                          className="text-xs border rounded px-2 py-1 bg-white hover:bg-gray-50 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
                          onChange={(e) => {
                            const listId = e.target.value;
                            if (listId) {
                              onAddToList(listId, [c.contactId]);
                              e.target.value = "";
                            }
                          }}
                          defaultValue=""
                        >
                          <option value="">+ Add to list</option>
                          {availableLists.map((l) => (
                            <option key={l.list_id} value={l.list_id}>
                              {l.list_name}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  </td>

                  <td className="py-3 px-4 text-sm text-gray-600">
                    {new Date(c.createdAt).toLocaleDateString()}
                  </td>

                  <td className="py-3 px-4">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEdit(c.contactId, c)}
                        className="p-1.5 rounded hover:bg-blue-50 text-blue-600 transition-colors"
                        title="Edit contact"
                      >
                        <Pencil size={14} />
                      </button>

                      <button
                        onClick={() => onDelete(c.contactId)}
                        className="p-1.5 text-red-600 rounded hover:bg-red-50 transition-colors"
                        title="Delete contact"
                      >
                        <Trash size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
                </React.Fragment>
              );
            })}

            {!loading && paginated.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-8 text-gray-500">
                  No contacts found
                </td>
              </tr>
            )}

            {loading && (
              <tr>
                <td colSpan={6} className="text-center py-8 text-gray-500">
                  Loading contacts...
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* PAGINATION */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center mt-4 gap-4">
          <button
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
            className="px-4 py-2 border rounded hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Previous
          </button>

          <span className="text-sm text-gray-600">
            Page {page} of {totalPages}
          </span>

          <button
            disabled={page === totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="px-4 py-2 border rounded hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}