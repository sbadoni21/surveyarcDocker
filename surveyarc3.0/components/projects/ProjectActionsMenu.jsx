import React, { useState } from "react";
import { MoreVertical, Star, Users, Clock, Edit, Trash2, RefreshCw } from "lucide-react";

export function ProjectActionsMenu({
  project,
  canManage,
  onToggleFavorite,
  onOpenMembers,
  onOpenTimeline,
  onEdit,
  onDelete,
  onStatusChanged,
  onRecomputed,
}) {
  const [isOpen, setIsOpen] = useState(false);

  const handleAction = (action) => {
    setIsOpen(false);
    action();
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
      >
        <MoreVertical className="w-5 h-5 text-gray-600" />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-20">
            <div className="py-1">
              <button
                onClick={() => handleAction(onToggleFavorite)}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
              >
                <Star className="w-4 h-4" />
                Toggle Favorite
              </button>

              <button
                onClick={() => handleAction(onOpenMembers)}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
              >
                <Users className="w-4 h-4" />
                Manage Team
              </button>

              <button
                onClick={() => handleAction(onOpenTimeline)}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
              >
                <Clock className="w-4 h-4" />
                View Timeline
              </button>

              {canManage && (
                <>
                  <div className="border-t border-gray-200 my-1" />

                  <button
                    onClick={() => handleAction(onEdit)}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                  >
                    <Edit className="w-4 h-4" />
                    Edit Directory
                  </button>

                  <button
                    onClick={() => handleAction(onRecomputed)}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Recompute Progress
                  </button>

                  <button
                    onClick={() => handleAction(onDelete)}
                    className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete Directory
                  </button>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}