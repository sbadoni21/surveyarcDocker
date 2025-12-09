"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams } from "next/navigation";
import GroupModel from "@/models/postGresModels/groupModel";
import { useUser } from "@/providers/postGresPorviders/UserProvider";
import AddGroupMemberModal from "@/components/team/AddGroupMemberModal";
import { Trash2, CheckSquare, Square, Loader2, Users, UserPlus, AlertCircle, CheckCircle2, Search, X } from "lucide-react";
import Link from "next/link";

export default function GroupDetailPage() {
  const params = useParams();
  const groupId = params?.groupId;

  const {
    user: currentUser,
    getActiveUsersByOrg,
  } = useUser();

  const [group, setGroup] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [selectedUids, setSelectedUids] = useState(new Set());
  const [removing, setRemoving] = useState(false);

  const [orgUsers, setOrgUsers] = useState([]);
  const [loadingOrgUsers, setLoadingOrgUsers] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");

  const orgUsersMap = useMemo(() => {
    const m = {};
    for (const u of orgUsers || []) {
      if (u?.uid) m[u.uid] = u;
    }
    return m;
  }, [orgUsers]);

  useEffect(() => {
    if (!groupId || !currentUser?.uid) return;

    const load = async () => {
      try {
        setLoading(true);
        setError("");
        setSuccess("");
        setSelectedUids(new Set());

        const g = await GroupModel.get(groupId, currentUser.uid);
        setGroup(g);

        const m = await GroupModel.listMembers(groupId, currentUser.uid);
        setMembers(m || []);
      } catch (err) {
        console.error("[GroupDetailPage] load error:", err);
        setError(err.message || "Failed to load group");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [groupId, currentUser?.uid]);

  useEffect(() => {
    const loadOrgUsers = async () => {
      if (!group?.org_id || !getActiveUsersByOrg) return;
      try {
        setLoadingOrgUsers(true);
        const users = await getActiveUsersByOrg(group.org_id);
        setOrgUsers(users || []);
      } catch (err) {
        console.error("[GroupDetailPage] load org users error:", err);
      } finally {
        setLoadingOrgUsers(false);
      }
    };

    loadOrgUsers();
  }, [group?.org_id, getActiveUsersByOrg]);

  const handleMemberAdded = (member) => {
    setMembers((prev) => [member, ...prev]);
    setSuccess("Member added to group");
    setTimeout(() => setSuccess(""), 3000);
  };

  const toggleOne = (uid) => {
    setSelectedUids((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  };

  const filteredMembers = useMemo(() => {
    if (!searchQuery.trim()) return members;
    const query = searchQuery.toLowerCase();
    return members.filter((m) => {
      const u = orgUsersMap[m.user_uid];
      const displayName = u?.display_name || u?.name || u?.email || m.user_uid;
      const email = u?.email || "";
      return displayName.toLowerCase().includes(query) || email.toLowerCase().includes(query);
    });
  }, [members, searchQuery, orgUsersMap]);

  const allMemberUids = filteredMembers.map((m) => m.user_uid);
  const allSelected =
    filteredMembers.length > 0 && allMemberUids.every((uid) => selectedUids.has(uid));
  const selectedCount = selectedUids.size;

  const toggleAll = () => {
    setSelectedUids((prev) => {
      if (allSelected) return new Set();
      return new Set(allMemberUids);
    });
  };

  const handleRemoveOne = async (uid) => {
    if (!groupId || !currentUser?.uid) return;

    try {
      setRemoving(true);
      setError("");
      setSuccess("");

      await GroupModel.removeMember(groupId, uid, currentUser.uid);

      setMembers((prev) => prev.filter((m) => m.user_uid !== uid));
      setSelectedUids((prev) => {
        const next = new Set(prev);
        next.delete(uid);
        return next;
      });

      setSuccess("Member removed from group");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      console.error("[GroupDetailPage] remove one error:", err);
      setError(err.message || "Failed to remove member");
    } finally {
      setRemoving(false);
    }
  };

  const handleBulkRemove = async () => {
    if (!groupId || !currentUser?.uid) return;
    if (!selectedCount) {
      setError("No members selected to remove");
      return;
    }

    try {
      setRemoving(true);
      setError("");
      setSuccess("");

      const uidsToRemove = Array.from(selectedUids);

      if (typeof GroupModel.bulkRemoveMembers === "function") {
        await GroupModel.bulkRemoveMembers(
          groupId,
          uidsToRemove,
          currentUser.uid
        );
      } else {
        for (const uid of uidsToRemove) {
          await GroupModel.removeMember(groupId, uid, currentUser.uid);
        }
      }

      setMembers((prev) =>
        prev.filter((m) => !selectedUids.has(m.user_uid))
      );
      setSelectedUids(new Set());
      setSuccess(`Removed ${uidsToRemove.length} member(s) from group`);
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      console.error("[GroupDetailPage] bulk remove error:", err);
      setError(err.message || "Failed to remove selected members");
    } finally {
      setRemoving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 dark:text-blue-400" />
          <p className="text-sm text-slate-600 dark:text-slate-400">Loading group...</p>
        </div>
      </div>
    );
  }

  if (error && !group) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-xl shadow-lg border border-red-200 dark:border-red-900 p-6">
          <div className="flex items-center gap-3 mb-2">
            <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Error Loading Group</h2>
          </div>
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <p className="text-sm text-slate-500 dark:text-slate-400">Group not found.</p>
      </div>
    );
  }
  const handleBack = () => {
    window.history.back();
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        {/* Header Card */}
        <button onClick={handleBack} >back</button>
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4 flex-1">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700 flex items-center justify-center shadow-lg flex-shrink-0">
                <Users className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50 mb-1">
                  {group.name}
                </h1>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                  {group.description || "No description provided"}
                </p>
                <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
                  <span className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5" />
                    {members.length} {members.length === 1 ? 'member' : 'members'}
                  </span>
                  {loadingOrgUsers && (
                    <span className="flex items-center gap-1.5">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Loading details...
                    </span>
                  )}
                </div>
              </div>
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm hover:shadow-md flex-shrink-0"
            >
              <UserPlus className="w-4 h-4" />
              Add Members
            </button>
          </div>
        </div>

        {/* Alerts */}
        {error && (
          <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-lg p-4 flex items-start gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-medium text-red-900 dark:text-red-200 mb-1">Error</h3>
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            </div>
            <button onClick={() => setError("")} className="text-red-400 hover:text-red-600 dark:text-red-500 dark:hover:text-red-300">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        {success && (
          <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 rounded-lg p-4 flex items-start gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-emerald-900 dark:text-emerald-200">{success}</p>
            </div>
            <button onClick={() => setSuccess("")} className="text-emerald-400 hover:text-emerald-600 dark:text-emerald-500 dark:hover:text-emerald-300">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Members Card */}
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
          {/* Toolbar */}
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3 flex-1 min-w-0 max-w-md">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search members..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-600 focus:border-transparent text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500"
                  />
                </div>
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {filteredMembers.length > 0 && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={toggleAll}
                    disabled={removing}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {allSelected ? (
                      <CheckSquare className="w-4 h-4" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                    {allSelected ? "Unselect all" : "Select all"}
                  </button>

                  <button
                    type="button"
                    onClick={handleBulkRemove}
                    disabled={removing || !selectedCount}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700 text-white text-sm font-medium disabled:bg-slate-300 dark:disabled:bg-slate-700 disabled:cursor-not-allowed transition-colors shadow-sm"
                  >
                    {removing ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                    Remove {selectedCount > 0 && `(${selectedCount})`}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Members List */}
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {filteredMembers.length === 0 ? (
              <div className="p-12 text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                  <Users className="w-8 h-8 text-slate-400 dark:text-slate-600" />
                </div>
                <h3 className="text-sm font-medium text-slate-900 dark:text-slate-50 mb-1">
                  {searchQuery ? "No members found" : "No members yet"}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {searchQuery ? "Try adjusting your search" : "Add members to get started"}
                </p>
              </div>
            ) : (
              <div className="max-h-[600px] overflow-y-auto">
                {filteredMembers.map((m) => {
                  const checked = selectedUids.has(m.user_uid);
                  const u = orgUsersMap[m.user_uid];

                  const displayName =
                    u?.display_name || u?.name || u?.email || m.user_uid || "Unknown";
                  const email = u?.email;
                  const orgRole = u?.role;

                  const initials = (displayName || "U")
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .toUpperCase()
                    .slice(0, 2);

                  return (
                    <div
                      key={`${m.group_id}-${m.user_uid}`}
                      className={`flex items-center gap-4 p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${
                        checked ? "bg-blue-50 dark:bg-blue-950/20" : ""
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-600 dark:bg-slate-800 cursor-pointer"
                        checked={checked}
                        onChange={() => toggleOne(m.user_uid)}
                      />

                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-medium text-sm flex-shrink-0">
                        {initials}
                      </div>

                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-medium text-slate-900 dark:text-slate-50 truncate">
                          {displayName}
                        </h4>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          {email && (
                            <span className="text-xs text-slate-500 dark:text-slate-400 truncate">
                              {email}
                            </span>
                          )}
                          <div className="flex items-center gap-1.5">
                            {orgRole && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                Org: {orgRole}
                              </span>
                            )}
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                              Group: {String(m.role)}
                            </span>
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveOne(m.user_uid)}
                        disabled={removing}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex-shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Remove
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Member Modal */}
      <AddGroupMemberModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        group={group}
        orgId={group.org_id}
        existingMemberIds={members.map((m) => m.user_uid)}
        onMemberAdded={handleMemberAdded}
      />
    </div>
  );
}