"use client";

import { useEffect, useState, useMemo } from "react";
import { X, UserPlus, CheckSquare, Square, Loader2, Search, AlertCircle, CheckCircle2 } from "lucide-react";
import UserModel from "@/models/postGresModels/userModel";
import GroupModel from "@/models/postGresModels/groupModel";
import { useUser } from "@/providers/postGresPorviders/UserProvider";

export default function AddGroupMemberModal({
  isOpen,
  onClose,
  group,
  orgId,
  onMemberAdded,
  existingMemberIds = [],
}) {
  const { user: currentUser } = useUser();

  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  const [selectedUids, setSelectedUids] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (!isOpen || !orgId) return;

    const fetchUsers = async () => {
      try {
        setLoadingUsers(true);
        setError("");
        setSuccess("");
        setSelectedUids(new Set());
        setSearchQuery("");

        const data = await UserModel.listActiveByOrg(orgId);

        const filtered = existingMemberIds.length
          ? data.filter((u) => !existingMemberIds.includes(u.uid))
          : data;

        setUsers(filtered);
      } catch (err) {
        console.error("[AddGroupMemberModal] load users error:", err);
        setError(err.message || "Failed to load users");
      } finally {
        setLoadingUsers(false);
      }
    };

    fetchUsers();
  }, [isOpen, orgId, existingMemberIds]);

  const handleClose = () => {
    if (submitting) return;
    setError("");
    setSuccess("");
    setSelectedUids(new Set());
    setSearchQuery("");
    onClose?.();
  };

  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return users;
    const query = searchQuery.toLowerCase();
    return users.filter((u) => {
      const displayName = (u.display_name || u.email || u.uid).toLowerCase();
      const email = (u.email || "").toLowerCase();
      return displayName.includes(query) || email.includes(query);
    });
  }, [users, searchQuery]);

  const allSelectableUids = useMemo(
    () => filteredUsers.map((u) => u.uid),
    [filteredUsers]
  );

  const allSelected = useMemo(() => {
    if (!filteredUsers.length) return false;
    return allSelectableUids.every((uid) => selectedUids.has(uid));
  }, [filteredUsers, allSelectableUids, selectedUids]);

  const selectedCount = selectedUids.size;

  const toggleUser = (uid) => {
    setSelectedUids((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedUids((prev) => {
      if (allSelected) {
        return new Set();
      }
      return new Set(allSelectableUids);
    });
  };

  const handleAddSelected = async (e) => {
    e?.preventDefault?.();

    if (!group?.id) {
      setError("Invalid group");
      return;
    }
    if (!currentUser?.uid) {
      setError("Current user not loaded");
      return;
    }
    if (!selectedCount) {
      setError("Please select at least one user");
      return;
    }

    try {
      setSubmitting(true);
      setError("");
      setSuccess("");

      const userUids = Array.from(selectedUids);

      let members;
      if (typeof GroupModel.bulkAddMembers === "function") {
        members = await GroupModel.bulkAddMembers(
          group.id,
          userUids,
          currentUser.uid,
          undefined
        );
      } else {
        members = [];
        for (const uid of userUids) {
          const m = await GroupModel.addMember(
            group.id,
            uid,
            undefined,
            currentUser.uid
          );
          members.push(m);
        }
      }

      setSuccess(`Added ${members.length || userUids.length} member(s) to group`);

      if (onMemberAdded) {
        onMemberAdded(members);
      }

      setTimeout(() => {
        handleClose();
      }, 1000);
    } catch (err) {
      console.error("[AddGroupMemberModal] add selected error:", err);
      setError(err.message || "Failed to add selected members");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-2xl mx-4 rounded-2xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center gap-4 p-6 border-b border-slate-200 dark:border-slate-800 flex-shrink-0">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700 flex items-center justify-center shadow-lg flex-shrink-0">
            <UserPlus className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">
              Add Members to Group
            </h2>
            {group?.name && (
              <p className="text-sm text-slate-600 dark:text-slate-400 truncate">
                {group.name}
              </p>
            )}
          </div>
          <button
            onClick={handleClose}
            disabled={submitting}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Info Banner */}
        <div className="px-6 pt-4 flex-shrink-0">
          <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 rounded-lg p-3 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-blue-700 dark:text-blue-300">
              Each selected user will get a <span className="font-semibold">group role equal to their organisation role</span>.
            </p>
          </div>
        </div>

        {/* Search and Selection Controls */}
        <div className="px-6 pt-4 flex-shrink-0">
          <div className="flex items-center gap-3 mb-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-600 focus:border-transparent text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500"
              />
            </div>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={toggleSelectAll}
              disabled={loadingUsers || !filteredUsers.length}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {allSelected ? (
                <CheckSquare className="w-4 h-4" />
              ) : (
                <Square className="w-4 h-4" />
              )}
              {allSelected ? "Unselect all" : "Select all"}
            </button>
            <span className="text-sm text-slate-600 dark:text-slate-400 font-medium">
              {selectedCount} selected
            </span>
          </div>
        </div>

        {/* User List */}
        <div className="flex-1 min-h-0 px-6 py-4">
          <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden h-full flex flex-col bg-slate-50 dark:bg-slate-900/50">
            {loadingUsers ? (
              <div className="flex-1 flex items-center justify-center py-12">
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-600 dark:text-blue-400" />
                  <p className="text-sm text-slate-600 dark:text-slate-400">Loading users...</p>
                </div>
              </div>
            ) : !filteredUsers.length ? (
              <div className="flex-1 flex items-center justify-center py-12">
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center">
                    <UserPlus className="w-8 h-8 text-slate-400 dark:text-slate-600" />
                  </div>
                  <h3 className="text-sm font-medium text-slate-900 dark:text-slate-50 mb-1">
                    {searchQuery ? "No users found" : "No available users"}
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {searchQuery ? "Try adjusting your search" : "All users are already members"}
                  </p>
                </div>
              </div>
            ) : (
              <div className="overflow-y-auto flex-1">
                {filteredUsers.map((u) => {
                  const checked = selectedUids.has(u.uid);
                  const displayName = u.display_name || u.email || u.uid || "Unknown User";
                  const initials = (displayName || "U")
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .toUpperCase()
                    .slice(0, 2);

                  return (
                    <label
                      key={u.uid}
                      className={`flex items-center gap-3 px-4 py-3 border-b border-slate-200 dark:border-slate-800 last:border-b-0 hover:bg-white dark:hover:bg-slate-800 cursor-pointer transition-colors ${
                        checked ? "bg-blue-50 dark:bg-blue-950/30" : ""
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-600 dark:bg-slate-800 cursor-pointer"
                        checked={checked}
                        onChange={() => toggleUser(u.uid)}
                      />

                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center text-white font-medium text-sm flex-shrink-0">
                        {initials}
                      </div>

                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-medium text-slate-900 dark:text-slate-50 truncate">
                          {displayName}
                        </h4>
                        {u.email && (
                          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                            {u.email}
                          </p>
                        )}
                      </div>

                      {u.role && (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex-shrink-0">
                          {String(u.role)}
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Messages */}
        {(error || success) && (
          <div className="px-6 pb-4 flex-shrink-0">
            {error && (
              <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-lg p-3 flex items-start gap-2 animate-in fade-in slide-in-from-top-2 duration-200">
                <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700 dark:text-red-300 flex-1">{error}</p>
              </div>
            )}
            {success && (
              <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 rounded-lg p-3 flex items-start gap-2 animate-in fade-in slide-in-from-top-2 duration-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-emerald-700 dark:text-emerald-300 flex-1">{success}</p>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 p-6 border-t border-slate-200 dark:border-slate-800 flex-shrink-0">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {filteredUsers.length} {filteredUsers.length === 1 ? 'user' : 'users'} available
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={submitting}
              className="px-4 py-2 rounded-lg text-sm border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAddSelected}
              disabled={submitting || !selectedCount || loadingUsers}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700 text-white font-medium disabled:bg-slate-300 dark:disabled:bg-slate-700 disabled:cursor-not-allowed transition-colors shadow-sm"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  Add {selectedCount > 0 && `(${selectedCount})`}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}