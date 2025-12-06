"use client";
import { useSalesforceAccounts } from "@/providers/postGresPorviders/SalesforceAccountProvider";
import { useState, useEffect } from "react";
import { Search, Building2, RefreshCw, X, Globe, Phone, Users, Mail, User, Filter, ChevronDown, ExternalLink } from "lucide-react";

export default function SalesforceAccountsPage() {
  const { list, accounts, get, selectedAccount, loading, setSelectedAccount } = useSalesforceAccounts();
  
  const [searchTerm, setSearchTerm] = useState("");
  const [limitParam, setLimitParam] = useState(50);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    list({ limit: limitParam });
  }, [list, limitParam]);

  const onRefresh = () => {
    list({ limit: limitParam });
  };

  const onSelectAccount = async (accountId) => {
    await get(accountId);
  };

  const onCloseDrawer = () => {
    setSelectedAccount(null);
  };

  const filteredAccounts = accounts.filter(a => {
    const search = searchTerm.toLowerCase();
    return (
      (a.name?.toLowerCase() || "").includes(search) ||
      (a.type?.toLowerCase() || "").includes(search) ||
      (a.website?.toLowerCase() || "").includes(search)
    );
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-800 mb-2">Salesforce Accounts</h1>
          <p className="text-slate-600">View and manage your Salesforce accounts and contacts</p>
        </div>

        {/* Top Controls */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
          <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Search accounts..."
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
                Total: {accounts.length}
              </div>
            </div>
          </div>

          {/* Filters Panel */}
          {showFilters && (
            <div className="mt-6 pt-6 border-t border-slate-200">
              <div className="max-w-md">
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
            </div>
          )}
        </div>

        {/* Accounts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {loading && accounts.length === 0 ? (
            <div className="col-span-full flex justify-center items-center py-20">
              <div className="text-center">
                <RefreshCw className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-4" />
                <p className="text-slate-600">Loading accounts...</p>
              </div>
            </div>
          ) : filteredAccounts.length === 0 ? (
            <div className="col-span-full flex justify-center items-center py-20">
              <div className="text-center">
                <Building2 className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-slate-700 mb-2">No accounts found</h3>
                <p className="text-slate-500">Try adjusting your search or filters</p>
              </div>
            </div>
          ) : (
            filteredAccounts.map((account) => (
              <div
                key={account.accountId}
                onClick={() => onSelectAccount(account.accountId)}
                className={`bg-white rounded-xl shadow-sm border-2 transition-all cursor-pointer hover:shadow-md ${
                  selectedAccount?.account?.id === account.accountId
                    ? 'border-blue-500 ring-2 ring-blue-100'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center text-white font-semibold text-lg shadow-md">
                        <Building2 className="w-6 h-6" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-slate-800 text-lg truncate">
                          {account.name}
                        </h3>
                        {account.type && (
                          <span className="inline-block px-2 py-0.5 bg-slate-100 text-slate-600 text-xs rounded-full mt-1">
                            {account.type}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {account.website && (
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <Globe className="w-4 h-4 text-slate-400 flex-shrink-0" />
                        <span className="truncate">{account.website}</span>
                      </div>
                    )}

                    {account.phone && (
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <Phone className="w-4 h-4 text-slate-400 flex-shrink-0" />
                        <span>{account.phone}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Detail Drawer */}
        {selectedAccount && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
              {/* Header */}
              <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center text-white shadow-lg">
                    <Building2 className="w-8 h-8" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-slate-800">
                      {selectedAccount.account.name}
                    </h2>
                    {selectedAccount.account.type && (
                      <span className="inline-block px-3 py-1 bg-slate-100 text-slate-600 text-sm rounded-full mt-1">
                        {selectedAccount.account.type}
                      </span>
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
                {/* Account Info */}
                <div className="mb-8">
                  <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">
                    Account Information
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {selectedAccount.account.website && (
                      <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-lg">
                        <Globe className="w-5 h-5 text-slate-400 mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-slate-500 mb-1">Website</p>
                          <a 
                            href={selectedAccount.account.website.startsWith('http') ? selectedAccount.account.website : `https://${selectedAccount.account.website}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-700 flex items-center gap-1 break-all"
                          >
                            {selectedAccount.account.website}
                            <ExternalLink className="w-3 h-3 flex-shrink-0" />
                          </a>
                        </div>
                      </div>
                    )}

                    {selectedAccount.account.phone && (
                      <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-lg">
                        <Phone className="w-5 h-5 text-slate-400 mt-0.5" />
                        <div>
                          <p className="text-xs text-slate-500 mb-1">Phone</p>
                          <p className="text-slate-800">{selectedAccount.account.phone}</p>
                        </div>
                      </div>
                    )}

                    {selectedAccount.account.industry && (
                      <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-lg">
                        <Building2 className="w-5 h-5 text-slate-400 mt-0.5" />
                        <div>
                          <p className="text-xs text-slate-500 mb-1">Industry</p>
                          <p className="text-slate-800">{selectedAccount.account.industry}</p>
                        </div>
                      </div>
                    )}

                    <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-lg">
                      <Users className="w-5 h-5 text-blue-500 mt-0.5" />
                      <div>
                        <p className="text-xs text-blue-600 mb-1">Contacts</p>
                        <p className="text-xl font-bold text-blue-700">
                          {selectedAccount.contacts?.length || 0}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Contacts List */}
                {selectedAccount.contacts && selectedAccount.contacts.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4 flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      Associated Contacts ({selectedAccount.contacts.length})
                    </h3>

                    <div className="space-y-3">
                      {selectedAccount.contacts.map((contact) => (
                        <div
                          key={contact.id}
                          className="flex items-center gap-4 p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
                        >
                          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold shadow-md">
                            {contact.firstName?.[0]}{contact.lastName?.[0]}
                          </div>

                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-slate-800">
                              {contact.firstName} {contact.lastName}
                            </h4>
                            
                            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 mt-1">
                              {contact.email && (
                                <div className="flex items-center gap-1.5 text-sm text-slate-600">
                                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                                  <span className="truncate">{contact.email}</span>
                                </div>
                              )}
                              
                              {contact.title && (
                                <div className="flex items-center gap-1.5 text-sm text-slate-600">
                                  <User className="w-3.5 h-3.5 text-slate-400" />
                                  <span>{contact.title}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* No Contacts Message */}
                {(!selectedAccount.contacts || selectedAccount.contacts.length === 0) && (
                  <div className="text-center py-12 bg-slate-50 rounded-lg">
                    <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-500">No contacts associated with this account</p>
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