import React, { useState } from "react";
import { Search, X, Archive, Trash2, Users, Info } from "lucide-react";
import { FiPlus } from "react-icons/fi";

export function ProjectsToolbar({
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  onlyMine,
  onOnlyMineChange,
  selectedCount,
  onClearSelection,
  onBulkArchive,
  onBulkDelete,
  handleCreateProject,
  canCreate = true, // ✅ New prop - defaults to true for backward compatibility
  loading
}) {
  const [showDirectoryHelp, setShowDirectoryHelp] = useState(false);

  return (
    <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Users className="w-6 h-6 text-orange-600" />
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">Directories</h1>
            <button
              type="button"
              onClick={() => setShowDirectoryHelp((prev) => !prev)}
              aria-label="What is a directory?"
              aria-expanded={showDirectoryHelp}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-orange-200 bg-orange-50 text-orange-700 transition hover:bg-orange-100"
            >
              <Info className="h-4 w-4" />
            </button>
          </div>
        </div>
        
        {selectedCount > 0 ? (
          // Bulk action buttons
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">
              {selectedCount} selected
            </span>
            <button
              onClick={onClearSelection}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
            >
              <X className="w-4 h-4" />
            </button>
            <button
              onClick={onBulkArchive}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded text-sm font-medium text-gray-700"
            >
              <Archive className="w-4 h-4" />
              Archive
            </button>
            <button
              onClick={onBulkDelete}
              className="flex items-center gap-2 px-4 py-2 bg-red-100 hover:bg-red-200 rounded text-sm font-medium text-red-700"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          </div>
        ) : (
          // Create button - only show if user has permission
          canCreate && handleCreateProject && (
            <div className="flex items-center">
              <button
                onClick={handleCreateProject}
                disabled={loading}
                className={`px-2 h-8 rounded-md flex justify-center items-center gap-2 text-white transition-all duration-300 text-sm ${
                  loading
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-[#ED7A13] shadow-md shadow-orange-500/25 hover:scale-105"
                }`}
              >
                <FiPlus className="text-md" /> Create New Directory
              </button>
            </div>
          )
        )}
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[280px]">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search directories..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          />
          {search && (
            <button
              onClick={() => onSearchChange("")}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        <select
          value={statusFilter}
          onChange={(e) => onStatusFilterChange(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent min-w-[150px]"
        >
          <option value="all">All Status</option>
          <option value="active">Active Only</option>
          <option value="dormant">Dormant Only</option>
        </select>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={onlyMine}
            onChange={(e) => onOnlyMineChange(e.target.checked)}
            className="w-4 h-4 text-orange-600 rounded focus:ring-2 focus:ring-orange-500"
          />
          <span className="text-sm font-medium text-gray-700">My Directories</span>
        </label>
      </div>

      {showDirectoryHelp && (
        <div className="mt-4 rounded-xl border border-orange-200 bg-gradient-to-r from-orange-50 to-amber-50 p-4 text-sm text-gray-700">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">
                How to use directories
              </h2>
              <p className="mt-1">
                A directory is a collection of surveys grouped around one shared intent,
                such as one company, one client account, one product line, one research
                topic, or one campaign theme.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowDirectoryHelp(false)}
              aria-label="Close directory help"
              className="rounded-md p-1 text-gray-500 transition hover:bg-white hover:text-gray-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <div className="rounded-lg bg-white/80 p-3">
              <p className="font-medium text-gray-900">Create one when</p>
              <p className="mt-1">
                multiple surveys belong to the same business goal and should stay together.
              </p>
            </div>
            <div className="rounded-lg bg-white/80 p-3">
              <p className="font-medium text-gray-900">Good examples</p>
              <p className="mt-1">
                Acme customer feedback, hiring interviews, NPS tracking, or a healthcare
                topic study.
              </p>
            </div>
            <div className="rounded-lg bg-white/80 p-3">
              <p className="font-medium text-gray-900">Avoid this</p>
              <p className="mt-1">
                creating a new directory for every small survey if it belongs to an existing
                company or topic.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ✅ Show permission notice if user can't create */}
      {!canCreate && !selectedCount && (
        <div className="mt-4 px-4 py-2 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
          <span className="font-medium">Note:</span> You don't have permission to create new directories. Contact your organization administrator to request access.
        </div>
      )}
    </div>
  );
}
