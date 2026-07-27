"use client";

import React, { useEffect, useState, useRef } from "react";
import { 
  Users as UsersIcon, 
  UserPlus, 
  Search, 
  Filter,
  MoreVertical,
  Shield,
  Mail,
  Calendar,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  AlertCircle
} from "lucide-react";
import { useUser } from "@/providers/postGresPorviders/UserProvider";
import { useRBAC } from "@/providers/RBACProvider";
import { useOrganisation } from "@/providers/postGresPorviders/organisationProvider";

import AddUserModal from "./AddUser";
import UserAccessManager from "@/components/rbac/UserAccessManager";

export default function UsersPage() {
  const { organisation } = useOrganisation();
  const { user, getUsersByOrg, deleteUser } = useUser();
  const { listUserRoles, hasCapability } = useRBAC();

  const orgId = organisation?.org_id;

  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [rolesMap, setRolesMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [activeUser, setActiveUser] = useState(null);
  
  // Search & Filter
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // CRITICAL FIX: Track if we've loaded to prevent duplicate calls
  const hasLoadedRef = useRef(false);
  const isLoadingRef = useRef(false);

  // Load users + roles - FIXED VERSION
  useEffect(() => {
    if (!orgId) return;
    if (hasLoadedRef.current) return; // Only load once
    if (isLoadingRef.current) return; // Prevent concurrent loads

    const load = async () => {
      isLoadingRef.current = true;
      
      try {
        setLoading(true);
        console.log("[UsersPage] Loading users for org:", orgId);

        const usersList = await getUsersByOrg(orgId);

        const roleEntries = await Promise.all(
          usersList.map(async (u) => {
            try {
              const roles = await listUserRoles(u.uid, orgId);
              return [u.uid, roles || []];
            } catch (err) {
              console.error(`Failed to load roles for ${u.uid}:`, err);
              return [u.uid, []];
            }
          })
        );

        setUsers(usersList || []);
        setFilteredUsers(usersList || []);
        setRolesMap(Object.fromEntries(roleEntries));
        hasLoadedRef.current = true; // Mark as loaded
      } catch (err) {
        console.error("Failed to load users / roles", err);
      } finally {
        setLoading(false);
        isLoadingRef.current = false;
      }
    };

    load();
  }, [orgId]); // REMOVED unstable function dependencies

  // Search & Filter logic
  useEffect(() => {
    let filtered = users;

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(
        (u) =>
          u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          u.display_name?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter((u) => u.status === statusFilter);
    }

    setFilteredUsers(filtered);
  }, [searchTerm, statusFilter, users]);

  const getStatusBadge = (status) => {
    const variants = {
      active: {
        bg: "bg-green-100 dark:bg-green-900/20",
        text: "text-green-700 dark:text-green-400",
        icon: CheckCircle,
      },
      inactive: {
        bg: "bg-gray-100 dark:bg-gray-800",
        text: "text-gray-700 dark:text-gray-400",
        icon: XCircle,
      },
      suspended: {
        bg: "bg-red-100 dark:bg-red-900/20",
        text: "text-red-700 dark:text-red-400",
        icon: XCircle,
      },
      pending: {
        bg: "bg-yellow-100 dark:bg-yellow-900/20",
        text: "text-yellow-700 dark:text-yellow-400",
        icon: Clock,
      },
    };

    const variant = variants[status] || variants.inactive;
    const Icon = variant.icon;

    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${variant.bg} ${variant.text}`}
      >
        <Icon size={12} />
        {status}
      </span>
    );
  };

  const handleRefresh = async () => {
    if (!orgId) return;
    if (isLoadingRef.current) return; // Prevent concurrent refreshes
    
    isLoadingRef.current = true;
    setLoading(true);
    
    try {
      console.log("[UsersPage] Refreshing users");
      const usersList = await getUsersByOrg(orgId);
      const roleEntries = await Promise.all(
        usersList.map(async (u) => {
          try {
            const roles = await listUserRoles(u.uid, orgId);
            return [u.uid, roles || []];
          } catch {
            return [u.uid, []];
          }
        })
      );

      setUsers(usersList || []);
      setFilteredUsers(usersList || []);
      setRolesMap(Object.fromEntries(roleEntries));
    } catch (err) {
      console.error("Refresh failed:", err);
    } finally {
      setLoading(false);
      isLoadingRef.current = false;
    }
  };
const handleDeleteUser = async (targetUser) => {
  if (!targetUser?.uid) return;

  // Prevent self-delete from UI
  if (targetUser.uid === user?.uid) {
    alert("You cannot delete your own account.");
    return;
  }

  const confirmText = `DELETE`;
  const input = prompt(
    `This action is irreversible.\n\nType "${confirmText}" to confirm deletion:`
  );

  if (input !== confirmText) return;

  try {
    await deleteUser(targetUser.uid);
    await handleRefresh();
  } catch (err) {
    console.error("Failed to delete user:", err);
    alert("Failed to delete user");
  }
};

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen space-y-4">
        <Loader2 className="animate-spin text-orange-500" size={40} />
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Loading users...
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <UsersIcon className="text-orange-500" size={28} />
            Team Members
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Manage users, roles, and permissions for your organization
          </p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors font-medium"
        >
          <UserPlus size={18} />
          Add User
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
              <UsersIcon className="text-blue-600 dark:text-blue-400" size={20} />
            </div>
            <div>
              <p className="text-2xl font-bold">{users.length}</p>
              <p className="text-xs text-gray-600 dark:text-gray-400">Total Users</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-lg">
              <CheckCircle className="text-green-600 dark:text-green-400" size={20} />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {users.filter((u) => u.status === "active").length}
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400">Active</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 dark:bg-yellow-900/20 rounded-lg">
              <Clock className="text-yellow-600 dark:text-yellow-400" size={20} />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {users.filter((u) => u.status === "pending").length}
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400">Pending</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 dark:bg-red-900/20 rounded-lg">
              <XCircle className="text-red-600 dark:text-red-400" size={20} />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {users.filter((u) => u.status === "suspended").length}
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400">Suspended</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="relative flex-1">
            <Search
              className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
              size={18}
            />
            <input
              type="text"
              placeholder="Search by name or email..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <Filter size={18} className="text-gray-400" />
            <select
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="pending">Pending</option>
              <option value="suspended">Suspended</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>

        {/* Results Count */}
        <div className="mt-3 text-sm text-gray-600 dark:text-gray-400">
          Showing {filteredUsers.length} of {users.length} users
        </div>
      </div>

      {/* Users Table */}
      {filteredUsers.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-12">
          <div className="text-center space-y-3">
            <div className="flex justify-center">
              <div className="p-4 bg-gray-100 dark:bg-gray-700 rounded-full">
                <AlertCircle className="text-gray-400" size={32} />
              </div>
            </div>
            <h3 className="text-lg font-semibold">No users found</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {searchTerm || statusFilter !== "all"
                ? "Try adjusting your search or filters"
                : "Get started by adding your first team member"}
            </p>
            {!searchTerm && statusFilter === "all" && (
              <button
                onClick={() => setShowAdd(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors font-medium"
              >
                <UserPlus size={18} />
                Add Your First User
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-750 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Roles
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Joined
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredUsers.map((u) => (
                  <tr
                    key={u.uid}
                    className="hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
                  >
                    {/* User Info */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex-shrink-0">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-pink-500 flex items-center justify-center text-white font-semibold">
                            {(u.display_name || u.email || "?")
                              .charAt(0)
                              .toUpperCase()}
                          </div>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-gray-900 dark:text-gray-100 truncate">
                            {u.display_name || "—"}
                          </div>
                          <div className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400 truncate">
                            <Mail size={12} />
                            {u.email}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-6 py-4">
                      {getStatusBadge(u.status)}
                    </td>

                    {/* Roles */}
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1.5">
                        {(rolesMap[u.uid] || []).length === 0 ? (
                          <span className="text-sm text-gray-500 dark:text-gray-400">
                            No roles
                          </span>
                        ) : (
                          (rolesMap[u.uid] || []).map((r) => (
                            <span
                              key={r.id}
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 rounded"
                            >
                              <Shield size={10} />
                              {r.role_name}
                            </span>
                          ))
                        )}
                      </div>
                    </td>

                    {/* Joined Date */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400">
                        <Calendar size={14} />
                        {u.joined_at
                          ? new Date(u.joined_at).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })
                          : "—"}
                      </div>
                    </td>

                <td className="px-6 py-4 text-right">
  <div className="relative inline-flex gap-2">
    <button
      onClick={() => setActiveUser(u)}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-lg transition-colors"
    >
      <Shield size={14} />
      Manage
    </button>

  {hasCapability("user.delete") && (
  <button
    onClick={() => handleDeleteUser(u)}
    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg"
  >
    <XCircle size={14} />
    Delete
  </button>
)}

  </div>
</td>

                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add User Modal */}
      {showAdd && (
        <AddUserModal
          orgId={orgId}
          userId={user?.uid}
          onClose={() => setShowAdd(false)}
          onCreated={() => {
            setShowAdd(false);
            handleRefresh();
          }}
        />
      )}

      {/* User Access Manager */}
      {activeUser && (
        <UserAccessManager
          user={activeUser}
          orgId={orgId}
          onClose={() => {
            setActiveUser(null);
          }}
        />
      )}
    </div>
  );
}