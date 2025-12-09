import React from "react";
import { Search, X, Archive, Trash2, Users } from "lucide-react";

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
}) {
  return (
    <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Users className="w-6 h-6 text-blue-600" />
          <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
        </div>

        {selectedCount > 0 && (
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
        )}
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[280px]">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search projects..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent min-w-[150px]"
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
            className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
          />
          <span className="text-sm font-medium text-gray-700">My Projects</span>
        </label>
      </div>
    </div>
  );
}