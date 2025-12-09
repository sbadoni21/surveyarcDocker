// app/en/dashboard/groups/page.jsx
"use client";

import { useEffect, useState } from "react";
import { PlusCircle } from "lucide-react";
import { useUser } from "@/providers/postGresPorviders/UserProvider";
import { useGroups } from "@/providers/postGresPorviders/GroupProvider";
import CreateGroupModal from "@/components/team/CreateGroupModal";
import GroupListCard from "@/components/team/GroupListCard";

export default function GroupsPage() {
  const { user } = useUser();
  const { groups, loadGroups, loading } = useGroups();

  const [orgId, setOrgId] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

  // Derive orgId from user (first org)
  useEffect(() => {
    if (user?.org_ids?.length) {
      setOrgId(user.org_ids[0]);
      loadGroups(user.org_ids[0]);
    }
  }, [user, loadGroups]);

  const handleCreated = async () => {
    if (orgId) {
      await loadGroups(orgId);
    }
  };

  return (
    <div className="min-h-screen px-6 py-6 bg-gray-50 dark:bg-[#020617]">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold text-gray-900 dark:text-gray-100">
              User Groups
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Create logical groups of users for permissions, workflows and campaigns.
            </p>
          </div>

          <button
            onClick={() => setModalOpen(true)}
            disabled={!orgId}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium shadow-sm hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            <PlusCircle size={18} />
            <span>Create Group</span>
          </button>
        </div>

        {/* Content */}
        <div className="bg-white dark:bg-[#020617] border border-gray-200 dark:border-gray-800 rounded-2xl p-5 shadow-sm">
          {loading && (
            <div className="py-10 text-center text-sm text-gray-500 dark:text-gray-400">
              Loading groups...
            </div>
          )}

          {!loading && (!groups || groups.length === 0) && (
            <div className="py-10 text-center">
              <p className="text-gray-700 dark:text-gray-200 font-medium">
                No groups created yet
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Use “Create Group” to add your first group.
              </p>
            </div>
          )}

          {!loading && groups && groups.length > 0 && (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {groups.map((group) => (
                <GroupListCard key={group.id} group={group} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create Group Modal */}
      {modalOpen && orgId && (
        <CreateGroupModal
          orgId={orgId}          // 👈 passed but NOT shown in UI
          onClose={() => setModalOpen(false)}
          onCreated={handleCreated}
        />
      )}
    </div>
  );
}
