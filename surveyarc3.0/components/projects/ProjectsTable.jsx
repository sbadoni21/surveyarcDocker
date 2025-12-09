import React from "react";
import { ArrowUpDown, Star, Lock, Tag, X } from "lucide-react";
import { TeamMembers } from "./TeamMembers";
import { ProjectActionsMenu } from "./ProjectActionsMenu";
import { timeformater } from "@/utils/timeformater";
import { StatusChip } from "@/utils/StatusChip";

export function ProjectsTable({
  rows,
  order,
  orderBy,
  onRequestSort,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  favorites,
  onToggleFavorite,
  projectOverrides,
  canEnter,
  canManageProject,
  onEnter,
  editingTags,
  tagInput,
  onTagInputChange,
  onStartEditTags,
  onStopEditTags,
  onAddTag,
  onRemoveTag,
  byUid,
  onOpenMembers,
  onOpenTimeline,
  onEdit,
  onDelete,
  onStatusChanged,
  onRecomputed,
  totalCount,
}) {
  const allSelected = selectedIds.size === totalCount && totalCount > 0;
  const someSelected = selectedIds.size > 0 && selectedIds.size < totalCount;

  const SortButton = ({ property, children }) => {
    const isActive = orderBy === property;
    return (
      <button
        onClick={() => onRequestSort(property)}
        className="flex items-center gap-1 font-semibold text-gray-700 hover:text-gray-900"
      >
        {children}
        <ArrowUpDown className={`w-4 h-4 ${isActive ? "text-blue-600" : "text-gray-400"}`} />
      </button>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="w-12 px-4 py-3">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someSelected;
                  }}
                  onChange={(e) => onSelectAll(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                />
              </th>
              <th className="px-4 py-3 text-left">
                <SortButton property="name">Project</SortButton>
              </th>
              <th className="px-4 py-3 text-left">
                <span className="font-semibold text-gray-700">Tags</span>
              </th>
              <th className="px-4 py-3 text-left">
                <SortButton property="is_active">Status</SortButton>
              </th>
              <th className="px-4 py-3 text-left">
                <SortButton property="members">Team</SortButton>
              </th>
              <th className="px-4 py-3 text-left">
                <SortButton property="lastActivity">Last Activity</SortButton>
              </th>
              <th className="px-4 py-3 text-right">
                <span className="font-semibold text-gray-700">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {rows.map((p) => {
              const pid = p.projectId;
              const effective = projectOverrides[pid] ? { ...p, ...projectOverrides[pid] } : p;
              const allowed = canEnter(effective);
              const canManage = canManageProject(effective);
              const isFav = favorites.has(pid);
              const isEditing = editingTags === pid;

              return (
                <tr
                  key={pid}
                  className={`hover:bg-gray-50 transition-colors ${
                    allowed ? "cursor-pointer" : "opacity-60"
                  }`}
                  onClick={() => allowed && onEnter(effective)}
                >
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(pid)}
                      onChange={() => onToggleSelect(pid)}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                    />
                  </td>

                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleFavorite(pid);
                        }}
                        className="text-gray-400 hover:text-yellow-500 transition-colors"
                      >
                        {isFav ? (
                          <Star className="w-5 h-5 fill-yellow-500 text-yellow-500" />
                        ) : (
                          <Star className="w-5 h-5" />
                        )}
                      </button>
                      {!allowed && <Lock className="w-4 h-4 text-gray-400" />}
                      <div>
                        <div className="font-medium text-gray-900">{effective.name}</div>
                        <div className="text-xs text-gray-500">{pid}</div>
                      </div>
                    </div>
                  </td>

                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    {isEditing ? (
                      <div className="flex flex-wrap gap-1 items-center">
                        {(effective.tags || []).map((t) => (
                          <span
                            key={t}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded"
                          >
                            {t}
                            <button
                              onClick={() => onRemoveTag(pid, t)}
                              className="hover:text-blue-900"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                        <input
                          type="text"
                          value={tagInput}
                          onChange={(e) => onTagInputChange(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              onAddTag(pid, tagInput);
                            } else if (e.key === "Escape") {
                              onStopEditTags();
                            }
                          }}
                          onBlur={onStopEditTags}
                          autoFocus
                          placeholder="Add tag..."
                          className="w-32 px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                    ) : (
                      <div
                        onClick={() => canManage && onStartEditTags(pid)}
                        className={canManage ? "cursor-pointer" : ""}
                      >
                        {(effective.tags || []).length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {(effective.tags || []).slice(0, 3).map((t) => (
                              <span
                                key={t}
                                className="inline-flex items-center px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded"
                              >
                                {t}
                              </span>
                            ))}
                            {(effective.tags?.length || 0) > 3 && (
                              <span className="inline-flex items-center px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                                +{(effective.tags?.length || 0) - 3}
                              </span>
                            )}
                            {canManage && (
                              <Tag className="w-4 h-4 text-gray-400" />
                            )}
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400 italic">
                            {canManage ? "Click to add tags" : "No tags"}
                          </span>
                        )}
                      </div>
                    )}
                  </td>

                  <td className="px-4 py-3">
                    <StatusChip status={effective.status} />
                  </td>

                  <td className="px-4 py-3">
                    <TeamMembers
                      members={effective.members || []}
                      byUid={byUid}
                    />
                  </td>

                  <td className="px-4 py-3">
                    <span className="text-sm text-gray-600">
                      {effective.lastActivity ? timeformater(effective.lastActivity) : "—"}
                    </span>
                  </td>

                  <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    <ProjectActionsMenu
                      project={effective}
                      canManage={canManage}
                      onToggleFavorite={() => onToggleFavorite(pid)}
                      onOpenMembers={() => onOpenMembers(effective)}
                      onOpenTimeline={() => onOpenTimeline(effective)}
                      onEdit={() => onEdit(effective)}
                      onDelete={() => onDelete(pid)}
                      onStatusChanged={() => onStatusChanged(pid)}
                      onRecomputed={() => onRecomputed(pid)}
                    />
                  </td>
                </tr>
              );
            })}

            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center">
                  <div className="text-gray-400">
                    <div className="text-lg font-medium mb-1">No projects found</div>
                    <div className="text-sm">
                      Try adjusting your search or filters
                    </div>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}