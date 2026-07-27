"use client"
import { Edit, Loader2, Plus, Save, Search, Trash2, X, MoreVertical, Shield } from "lucide-react";
import { useEffect, useState, useCallback } from "react";

export function RolesTab({ orgId, userId, data, setData }) {
  const { roles, loading, hasLoaded } = data;
  
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    name: "",
    scope: "org",
    description: "",
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState("name");
  const [sortDirection, setSortDirection] = useState("asc");
  const [activeDropdown, setActiveDropdown] = useState(null);

  // Memoize loadRoles with useCallback
  const loadRoles = useCallback(async () => {
    if (!orgId || !userId) {
      console.log("Missing orgId or userId");
      return;
    }

    setData(prev => ({ ...prev, loading: true }));
    try {
      const res = await fetch(
        `/api/post-gres-apis/rbac/roles?org_id=${orgId}&user=${userId}`,
        { cache: "no-store" }
      );
      const fetchedRoles = await res.json();
      setData({
        roles: fetchedRoles || [],
        loading: false,
        hasLoaded: true,
      });
    } catch (error) {
      console.error("Error loading roles:", error);
      setData(prev => ({ ...prev, loading: false }));
    }
  }, [orgId, userId, setData]);

  // Load roles only once when component mounts or when orgId/userId changes
  useEffect(() => {
    if (orgId && userId && !hasLoaded) {
      loadRoles();
    }
  }, [orgId, userId, hasLoaded, loadRoles]);

  // Create/Update role
  const submit = async () => {
    const method = editing ? "PUT" : "POST";
    const url = editing
      ? `/api/post-gres-apis/rbac/roles/${editing.id}`
      : `/api/post-gres-apis/rbac/roles`;

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          org_id: orgId,
          user_id: userId,
        }),
      });

      if (res.ok) {
        setForm({ name: "", scope: "org", description: "" });
        setEditing(null);
        setShowModal(false);
        // Reload roles after successful operation
        setData(prev => ({ ...prev, hasLoaded: false }));
      } else {
        const error = await res.json();
        alert(error.detail || "Failed to save role");
      }
    } catch (error) {
      alert("Error saving role");
    }
  };

  // Delete role
  const deleteRole = async (id, isSystem) => {
    if (isSystem) {
      alert("Cannot delete system roles");
      return;
    }

    if (!confirm("Delete this role? This will remove all assignments.")) return;

    try {
      await fetch(`/api/post-gres-apis/rbac/roles/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId }),
      });
      // Trigger reload after successful deletion
      setData(prev => ({ ...prev, hasLoaded: false }));
      setActiveDropdown(null);
    } catch (error) {
      alert("Error deleting role");
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

  // Filter and sort roles
  const filteredRoles = roles
    .filter(
      (r) =>
        r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.scope.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.description && r.description.toLowerCase().includes(searchTerm.toLowerCase()))
    )
    .sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

      if (sortField === "created_at") {
        aVal = new Date(aVal);
        bVal = new Date(bVal);
      }

      if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });

  const getScopeBadgeColor = (scope) => {
    const colors = {
      org: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
      group: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
      team: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
      project: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    };
    return colors[scope] || colors.org;
  };

  // Manual refresh function
  const handleRefresh = () => {
    setData(prev => ({ ...prev, hasLoaded: false }));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Roles Management</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Manage roles and their permissions across your organization
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
              setForm({ name: "", scope: "org", description: "" });
              setShowModal(true);
            }}
            className="px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg flex items-center gap-2 transition-colors shadow-sm hover:shadow-md"
          >
            <Plus size={18} />
            <span className="font-medium">Create Role</span>
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Search by name, scope, or description..."
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-500 dark:focus:ring-orange-400"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center items-center py-20 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="text-center">
            <Loader2 className="animate-spin text-orange-500 mx-auto mb-4" size={40} />
            <p className="text-gray-600 dark:text-gray-400">Loading roles...</p>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          {filteredRoles.length === 0 ? (
            <div className="text-center py-16 px-4">
              <Shield size={48} className="mx-auto mb-4 text-gray-400 dark:text-gray-600" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                {searchTerm ? "No roles found" : "No roles yet"}
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                {searchTerm
                  ? "Try adjusting your search criteria"
                  : "Create your first role to get started"}
              </p>
              {!searchTerm && (
                <button
                  onClick={() => {
                    setEditing(null);
                    setForm({ name: "", scope: "org", description: "" });
                    setShowModal(true);
                  }}
                  className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg inline-flex items-center gap-2 transition-colors"
                >
                  <Plus size={18} />
                  Create Role
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                  <tr>
                    <th
                      onClick={() => handleSort("name")}
                      className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        Role Name
                        {sortField === "name" && (
                          <span className="text-orange-500">
                            {sortDirection === "asc" ? "↑" : "↓"}
                          </span>
                        )}
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort("scope")}
                      className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        Scope
                        {sortField === "scope" && (
                          <span className="text-orange-500">
                            {sortDirection === "asc" ? "↑" : "↓"}
                          </span>
                        )}
                      </div>
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      Description
                    </th>
                    <th
                      onClick={() => handleSort("created_at")}
                      className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        Created
                        {sortField === "created_at" && (
                          <span className="text-orange-500">
                            {sortDirection === "asc" ? "↑" : "↓"}
                          </span>
                        )}
                      </div>
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredRoles.map((role) => (
                    <tr
                      key={role.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900 dark:text-white">
                            {role.name}
                          </span>
                          {role.is_system && (
                            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600">
                              System
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-3 py-1 text-xs font-medium rounded-full ${getScopeBadgeColor(
                            role.scope
                          )}`}
                        >
                          {role.scope.charAt(0).toUpperCase() + role.scope.slice(1)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-gray-600 dark:text-gray-400 max-w-md truncate">
                          {role.description || "—"}
                        </p>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          {new Date(role.created_at).toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="relative inline-block">
                          <button
                            onClick={() =>
                              setActiveDropdown(activeDropdown === role.id ? null : role.id)
                            }
                            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                          >
                            <MoreVertical size={18} className="text-gray-600 dark:text-gray-400" />
                          </button>

                          {activeDropdown === role.id && (
                            <>
                              <div
                                className="fixed inset-0 z-10"
                                onClick={() => setActiveDropdown(null)}
                              />
                              <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-20">
                                <button
                                  onClick={() => {
                                    setEditing(role);
                                    setForm({
                                      name: role.name,
                                      scope: role.scope,
                                      description: role.description || "",
                                    });
                                    setShowModal(true);
                                    setActiveDropdown(null);
                                  }}
                                  disabled={role.is_system}
                                  className="w-full px-4 py-2 text-left text-sm flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  <Edit size={16} className="text-blue-600 dark:text-blue-400" />
                                  <span className="text-gray-700 dark:text-gray-300">Edit Role</span>
                                </button>
                                <button
                                  onClick={() => deleteRole(role.id, role.is_system)}
                                  disabled={role.is_system}
                                  className="w-full px-4 py-2 text-left text-sm flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  <Trash2 size={16} className="text-red-600 dark:text-red-400" />
                                  <span className="text-gray-700 dark:text-gray-300">Delete Role</span>
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

          {/* Table Footer with Count */}
          {filteredRoles.length > 0 && (
            <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Showing <span className="font-medium text-gray-900 dark:text-white">{filteredRoles.length}</span> of{" "}
                <span className="font-medium text-gray-900 dark:text-white">{roles.length}</span> roles
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
                  {editing ? "Edit Role" : "Create New Role"}
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {editing ? "Update role details" : "Define a new role for your organization"}
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
                  Role Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g., manager, team_lead, analyst"
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 dark:focus:ring-orange-400"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
                <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                  Use lowercase with underscores (e.g., team_lead)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Scope <span className="text-red-500">*</span>
                </label>
                <select
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500 dark:focus:ring-orange-400"
                  value={form.scope}
                  onChange={(e) => setForm({ ...form, scope: e.target.value })}
                >
                  <option value="org">Organization</option>
                  <option value="group">Group</option>
                  <option value="team">Team</option>
                  <option value="project">Project</option>
                </select>
                <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                  Define where this role can be applied
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Description
                </label>
                <textarea
                  placeholder="Describe the purpose and responsibilities of this role..."
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 dark:focus:ring-orange-400 resize-none"
                  rows={4}
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
                disabled={!form.name.trim()}
                className="px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg flex items-center gap-2 transition-colors shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                <Save size={18} />
                {editing ? "Update Role" : "Create Role"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}