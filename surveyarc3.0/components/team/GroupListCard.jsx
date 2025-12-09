// components/groups/GroupListCard.jsx
"use client";

import { useRouter } from "next/navigation";
import { Users, ArrowRight } from "lucide-react";

export default function GroupListCard({ group }) {
  const router = useRouter();

  const handleManage = () => {
    router.push(`./groups/${group.id}`);
  };

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#020617] p-4 shadow-sm flex flex-col justify-between">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
            <Users size={18} className="text-blue-600 dark:text-blue-200" />
          </div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
            {group.group_name}
          </h3>
        </div>

        {group.description && (
          <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-3 mb-2">
            {group.description}
          </p>
        )}

        <span className="inline-flex items-center px-2 py-1 rounded-full text-[10px] font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
          {group.group_type || "custom"}
        </span>
      </div>

      <div className="mt-4 flex justify-between items-center">
        <p className="text-[11px] text-gray-500 dark:text-gray-400">
          {group.members_count != null
            ? `${group.members_count} member${group.members_count === 1 ? "" : "s"}`
            : ""}
        </p>
        <button
          onClick={handleManage}
          className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:underline"
        >
          Manage Members
          <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}
