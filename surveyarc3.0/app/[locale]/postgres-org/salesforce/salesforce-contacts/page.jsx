"use client";
import { useSalesforceContacts } from "@/providers/postGresPorviders/SalesforceContactProvider";
import { useState, useEffect } from "react";
import { Search, Plus, X, Edit2, Trash2, User, Mail, Building2, RefreshCw, Save, Filter, ChevronDown, Phone, Briefcase } from "lucide-react";

export default function SalesforceContactsPage() {
  const {
    contacts,
    total,
    loading,
    list,
    get,
    update,
    remove,
    selectedContact,
    setSelectedContact,
  } = useSalesforceContacts();

  const [editing, setEditing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", phone: "", title: "" });
  const [searchTerm, setSearchTerm] = useState("");
  const [limitParam, setLimitParam] = useState(50);
  const [useApexParam, setUseApexParam] = useState(true);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    list({ limit: limitParam, useApex: useApexParam });
  }, [list, limitParam, useApexParam]);

  useEffect(() => {
    if (selectedContact) {
      setForm({
        firstName: selectedContact.firstName || "",
        lastName: selectedContact.lastName || "",
        email: selectedContact.email || "",
        phone: selectedContact.phone || "",
        title: selectedContact.title || "",
      });
    }
  }, [selectedContact]);

  const onField = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  const onSave = async () => {
    if (!selectedContact) return;
    await update(selectedContact.contactId, form);
    setEditing(false);
  };

  const onDelete = async (contactId) => {
    if (!confirm("Are you sure you want to delete this contact?")) return;
    await remove(contactId);
    setSelectedContact(null);
  };

  const onSelect = async (contactId) => {
    setEditing(false);
    setCreating(false);
    await get(contactId);
  };

  const onCloseDrawer = () => {
    setSelectedContact(null);
    setEditing(false);
    setCreating(false);
  };

  const onRefresh = () => {
    list({ limit: limitParam, useApex: useApexParam });
  };

  const filteredContacts = contacts.filter(c => {
    const search = searchTerm.toLowerCase();
    return (
      (c.firstName?.toLowerCase() || "").includes(search) ||
      (c.lastName?.toLowerCase() || "").includes(search) ||
      (c.email?.toLowerCase() || "").includes(search) ||
      (c.accountName?.toLowerCase() || "").includes(search)
    );
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-800 mb-2">Salesforce Contacts</h1>
          <p className="text-slate-600">Manage and sync your Salesforce contacts</p>
        </div>

        {/* Top Controls */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
          <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Search contacts..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3 flex-wrap">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-2 px-4 py-2.5 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <Filter className="w-4 h-4" />
                Filters
                <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
              </button>

              <button
                onClick={onRefresh}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>

              <div className="px-4 py-2.5 bg-blue-50 text-blue-700 rounded-lg font-semibold">
                Total: {total}
              </div>
            </div>
          </div>

          {/* Filters Panel */}
          {showFilters && (
            <div className="mt-6 pt-6 border-t border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Results Limit
                </label>
                <select
                  value={limitParam}
                  onChange={(e) => setLimitParam(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={200}>200</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Data Source
                </label>
                <select
                  value={useApexParam ? "apex" : "rest"}
                  onChange={(e) => setUseApexParam(e.target.value === "apex")}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="apex">Apex REST</option>
                  <option value="rest">Standard REST API</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Contacts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {loading && contacts.length === 0 ? (
            <div className="col-span-full flex justify-center items-center py-20">
              <div className="text-center">
                <RefreshCw className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-4" />
                <p className="text-slate-600">Loading contacts...</p>
              </div>
            </div>
          ) : filteredContacts.length === 0 ? (
            <div className="col-span-full flex justify-center items-center py-20">
              <div className="text-center">
                <User className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-slate-700 mb-2">No contacts found</h3>
                <p className="text-slate-500">Try adjusting your search or filters</p>
              </div>
            </div>
          ) : (
            filteredContacts.map((contact) => (
              <div
                key={contact.contactId}
                onClick={() => onSelect(contact.contactId)}
                className={`bg-white rounded-xl shadow-sm border-2 transition-all cursor-pointer hover:shadow-md ${
                  selectedContact?.contactId === contact.contactId
                    ? 'border-blue-500 ring-2 ring-blue-100'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold text-lg">
                        {contact.firstName?.[0]}{contact.lastName?.[0]}
                      </div>
                      <div>
                        <h3 className="font-semibold text-slate-800 text-lg">
                          {contact.firstName} {contact.lastName}
                        </h3>
                        {contact.title && (
                          <p className="text-sm text-slate-500">{contact.title}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {contact.email && (
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <Mail className="w-4 h-4 text-slate-400" />
                        <span className="truncate">{contact.email}</span>
                      </div>
                    )}

                    {contact.accountName && (
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <Building2 className="w-4 h-4 text-slate-400" />
                        <span className="truncate">{contact.accountName}</span>
                      </div>
                    )}

                    {contact.phone && (
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <Phone className="w-4 h-4 text-slate-400" />
                        <span>{contact.phone}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Detail Drawer */}
        {selectedContact && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              {/* Header */}
              <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold text-xl">
                    {selectedContact.firstName?.[0]}{selectedContact.lastName?.[0]}
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-slate-800">
                      {selectedContact.firstName} {selectedContact.lastName}
                    </h2>
                    {selectedContact.title && (
                      <p className="text-slate-500">{selectedContact.title}</p>
                    )}
                  </div>
                </div>

                <button
                  onClick={onCloseDrawer}
                  className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <X className="w-6 h-6 text-slate-600" />
                </button>
              </div>

              {/* Content */}
              <div className="p-6">
                {editing ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          First Name
                        </label>
                        <input
                          type="text"
                          value={form.firstName}
                          onChange={(e) => onField("firstName", e.target.value)}
                          className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                          placeholder="Enter first name"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Last Name
                        </label>
                        <input
                          type="text"
                          value={form.lastName}
                          onChange={(e) => onField("lastName", e.target.value)}
                          className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                          placeholder="Enter last name"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Email Address
                      </label>
                      <input
                        type="email"
                        value={form.email}
                        onChange={(e) => onField("email", e.target.value)}
                        className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="contact@example.com"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Phone Number
                      </label>
                      <input
                        type="tel"
                        value={form.phone}
                        onChange={(e) => onField("phone", e.target.value)}
                        className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="+1 (555) 000-0000"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Job Title
                      </label>
                      <input
                        type="text"
                        value={form.title}
                        onChange={(e) => onField("title", e.target.value)}
                        className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="Job title"
                      />
                    </div>

                    <div className="flex gap-3 pt-4">
                      <button
                        onClick={() => setEditing(false)}
                        className="flex-1 px-6 py-3 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={onSave}
                        className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center justify-center gap-2"
                      >
                        <Save className="w-5 h-5" />
                        Save Changes
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Contact Info */}
                    <div className="space-y-4">
                      <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">
                        Contact Information
                      </h3>

                      {selectedContact.email && (
                        <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                          <Mail className="w-5 h-5 text-slate-400 mt-0.5" />
                          <div>
                            <p className="text-xs text-slate-500 mb-1">Email</p>
                            <p className="text-slate-800">{selectedContact.email}</p>
                          </div>
                        </div>
                      )}

                      {selectedContact.phone && (
                        <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                          <Phone className="w-5 h-5 text-slate-400 mt-0.5" />
                          <div>
                            <p className="text-xs text-slate-500 mb-1">Phone</p>
                            <p className="text-slate-800">{selectedContact.phone}</p>
                          </div>
                        </div>
                      )}

                      {selectedContact.accountName && (
                        <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                          <Building2 className="w-5 h-5 text-slate-400 mt-0.5" />
                          <div>
                            <p className="text-xs text-slate-500 mb-1">Account</p>
                            <p className="text-slate-800">{selectedContact.accountName}</p>
                          </div>
                        </div>
                      )}

                      {selectedContact.title && (
                        <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                          <Briefcase className="w-5 h-5 text-slate-400 mt-0.5" />
                          <div>
                            <p className="text-xs text-slate-500 mb-1">Title</p>
                            <p className="text-slate-800">{selectedContact.title}</p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 pt-4 border-t border-slate-200">
                      <button
                        onClick={() => setEditing(true)}
                        className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center justify-center gap-2"
                      >
                        <Edit2 className="w-5 h-5" />
                        Edit Contact
                      </button>
                      <button
                        onClick={() => onDelete(selectedContact.contactId)}
                        className="px-6 py-3 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors font-medium flex items-center justify-center gap-2"
                      >
                        <Trash2 className="w-5 h-5" />
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}