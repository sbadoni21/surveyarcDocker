"use client"
import { Edit, Key, Loader2, Plus, Save, Search, Trash2, X, MoreVertical, Shield } from "lucide-react";
import { useEffect, useState, useCallback } from "react";

export function PermissionsTab({ orgId, userId, data, setData }) {
  const { permissions, loading, hasLoaded } = data;
  
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    code: "",
    module: "",
    description: "",
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [filterModule, setFilterModule] = useState("all");
  const [sortField, setSortField] = useState("code");
  const [sortDirection, setSortDirection] = useState("asc");
  const [activeDropdown, setActiveDropdown] = useState(null);
  const [expandedModules, setExpandedModules] = useState({});

  const loadPermissions = useCallback(async () => {
    if (!orgId || !userId) {
      console.log("Missing orgId or userId");
      return;
    }

    setData(prev => ({ ...prev, loading: true }));
    try {
      const res = await fetch(
        `/api/post-gres-apis/rbac/permissions?user=${userId}&orgId=${orgId}`,
        { cache: "no-store" }
      );

      if (!res.ok) {
        const text = await res.text();
        console.error("Permissions API error:", res.status, text);
        setData({
          permissions: [],
          loading: false,
          hasLoaded: true,
        });
        return;
      }

      const text = await res.text();
      if (!text) {
        setData({
          permissions: [],
          loading: false,
          hasLoaded: true,
        });
        return;
      }

      const fetchedData = JSON.parse(text);
      setData({
        permissions: Array.isArray(fetchedData) ? fetchedData : [],
        loading: false,
        hasLoaded: true,
      });
    } catch (error) {
      console.error("Error loading permissions:", error);
      setData({
        permissions: [],
        loading: false,
        hasLoaded: true,
      });
    }
  }, [orgId, userId, setData]);

  useEffect(() => {
    if (orgId && userId && !hasLoaded) {
      loadPermissions();
    }
  }, [orgId, userId, hasLoaded, loadPermissions]);

  // Get unique modules
  const modules = [...new Set(permissions.map((p) => p.module))];

  // Toggle module expansion
  const toggleModule = (module) => {
    setExpandedModules(prev => ({
      ...prev,
      [module]: !prev[module]
    }));
  };

  // Create/Update permission
  const submit = async () => {
    const method = editing ? "PUT" : "POST";
    const url = editing
      ? `/api/post-gres-apis/rbac/permissions/${editing.id}`
      : `/api/post-gres-apis/rbac/permissions`;

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, user_id: userId }),
      });

      if (res.ok) {
        setForm({ code: "", module: "", description: "" });
        setEditing(null);
        setShowModal(false);
        setData(prev => ({ ...prev, hasLoaded: false }));
      } else {
        const error = await res.json();
        alert(error.detail || "Failed to save permission");
      }
    } catch (error) {
      alert("Error saving permission");
    }
  };

  // Delete permission
  const deletePermission = async (id) => {
    if (!confirm("Delete this permission? This will affect all roles using it.")) return;

    try {
      await fetch(`/api/post-gres-apis/rbac/permissions/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId }),
      });
      setData(prev => ({ ...prev, hasLoaded: false }));
      setActiveDropdown(null);
    } catch (error) {
      alert("Error deleting permission");
    }
  };

  // Sorting function
  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  // Filter and sort permissions
  const filteredPermissions = permissions
    .filter(
      (p) =>
        (filterModule === "all" || p.module === filterModule) &&
        (p.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
          p.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          p.module?.toLowerCase().includes(searchTerm.toLowerCase()))
    )
    .sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

      if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });

  // Group by module
  const groupedPermissions = filteredPermissions.reduce((acc, perm) => {
    if (!acc[perm.module]) acc[perm.module] = [];
    acc[perm.module].push(perm);
    return acc;
  }, {});

  // Manual refresh
  const handleRefresh = () => {
    setData(prev => ({ ...prev, hasLoaded: false }));
  };

  const getModuleColor = (module) => {
    const colors = {
      support: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
      project: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
      billing: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
      rbac: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
      team: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400",
    };
    return colors[module] || "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Permissions Management</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Define and manage permissions that can be assigned to roles
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleRefresh}
            className="px-4 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            disabled={loading}
          >
            {loading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              "Refresh"
            )}
          </button>
          <button
            onClick={() => {
              setEditing(null);
              setForm({ code: "", module: "", description: "" });
              setShowModal(true);
            }}
            className="px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg flex items-center gap-2 transition-colors shadow-sm hover:shadow-md"
          >
            <Plus size={18} />
            <span className="font-medium">Create Permission</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search by code, module, or description..."
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-500 dark:focus:ring-orange-400"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <select
            className="px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-500 dark:focus:ring-orange-400 min-w-[180px]"
            value={filterModule}
            onChange={(e) => setFilterModule(e.target.value)}
          >
            <option value="all">All Modules ({permissions.length})</option>
            {modules.map((mod) => (
              <option key={mod} value={mod}>
                {mod} ({permissions.filter(p => p.module === mod).length})
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-20 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="text-center">
            <Loader2 className="animate-spin text-orange-500 mx-auto mb-4" size={40} />
            <p className="text-gray-600 dark:text-gray-400">Loading permissions...</p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.keys(groupedPermissions).length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="text-center py-16 px-4">
                <Key size={48} className="mx-auto mb-4 text-gray-400 dark:text-gray-600" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  {searchTerm || filterModule !== "all" ? "No permissions found" : "No permissions yet"}
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  {searchTerm || filterModule !== "all"
                    ? "Try adjusting your search or filter criteria"
                    : "Create your first permission to get started"}
                </p>
                {!searchTerm && filterModule === "all" && (
                  <button
                    onClick={() => {
                      setEditing(null);
                      setForm({ code: "", module: "", description: "" });
                      setShowModal(true);
                    }}
                    className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg inline-flex items-center gap-2 transition-colors"
                  >
                    <Plus size={18} />
                    Create Permission
                  </button>
                )}
              </div>
            </div>
          ) : (
            Object.keys(groupedPermissions).map((module) => {
              const isExpanded = expandedModules[module] !== false; // Default to expanded
              const modulePerms = groupedPermissions[module];
              
              return (
                <div
                  key={module}
                  className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden"
                >
                  {/* Module Header */}
                  <button
                    onClick={() => toggleModule(module)}
                    className="w-full bg-gray-50 dark:bg-gray-900 px-6 py-4 border-b border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Key size={20} className="text-orange-500" />
                        <h3 className="font-semibold text-lg text-gray-900 dark:text-white">
                          {module}
                        </h3>
                        <span className={`px-3 py-1 text-xs font-medium rounded-full ${getModuleColor(module)}`}>
                          {modulePerms.length} {modulePerms.length === 1 ? 'permission' : 'permissions'}
                        </span>
                      </div>
                      <div className="text-gray-400">
                        {isExpanded ? '▼' : '▶'}
                      </div>
                    </div>
                  </button>

                  {/* Permissions Table */}
                  {isExpanded && (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                          <tr>
                            <th
                              onClick={() => handleSort("code")}
                              className="px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                            >
                              <div className="flex items-center gap-2">
                                Permission Code
                                {sortField === "code" && (
                                  <span className="text-orange-500">
                                    {sortDirection === "asc" ? "↑" : "↓"}
                                  </span>
                                )}
                              </div>
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                              Description
                            </th>
                            <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                          {modulePerms.map((perm) => (
                            <tr
                              key={perm.id}
                              className="hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors"
                            >
                              <td className="px-6 py-4 whitespace-nowrap">
                                <code className="text-sm font-mono bg-gray-100 dark:bg-gray-700 px-3 py-1.5 rounded text-gray-900 dark:text-gray-100">
                                  {perm.code}
                                </code>
                              </td>
                              <td className="px-6 py-4">
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                  {perm.description || "—"}
                                </p>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-right">
                                <div className="relative inline-block">
                                  <button
                                    onClick={() =>
                                      setActiveDropdown(activeDropdown === perm.id ? null : perm.id)
                                    }
                                    className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                  >
                                    <MoreVertical size={18} className="text-gray-600 dark:text-gray-400" />
                                  </button>

                                  {activeDropdown === perm.id && (
                                    <>
                                      <div
                                        className="fixed inset-0 z-10"
                                        onClick={() => setActiveDropdown(null)}
                                      />
                                      <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-20">
                                        <button
                                          onClick={() => {
                                            setEditing(perm);
                                            setForm(perm);
                                            setShowModal(true);
                                            setActiveDropdown(null);
                                          }}
                                          className="w-full px-4 py-2 text-left text-sm flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                                        >
                                          <Edit size={16} className="text-blue-600 dark:text-blue-400" />
                                          <span className="text-gray-700 dark:text-gray-300">Edit Permission</span>
                                        </button>
                                        <button
                                          onClick={() => deletePermission(perm.id)}
                                          className="w-full px-4 py-2 text-left text-sm flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                                        >
                                          <Trash2 size={16} className="text-red-600 dark:text-red-400" />
                                          <span className="text-gray-700 dark:text-gray-300">Delete Permission</span>
                                        </button>
                                      </div>
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })
          )}

          {/* Summary Footer */}
          {Object.keys(groupedPermissions).length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 px-6 py-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Showing <span className="font-medium text-gray-900 dark:text-white">{filteredPermissions.length}</span> of{" "}
                <span className="font-medium text-gray-900 dark:text-white">{permissions.length}</span> permissions
                {filterModule !== "all" && (
                  <span> in <span className="font-medium text-gray-900 dark:text-white">{filterModule}</span> module</span>
                )}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 w-full max-w-lg rounded-xl shadow-2xl">
            <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  {editing ? "Edit Permission" : "Create New Permission"}
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {editing ? "Update permission details" : "Define a new permission for your system"}
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              >
                <X size={20} className="text-gray-600 dark:text-gray-400" />
              </button>
            </div>

            <div className="px-6 py-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Permission Code <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g., module.action"
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 dark:focus:ring-orange-400"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">
                  Use format: module.action (e.g., support.create, project.read)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Module <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g., support, project, billing"
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500 dark:focus:ring-orange-400"
                  value={form.module}
                  onChange={(e) => setForm({ ...form, module: e.target.value })}
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">
                  Group permissions by functional area
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Description
                </label>
                <textarea
                  placeholder="Describe what this permission allows users to do..."
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500 dark:focus:ring-orange-400 resize-none"
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 rounded-b-xl">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={submit}
                disabled={!form.code.trim() || !form.module.trim()}
                className="px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg flex items-center gap-2 transition-colors shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                <Save size={18} />
                {editing ? "Update Permission" : "Create Permission"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}